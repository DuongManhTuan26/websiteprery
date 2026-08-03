import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createCheckoutSession, createPortalSession } from '../services/billing.service.js';

export const billingRouter = Router();
billingRouter.use(requireAuth);

const checkoutSchema = z.object({ planName: z.string().min(1) });

billingRouter.post('/checkout', asyncHandler(async (req, res) => {
  const { planName } = checkoutSchema.parse(req.body);
  const url = await createCheckoutSession(req.user.accountId, planName);
  res.json({ url });
}));

billingRouter.post('/portal', asyncHandler(async (req, res) => {
  const url = await createPortalSession(req.user.accountId);
  res.json({ url });
}));
