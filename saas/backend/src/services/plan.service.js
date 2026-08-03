import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/errorHandler.js';

const TRIAL_DAYS = 14;

// Every Account gets a real Subscription row the moment it's created (see
// auth.routes.js) — defaults to the free "Starter" plan seeded by
// prisma/seed.js, TRIALING for 14 days. There is no "no subscription"
// state to handle elsewhere in the codebase.
export async function createDefaultSubscription(accountId) {
  const starterPlan = await prisma.plan.findUnique({ where: { name: 'Starter' } });

  if (!starterPlan) {
    throw new Error('Starter plan not seeded — run `npm run seed` before starting the server.');
  }

  return prisma.subscription.create({
    data: {
      accountId,
      planId: starterPlan.id,
      status: 'TRIALING',
      currentPeriodEnd: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
    }
  });
}

export async function getActivePlan(accountId) {
  const subscription = await prisma.subscription.findFirst({
    where: { accountId, status: { in: ['TRIALING', 'ACTIVE'] } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' }
  });

  return subscription;
}

const RESOURCE_CONFIG = {
  fanpage: { model: 'fanpage', limitField: 'maxFanpages', label: 'Fanpage' },
  chatbot: { model: 'chatbot', limitField: 'maxChatbots', label: 'Chatbot' }
};

// Called before creating a new Fanpage/Chatbot — real enforcement, not
// just numbers displayed in a dashboard. Conversations are checked
// separately (per-billing-period count, not a total) — see
// enforceConversationLimit below.
export async function enforceResourceLimit(accountId, resourceKey, additionalCount = 1) {
  const config = RESOURCE_CONFIG[resourceKey];
  const subscription = await getActivePlan(accountId);

  if (!subscription) {
    throw new ApiError(402, 'No active subscription. Please subscribe to a plan to continue.');
  }

  if (subscription.status === 'TRIALING' && subscription.currentPeriodEnd < new Date()) {
    throw new ApiError(402, 'Trial period has ended. Please upgrade to a paid plan.');
  }

  const count = await prisma[config.model].count({ where: { accountId } });
  const limit = subscription.plan[config.limitField];

  if (count + additionalCount > limit) {
    throw new ApiError(
      402,
      `${config.label} limit reached for the ${subscription.plan.name} plan (${limit}). Upgrade to add more.`
    );
  }
}

// Conversations are metered per billing period, not a lifetime total — a
// business on the Starter plan doing 200 conversations/month should be
// able to keep operating next month, not get permanently locked out.
export async function enforceConversationLimit(accountId) {
  const subscription = await getActivePlan(accountId);

  if (!subscription) {
    throw new ApiError(402, 'No active subscription. Please subscribe to a plan to continue.');
  }

  const periodStart = new Date(subscription.currentPeriodEnd);
  periodStart.setMonth(periodStart.getMonth() - 1);

  const count = await prisma.conversation.count({
    where: { accountId, createdAt: { gte: periodStart } }
  });

  if (count >= subscription.plan.maxConversations) {
    throw new ApiError(
      402,
      `Monthly conversation limit reached for the ${subscription.plan.name} plan (${subscription.plan.maxConversations}). Upgrade to continue receiving new conversations.`
    );
  }
}
