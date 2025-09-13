import { encrypt, decrypt, generateEncryptionKey } from '../server/lib/crypto.js';

describe('crypto AES-GCM', () => {
  test('encrypt/decrypt roundtrip', () => {
    const key = '12345678901234567890123456789012'; // 32 chars
    const plaintext = 'hello world: ' + Date.now();
    const enc = encrypt(plaintext, key);
    expect(typeof enc).toBe('string');
    const dec = decrypt(enc, key);
    expect(dec).toBe(plaintext);
  });

  test('rejects wrong key length', () => {
    expect(() => encrypt('x', 'short')).toThrow();
    expect(() => decrypt('abc', 'short')).toThrow();
  });
});


