import crypto from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended IV length for GCM

function getKey(): Buffer {
  // env.ts requires ENCRYPTION_KEY at boot (process fails fast if unset),
  // so it's always present here. Hashed regardless of the operator's chosen
  // secret length/format — gives a fixed 32-byte AES-256 key without
  // weakening a genuinely random secret.
  return crypto.createHash('sha256').update(env.ENCRYPTION_KEY).digest();
}

// AES-256-GCM: ciphertext stored as `<iv>:<authTag>:<encrypted>` (all hex).
// Never logged, never returned to a client — see settings/service.ts.
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Malformed ciphertext');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
}
