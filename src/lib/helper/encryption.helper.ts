import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

const getEncryptionKey = (): Buffer => {
  const key = process.env.PHONE_ENCRYPTION_KEY!;

  if (!key || !/^[0-9a-f]{64}$/i.test(key)) {
    throw new Error('Invalid PHONE_ENCRYPTION_KEY');
  }

  return Buffer.from(key, 'hex');
};

export const encrypt = (text: string): string => {
  if (!text) return text;

  const iv = randomBytes(12);

  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
};

export const decrypt = (encryptedText: string): string => {
  if (!encryptedText) return encryptedText;

  const [version, iv, authTag, encrypted] = encryptedText.split(':');

  if (version !== 'v1' || !iv || !authTag || !encrypted) {
    throw new Error('Invalid encrypted data');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(iv, 'hex'),
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};
