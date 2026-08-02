import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from '../src/utils/encryption.js';

describe('encryption', () => {
  it('round-trips a plaintext value', () => {
    const ciphertext = encrypt('sk-super-secret-key');
    expect(ciphertext).not.toContain('sk-super-secret-key');
    expect(decrypt(ciphertext)).toBe('sk-super-secret-key');
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', () => {
    const a = encrypt('same-value');
    const b = encrypt('same-value');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same-value');
    expect(decrypt(b)).toBe('same-value');
  });

  it('throws on tampered ciphertext (GCM auth tag check)', () => {
    const ciphertext = encrypt('sk-real-key');
    const tampered = ciphertext.slice(0, -2) + '00';
    expect(() => decrypt(tampered)).toThrow();
  });
});
