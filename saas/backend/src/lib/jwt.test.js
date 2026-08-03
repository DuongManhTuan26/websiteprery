import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signAccessToken, verifyAccessToken } from './jwt.js';

test('signAccessToken produces a token verifyAccessToken can decode', () => {
  const token = signAccessToken({ id: 'user-1', accountId: 'account-1', role: 'OWNER' });
  const payload = verifyAccessToken(token);

  assert.equal(payload.sub, 'user-1');
  assert.equal(payload.accountId, 'account-1');
  assert.equal(payload.role, 'OWNER');
});

test('verifyAccessToken rejects a tampered token', () => {
  const token = signAccessToken({ id: 'user-1', accountId: 'account-1', role: 'OWNER' });
  const tampered = token.slice(0, -2) + 'xx';

  assert.throws(() => verifyAccessToken(tampered));
});

test('verifyAccessToken rejects garbage input', () => {
  assert.throws(() => verifyAccessToken('not-a-jwt-at-all'));
});
