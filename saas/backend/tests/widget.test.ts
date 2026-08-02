import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/client.js';

const app = createApp();
const EMAIL_PREFIX = 'widget-test-';

function uniqueEmail() {
  return `${EMAIL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndLogin() {
  const email = uniqueEmail();
  const res = await request(app).post('/auth/register').send({ email, password: 'correct-horse-battery', name: 'Widget Test' });
  return { accessToken: res.body.tokens.accessToken as string };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('public widget API', () => {
  afterAll(async () => {
    await prisma.chatbot.deleteMany({ where: { workspace: { members: { some: { user: { email: { contains: EMAIL_PREFIX } } } } } } });
    await prisma.workspaceMember.deleteMany({ where: { user: { email: { contains: EMAIL_PREFIX } } } });
    await prisma.workspace.deleteMany({ where: { members: { none: {} } } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: { contains: EMAIL_PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { contains: EMAIL_PREFIX } } });
    await prisma.$disconnect();
  });

  let widgetToken: string;
  let chatbotId: string;
  let workspaceId: string;
  let accessToken: string;

  beforeEach(async () => {
    const owner = await registerAndLogin();
    accessToken = owner.accessToken;
    const ws = await request(app).post('/workspaces').set(auth(accessToken)).send({ name: 'Widget Co' });
    workspaceId = ws.body.workspace.id;
    const bot = await request(app)
      .post(`/workspaces/${workspaceId}/chatbots`)
      .set(auth(accessToken))
      .send({ name: 'Public Bot' });
    chatbotId = bot.body.chatbot.id;
    widgetToken = bot.body.chatbot.widgetToken;
  });

  it('requires no authentication at all', async () => {
    const res = await request(app).get(`/widget/${widgetToken}/config`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Public Bot', isActive: true });
  });

  it('sends the CORS Access-Control-Allow-Origin header reflecting an arbitrary origin', async () => {
    const res = await request(app)
      .get(`/widget/${widgetToken}/config`)
      .set('Origin', 'https://some-random-customer-site.example');

    expect(res.headers['access-control-allow-origin']).toBe('https://some-random-customer-site.example');
  });

  it('returns 404 for an unknown token', async () => {
    const res = await request(app).get('/widget/00000000-0000-0000-0000-000000000000/config');
    expect(res.status).toBe(404);
  });

  it('returns a real reply from the configured (Mock) provider and starts a real conversation', async () => {
    const res = await request(app).post(`/widget/${widgetToken}/message`).send({ message: 'Hi there' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('[mock-ai]');
    expect(typeof res.body.conversationId).toBe('string');

    const messages = await prisma.message.findMany({ where: { conversationId: res.body.conversationId } });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('USER');
    expect(messages[0].content).toBe('Hi there');
    expect(messages[1].role).toBe('ASSISTANT');
  });

  it('rejects messages once the chatbot is deactivated', async () => {
    await request(app)
      .patch(`/workspaces/${workspaceId}/chatbots/${chatbotId}`)
      .set(auth(accessToken))
      .send({ isActive: false });

    const res = await request(app).post(`/widget/${widgetToken}/message`).send({ message: 'Hi' });
    expect(res.status).toBe(403);
  });

  it('appends to the same conversation across multiple messages, in real persisted order', async () => {
    const first = await request(app).post(`/widget/${widgetToken}/message`).send({ message: 'First message' });
    const second = await request(app)
      .post(`/widget/${widgetToken}/message`)
      .send({ message: 'Second message', conversationId: first.body.conversationId });

    expect(second.body.conversationId).toBe(first.body.conversationId);

    const messages = await prisma.message.findMany({
      where: { conversationId: first.body.conversationId },
      orderBy: { createdAt: 'asc' }
    });
    expect(messages).toHaveLength(4);
    expect(messages.map(m => m.content)).toEqual([
      'First message',
      expect.stringContaining('[mock-ai]'),
      'Second message',
      expect.stringContaining('[mock-ai]')
    ]);
  });

  it('rejects an unknown conversationId', async () => {
    const res = await request(app)
      .post(`/widget/${widgetToken}/message`)
      .send({ message: 'hi', conversationId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  it('rejects a conversationId belonging to a different chatbot (tenant isolation)', async () => {
    const otherBot = await request(app)
      .post(`/workspaces/${workspaceId}/chatbots`)
      .set(auth(accessToken))
      .send({ name: 'Other Bot' });
    const otherConvo = await request(app).post(`/widget/${otherBot.body.chatbot.widgetToken}/message`).send({ message: 'hi' });

    const res = await request(app)
      .post(`/widget/${widgetToken}/message`)
      .send({ message: 'hi', conversationId: otherConvo.body.conversationId });
    expect(res.status).toBe(404);
  });
});
