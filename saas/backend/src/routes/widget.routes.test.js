import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

// Regression test for a real cross-tenant data leak: GET
// /:conversationId/messages originally had no ownership check at all —
// any caller who knew (or guessed — conversationId is a real UUID visible
// client-side, not a secret) a conversationId could read a different
// account's widget conversation. Fixed by requiring widgetKey and
// cross-checking it against the conversation's own account.
let server;
let baseUrl;

before(async () => {
  const app = createApp();
  server = createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
});

// Two separate accounts, not two chatbots on one — the Starter plan caps
// chatbots at 1 (see plan.service.js), and this test needs two genuinely
// different accounts' widgets to prove cross-tenant isolation anyway.
async function createChatbotForNewAccount(label) {
  const email = `widget-history-${label}-${Date.now()}@example.com`;
  const reg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessName: `Widget Co ${label}`, name: 'Widget Owner', email, password: 'matkhau123' })
  }).then(r => r.json());

  return fetch(`${baseUrl}/api/chatbots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${reg.accessToken}` },
    body: JSON.stringify({ name: 'Support Bot', systemPrompt: 'Bạn là trợ lý bán hàng.' })
  }).then(r => r.json());
}

async function startConversation(widgetKey) {
  const res = await fetch(`${baseUrl}/api/widget/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ widgetKey })
  });
  return res.json();
}

test('GET /:conversationId/messages requires widgetKey and rejects a different widget entirely', async () => {
  const botA = await createChatbotForNewAccount('a');
  const botB = await createChatbotForNewAccount('b');

  const { conversationId } = await startConversation(botA.widgetKey);

  const withOwnKey = await fetch(
    `${baseUrl}/api/widget/${conversationId}/messages?widgetKey=${botA.widgetKey}`
  );
  assert.equal(withOwnKey.status, 200);

  const withWrongKey = await fetch(
    `${baseUrl}/api/widget/${conversationId}/messages?widgetKey=${botB.widgetKey}`
  );
  assert.equal(withWrongKey.status, 404);

  const withNoKey = await fetch(`${baseUrl}/api/widget/${conversationId}/messages`);
  assert.equal(withNoKey.status, 400);
});
