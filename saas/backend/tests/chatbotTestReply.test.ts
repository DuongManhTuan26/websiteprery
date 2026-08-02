import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/client.js';

const app = createApp();
const EMAIL_PREFIX = 'reply-test-';

function uniqueEmail() {
  return `${EMAIL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndLogin() {
  const email = uniqueEmail();
  const res = await request(app).post('/auth/register').send({ email, password: 'correct-horse-battery', name: 'Reply Test' });
  return { accessToken: res.body.tokens.accessToken as string };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('POST /workspaces/:id/chatbots/:id/test-reply', () => {
  afterAll(async () => {
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
    const ws = await request(app).post('/workspaces').set(auth(accessToken)).send({ name: 'Reply Co' });
    workspaceId = ws.body.workspace.id;
  });

  it('returns a real Mock reply for a MOCK-provider chatbot (default)', async () => {
    const bot = await request(app)
      .post(`/workspaces/${workspaceId}/chatbots`)
      .set(auth(accessToken))
      .send({ name: 'Bot' });

    const res = await request(app)
      .post(`/workspaces/${workspaceId}/chatbots/${bot.body.chatbot.id}/test-reply`)
      .set(auth(accessToken))
      .send({ message: 'Is this working?' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('[mock-ai]');
  });

  it('returns 400 for an OPENAI-provider chatbot with no workspace API key configured', async () => {
    const bot = await request(app)
      .post(`/workspaces/${workspaceId}/chatbots`)
      .set(auth(accessToken))
      .send({ name: 'Bot', aiProvider: 'OPENAI' });

    const res = await request(app)
      .post(`/workspaces/${workspaceId}/chatbots/${bot.body.chatbot.id}/test-reply`)
      .set(auth(accessToken))
      .send({ message: 'hi' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/API key/i);
  });

  it('404s for a chatbot in a different workspace', async () => {
    const otherWs = await request(app).post('/workspaces').set(auth(accessToken)).send({ name: 'Other Co' });
    const otherBot = await request(app)
      .post(`/workspaces/${otherWs.body.workspace.id}/chatbots`)
      .set(auth(accessToken))
      .send({ name: 'Other Bot' });

    const res = await request(app)
      .post(`/workspaces/${workspaceId}/chatbots/${otherBot.body.chatbot.id}/test-reply`)
      .set(auth(accessToken))
      .send({ message: 'hi' });

    expect(res.status).toBe(404);
  });
});
