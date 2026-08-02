import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'validation_error', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'unauthorized', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'forbidden', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'not_found', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'conflict', message);
  }
}

// An upstream AI provider (or any third-party dependency) failed or is
// unreachable/misconfigured — 502, distinct from a validation error on the
// caller's part.
export class UpstreamError extends AppError {
  constructor(message: string) {
    super(502, 'upstream_error', message);
  }
}

// Single place errors are mapped to HTTP responses. Known AppError subtypes
// return their intended status/code; anything else is logged and collapsed
// to a generic 500 so internal details (stack traces, DB errors) never leak
// to a client.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
}
