import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { parseOrThrow } from '../../utils/validate.js';
import { loginSchema, refreshSchema, registerSchema } from './schemas.js';
import * as authService from './service.js';
import { NotFoundError } from '../../middleware/errorHandler.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = parseOrThrow(registerSchema, req.body);
    const result = await authService.register(email, password, name);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = parseOrThrow(loginSchema, req.body);
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = parseOrThrow(refreshSchema, req.body);
    const tokens = await authService.refresh(refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = parseOrThrow(refreshSchema, req.body);
    await authService.logout(refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.userId!);
    if (!user) throw new NotFoundError('User not found');
    res.json({ user });
  } catch (err) {
    next(err);
  }
});
