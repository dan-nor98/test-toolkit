// Simple logger implementation
const logger = {
  debug: (message, data) => {
    console.log(`[DEBUG] ${message}`, data);
  },
  error: (message, data) => {
    console.error(`[ERROR] ${message}`, data);
  }
};

// Paste all your existing functions here
function generatePhoneNumber() {
  const phoneNumber = `09${Math.floor(Math.random() * 900000000) + 100000000}`;
  logger.debug('Generated phone number.', { phoneNumber });
  return phoneNumber;
}

/**
 * Generates a random Iranian phone number.
 * @returns {string} A random phone number.
 */
function generatePhoneNumber() {
  const phoneNumber = `0900${Math.floor(Math.random() * 9000000) + 1000000}`;
  logger.debug('Generated phone number.', { phoneNumber });
  return phoneNumber;
}

/**
 * Generates a random Persian name.
 * @returns {string} A random name.
 */
function generateName() {
  const name = `کاربر تست${Math.floor(Math.random() * 9000) + 1000}`; // "Test User" in Persian
  logger.debug('Generated name.', { name });
  return name;
}

/**
 * Calculates the check digit for an Iranian national code.
 * @param {number} nationalCodeWithoutCheckDigit - The 9-digit national code.
 * @returns {number} The check digit.
 */
function getNationalCodeCheckDigit(nationalCodeWithoutCheckDigit) {
  const digits = nationalCodeWithoutCheckDigit.toString().split('').map(Number);
  if (digits.length !== 9) {
      logger.error('National code for check digit calculation must be 9 digits.', { input: nationalCodeWithoutCheckDigit });
      throw new Error('National code (without check digit) must be 9 digits long.');
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  const remainder = sum % 11;
  if (remainder < 2) {
    return remainder;
  } else {
    return 11 - remainder;
  }
}

/**
 * Generates a random Iranian national code with a valid check digit.
 * @returns {string} A 10-digit national code.
 */
function generateNationalCode() {
  const baseNationalCode = Math.floor(Math.random() * 900000000) + 100000000; // 9 digits
  const checkDigit = getNationalCodeCheckDigit(baseNationalCode);
  const nationalCode = `${baseNationalCode}${checkDigit}`;
  logger.debug('Generated national code.', { nationalCode });
  return nationalCode;
}


/**
 * Calculates the Luhn check digit.
 * https://en.wikipedia.org/wiki/Luhn_algorithm
 * @param {string} numberString - The number string (without the check digit).
 * @returns {number} The Luhn check digit.
 */
function calculateLuhnCheckDigit(numberString) {
    const digits = numberString.split('').map(Number);
    let sum = 0;
    let isSecond = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = digits[i];
        if (isSecond) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        sum += digit;
        isSecond = !isSecond;
    }
    const remainder = sum % 10;
    return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Generates a random bank card number with a valid Luhn check digit.
 * @returns {string} A 16-digit bank card number.
 */
function generateBankCardNumber() {
  // Common Iranian bank IINs (Issuer Identification Number) - first 6 digits
  // You can expand this list or make it configurable
  const iins = [
    '603799', // Melli Bank
    '589210', // Saderat Bank
    '627648', // Tose'e Saderat Bank
    // '627961', // Sanat O Madan Bank
    '603770', // Keshavarzi Bank
    '628023', // Maskan Bank
    '627760', // Post Bank
    '502229', // Pasargad Bank
    '627412', // Eghtesad Novin Bank
    '622106', // Parsian Bank
    '627353', // Tejarat Bank
    '639346', // Sina Bank
  ];
  const iin = iins[Math.floor(Math.random() * iins.length)];
  // Account number part (9 digits for a total of 15 digits before check digit)
  const accountNumberPart = (Math.floor(Math.random() * 900000000) + 100000000).toString();
  const partialCardNumber = `${iin}${accountNumberPart}`; // 15 digits
  const checkDigit = calculateLuhnCheckDigit(partialCardNumber);
  const bankCardNumber = `${partialCardNumber}${checkDigit}`;
  logger.debug('Generated bank card number.', { bankCardNumber, iin });
  return bankCardNumber;
}

/**
 * Calculates IBAN check digits (ISO 7064 MOD 97-10).
 * @param {string} countryCode - The two-letter ISO country code (e.g., "IR").
 * @param {string} bban - The Basic Bank Account Number.
 * @returns {string} The two check digits as a string (e.g., "05", "89").
 */
function calculateIbanCheckDigits(countryCode, bban) {
    const ibanToCheck = `${bban}${countryCode}00`; // Append country code and two zeros
    let numericIban = '';
    for (let char of ibanToCheck) {
        if (char >= 'A' && char <= 'Z') {
            numericIban += (char.charCodeAt(0) - 'A'.charCodeAt(0) + 10).toString();
        } else {
            numericIban += char;
        }
    }

    // Perform mod 97 calculation on potentially very large number
    // by processing it in chunks if necessary (BigInt can handle it directly)
    try {
        const remainder = BigInt(numericIban) % 97n;
        const checkDigits = (98n - remainder).toString().padStart(2, '0');
        return checkDigits;
    } catch (e) {
        logger.error('Error calculating IBAN check digits with BigInt', { input: numericIban, error: e.message });
        // Fallback or error for extremely long numbers if BigInt fails (unlikely for IBANs)
        // For very long numbers not supported by BigInt directly (not the case for IBANs),
        // a chunk-wise modulo operation would be needed:
        let num = 0;
        for (let i = 0; i < numericIban.length; i++) {
            num = (num * 10 + parseInt(numericIban[i], 10)) % 97;
        }
        const check = (98 - num).toString().padStart(2, '0');
        return check;
    }
}

/**
 * Generates a random Iranian Sheba (IBAN) number.
 * Format: IRkkBBBAAAAAAAAAAAAAAAAAAAAAA (IR + 2 check digits + 3 bank code + 19 account num)
 * @returns {string} A random Sheba number.
 */
function generateShebaNumber() {
  const countryCode = 'IR';
  // List of some Iranian bank codes (first 3 digits of BBAN after check digits)
  // This should correspond to the `B` in `IRkkBBBA...`
  // Example: Melli Bank (017), Saderat (019), Tejarat (018)
  const bankCodes = ['017', '019', '018', '010', '054', '055', '056', '057'];
  const bankCode = bankCodes[Math.floor(Math.random() * bankCodes.length)];

  // The rest of the BBAN is the account number, typically padded to 19 digits.
  // Total BBAN length for Iran is 22 digits (3 bank code + 19 account identifier).
  const accountNumber = (BigInt(Math.floor(Math.random() * 1e18)) + BigInt(1e17)).toString().padStart(19, '0'); // Ensures 18-19 digits, then pads
  
  const bban = `${bankCode}${accountNumber}`; // 3 + 19 = 22 digits

  const checkDigits = calculateIbanCheckDigits(countryCode, bban);
  const shebaNumber = `${countryCode}${checkDigits}${bban}`;
  logger.debug('Generated Sheba number.', { shebaNumber, bankCode, checkDigits });
  return shebaNumber;
}