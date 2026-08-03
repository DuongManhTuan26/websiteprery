import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../lib/jwt.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { createDefaultSubscription } from '../services/plan.service.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'refresh_token';
const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.nodeEnv === 'production',
  maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  path: '/api/auth'
};

function toUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    accountId: user.accountId,
    isPlatformAdmin: user.isPlatformAdmin
  };
}

const registerSchema = z.object({
  businessName: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200)
});

authRouter.post('/register', asyncHandler(async (req, res) => {
  const body = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: body.email } });

  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(body.password);

  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash,
      name: body.name,
      role: 'OWNER',
      account: { create: { name: body.businessName } }
    }
  });

  await createDefaultSubscription(user.accountId);

  const accessToken = signAccessToken({ id: user.id, accountId: user.accountId, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  res.status(201).json({
    accessToken,
    user: toUserResponse(user)
  });
}));

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRouter.post('/login', asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });

  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  res.json({
    accessToken,
    user: toUserResponse(user)
  });
}));

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];

  if (!token) {
    throw new ApiError(401, 'Missing refresh token');
  }

  const rotated = await rotateRefreshToken(token);

  if (!rotated) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    throw new ApiError(401, 'Refresh token invalid or expired');
  }

  const user = await prisma.user.findUnique({ where: { id: rotated.userId } });

  if (!user) {
    throw new ApiError(401, 'User no longer exists');
  }

  const accessToken = signAccessToken(user);

  res.cookie(REFRESH_COOKIE, rotated.refreshToken, refreshCookieOptions);
  res.json({ accessToken });
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];

  if (token) {
    await revokeRefreshToken(token);
  }

  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).send();
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.json(toUserResponse(user));
}));
