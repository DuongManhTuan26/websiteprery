import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { enforceResourceLimit } from '../services/plan.service.js';

export const chatbotsRouter = Router();
chatbotsRouter.use(requireAuth);

chatbotsRouter.get('/', asyncHandler(async (req, res) => {
  const chatbots = await prisma.chatbot.findMany({
    where: { accountId: req.user.accountId },
    orderBy: { createdAt: 'desc' }
  });

  res.json(chatbots);
}));

const chatbotSchema = z.object({
  name: z.string().min(1).max(200),
  systemPrompt: z.string().min(1),
  aiProvider: z.string().default('anthropic'),
  aiModel: z.string().default('claude-sonnet-5')
});

chatbotsRouter.post('/', asyncHandler(async (req, res) => {
  const body = chatbotSchema.parse(req.body);

  await enforceResourceLimit(req.user.accountId, 'chatbot');

  const chatbot = await prisma.chatbot.create({
    data: { ...body, accountId: req.user.accountId }
  });

  res.status(201).json(chatbot);
}));

chatbotsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const body = chatbotSchema.partial().parse(req.body);

  const existing = await prisma.chatbot.findFirst({
    where: { id: req.params.id, accountId: req.user.accountId }
  });

  if (!existing) {
    throw new ApiError(404, 'Chatbot not found');
  }

  const chatbot = await prisma.chatbot.update({ where: { id: existing.id }, data: body });
  res.json(chatbot);
}));

chatbotsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.chatbot.findFirst({
    where: { id: req.params.id, accountId: req.user.accountId }
  });

  if (!existing) {
    throw new ApiError(404, 'Chatbot not found');
  }

  await prisma.chatbot.delete({ where: { id: existing.id } });
  res.status(204).send();
}));
