import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

let server;
let baseUrl;

before(async () => {
  const plan = await prisma.plan.findUnique({ where: { name: 'Starter' } });

  if (!plan) {
    await prisma.plan.create({
      data: { name: 'Starter', priceMonthly: 0, maxFanpages: 1, maxChatbots: 1, maxConversations: 200 }
    });
  }

  const app = createApp();
  server = createServer(app);

  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
});

async function registerUser(email) {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessName: 'Test Co', name: 'Test User', email, password: 'matkhau123' })
  });

  return res.json();
}

test('POST /api/leads is public (no auth) and creates a real Lead row', async () => {
  const res = await fetch(`${baseUrl}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Nguyễn Test', phone: '0900000000', category: 'demo' })
  });

  assert.equal(res.status, 201);
  const { id } = await res.json();

  const lead = await prisma.lead.findUnique({ where: { id } });
  assert.equal(lead.fullName, 'Nguyễn Test');
  assert.equal(lead.status, 'NEW');
});

test('GET /api/admin/leads rejects a regular (non-platform-admin) user', async () => {
  const { accessToken } = await registerUser(`regular-${Date.now()}@example.com`);

  const res = await fetch(`${baseUrl}/api/admin/leads`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  assert.equal(res.status, 403);
});

test('GET /api/admin/leads succeeds once the user is promoted to platform admin', async () => {
  const email = `admin-${Date.now()}@example.com`;
  const { accessToken, user } = await registerUser(email);

  await prisma.user.update({ where: { id: user.id }, data: { isPlatformAdmin: true } });

  const res = await fetch(`${baseUrl}/api/admin/leads`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(await res.json()));
});

test('a demoted platform admin loses access immediately (no DB caching in the JWT)', async () => {
  const email = `demoted-${Date.now()}@example.com`;
  const { accessToken, user } = await registerUser(email);

  await prisma.user.update({ where: { id: user.id }, data: { isPlatformAdmin: true } });
  const first = await fetch(`${baseUrl}/api/admin/leads`, { headers: { Authorization: `Bearer ${accessToken}` } });
  assert.equal(first.status, 200);

  await prisma.user.update({ where: { id: user.id }, data: { isPlatformAdmin: false } });
  const second = await fetch(`${baseUrl}/api/admin/leads`, { headers: { Authorization: `Bearer ${accessToken}` } });
  assert.equal(second.status, 403);
});
