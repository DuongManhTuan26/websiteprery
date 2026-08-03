import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';

// Platform-operator surface — everything here is scoped across ALL
// accounts, unlike every other route in this API. Gated by both
// requireAuth (must be a real logged-in user) and requirePlatformAdmin
// (must specifically be promoted via scripts/promote-admin.js).
export const adminRouter = Router();
adminRouter.use(requireAuth, requirePlatformAdmin);

adminRouter.get('/leads', asyncHandler(async (req, res) => {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500
  });

  res.json(leads);
}));

const statusSchema = z.object({ status: z.enum(['NEW', 'CONTACTED', 'CONVERTED']) });

adminRouter.patch('/leads/:id/status', asyncHandler(async (req, res) => {
  const body = statusSchema.parse(req.body);

  const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });

  if (!existing) {
    throw new ApiError(404, 'Lead not found');
  }

  const lead = await prisma.lead.update({ where: { id: existing.id }, data: body });
  res.json(lead);
}));
