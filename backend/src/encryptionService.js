import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  console.warn('⚠️  ENCRYPTION_KEY not set. Email encryption will fail. Set a 32-byte base64 key in .env');
}

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Validate or derive encryption key
 * @returns {Buffer} 32-byte key
 */
function getKey() {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required for email encryption');
  }
  
  // If key is base64 encoded and 32 bytes when decoded, use it directly
  try {
    const decoded = Buffer.from(ENCRYPTION_KEY, 'base64');
    if (decoded.length === KEY_LENGTH) {
      return decoded;
    }
  } catch (e) {
    // Not valid base64, fall through to hash
  }
  
  // Derive 32-byte key from string using SHA-256
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @returns {string} Encrypted data as base64 string (salt:iv:authTag:ciphertext)
 */
export function encrypt(plaintext) {
  if (!plaintext) return null;
  
  try {
    const key = getKey();
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Combine: salt:iv:authTag:ciphertext (all base64)
    const encrypted = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(ciphertext, 'base64')
    ]).toString('base64');
    
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedData - Encrypted data as base64 string
 * @returns {string} Decrypted plaintext
 */
export function decrypt(encryptedData) {
  if (!encryptedData) return null;
  
  try {
    const key = getKey();
    const data = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const salt = data.slice(0, SALT_LENGTH);
    const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = data.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = data.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);
    
    return plaintext.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data - data may be corrupted or key mismatch');
  }
}

/**
 * Generate SHA-256 hash of email for duplicate checking
 * This allows checking for duplicates without decrypting
 * @param {string} email - Email address
 * @returns {string} SHA-256 hash as hex string
 */
export function hashEmail(email) {
  if (!email) return null;
  const normalized = email.toLowerCase().trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generate a secure random token
 * @param {number} length - Token length in bytes (default 32)
 * @returns {string} URL-safe base64 token
 */
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Hash a token for storage (for verification)
 * @param {string} token - Token to hash
 * @returns {string} SHA-256 hash as hex string
 */
export function hashToken(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate encryption key for .env file
 * Run this once to generate a key
 * @returns {string} Base64 encoded 32-byte key
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Verify if encryption is properly configured
 * @returns {boolean}
 */
export function isEncryptionConfigured() {
  try {
    getKey();
    return true;
  } catch (e) {
    return false;
  }
}

export default {
  encrypt,
  decrypt,
  hashEmail,
  generateToken,
  hashToken,
  generateEncryptionKey,
  isEncryptionConfigured,
};