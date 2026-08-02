import type { ZodType } from 'zod';
import { ValidationError } from '../middleware/errorHandler.js';

// Parses `input` against `schema`, throwing a ValidationError (-> 400) with
// a readable message on failure instead of leaking a raw zod issue array.
export function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const message = result.error.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    throw new ValidationError(message);
  }

  return result.data;
}
