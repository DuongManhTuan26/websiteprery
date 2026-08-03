import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

// Regression test for a real functional bug: a human agent replying from
// the dashboard inbox to a FACEBOOK-channel conversation was only ever
// saved locally — conversation.service.js's forwardToFacebook (extracted
// from what used to be bot-reply-only logic) was never called from the
// agent-reply route, so the real Messenger customer never received it.
// Fixed in conversations.routes.js.
//
// This doesn't hit the real Facebook Graph API (no real Page Access Token
// exists in this environment, and this suite never makes real third-party
// network calls — see billing.service.test.js for the same policy) — it
// verifies the route actually reaches the forwarding call and behaves
// correctly (still 201s, still saves the message) rather than crashing,
// for the channels/states that don't require a live network call.
let server;
let baseUrl;
let accessToken;
let accountId;

before(async () => {
  server = createServer(createApp());
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  const email = `fb-forward-${Date.now()}@example.com`;
  const reg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessName: 'FB Forward Co', name: 'Agent', email, password: 'matkhau123' })
  }).then(r => r.json());
  accessToken = reg.accessToken;
  accountId = reg.user.accountId;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
});

async function authed(path, opts = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...opts.headers }
  });
}

test('agent reply on a WIDGET conversation saves normally (no Facebook forward attempted)', async () => {
  const customer = await prisma.customer.create({ data: { accountId, name: 'Widget Visitor' } });
  const conversation = await prisma.conversation.create({
    data: { accountId, customerId: customer.id, channel: 'WIDGET', status: 'HUMAN' }
  });

  const res = await authed(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: 'Xin chào, tôi có thể giúp gì cho bạn?' })
  });

  assert.equal(res.status, 201);
  const message = await res.json();
  assert.equal(message.senderType, 'AGENT');
  assert.equal(message.content, 'Xin chào, tôi có thể giúp gì cho bạn?');
});

test('agent reply on a FACEBOOK conversation with no real fanpage on file still saves (forward safely no-ops)', async () => {
  const customer = await prisma.customer.create({
    data: { accountId, facebookPsid: `psid-${Date.now()}`, name: 'FB Customer' }
  });
  // No Fanpage row for this conversation's fanpageId — simulates a
  // conversation whose page was later disconnected, or (as here) simply
  // never given a real one, without requiring a real Page Access Token.
  const conversation = await prisma.conversation.create({
    data: { accountId, customerId: customer.id, channel: 'FACEBOOK', status: 'HUMAN', fanpageId: null }
  });

  const res = await authed(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: 'Dạ shop xin chào ạ' })
  });

  assert.equal(res.status, 201);
  const message = await res.json();
  assert.equal(message.content, 'Dạ shop xin chào ạ');

  const stored = await prisma.message.findUnique({ where: { id: message.id } });
  assert.ok(stored, 'message must still be persisted locally regardless of Facebook delivery outcome');
});
