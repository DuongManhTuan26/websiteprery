import bcrypt from 'bcryptjs';
import { prisma } from '../../db/client.js';
import { ConflictError, UnauthorizedError } from '../../middleware/errorHandler.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken
} from '../../utils/tokens.js';

const BCRYPT_COST = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

function toPublicUser(user: { id: string; email: string; name: string }): PublicUser {
  return { id: user.id, email: user.email, name: user.name };
}

async function issueTokens(userId: string): Promise<AuthTokens> {
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiry()
    }
  });

  return { accessToken: signAccessToken(userId), refreshToken };
}

export async function register(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await prisma.user.create({ data: { email, passwordHash, name } });

  return { user: toPublicUser(user), tokens: await issueTokens(user.id) };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  return { user: toPublicUser(user), tokens: await issueTokens(user.id) };
}

// Rotation: the presented token is looked up by hash, checked for
// expiry/revocation, immediately revoked, and a fresh pair is issued and
// linked via `replacedBy` — so reuse of an already-rotated token is
// detectable (it will be found but already revoked) rather than silently
// accepted.
export async function refresh(presentedToken: string): Promise<AuthTokens> {
  const tokenHash = hashRefreshToken(presentedToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const next = await issueTokens(existing.userId);

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedBy: hashRefreshToken(next.refreshToken) }
  });

  return next;
}

export async function logout(presentedToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(presentedToken);

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? toPublicUser(user) : null;
}
