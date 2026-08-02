import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/client.js';

const app = createApp();
const EMAIL_PREFIX = 'ws-test-';

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

describe('workspaces', () => {
  afterAll(async () => {
    await prisma.workspaceMember.deleteMany({ where: { user: { email: { contains: EMAIL_PREFIX } } } });
    await prisma.workspace.deleteMany({ where: { members: { none: {} } } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: { contains: EMAIL_PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { contains: EMAIL_PREFIX } } });
    await prisma.$disconnect();
  });

  let owner: Awaited<ReturnType<typeof registerAndLogin>>;

  beforeEach(async () => {
    owner = await registerAndLogin('Owner');
  });

  it('creates a workspace and makes the creator OWNER', async () => {
    const res = await request(app).post('/workspaces').set(auth(owner.accessToken)).send({ name: 'Acme Inc' });

    expect(res.status).toBe(201);
    expect(res.body.workspace.name).toBe('Acme Inc');
    expect(res.body.workspace.slug).toMatch(/^acme-inc-[0-9a-f]{6}$/);

    const list = await request(app).get('/workspaces').set(auth(owner.accessToken));
    expect(list.body.workspaces.some((w: { id: string; role: string }) => w.id === res.body.workspace.id && w.role === 'OWNER')).toBe(true);
  });

  it('rejects access from a non-member', async () => {
    const created = await request(app).post('/workspaces').set(auth(owner.accessToken)).send({ name: 'Private Co' });
    const stranger = await registerAndLogin('Stranger');

    const res = await request(app).get(`/workspaces/${created.body.workspace.id}`).set(auth(stranger.accessToken));
    expect(res.status).toBe(403);
  });

  describe('membership + RBAC', () => {
    let workspaceId: string;
    let admin: Awaited<ReturnType<typeof registerAndLogin>>;
    let member: Awaited<ReturnType<typeof registerAndLogin>>;

    beforeEach(async () => {
      const created = await request(app).post('/workspaces').set(auth(owner.accessToken)).send({ name: 'Team Co' });
      workspaceId = created.body.workspace.id;

      admin = await registerAndLogin('Admin');
      await request(app)
        .post(`/workspaces/${workspaceId}/members`)
        .set(auth(owner.accessToken))
        .send({ email: admin.email, role: 'ADMIN' });

      member = await registerAndLogin('Member');
      await request(app)
        .post(`/workspaces/${workspaceId}/members`)
        .set(auth(owner.accessToken))
        .send({ email: member.email, role: 'MEMBER' });
    });

    it('lists all three members with correct roles', async () => {
      const res = await request(app).get(`/workspaces/${workspaceId}/members`).set(auth(owner.accessToken));
      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(3);
      const roles = res.body.members.map((m: { role: string }) => m.role).sort();
      expect(roles).toEqual(['ADMIN', 'MEMBER', 'OWNER']);
    });

    it('rejects adding a member who has no account', async () => {
      const res = await request(app)
        .post(`/workspaces/${workspaceId}/members`)
        .set(auth(owner.accessToken))
        .send({ email: 'nobody@example.com' });
      expect(res.status).toBe(404);
    });

    it('rejects a plain MEMBER from adding new members', async () => {
      const res = await request(app)
        .post(`/workspaces/${workspaceId}/members`)
        .set(auth(member.accessToken))
        .send({ email: uniqueEmail() });
      expect(res.status).toBe(403);
    });

    it('allows ADMIN to remove a MEMBER but not an OWNER', async () => {
      const removeMember = await request(app)
        .delete(`/workspaces/${workspaceId}/members/${member.userId}`)
        .set(auth(admin.accessToken));
      expect(removeMember.status).toBe(204);

      const removeOwner = await request(app)
        .delete(`/workspaces/${workspaceId}/members/${owner.userId}`)
        .set(auth(admin.accessToken));
      expect(removeOwner.status).toBe(403);
    });

    it('prevents removing the last owner', async () => {
      const res = await request(app)
        .delete(`/workspaces/${workspaceId}/members/${owner.userId}`)
        .set(auth(owner.accessToken));
      expect(res.status).toBe(403);
    });

    it('prevents an ADMIN from granting OWNER', async () => {
      const res = await request(app)
        .patch(`/workspaces/${workspaceId}/members/${member.userId}`)
        .set(auth(admin.accessToken))
        .send({ role: 'OWNER' });
      expect(res.status).toBe(403);
    });

    it('allows OWNER to promote a MEMBER to OWNER, and then the workspace has two owners', async () => {
      const res = await request(app)
        .patch(`/workspaces/${workspaceId}/members/${member.userId}`)
        .set(auth(owner.accessToken))
        .send({ role: 'OWNER' });
      expect(res.status).toBe(200);

      const members = await request(app).get(`/workspaces/${workspaceId}/members`).set(auth(owner.accessToken));
      const owners = members.body.members.filter((m: { role: string }) => m.role === 'OWNER');
      expect(owners).toHaveLength(2);
    });

    it('only OWNER can delete the workspace', async () => {
      const asAdmin = await request(app).delete(`/workspaces/${workspaceId}`).set(auth(admin.accessToken));
      expect(asAdmin.status).toBe(403);

      const asOwner = await request(app).delete(`/workspaces/${workspaceId}`).set(auth(owner.accessToken));
      expect(asOwner.status).toBe(204);
    });
  });
});
