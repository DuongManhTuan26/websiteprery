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

test('register creates a real Account + User + Subscription and returns a usable access token', async () => {
  const email = `test-${Date.now()}@example.com`;

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessName: 'Test Co', name: 'Test User', email, password: 'matkhau123' })
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.accessToken);
  assert.equal(body.user.email, email);

  const subscription = await prisma.subscription.findFirst({ where: { accountId: body.user.accountId } });
  assert.ok(subscription, 'register must create a real Subscription row');

  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${body.accessToken}` }
  });
  assert.equal(meRes.status, 200);
});

test('register rejects a duplicate email', async () => {
  const email = `dup-${Date.now()}@example.com`;
  const payload = { businessName: 'Test Co', name: 'Test User', email, password: 'matkhau123' };

  const first = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.equal(first.status, 201);

  const second = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.equal(second.status, 409);
});

test('login with a wrong password is rejected', async () => {
  const email = `wrongpw-${Date.now()}@example.com`;

  await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessName: 'Test Co', name: 'Test User', email, password: 'matkhau123' })
  });

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'wrong-password' })
  });

  assert.equal(res.status, 401);
});

test('protected routes reject requests with no token', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/summary`);
  assert.equal(res.status, 401);
});

test('creating a chatbot beyond the Starter plan limit (1) returns 402', async () => {
  const email = `planlimit-${Date.now()}@example.com`;

  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessName: 'Test Co', name: 'Test User', email, password: 'matkhau123' })
  });
  const { accessToken } = await registerRes.json();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };

  const first = await fetch(`${baseUrl}/api/chatbots`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Bot 1', systemPrompt: 'You are a helpful assistant.' })
  });
  assert.equal(first.status, 201);

  const second = await fetch(`${baseUrl}/api/chatbots`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Bot 2', systemPrompt: 'You are a helpful assistant.' })
  });
  assert.equal(second.status, 402);
});
