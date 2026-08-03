import crypto from 'node:crypto';
import { prisma } from './prisma.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Opaque random token, only its hash stored — same rationale as
// RefreshToken (see jwt.js): a leaked database dump alone can't be
// replayed as a valid reset link.
export async function issuePasswordResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) }
  });

  return token;
}

// Returns the userId if the token was valid and unused (and atomically
// marks it used), else null.
export async function consumePasswordResetToken(token) {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  return record.userId;
}
