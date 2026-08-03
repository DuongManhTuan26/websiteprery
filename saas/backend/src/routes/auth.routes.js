import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens
} from '../lib/jwt.js';
import { issuePasswordResetToken, consumePasswordResetToken } from '../lib/passwordReset.js';
import { sendPasswordResetEmail } from '../services/email.service.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { createDefaultSubscription } from '../services/plan.service.js';

export const authRouter = Router();

// Real brute-force protection on the two endpoints that check a password.
// Keyed by IP only (no email/account concept exists before a request
// succeeds) — generous enough not to lock out a real user mistyping their
// password a few times, tight enough to make credential-stuffing slow.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

// Same reasoning as loginLimiter — this is also anonymous and, unlike
// login, actually sends a real email when SMTP is configured, so it's
// also real protection against using this endpoint to spam an inbox.
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});

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

authRouter.post('/register', registerLimiter, asyncHandler(async (req, res) => {
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

authRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
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

const forgotPasswordSchema = z.object({ email: z.string().email() });

// Always responds with the same generic message regardless of whether the
// email exists or whether SMTP is actually configured — a different
// response in either case would let an anonymous caller enumerate real
// accounts or probe this deployment's email configuration. The real
// (or logged, if unconfigured) outcome only ever reaches the account
// owner's own inbox / this server's own logs, never the HTTP response.
authRouter.post('/forgot-password', forgotPasswordLimiter, asyncHandler(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const token = await issuePasswordResetToken(user.id);
    const resetUrl = `${env.frontendUrl}/dat-lai-mat-khau?token=${token}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  }

  res.json({ message: 'Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu.' });
}));

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200)
});

authRouter.post('/reset-password', asyncHandler(async (req, res) => {
  const body = resetPasswordSchema.parse(req.body);
  const userId = await consumePasswordResetToken(body.token);

  if (!userId) {
    throw new ApiError(400, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
  }

  const passwordHash = await hashPassword(body.password);

  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  // A password reset should end every existing session, not just let the
  // device that performed the reset keep going — this is exactly the
  // scenario (e.g. a stolen device) the reset is often performed for.
  await revokeAllRefreshTokens(userId);

  res.status(204).send();
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.json(toUserResponse(user));
}));
