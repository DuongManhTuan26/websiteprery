import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/client.js';

const app = createApp();
const EMAIL_PREFIX = 'bot-test-';

function uniqueEmail() {
  return `${EMAIL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndLogin(name: string) {
  const email = uniqueEmail();
  const res = await request(app).post('/auth/register').send({ email, password: 'correct-horse-battery', name });
  return { email, userId: res.body.user.id as string, accessToken: res.body.tokens.accessToken as string };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('chatbots', () => {
  afterAll(async () => {
    await prisma.chatbot.deleteMany({ where: { workspace: { members: { some: { user: { email: { contains: EMAIL_PREFIX } } } } } } });
    await prisma.workspaceMember.deleteMany({ where: { user: { email: { contains: EMAIL_PREFIX } } } });
    await prisma.workspace.deleteMany({ where: { members: { none: {} } } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: { contains: EMAIL_PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { contains: EMAIL_PREFIX } } });
    await prisma.$disconnect();
  });

  let owner: Awaited<ReturnType<typeof registerAndLogin>>;
  let member: Awaited<ReturnType<typeof registerAndLogin>>;
  let workspaceId: string;

  beforeEach(async () => {
    owner = await registerAndLogin('Owner');
    const ws = await request(app).post('/workspaces').set(auth(owner.accessToken)).send({ name: 'Bot Co' });
    workspaceId = ws.body.workspace.id;

    member = await registerAndLogin('Member');
    await request(app)
      .post(`/workspaces/${workspaceId}/members`)
      .set(auth(owner.accessToken))
      .send({ email: member.email, role: 'MEMBER' });
  });

  it('creates a chatbot with sensible defaults', async () => {
    const res = await request(app)
      .post(`/workspaces/${workspaceId}/chatbots`)
      .set(auth(owner.accessToken))
      .send({ name: 'Support Bot' });

    expect(res.status).toBe(201);
    expect(res.body.chatbot.name).toBe('Support Bot');
    expect(res.body.chatbot.aiProvider).toBe('MOCK');
    expect(res.body.chatbot.isActive).toBe(true);
    expect(typeof res.body.chatbot.widgetToken).toBe('string');
  });

  it('lets any workspace member create and list chatbots', async () => {
    await request(app).post(`/workspaces/${workspaceId}/chatbots`).set(auth(member.accessToken)).send({ name: 'Member Bot' });

    const list = await request(app).get(`/workspaces/${workspaceId}/chatbots`).set(auth(owner.accessToken));
    expect(list.body.chatbots).toHaveLength(1);
    expect(list.body.chatbots[0].name).toBe('Member Bot');
  });

  it('updates a chatbot', async () => {
    const created = await request(app)
      .post(`/workspaces/${workspaceId}/chatbots`)
      .set(auth(owner.accessToken))
      .send({ name: 'Bot' });

    const updated = await request(app)
      .patch(`/workspaces/${workspaceId}/chatbots/${created.body.chatbot.id}`)
      .set(auth(owner.accessToken))
      .send({ name: 'Renamed Bot', isActive: false });

    expect(updated.status).toBe(200);
    expect(updated.body.chatbot.name).toBe('Renamed Bot');
    expect(updated.body.chatbot.isActive).toBe(false);
  });

  it('rejects a plain MEMBER from deleting a chatbot, but allows OWNER', async () => {
    const created = await request(app)
      .post(`/workspaces/${workspaceId}/chatbots`)
      .set(auth(owner.accessToken))
      .send({ name: 'Bot' });

    const asMember = await request(app)
      .delete(`/workspaces/${workspaceId}/chatbots/${created.body.chatbot.id}`)
      .set(auth(member.accessToken));
    expect(asMember.status).toBe(403);

    const asOwner = await request(app)
      .delete(`/workspaces/${workspaceId}/chatbots/${created.body.chatbot.id}`)
      .set(auth(owner.accessToken));
    expect(asOwner.status).toBe(204);
  });

  it('404s for a chatbot id from a different workspace (tenant isolation)', async () => {
    const otherWs = await request(app).post('/workspaces').set(auth(owner.accessToken)).send({ name: 'Other Co' });
    const botInOther = await request(app)
      .post(`/workspaces/${otherWs.body.workspace.id}/chatbots`)
      .set(auth(owner.accessToken))
      .send({ name: 'Other Bot' });

    const res = await request(app)
      .get(`/workspaces/${workspaceId}/chatbots/${botInOther.body.chatbot.id}`)
      .set(auth(owner.accessToken));

    expect(res.status).toBe(404);
  });

  it('rejects access from a non-member of the workspace', async () => {
    const stranger = await registerAndLogin('Stranger');
    const res = await request(app).get(`/workspaces/${workspaceId}/chatbots`).set(auth(stranger.accessToken));
    expect(res.status).toBe(403);
  });
});
