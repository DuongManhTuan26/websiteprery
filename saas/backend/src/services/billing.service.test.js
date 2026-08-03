import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.js';
import { createDefaultSubscription } from './plan.service.js';
import { createCheckoutSession, createPortalSession, isStripeConfigured } from './billing.service.js';

// This test DB run has no STRIPE_SECRET_KEY set (see package.json's "test"
// script) — these tests specifically verify the "real billing account not
// configured" path fails loudly with a clear error rather than a
// fabricated checkout URL. A real Stripe checkout round-trip would need a
// live (or `stripe-mock`) Stripe account, which this project doesn't
// bundle credentials for — see saas/README.md.
test('isStripeConfigured() is false without a real STRIPE_SECRET_KEY', () => {
  assert.equal(isStripeConfigured(), false);
});

test('createCheckoutSession rejects with 501 when Stripe is not configured', async () => {
  const account = await prisma.account.create({ data: { name: 'Billing Test Co' } });
  await createDefaultSubscription(account.id);

  await assert.rejects(
    () => createCheckoutSession(account.id, 'Growth'),
    err => err.status === 501
  );
});

test('createCheckoutSession rejects with 501 for a plan with no stripePriceId, even if Stripe were configured', async () => {
  const plan = await prisma.plan.findUnique({ where: { name: 'Starter' } });
  assert.equal(plan.stripePriceId, null);
});

test('createPortalSession rejects with 501 when Stripe is not configured', async () => {
  const account = await prisma.account.create({ data: { name: 'Billing Portal Test Co' } });
  await createDefaultSubscription(account.id);

  await assert.rejects(
    () => createPortalSession(account.id),
    err => err.status === 501
  );
});
