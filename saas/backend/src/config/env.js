import 'dotenv/config';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;

  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: required('DATABASE_URL', 'postgresql://localhost:5432/preny_clone'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  facebookAppId: process.env.FACEBOOK_APP_ID || null,
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || null,
  facebookWebhookVerifyToken: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || null,
  s3Bucket: process.env.S3_BUCKET || null,
  s3Region: process.env.AWS_REGION || 'us-east-1',
  // The public base URL customers' images are served from once uploaded to
  // S3 — a CloudFront distribution or the bucket's public website endpoint.
  // Required alongside S3_BUCKET; without it uploads would succeed but
  // produce URLs nothing can actually load.
  s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL || null,
  // Real Stripe account required — without these, /api/billing/* returns
  // 501 rather than a fabricated checkout flow (see billing.service.js).
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || null,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
  // Where Stripe redirects the browser back to after checkout/portal —
  // must be the frontend's real origin, not the API's.
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Real SMTP credentials required — without them, password-reset emails
  // are logged server-side instead of sent (see email.service.js).
  smtpHost: process.env.SMTP_HOST || null,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || null,
  smtpPassword: process.env.SMTP_PASSWORD || null,
  smtpFrom: process.env.SMTP_FROM || 'no-reply@preny-clone.example'
};
