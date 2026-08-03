import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/errorHandler.js';

// Same lazy-init-or-null pattern as storage.service.js's S3 client and
// ai.service.js's Anthropic client — real integration code, but every
// entry point below fails loudly (ApiError) rather than fabricating a
// checkout URL or a subscription change when no real Stripe account is
// configured.
let stripeClient = null;

function getStripeClient() {
  if (!env.stripeSecretKey) return null;
  if (!stripeClient) stripeClient = new Stripe(env.stripeSecretKey);
  return stripeClient;
}

export function isStripeConfigured() {
  return getStripeClient() !== null;
}

const STRIPE_TO_LOCAL_STATUS = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELLED',
  unpaid: 'PAST_DUE',
  incomplete_expired: 'CANCELLED'
};

async function currentSubscriptionRow(accountId) {
  return prisma.subscription.findFirst({ where: { accountId }, orderBy: { createdAt: 'desc' } });
}

// Reuses the Stripe Customer already on file for this account (from a
// prior checkout) instead of creating a duplicate one every time.
async function getOrCreateStripeCustomer(stripe, account, subscriptionRow) {
  if (subscriptionRow?.stripeCustomerId) {
    return subscriptionRow.stripeCustomerId;
  }

  const owner = await prisma.user.findFirst({ where: { accountId: account.id, role: 'OWNER' } });
  const customer = await stripe.customers.create({
    email: owner?.email,
    name: account.name,
    metadata: { accountId: account.id }
  });

  return customer.id;
}

// Starter has no stripePriceId (it's free) — only Growth/Business are
// checkout-able. Real preny.ai pricing tiers/amounts are not observable
// from the public site; these three tiers and their limits are this
// project's own design (see prisma/seed.js).
export async function createCheckoutSession(accountId, planName) {
  const stripe = getStripeClient();

  if (!stripe) {
    throw new ApiError(501, 'Billing is not configured on this deployment (no STRIPE_SECRET_KEY).');
  }

  const plan = await prisma.plan.findUnique({ where: { name: planName } });

  if (!plan || !plan.stripePriceId) {
    throw new ApiError(501, `The ${planName} plan is not yet available for checkout on this deployment.`);
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  const subscriptionRow = await currentSubscriptionRow(accountId);
  const customerId = await getOrCreateStripeCustomer(stripe, account, subscriptionRow);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    client_reference_id: accountId,
    success_url: `${env.frontendUrl}/dashboard?checkout=success`,
    cancel_url: `${env.frontendUrl}/dashboard?checkout=cancelled`
  });

  return session.url;
}

export async function createPortalSession(accountId) {
  const stripe = getStripeClient();

  if (!stripe) {
    throw new ApiError(501, 'Billing is not configured on this deployment (no STRIPE_SECRET_KEY).');
  }

  const subscriptionRow = await currentSubscriptionRow(accountId);

  if (!subscriptionRow?.stripeCustomerId) {
    throw new ApiError(400, 'No billing account on file yet — subscribe to a paid plan first.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscriptionRow.stripeCustomerId,
    return_url: `${env.frontendUrl}/dashboard`
  });

  return session.url;
}

// Verifies the raw request body against Stripe's signature — throws if
// invalid/missing, exactly like facebook.service.js's HMAC check.
export function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripeClient();

  if (!stripe || !env.stripeWebhookSecret) {
    throw new ApiError(501, 'Stripe webhooks are not configured on this deployment.');
  }

  return stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
}

async function upsertSubscriptionFromStripe(accountId, stripeSubscription) {
  const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
  const plan = priceId ? await prisma.plan.findUnique({ where: { stripePriceId: priceId } }) : null;
  const status = STRIPE_TO_LOCAL_STATUS[stripeSubscription.status] || 'ACTIVE';
  const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);

  const existing = await currentSubscriptionRow(accountId);

  if (!existing) {
    // Shouldn't happen in practice — every account gets a Subscription row
    // at registration (see plan.service.js) — but don't silently drop a
    // real Stripe event if it does.
    if (!plan) return;
    await prisma.subscription.create({
      data: {
        accountId,
        planId: plan.id,
        status,
        currentPeriodEnd,
        stripeCustomerId: stripeSubscription.customer,
        stripeSubscriptionId: stripeSubscription.id
      }
    });
    return;
  }

  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      ...(plan ? { planId: plan.id } : {}),
      status,
      currentPeriodEnd,
      stripeCustomerId: stripeSubscription.customer,
      stripeSubscriptionId: stripeSubscription.id
    }
  });
}

// Applies a verified Stripe event to our own Subscription row. Stripe is
// the source of truth for payment state; this only ever mirrors it, never
// grants ACTIVE status without a real Stripe event saying so.
export async function applyStripeEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const accountId = session.client_reference_id;

      if (!accountId || !session.subscription) return;

      const stripe = getStripeClient();
      const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
      await upsertSubscriptionFromStripe(accountId, stripeSubscription);
      return;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const stripeSubscription = event.data.object;
      const existing = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: stripeSubscription.id }
      });

      if (!existing) return;

      await upsertSubscriptionFromStripe(existing.accountId, stripeSubscription);
      return;
    }
    default:
      // Real events we deliberately don't act on (invoice.*, payment_method.*, ...).
      return;
  }
}
