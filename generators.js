/**
 * DevToolkit Pro - Data Generators
 * Professional data generation utilities
 */

class DataGenerators {
  /**
   * Generate random Iranian phone number
   * Format: 0900 XXX XXXX
   */
  static generatePhoneNumber() {
    const prefix = '0900'; // Changed prefix to '0900'
    // Generate the remaining 7 digits
    const remaining = Math.floor(Math.random() * 9000000) + 1000000;
    return `${prefix}${remaining}`;
  }

  /**
   * Generate random Persian name
   */
  static generateName() {
    const firstNames = ['علی', 'محمد', 'حسین', 'رضا', 'احمد', 'مهدی', 'فاطمه', 'زهرا', 'مریم', 'سارا'];
    const lastNames = ['احمدی', 'محمدی', 'حسینی', 'رضایی', 'کریمی', 'جعفری', 'موسوی', 'نوری', 'عباسی', 'صادقی'];
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    return `${firstName} ${lastName}`;
  }

  /**
   * Calculate check digit for Iranian national code
   */
  static calculateNationalCodeCheckDigit(nineDigits) {
    const digits = nineDigits.toString().split('').map(Number);
    
    if (digits.length !== 9) {
      throw new Error('National code must be 9 digits');
    }
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * (10 - i);
    }
    
