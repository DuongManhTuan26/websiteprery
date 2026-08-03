import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getActivePlan } from '../services/plan.service.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get('/summary', asyncHandler(async (req, res) => {
  const accountId = req.user.accountId;

  const [
    totalConversations,
    botConversations,
    humanConversations,
    totalCustomers,
    ordersConfirmed,
    fanpages
  ] = await Promise.all([
    prisma.conversation.count({ where: { accountId } }),
    prisma.conversation.count({ where: { accountId, status: 'BOT' } }),
    prisma.conversation.count({ where: { accountId, status: 'HUMAN' } }),
    prisma.customer.count({ where: { accountId } }),
    prisma.order.aggregate({
      where: { accountId, status: 'CONFIRMED' },
      _sum: { amount: true },
      _count: true
    }),
    prisma.fanpage.count({ where: { accountId, status: 'CONNECTED' } })
  ]);

  res.json({
    totalConversations,
    botConversations,
    humanConversations,
    totalCustomers,
    confirmedOrders: ordersConfirmed._count,
    confirmedRevenue: ordersConfirmed._sum.amount || 0,
    connectedFanpages: fanpages
  });
}));

dashboardRouter.get('/subscription', asyncHandler(async (req, res) => {
  const accountId = req.user.accountId;
  const subscription = await getActivePlan(accountId);

  if (!subscription) {
    return res.json({ subscription: null });
  }

  const periodStart = new Date(subscription.currentPeriodEnd);
  periodStart.setMonth(periodStart.getMonth() - 1);

  const [fanpageCount, chatbotCount, conversationCount] = await Promise.all([
    prisma.fanpage.count({ where: { accountId } }),
    prisma.chatbot.count({ where: { accountId } }),
    prisma.conversation.count({ where: { accountId, createdAt: { gte: periodStart } } })
  ]);

  res.json({
    plan: subscription.plan.name,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    hasBillingAccount: Boolean(subscription.stripeCustomerId),
    usage: {
      fanpages: { used: fanpageCount, limit: subscription.plan.maxFanpages },
      chatbots: { used: chatbotCount, limit: subscription.plan.maxChatbots },
      conversationsThisPeriod: { used: conversationCount, limit: subscription.plan.maxConversations }
    }
  });
}));

// Public within the dashboard (still requireAuth'd above) — used to render
// upgrade options. stripePriceId is intentionally omitted; the frontend
// never needs it, only whether a plan is checkout-able.
dashboardRouter.get('/plans', asyncHandler(async (req, res) => {
  const plans = await prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } });

  res.json(plans.map(p => ({
    name: p.name,
    priceMonthly: p.priceMonthly,
    maxFanpages: p.maxFanpages,
    maxChatbots: p.maxChatbots,
    maxConversations: p.maxConversations,
    checkoutAvailable: Boolean(p.stripePriceId)
  })));
}));
