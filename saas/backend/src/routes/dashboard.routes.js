import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

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
