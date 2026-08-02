import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/client.js';

const app = createApp();
const EMAIL_PREFIX = 'crm-test-';

function uniqueEmail() {
  return `${EMAIL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndLogin() {
  const email = uniqueEmail();
  const res = await request(app).post('/auth/register').send({ email, password: 'correct-horse-battery', name: 'CRM Test' });
  return { email, accessToken: res.body.tokens.accessToken as string };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('mini CRM (contacts)', () => {
  afterAll(async () => {
    await prisma.conversation.updateMany({
      where: { contact: { workspace: { members: { some: { user: { email: { contains: EMAIL_PREFIX } } } } } } },
      data: { contactId: null }
    });
    await prisma.contact.deleteMany({ where: { workspace: { members: { some: { user: { email: { contains: EMAIL_PREFIX } } } } } } });
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
    const ws = await request(app).post('/workspaces').set(auth(accessToken)).send({ name: 'CRM Co' });
    workspaceId = ws.body.workspace.id;
  });

  it('creates and lists a contact', async () => {
    const created = await request(app)
      .post(`/workspaces/${workspaceId}/contacts`)
      .set(auth(accessToken))
      .send({ name: 'Jane Doe', email: 'jane@customer.example', tags: ['vip'] });

    expect(created.status).toBe(201);
    expect(created.body.contact.name).toBe('Jane Doe');
    expect(created.body.contact.tags).toEqual(['vip']);

    const list = await request(app).get(`/workspaces/${workspaceId}/contacts`).set(auth(accessToken));
    expect(list.body.contacts).toHaveLength(1);
  });

  it('updates a contact', async () => {
    const created = await request(app).post(`/workspaces/${workspaceId}/contacts`).set(auth(accessToken)).send({ name: 'Old Name' });

    const updated = await request(app)
      .patch(`/workspaces/${workspaceId}/contacts/${created.body.contact.id}`)
      .set(auth(accessToken))
      .send({ name: 'New Name', notes: 'Called about refund' });

    expect(updated.status).toBe(200);
    expect(updated.body.contact.name).toBe('New Name');
    expect(updated.body.contact.notes).toBe('Called about refund');
  });

  it('404s for a contact id from a different workspace (tenant isolation)', async () => {
    const otherWs = await request(app).post('/workspaces').set(auth(accessToken)).send({ name: 'Other Co' });
    const otherContact = await request(app)
      .post(`/workspaces/${otherWs.body.workspace.id}/contacts`)
      .set(auth(accessToken))
      .send({ name: 'Other Contact' });

    const res = await request(app)
      .get(`/workspaces/${workspaceId}/contacts/${otherContact.body.contact.id}`)
      .set(auth(accessToken));
    expect(res.status).toBe(404);
  });

  it('rejects a plain MEMBER from deleting a contact, but allows OWNER', async () => {
    const member = await registerAndLogin();
    await request(app)
      .post(`/workspaces/${workspaceId}/members`)
      .set(auth(accessToken))
      .send({ email: member.email, role: 'MEMBER' });

    const created = await request(app).post(`/workspaces/${workspaceId}/contacts`).set(auth(accessToken)).send({ name: 'X' });

    const asMember = await request(app)
      .delete(`/workspaces/${workspaceId}/contacts/${created.body.contact.id}`)
      .set(auth(member.accessToken));
    expect(asMember.status).toBe(403);

    const asOwner = await request(app)
      .delete(`/workspaces/${workspaceId}/contacts/${created.body.contact.id}`)
      .set(auth(accessToken));
    expect(asOwner.status).toBe(204);
  });

  describe('linking a conversation to a contact', () => {
    let conversationId: string;
    let contactId: string;

    beforeEach(async () => {
      const bot = await request(app).post(`/workspaces/${workspaceId}/chatbots`).set(auth(accessToken)).send({ name: 'Bot' });
      const started = await request(app).post(`/widget/${bot.body.chatbot.widgetToken}/message`).send({ message: 'Hi' });
      conversationId = started.body.conversationId;

      const contact = await request(app).post(`/workspaces/${workspaceId}/contacts`).set(auth(accessToken)).send({ name: 'Real Customer' });
      contactId = contact.body.contact.id;
    });

    it('links a conversation to a contact and it appears in the contact detail view', async () => {
      const link = await request(app)
        .patch(`/workspaces/${workspaceId}/conversations/${conversationId}/contact`)
        .set(auth(accessToken))
        .send({ contactId });

      expect(link.status).toBe(200);
      expect(link.body.conversation.contact.id).toBe(contactId);

      const contactDetail = await request(app).get(`/workspaces/${workspaceId}/contacts/${contactId}`).set(auth(accessToken));
      expect(contactDetail.body.contact.conversations).toHaveLength(1);
      expect(contactDetail.body.contact.conversations[0].id).toBe(conversationId);
      // regression: the nested conversation summary must include a real
      // last message, not just chatbot metadata (caught by a live E2E run
      // where the UI silently showed "(no messages)" for a conversation
      // that had two real messages).
      expect(contactDetail.body.contact.conversations[0].messageCount).toBe(2);
      expect(contactDetail.body.contact.conversations[0].lastMessage.content).toContain('[mock-ai]');
    });

    it('rejects linking to a contact from a different workspace', async () => {
      const otherWs = await request(app).post('/workspaces').set(auth(accessToken)).send({ name: 'Other Co 2' });
      const otherContact = await request(app)
        .post(`/workspaces/${otherWs.body.workspace.id}/contacts`)
        .set(auth(accessToken))
        .send({ name: 'Not in this workspace' });

      const res = await request(app)
        .patch(`/workspaces/${workspaceId}/conversations/${conversationId}/contact`)
        .set(auth(accessToken))
        .send({ contactId: otherContact.body.contact.id });

      expect(res.status).toBe(404);
    });

    it('unlinks with contactId: null', async () => {
      await request(app)
        .patch(`/workspaces/${workspaceId}/conversations/${conversationId}/contact`)
        .set(auth(accessToken))
        .send({ contactId });

      const unlink = await request(app)
        .patch(`/workspaces/${workspaceId}/conversations/${conversationId}/contact`)
        .set(auth(accessToken))
        .send({ contactId: null });

      expect(unlink.status).toBe(200);
      expect(unlink.body.conversation.contact).toBeNull();
    });
  });
});
