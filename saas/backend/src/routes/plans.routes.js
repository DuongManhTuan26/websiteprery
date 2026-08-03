import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Public — powers the marketing site's real "Bảng giá" (pricing) page.
// Unlike /api/dashboard/plans (authenticated, includes checkoutAvailable
// for the logged-in account's own upgrade buttons), this is deliberately
// unauthenticated: real preny.ai's pricing page doesn't require login to
// view either.
export const publicPlansRouter = Router();

publicPlansRouter.get('/', asyncHandler(async (req, res) => {
  const plans = await prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } });

  res.json(plans.map(p => ({
    name: p.name,
    priceMonthly: p.priceMonthly,
    maxFanpages: p.maxFanpages,
    maxChatbots: p.maxChatbots,
    maxConversations: p.maxConversations
  })));
}));
