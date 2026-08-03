import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const leadsRouter = Router();

// Public — this is the real marketing site's "Dùng thử miễn phí" contact
// form (see saas/frontend public Home page). A Lead belongs to the
// platform itself (someone considering signing up), not to any existing
// Account, so — unlike every other route in this API — it is deliberately
// NOT scoped by requireAuth/accountId. Reading the Lead list back out is a
// real platform-operator feature (see admin.routes.js, requirePlatformAdmin)
// — a separate authorization boundary from tenant accounts, not missing.
const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

leadsRouter.use(leadLimiter);

const leadSchema = z.object({
  fullName: z.string().max(200).optional(),
  username: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  category: z.string().max(200).optional()
});

leadsRouter.post('/', asyncHandler(async (req, res) => {
  const body = leadSchema.parse(req.body);
  const lead = await prisma.lead.create({ data: { ...body, source: 'website' } });
  res.status(201).json({ id: lead.id });
}));