    const remainder = sum % 11;
    return remainder < 2 ? remainder : 11 - remainder;
  }

  /**
   * Generate valid Iranian national code
   * Format: 10 digits with valid check digit
   */
  static generateNationalCode() {
    const base = Math.floor(Math.random() * 900000000) + 100000000;
    const checkDigit = this.calculateNationalCodeCheckDigit(base);
    return `${base}${checkDigit}`;
  }

  /**
   * Calculate Luhn check digit for card numbers
   */
  static calculateLuhnCheckDigit(numberString) {
    const digits = numberString.split('').map(Number);
    let sum = 0;
    let isSecond = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = digits[i];
      if (isSecond) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isSecond = !isSecond;
    }
    
    const remainder = sum % 10;
    return remainder === 0 ? 0 : 10 - remainder;
  }

  /**
   * Generate valid Iranian bank card number
   * Format: 16 digits with valid Luhn check digit
   */
  static generateBankCardNumber() {
    const iranianBankIINs = [
      '603799', // Bank Melli
      '589210', // Bank Saderat
      '627648', // Bank Tosee Saderat
      '603770', // Bank Keshavarzi
      '628023', // Bank Maskan
      '627760', // Post Bank
      '502229', // Pasargad Bank
      '627412', // Eghtesad Novin
      '622106', // Parsian Bank
      '627353', // Tejarat Bank
      '639346', // Sina Bank
      '621986', // Saman Bank
      '639607', // Sarmayeh Bank
    ];
    
    const iin = iranianBankIINs[Math.floor(Math.random() * iranianBankIINs.length)];
    
    // This correctly generates 9 digits (from 100,000,000 to 999,999,999)
    const accountPart = (Math.floor(Math.random() * 900000000) + 100000000).toString();
    
    // This creates the 15-digit prefix (6 + 9)
    const partial = `${iin}${accountPart}`;
    
    // Calculate the 16th digit based on the 15-digit prefix
    const checkDigit = this.calculateLuhnCheckDigit(partial);
    
    return `${partial}${checkDigit}`;
  }

  /**
   * Calculates the Luhn check digit (the 16th digit) for a 15-digit partial card number.
   * @param {string} partial - The 15-digit string.
   * @returns {string} The 1-digit check digit.
   */
  static calculateLuhnCheckDigit(partial) {
    if (partial.length !== 15) {
      throw new Error("Partial number must be 15 digits long to calculate a 16th check digit.");
    }

    let sum = 0;
    // For a 16-digit number, the Luhn algorithm doubles the 1st, 3rd, 5th... 15th digits.
    let double = true; 

    for (let i = 0; i < 15; i++) {
      let digit = parseInt(partial[i], 10);

      if (double) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9; // This is equivalent to summing the digits (e.g., 14 -> 1+4=5, 14-9=5)
        }
      }

      sum += digit;
      double = !double; // Flip for the next digit
    }

    // The check digit is the number needed to make the total sum a multiple of 10.
    const checkDigit = (10 - (sum % 10)) % 10;
    
    return checkDigit.toString();
  }

  /**
   * Calculate IBAN check digits (MOD 97-10)
   */
  static calculateIBANCheckDigits(countryCode, bban) {
    const rearranged = `${bban}${countryCode}00`;
    let numericString = '';
    
    for (const char of rearranged) {
      if (char >= 'A' && char <= 'Z') {
        numericString += (char.charCodeAt(0) - 'A'.charCodeAt(0) + 10).toString();
      } else {
        numericString += char;
      }
    }
    
    const remainder = BigInt(numericString) % 97n;
    const checkDigits = (98n - remainder).toString().padStart(2, '0');
    return checkDigits;
  }

  /**
   * Generate valid Iranian IBAN (Sheba) number
   * Format: IR + 2 check digits + 3 bank code + 19 account number
   */
  static generateShebaNumber() {
    const countryCode = 'IR';
    const bankCodes = ['017', '019', '018', '010', '054', '055', '056', '057', '060', '062'];
    const bankCode = bankCodes[Math.floor(Math.random() * bankCodes.length)];
    
    // Generate 19-digit account number
    const accountNumber = (BigInt(Math.floor(Math.random() * 1e18)) + BigInt(1e17))
      .toString()
      .padStart(19, '0');
    
    const bban = `${bankCode}${accountNumber}`;
    const checkDigits = this.calculateIBANCheckDigits(countryCode, bban);
    
    return `${countryCode}${checkDigits}${bban}`;
  }

  /**
   * Generate random email address
   */
  static generateEmail() {
    const providers = ['abc.com', 'xyz.com', 'test.com', 'example.com'];
    const names = ['user', 'test', 'demo', 'sample', 'admin'];
    const randomNum = Math.floor(Math.random() * 9999);
    
    const name = names[Math.floor(Math.random() * names.length)];
    const provider = providers[Math.floor(Math.random() * providers.length)];
    
    return `${name}${randomNum}@${provider}`;
  }

  /**
   * Format card number with spaces
   */
  static formatCardNumber(cardNumber) {
    return cardNumber.match(/.{1,4}/g).join(' ');
  }

  /**
   * Format IBAN with spaces
   */
  static formatIBAN(iban) {
    return iban.match(/.{1,4}/g).join(' ');
  }

  /**
   * Return a Web Crypto compatible object.
   * Passwords and UUID fallback generation require crypto.getRandomValues();
   * callers in unsupported runtimes receive a clear error instead of weak output.
   */
  static getCrypto() {
    const cryptoObject = globalThis.crypto;

    if (!cryptoObject || typeof cryptoObject.getRandomValues !== 'function') {
      throw new Error('crypto.getRandomValues is required for secure random generation');
    }

    return cryptoObject;
  }

  /**
   * Generate an unbiased cryptographically secure integer in [0, maxExclusive).
   */
  static secureRandomInt(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error('maxExclusive must be a positive integer');
    }

    const cryptoObject = this.getCrypto();
    const randomValues = new Uint32Array(1);
    const maxUint32 = 0x100000000;
    const limit = maxUint32 - (maxUint32 % maxExclusive);
    let value;

    do {
      cryptoObject.getRandomValues(randomValues);
      value = randomValues[0];
    } while (value >= limit);

    return value % maxExclusive;
  }

  /**
   * Lightweight helper for checking password length input.
   */
  static isValidPasswordLength(length) {
    return Number.isInteger(length) && length > 0;
  }

  /**
   * Lightweight helper for checking whether a password configuration selects
   * at least one character class.
   */
  static hasSelectedPasswordCharacterClass(options = {}) {
    return Boolean(options.useUpper || options.useLower || options.useNumbers || options.useSymbols);
  }

  /**
   * Lightweight helper for validating UUID v4 output.
   */
  static isValidUUIDv4(uuid) {
    return typeof uuid === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
  }

  /**
   * Generate a cryptographically secure random password using Web Crypto.
   * The generated password has the requested length and includes at least one
   * character from every selected class when the length permits it. Security
   * still depends on selecting sufficient length and character classes.
   */
  static generatePassword(options = {}) {
    const defaults = {
      length: 16,
      useUpper: true,
      useLower: true,
      useNumbers: true,
      useSymbols: true
    };
    const config = { ...defaults, ...options };

    if (!this.isValidPasswordLength(config.length)) {
      throw new Error('Password length must be a positive integer');
    }

    if (!this.hasSelectedPasswordCharacterClass(config)) {
      throw new Error('At least one character type must be selected');
    }

    const charSets = {
      upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lower: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };
    const selectedCharSets = [];

    if (config.useUpper) selectedCharSets.push(charSets.upper);
    if (config.useLower) selectedCharSets.push(charSets.lower);
    if (config.useNumbers) selectedCharSets.push(charSets.numbers);
    if (config.useSymbols) selectedCharSets.push(charSets.symbols);

    if (config.length < selectedCharSets.length) {
      throw new Error('Password length must be at least the number of selected character types');
    }

    const passwordChars = [];
    const allChars = selectedCharSets.join('');

    // Guarantee one character from each selected class before filling the rest.
    for (const charSet of selectedCharSets) {
      passwordChars.push(charSet[this.secureRandomInt(charSet.length)]);
    }

    for (let i = passwordChars.length; i < config.length; i++) {
      passwordChars.push(allChars[this.secureRandomInt(allChars.length)]);
    }

    // Fisher-Yates shuffle using crypto.getRandomValues-backed indices.
    for (let i = passwordChars.length - 1; i > 0; i--) {
      const j = this.secureRandomInt(i + 1);
      [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
    }

    return passwordChars.join('');
  }

  /**
   * Generate an RFC 4122/9562 UUID v4. Uses crypto.randomUUID() when available;
   * otherwise falls back to manually setting v4 version and variant bits from
   * crypto.getRandomValues().
   */
  static generateUUID() {
    const cryptoObject = this.getCrypto();

    if (typeof cryptoObject.randomUUID === 'function') {
      return cryptoObject.randomUUID();
    }

    const randomBytes = new Uint8Array(16);
    cryptoObject.getRandomValues(randomBytes);

    // UUID v4 version (0100) and RFC variant (10xx) bits.
    randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
    randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;

    const hex = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0'));

    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }
}
// Export for use in popup
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataGenerators;
}