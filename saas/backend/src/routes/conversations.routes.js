import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { appendMessage } from '../services/conversation.service.js';

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth);

conversationsRouter.get('/', asyncHandler(async (req, res) => {
  const { status } = req.query;

  const conversations = await prisma.conversation.findMany({
    where: {
      accountId: req.user.accountId,
      ...(status ? { status } : {})
    },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 1 }
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 100
  });

  res.json(conversations);
}));

conversationsRouter.get('/:id/messages', asyncHandler(async (req, res) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, accountId: req.user.accountId }
  });

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' }
  });

  res.json(messages);
}));

const sendSchema = z.object({
  content: z.string().min(1).optional(),
  contentType: z.enum(['TEXT', 'IMAGE']).default('TEXT'),
  imageUrl: z.string().optional()
}).refine(body => body.content || body.imageUrl, { message: 'content or imageUrl is required' });

// An agent replying by hand — always allowed regardless of BOT/HUMAN
// status, since a human stepping in is exactly the documented handoff.
conversationsRouter.post('/:id/messages', asyncHandler(async (req, res) => {
  const body = sendSchema.parse(req.body);

  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, accountId: req.user.accountId }
  });

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  const message = await appendMessage({
    conversationId: conversation.id,
    senderType: 'AGENT',
    contentType: body.contentType,
    content: body.content,
    imageUrl: body.imageUrl
  });

  req.app.get('io')?.to(`account:${req.user.accountId}`).emit('message:new', message);

  res.status(201).json(message);
}));

const handoffSchema = z.object({ status: z.enum(['BOT', 'HUMAN', 'CLOSED']) });

conversationsRouter.patch('/:id/status', asyncHandler(async (req, res) => {
  const body = handoffSchema.parse(req.body);

  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, accountId: req.user.accountId }
  });

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: body.status,
      assignedUserId: body.status === 'HUMAN' ? req.user.id : conversation.assignedUserId
    }
  });

  req.app.get('io')?.to(`account:${req.user.accountId}`).emit('conversation:updated', updated);

  res.json(updated);
}));
