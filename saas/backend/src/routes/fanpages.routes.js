import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { buildOAuthUrl, exchangeCodeForPageTokens } from '../services/facebook.service.js';
import { connectFanpages } from '../services/fanpage.service.js';

export const fanpagesRouter = Router();
fanpagesRouter.use(requireAuth);

fanpagesRouter.get('/', asyncHandler(async (req, res) => {
  const fanpages = await prisma.fanpage.findMany({
    where: { accountId: req.user.accountId },
    orderBy: { connectedAt: 'desc' }
  });

  res.json(fanpages);
}));

// Step 1 of Facebook OAuth: return the URL the frontend should redirect the
// user to. Returns 501 (not fabricated success) if FACEBOOK_APP_ID isn't
// configured for this deployment.
fanpagesRouter.get('/connect/facebook', asyncHandler(async (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${req.protocol}://${req.get('host')}/api/fanpages/connect/facebook/callback`;
  const url = buildOAuthUrl(redirectUri, state);

  if (!url) {
    throw new ApiError(501, 'Facebook integration is not configured on this server (missing FACEBOOK_APP_ID).');
  }

  res.json({ url, state });
}));

const callbackSchema = z.object({ code: z.string() });

fanpagesRouter.post('/connect/facebook/callback', asyncHandler(async (req, res) => {
  const { code } = callbackSchema.parse(req.body);
  const redirectUri = `${req.protocol}://${req.get('host')}/api/fanpages/connect/facebook/callback`;
  const pages = await exchangeCodeForPageTokens(code, redirectUri);
  const created = await connectFanpages(req.user.accountId, pages);

  res.status(201).json(created);
}));

fanpagesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const fanpage = await prisma.fanpage.findFirst({
    where: { id: req.params.id, accountId: req.user.accountId }
  });

  if (!fanpage) {
    throw new ApiError(404, 'Fanpage not found');
  }

  await prisma.fanpage.update({ where: { id: fanpage.id }, data: { status: 'DISCONNECTED' } });
  res.status(204).send();
}));
