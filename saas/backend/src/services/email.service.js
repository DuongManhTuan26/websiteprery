import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// Same lazy-init-or-null pattern as billing.service.js's Stripe client and
// storage.service.js's S3 client — real SMTP integration, but every
// caller below degrades to "log it, don't send it" rather than
// pretending an email went out when no real mail server is configured.
let transporter = null;

function getTransporter() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPassword) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: { user: env.smtpUser, pass: env.smtpPassword }
    });
  }

  return transporter;
}

export function isEmailConfigured() {
  return getTransporter() !== null;
}

// Returns whether a real email was actually sent — callers that must
// never leak this to an untrusted caller (see /api/auth/forgot-password,
// which always returns the same generic response either way to avoid
// account-enumeration) use this only for server-side logging.
export async function sendPasswordResetEmail(toEmail, resetUrl) {
  const client = getTransporter();

  if (!client) {
    console.log(`[email] SMTP not configured — cannot deliver password reset email to ${toEmail}. Reset URL: ${resetUrl}`);
    return false;
  }

  await client.sendMail({
    from: env.smtpFrom,
    to: toEmail,
    subject: 'Đặt lại mật khẩu Preny Clone',
    text: `Nhấn vào liên kết sau để đặt lại mật khẩu (hết hạn sau 1 giờ): ${resetUrl}\n\nNếu bạn không yêu cầu điều này, hãy bỏ qua email này.`,
    html: `<p>Nhấn vào liên kết sau để đặt lại mật khẩu (hết hạn sau 1 giờ):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Nếu bạn không yêu cầu điều này, hãy bỏ qua email này.</p>`
  });

  return true;
}
