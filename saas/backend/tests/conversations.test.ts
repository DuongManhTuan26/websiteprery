import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/client.js';

const app = createApp();
const EMAIL_PREFIX = 'convo-test-';

function uniqueEmail() {
  return `${EMAIL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndLogin() {
  const email = uniqueEmail();
  const res = await request(app).post('/auth/register').send({ email, password: 'correct-horse-battery', name: 'Convo Test' });
  return { accessToken: res.body.tokens.accessToken as string };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('conversations (dashboard read API)', () => {
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
  let widgetToken: string;

  beforeEach(async () => {
    const owner = await registerAndLogin();
    accessToken = owner.accessToken;
    const ws = await request(app).post('/workspaces').set(auth(accessToken)).send({ name: 'Convo Co' });
    workspaceId = ws.body.workspace.id;
    const bot = await request(app)
      .post(`/workspaces/${workspaceId}/chatbots`)
      .set(auth(accessToken))
      .send({ name: 'Convo Bot' });
    widgetToken = bot.body.chatbot.widgetToken;
  });

  it('lists conversations created via the widget, most recently updated first', async () => {
    const first = await request(app).post(`/widget/${widgetToken}/message`).send({ message: 'Hello from visitor A' });
    await new Promise(r => setTimeout(r, 10));
    await request(app).post(`/widget/${widgetToken}/message`).send({ message: 'Hello from visitor B' });

    const res = await request(app).get(`/workspaces/${workspaceId}/conversations`).set(auth(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(2);
    expect(res.body.conversations[0].messageCount).toBe(2);
    expect(res.body.conversations[0].lastMessage.role).toBe('ASSISTANT');
    expect(res.body.conversations[0].chatbot.name).toBe('Convo Bot');

    // most recently updated (visitor B's) first
    expect(res.body.conversations[0].id).not.toBe(first.body.conversationId);
  });

  it('returns the full message thread for one conversation', async () => {
    const started = await request(app).post(`/widget/${widgetToken}/message`).send({ message: 'First' });
    await request(app)
      .post(`/widget/${widgetToken}/message`)
      .send({ message: 'Second', conversationId: started.body.conversationId });

    const res = await request(app)
      .get(`/workspaces/${workspaceId}/conversations/${started.body.conversationId}`)
      .set(auth(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.conversation.messages).toHaveLength(4);
    expect(res.body.conversation.messages.map((m: { content: string }) => m.content)[0]).toBe('First');
    expect(res.body.conversation.messages.map((m: { content: string }) => m.content)[2]).toBe('Second');
  });

  it('404s for a conversation belonging to a different workspace', async () => {
    const started = await request(app).post(`/widget/${widgetToken}/message`).send({ message: 'Hi' });

    const otherOwner = await registerAndLogin();
    const otherWs = await request(app).post('/workspaces').set(auth(otherOwner.accessToken)).send({ name: 'Other Co' });

    const res = await request(app)
      .get(`/workspaces/${otherWs.body.workspace.id}/conversations/${started.body.conversationId}`)
      .set(auth(otherOwner.accessToken));

    expect(res.status).toBe(404);
  });

  it('rejects access from a non-member of the workspace', async () => {
    const stranger = await registerAndLogin();
    const res = await request(app).get(`/workspaces/${workspaceId}/conversations`).set(auth(stranger.accessToken));
    expect(res.status).toBe(403);
  });
});
