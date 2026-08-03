import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, accountId: user.accountId, role: user.role },
    env.jwtAccessSecret,
    { expiresIn: env.accessTokenTtl }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Refresh tokens are opaque random strings, not JWTs — only their hash is
// stored, so a leaked database dump alone can't be replayed as a live
// session (same rationale as never storing a plaintext password).
export async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt }
  });

  return token;
}

export async function rotateRefreshToken(oldToken) {
  const tokenHash = hashToken(oldToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() }
  });

  const newToken = await issueRefreshToken(record.userId);

  return { userId: record.userId, refreshToken: newToken };
}

export async function revokeRefreshToken(token) {
  const tokenHash = hashToken(token);

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
