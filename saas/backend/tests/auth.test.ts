import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/client.js';

const app = createApp();

function uniqueEmail() {
  return `auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe('auth flow', () => {
  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user: { email: { contains: 'auth-test-' } } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'auth-test-' } } });
    await prisma.$disconnect();
  });

  it('registers a new user and returns tokens', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password: 'correct-horse-battery', name: 'Test User' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(typeof res.body.tokens.accessToken).toBe('string');
    expect(typeof res.body.tokens.refreshToken).toBe('string');
  });

  it('rejects registering the same email twice', async () => {
    const email = uniqueEmail();
    await request(app).post('/auth/register').send({ email, password: 'correct-horse-battery', name: 'A' });
    const res = await request(app).post('/auth/register').send({ email, password: 'correct-horse-battery', name: 'B' });

    expect(res.status).toBe(409);
  });

  it('rejects weak passwords with a 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: uniqueEmail(), password: 'short', name: 'Test' });

    expect(res.status).toBe(400);
  });

  describe('with a registered user', () => {
    let email: string;
    const password = 'correct-horse-battery';

    beforeEach(async () => {
      email = uniqueEmail();
      await request(app).post('/auth/register').send({ email, password, name: 'Login Test' });
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app).post('/auth/login').send({ email, password });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(email);
    });

    it('rejects an incorrect password', async () => {
      const res = await request(app).post('/auth/login').send({ email, password: 'wrong-password' });
      expect(res.status).toBe(401);
    });

    it('rejects an unknown email', async () => {
      const res = await request(app).post('/auth/login').send({ email: uniqueEmail(), password });
      expect(res.status).toBe(401);
    });

    it('GET /auth/me requires a valid access token', async () => {
      const noAuth = await request(app).get('/auth/me');
      expect(noAuth.status).toBe(401);

      const login = await request(app).post('/auth/login').send({ email, password });
      const withAuth = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${login.body.tokens.accessToken}`);

      expect(withAuth.status).toBe(200);
      expect(withAuth.body.user.email).toBe(email);
    });

    it('rejects a garbage access token', async () => {
      const res = await request(app).get('/auth/me').set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });

    it('rotates refresh tokens and invalidates the old one after use', async () => {
      const login = await request(app).post('/auth/login').send({ email, password });
      const firstRefreshToken = login.body.tokens.refreshToken;

      const refreshed = await request(app).post('/auth/refresh').send({ refreshToken: firstRefreshToken });
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.refreshToken).not.toBe(firstRefreshToken);

      // Reusing the already-rotated token must fail.
      const reused = await request(app).post('/auth/refresh').send({ refreshToken: firstRefreshToken });
      expect(reused.status).toBe(401);

      // The new token issued by rotation works.
      const secondRefresh = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: refreshed.body.refreshToken });
      expect(secondRefresh.status).toBe(200);
    });

    it('logs out and revokes the refresh token', async () => {
      const login = await request(app).post('/auth/login').send({ email, password });
      const { refreshToken } = login.body.tokens;

      const logoutRes = await request(app).post('/auth/logout').send({ refreshToken });
      expect(logoutRes.status).toBe(204);

      const refreshAfterLogout = await request(app).post('/auth/refresh').send({ refreshToken });
      expect(refreshAfterLogout.status).toBe(401);
    });
  });
});
