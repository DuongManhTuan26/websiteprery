import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/client.js';

const app = createApp();
const EMAIL_PREFIX = 'settings-test-';

function uniqueEmail() {
  return `${EMAIL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndLogin() {
  const email = uniqueEmail();
  const res = await request(app).post('/auth/register').send({ email, password: 'correct-horse-battery', name: 'Settings Test' });
  return { email, accessToken: res.body.tokens.accessToken as string };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('settings: API key management', () => {
  afterAll(async () => {
    await prisma.apiKey.deleteMany({ where: { workspace: { members: { some: { user: { email: { contains: EMAIL_PREFIX } } } } } } });
    await prisma.chatbot.deleteMany({ where: { workspace: { members: { some: { user: { email: { contains: EMAIL_PREFIX } } } } } } });
    await prisma.workspaceMember.deleteMany({ where: { user: { email: { contains: EMAIL_PREFIX } } } });
    await prisma.workspace.deleteMany({ where: { members: { none: {} } } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: { contains: EMAIL_PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { contains: EMAIL_PREFIX } } });
    await prisma.$disconnect();
  });

  let accessToken: string;
  let workspaceId: string;

  beforeEach(async () => {
    const owner = await registerAndLogin();
    accessToken = owner.accessToken;
    const ws = await request(app).post('/workspaces').set(auth(accessToken)).send({ name: 'Settings Co' });
    workspaceId = ws.body.workspace.id;
  });

  it('reports no key configured by default', async () => {
    const res = await request(app).get(`/workspaces/${workspaceId}/settings/api-keys`).set(auth(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.apiKeys).toEqual([{ provider: 'OPENAI', configured: false, updatedAt: null }]);
  });

  it('sets a key and never echoes it back', async () => {
    const set = await request(app)
      .put(`/workspaces/${workspaceId}/settings/api-keys/OPENAI`)
      .set(auth(accessToken))
      .send({ apiKey: 'sk-real-secret-value' });

    expect(set.status).toBe(200);
    expect(set.body.apiKey.configured).toBe(true);
    expect(JSON.stringify(set.body)).not.toContain('sk-real-secret-value');

    const list = await request(app).get(`/workspaces/${workspaceId}/settings/api-keys`).set(auth(accessToken));
    expect(list.body.apiKeys[0].configured).toBe(true);
    expect(JSON.stringify(list.body)).not.toContain('sk-real-secret-value');

    // the raw DB row is ciphertext, not plaintext
    const row = await prisma.apiKey.findUnique({ where: { workspaceId_provider: { workspaceId, provider: 'OPENAI' } } });
    expect(row?.encryptedKey).not.toContain('sk-real-secret-value');
  });

  it('rejects a plain MEMBER from setting a key, but allows OWNER', async () => {
    const member = await registerAndLogin();
    await request(app).post(`/workspaces/${workspaceId}/members`).set(auth(accessToken)).send({ email: member.email, role: 'MEMBER' });

    const asMember = await request(app)
      .put(`/workspaces/${workspaceId}/settings/api-keys/OPENAI`)
      .set(auth(member.accessToken))
      .send({ apiKey: 'sk-x' });
    expect(asMember.status).toBe(403);

    const asOwner = await request(app)
      .put(`/workspaces/${workspaceId}/settings/api-keys/OPENAI`)
      .set(auth(accessToken))
      .send({ apiKey: 'sk-x' });
    expect(asOwner.status).toBe(200);
  });

  it('deletes a key', async () => {
    await request(app).put(`/workspaces/${workspaceId}/settings/api-keys/OPENAI`).set(auth(accessToken)).send({ apiKey: 'sk-x' });

    const del = await request(app).delete(`/workspaces/${workspaceId}/settings/api-keys/OPENAI`).set(auth(accessToken));
    expect(del.status).toBe(204);

    const list = await request(app).get(`/workspaces/${workspaceId}/settings/api-keys`).set(auth(accessToken));
    expect(list.body.apiKeys[0].configured).toBe(false);
  });

  it('rejects an unsupported provider', async () => {
    const res = await request(app)
      .put(`/workspaces/${workspaceId}/settings/api-keys/MOCK`)
      .set(auth(accessToken))
      .send({ apiKey: 'x' });
    expect(res.status).toBe(400);
  });

  describe('end-to-end wiring: a configured key actually reaches the provider', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('POST .../test-reply uses the real, decrypted workspace key for an OPENAI chatbot', async () => {
      await request(app)
        .put(`/workspaces/${workspaceId}/settings/api-keys/OPENAI`)
        .set(auth(accessToken))
        .send({ apiKey: 'sk-the-real-configured-key' });

      const bot = await request(app)
        .post(`/workspaces/${workspaceId}/chatbots`)
        .set(auth(accessToken))
        .send({ name: 'OpenAI Bot', aiProvider: 'OPENAI' });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Real model reply' } }] })
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await request(app)
        .post(`/workspaces/${workspaceId}/chatbots/${bot.body.chatbot.id}/test-reply`)
        .set(auth(accessToken))
        .send({ message: 'hello' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBe('Real model reply');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(options.headers.Authorization).toBe('Bearer sk-the-real-configured-key');
    });
  });
});
