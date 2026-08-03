import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const leadsRouter = Router();

// Public — this is the real marketing site's "Dùng thử miễn phí" contact
// form (see saas/frontend public Home page). A Lead belongs to the
// platform itself (someone considering signing up), not to any existing
// Account, so — unlike every other route in this API — it is deliberately
// NOT scoped by requireAuth/accountId. Reading the Lead list back out is a
// platform-operator concern (the preny-clone team, not a tenant business)
// and is intentionally out of scope here: this repo has no platform-admin
// role/UI yet, only capture. Documented, not an oversight.
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
