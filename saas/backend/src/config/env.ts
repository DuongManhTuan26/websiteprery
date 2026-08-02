import { z } from 'zod';
import 'dotenv/config';

// Fails fast at boot on missing/invalid config rather than limping along
// with silently-wrong defaults in production.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  // Required, not optional: the settings module (encryption.ts) depends on
  // it for real functionality (storing AI provider API keys), so a missing
  // key should fail the whole process at boot, not fail confusingly later
  // the first time someone tries to save a key.
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  DASHBOARD_ORIGIN: z.string().default('http://localhost:5173'),
  // Absolute path to the built widget bundle's directory (containing
  // widget.js). Unset in local dev (app.ts falls back to the monorepo-
  // relative path); set explicitly in the Docker image, where the widget
  // is built into a different location than the source-tree layout.
  WIDGET_DIST_DIR: z.string().optional()
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();
