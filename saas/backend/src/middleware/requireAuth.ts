import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/tokens.js';
import { UnauthorizedError } from './errorHandler.js';

// Verifies the JWT access token in `Authorization: Bearer <token>` and
// attaches `req.userId`. Deliberately stateless (no DB lookup) — access
// tokens are short-lived (15m default) specifically so this can stay cheap;
// revocation happens at the refresh-token layer, not here.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing bearer token'));
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired access token'));
  }
}
