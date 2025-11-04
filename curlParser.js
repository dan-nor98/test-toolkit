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

    const trimmed = curlCommand.trim();
    
    // Extract URL
    const url = this.extractURL(trimmed);
    if (!url) {
      throw new Error('Could not extract URL from cURL command');
    }

    // Extract method
    const method = this.extractMethod(trimmed);

    // Extract headers
    const headers = this.extractHeaders(trimmed);

    // Extract body
    const body = this.extractBody(trimmed);

    // Build fetch options
    const options = {
      method,
      headers
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      options.body = body;
    }

    return { url, options };
  }

  /**
   * Extract URL from cURL command
   */
  static extractURL(curl) {
    // Try different URL patterns
    const patterns = [
      /curl\s+(?:-X\s+\w+\s+)?['"]([^'"]+)['"]/,  // curl -X POST 'url'
      /curl\s+(?:-X\s+\w+\s+)?(\S+)/,             // curl url
      /--url\s+['"]([^'"]+)['"]/,                  // --url 'url'
      /--url\s+(\S+)/                              // --url url
    ];

    for (const pattern of patterns) {
      const match = curl.match(pattern);
      if (match && match[1]) {
        let url = match[1];
        // Remove trailing backslashes and quotes
        url = url.replace(/[\\'"]+$/, '');
        if (url.startsWith('http://') || url.startsWith('https://')) {
          return url;
        }
      }
    }

    return null;
  }

  /**
   * Extract HTTP method
   */
  static extractMethod(curl) {
    const methodMatch = curl.match(/-X\s+(\w+)|--request\s+(\w+)/i);
    if (methodMatch) {
      return (methodMatch[1] || methodMatch[2]).toUpperCase();
    }
    
    // Default to POST if data is present, otherwise GET
    if (curl.includes('--data') || curl.includes('-d ')) {
      return 'POST';
    }
    
    return 'GET';
  }

  /**
   * Extract headers
   */
  static extractHeaders(curl) {
    const headers = {};
    
    // Match -H or --header
    const headerPatterns = [
      /-H\s+['"]([^'"]+)['"]/g,
      /--header\s+['"]([^'"]+)['"]/g,
      /-H\s+([^\s]+)/g
    ];

    for (const pattern of headerPatterns) {
      let match;
      while ((match = pattern.exec(curl)) !== null) {
        const headerString = match[1];
        const colonIndex = headerString.indexOf(':');
        
        if (colonIndex > 0) {
          const key = headerString.substring(0, colonIndex).trim();
          const value = headerString.substring(colonIndex + 1).trim();
          headers[key] = value;
        }
      }
    }

    return headers;
  }

  /**
   * Extract request body
   */
  static extractBody(curl) {
    // Try different body patterns
    const patterns = [
      /--data-raw\s+['"]([^'"]*(?:\\'|[^'"])*)['"]/s,
      /--data-binary\s+['"]([^'"]*)['"]/s,
      /--data\s+['"]([^'"]*)['"]/s,
      /-d\s+['"]([^'"]*)['"]/s,
      /--data-raw\s+(\S+)/,
      /--data\s+(\S+)/,
      /-d\s+(\S+)/
    ];

    for (const pattern of patterns) {
      const match = curl.match(pattern);
      if (match && match[1]) {
        let body = match[1];
        // Unescape quotes
        body = body.replace(/\\'/g, "'").replace(/\\"/g, '"');
        return body;
      }
    }

    return null;
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