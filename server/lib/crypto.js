import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Recommended IV length for GCM
const AUTH_DATA = Buffer.from('soundcloud-tokens', 'utf8');

export function encrypt(plaintext, key) {
  if (typeof key !== 'string' || key.length !== 32) {
    throw new Error('Encryption key must be a 32-character string');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'utf8'), iv);
  cipher.setAAD(AUTH_DATA);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: iv | tag | ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(encoded, key) {
  if (typeof key !== 'string' || key.length !== 32) {
    throw new Error('Decryption key must be a 32-character string');
  }
  const data = Buffer.from(encoded, 'base64');
  if (data.length < IV_LENGTH + 16) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = data.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'utf8'), iv);
  decipher.setAAD(AUTH_DATA);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function generateEncryptionKey() {
  // 32 chars ASCII (256 bits if treated as bytes in utf8)
  return crypto.randomBytes(32).toString('base64').slice(0, 32);
}


