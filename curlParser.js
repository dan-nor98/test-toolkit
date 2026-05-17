/**
 * DevToolkit Pro - cURL Parser
 * Converts cURL commands to fetch API calls
 */

class CurlParser {
  /**
   * Parse cURL command and return fetch options
   */
  static parse(curlCommand) {
    if (!curlCommand || typeof curlCommand !== 'string') {
      throw new Error('Invalid cURL command');
    }

    const tokens = this.tokenize(curlCommand);
    if (tokens.length === 0 || tokens[0] !== 'curl') {
      throw new Error('Invalid cURL command');
    }

    const parsed = this.parseTokens(tokens);

    if (!parsed.url) {
      throw new Error('Could not extract URL from cURL command');
    }

    // Build fetch options
    const options = {
      method: parsed.method,
      headers: parsed.headers
    };

    if (parsed.body !== null && parsed.method !== 'GET' && parsed.method !== 'HEAD') {
      options.body = parsed.body;
    }

    return { url: parsed.url, options };
  }

  /**
   * Tokenize a cURL command using shell-like quoting rules.
   * Supports single quotes, double quotes, escaped characters, and line continuations.
   */
  static tokenize(command) {
    const tokens = [];
    let current = '';
    let quote = null;
    let tokenStarted = false;

    for (let i = 0; i < command.length; i += 1) {
      const char = command[i];
      const next = command[i + 1];

      if (char === '\\') {
        if (next === '\r' && command[i + 2] === '\n') {
          i += 2;
          continue;
        }

        if (next === '\n') {
          i += 1;
          continue;
        }

        if (next === undefined) {
          current += char;
          tokenStarted = true;
          continue;
        }

        if (quote === "'") {
          current += char;
        } else {
          current += next;
          i += 1;
        }

        tokenStarted = true;
        continue;
      }

      if (quote) {
        if (char === quote) {
          quote = null;
        } else {
          current += char;
        }

        tokenStarted = true;
        continue;
      }

      if (char === "'" || char === '"') {
        quote = char;
        tokenStarted = true;
        continue;
      }

      if (/\s/.test(char)) {
        if (tokenStarted) {
          tokens.push(current);
          current = '';
          tokenStarted = false;
        }
        continue;
      }

      current += char;
      tokenStarted = true;
    }

    if (quote) {
      throw new Error('Unclosed quote in cURL command');
    }

    if (tokenStarted) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Parse tokenized cURL arguments into fetch-compatible values.
   */
  static parseTokens(tokens) {
    const headers = {};
    const dataParts = [];
    let method = null;
    let url = null;

    for (let i = 1; i < tokens.length; i += 1) {
      const token = tokens[i];
      const { name, inlineValue } = this.splitOptionToken(token);

      switch (name) {
        case '-X':
        case '--request': {
          const { value, nextIndex } = this.readOptionValue(tokens, i, inlineValue);
          if (value) {
            method = value.toUpperCase();
          }
          i = nextIndex;
          break;
        }

        case '-H':
        case '--header': {
          const { value, nextIndex } = this.readOptionValue(tokens, i, inlineValue);
          this.addHeader(headers, value);
          i = nextIndex;
          break;
        }

        case '-d':
        case '--data':
        case '--data-raw':
        case '--data-binary': {
          const { value, nextIndex } = this.readOptionValue(tokens, i, inlineValue);
          if (value !== null) {
            dataParts.push(value);
          }
          i = nextIndex;
          break;
        }

        case '--url': {
          const { value, nextIndex } = this.readOptionValue(tokens, i, inlineValue);
          if (value) {
            url = value;
          }
          i = nextIndex;
          break;
        }

        case '-u':
        case '--user': {
          const { value, nextIndex } = this.readOptionValue(tokens, i, inlineValue);
          this.addBasicAuthHeader(headers, value);
          i = nextIndex;
          break;
        }

        case '-b':
        case '--cookie': {
          const { value, nextIndex } = this.readOptionValue(tokens, i, inlineValue);
          this.addCookieHeader(headers, value);
          i = nextIndex;
          break;
        }

        default: {
          if (token.startsWith('-')) {
            i = this.skipUnsupportedFlag(tokens, i, inlineValue);
          } else if (!url && this.isValidURL(token)) {
            url = token;
          }
          break;
        }
      }
    }

    return {
      url,
      method: method || (dataParts.length > 0 ? 'POST' : 'GET'),
      headers,
      body: dataParts.length > 0 ? dataParts.join('&') : null
    };
  }

  /**
   * Split long --flag=value tokens while leaving ordinary tokens intact.
   */
  static splitOptionToken(token) {
    if (token.startsWith('--')) {
      const equalsIndex = token.indexOf('=');
      if (equalsIndex > 2) {
        return {
          name: token.substring(0, equalsIndex),
          inlineValue: token.substring(equalsIndex + 1)
        };
      }
    }

    const shortOptionsWithValues = ['-X', '-H', '-d', '-u', '-b'];
    for (const option of shortOptionsWithValues) {
      if (token.startsWith(option) && token.length > option.length) {
        return {
          name: option,
          inlineValue: token.substring(option.length)
        };
      }
    }

    return { name: token, inlineValue: null };
  }

  /**
   * Read an option value from either --flag=value or the next token.
   */
  static readOptionValue(tokens, index, inlineValue = null) {
    if (inlineValue !== null) {
      return { value: inlineValue, nextIndex: index };
    }

    const nextIndex = index + 1;
    if (nextIndex >= tokens.length) {
      return { value: null, nextIndex: index };
    }

    return { value: tokens[nextIndex], nextIndex };
  }

  /**
   * Add a Header: value token to the fetch headers object.
   */
  static addHeader(headers, headerString) {
    if (!headerString) {
      return;
    }

    const colonIndex = headerString.indexOf(':');
    if (colonIndex <= 0) {
      return;
    }

    const key = headerString.substring(0, colonIndex).trim();
    const value = headerString.substring(colonIndex + 1).trim();

    if (key) {
      headers[key] = value;
    }
  }

  /**
   * Convert -u/--user credentials to an Authorization header where possible.
   */
  static addBasicAuthHeader(headers, credentials) {
    if (!credentials) {
      return;
    }

    const encoded = this.base64Encode(credentials);
    if (encoded) {
      headers.Authorization = `Basic ${encoded}`;
    }
  }

  /**
   * Add or append cookies supplied through -b/--cookie.
   */
  static addCookieHeader(headers, cookie) {
    if (!cookie) {
      return;
    }

    headers.Cookie = headers.Cookie ? `${headers.Cookie}; ${cookie}` : cookie;
  }

  /**
   * Encode credentials in both browser and Node contexts.
   */
  static base64Encode(value) {
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(value)));
    }

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(value, 'utf8').toString('base64');
    }

    return null;
  }

  /**
   * Skip unsupported flags without failing whenever the value shape is obvious.
   */
  static skipUnsupportedFlag(tokens, index, inlineValue = null) {
    const token = tokens[index];

    if (inlineValue !== null || this.isKnownBooleanFlag(token)) {
      return index;
    }

    const next = tokens[index + 1];
    if (next && !next.startsWith('-') && !this.isValidURL(next)) {
      return index + 1;
    }

    return index;
  }

  /**
   * Unsupported flags that do not take a value.
   */
  static isKnownBooleanFlag(flag) {
    return new Set([
      '-i',
      '--include',
      '-I',
      '--head',
      '-k',
      '--insecure',
      '-L',
      '--location',
      '-s',
      '--silent',
      '-S',
      '--show-error',
      '-v',
      '--verbose',
      '--compressed'
    ]).has(flag);
  }

  /**
   * Extract URL from a cURL command.
   */
  static extractURL(curl) {
    return this.parseTokens(this.tokenize(curl)).url;
  }

  /**
   * Extract HTTP method from a cURL command.
   */
  static extractMethod(curl) {
    return this.parseTokens(this.tokenize(curl)).method;
  }

  /**
   * Extract headers from a cURL command.
   */
  static extractHeaders(curl) {
    return this.parseTokens(this.tokenize(curl)).headers;
  }

  /**
   * Extract request body from a cURL command.
   */
  static extractBody(curl) {
    return this.parseTokens(this.tokenize(curl)).body;
  }

  /**
   * Validate URL
   */
  static isValidURL(string) {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }
}

// Export for use in popup
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CurlParser;
}
