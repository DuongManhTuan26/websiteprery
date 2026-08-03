import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.js';
import { createDefaultSubscription, enforceResourceLimit, enforceConversationLimit } from './plan.service.js';
import { ApiError } from '../middleware/errorHandler.js';

let accountId;

before(async () => {
  const plan = await prisma.plan.findUnique({ where: { name: 'Starter' } });

  if (!plan) {
    // Tests run against a dedicated test database (see package.json's
    // `test` script) that starts empty — seed the same real Plan rows
    // prisma/seed.js would, rather than fabricating test-only plan data.
    await prisma.plan.create({
      data: { name: 'Starter', priceMonthly: 0, maxFanpages: 1, maxChatbots: 1, maxConversations: 200 }
    });
  }
});

beforeEach(async () => {
  const account = await prisma.account.create({ data: { name: 'Test Business' } });
  accountId = account.id;
});

after(async () => {
  await prisma.$disconnect();
});

test('createDefaultSubscription attaches the Starter plan, TRIALING', async () => {
  const subscription = await createDefaultSubscription(accountId);
  const withPlan = await prisma.subscription.findUnique({ where: { id: subscription.id }, include: { plan: true } });

  assert.equal(withPlan.plan.name, 'Starter');
  assert.equal(withPlan.status, 'TRIALING');
  assert.ok(withPlan.currentPeriodEnd > new Date());
});

test('enforceResourceLimit allows creation under the limit', async () => {
  await createDefaultSubscription(accountId);
  await assert.doesNotReject(() => enforceResourceLimit(accountId, 'chatbot'));
});

test('enforceResourceLimit rejects once the plan limit (1 chatbot) is reached', async () => {
  await createDefaultSubscription(accountId);
  await prisma.chatbot.create({
    data: { accountId, name: 'Existing bot', systemPrompt: 'x' }
  });

  await assert.rejects(() => enforceResourceLimit(accountId, 'chatbot'), ApiError);
});

test('enforceResourceLimit(accountId, key, N) correctly accounts for a batch of N new resources', async () => {
  // Regression test: connecting 2 Facebook pages at once against a
  // 1-fanpage plan must be rejected as a batch, not checked one-at-a-time
  // against a count that hasn't been incremented yet (the original bug —
  // see git history / CLAUDE.md-equivalent notes in plan.service.js).
  await createDefaultSubscription(accountId);

  await assert.rejects(() => enforceResourceLimit(accountId, 'fanpage', 2), ApiError);
  await assert.doesNotReject(() => enforceResourceLimit(accountId, 'fanpage', 1));
});

test('enforceResourceLimit rejects with no subscription at all', async () => {
  await assert.rejects(() => enforceResourceLimit(accountId, 'chatbot'), ApiError);
});

test('enforceConversationLimit rejects once the monthly plan limit is reached', async () => {
  await prisma.plan.update({ where: { name: 'Starter' }, data: { maxConversations: 1 } });
  await createDefaultSubscription(accountId);

  const customer = await prisma.customer.create({ data: { accountId } });
  await prisma.conversation.create({ data: { accountId, customerId: customer.id, channel: 'WIDGET' } });

  await assert.rejects(() => enforceConversationLimit(accountId), ApiError);

  await prisma.plan.update({ where: { name: 'Starter' }, data: { maxConversations: 200 } });
});
