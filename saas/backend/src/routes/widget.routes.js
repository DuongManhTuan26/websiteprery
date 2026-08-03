import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import {
  findOrCreateCustomer,
  findOrCreateConversation,
  appendMessage,
  maybeGenerateBotReply
} from '../services/conversation.service.js';

// Public (no requireAuth) — this is what the embeddable website chat
// widget calls from a visitor's browser on a third-party site. Scoped
// entirely by widgetKey, which only ever identifies one Chatbot/Account
// pair and grants no access beyond "start/continue a chat with this bot".
export const widgetRouter = Router();

const startSchema = z.object({ widgetKey: z.string().uuid() });

widgetRouter.post('/start', asyncHandler(async (req, res) => {
  const { widgetKey } = startSchema.parse(req.body);

  const chatbot = await prisma.chatbot.findUnique({ where: { widgetKey } });

  if (!chatbot || chatbot.status !== 'ACTIVE') {
    throw new ApiError(404, 'Unknown or inactive widget');
  }

  const customer = await findOrCreateCustomer({ accountId: chatbot.accountId, channel: 'WIDGET' });
  const conversation = await findOrCreateConversation({
    accountId: chatbot.accountId,
    customerId: customer.id,
    channel: 'WIDGET',
    chatbotId: chatbot.id
  });

  res.status(201).json({ conversationId: conversation.id });
}));

const messageSchema = z.object({
  widgetKey: z.string().uuid(),
  conversationId: z.string().uuid(),
  text: z.string().max(4000).optional(),
  imageUrl: z.string().optional()
}).refine(body => body.text || body.imageUrl, { message: 'text or imageUrl is required' });

widgetRouter.post('/message', asyncHandler(async (req, res) => {
  const body = messageSchema.parse(req.body);

  const chatbot = await prisma.chatbot.findUnique({ where: { widgetKey: body.widgetKey } });

  if (!chatbot) {
    throw new ApiError(404, 'Unknown widget');
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: body.conversationId, accountId: chatbot.accountId, channel: 'WIDGET' }
  });

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  const message = await appendMessage({
    conversationId: conversation.id,
    senderType: 'CUSTOMER',
    contentType: body.imageUrl ? 'IMAGE' : 'TEXT',
    content: body.text || null,
    imageUrl: body.imageUrl || null
  });

  const io = req.app.get('io');
  io?.to(`account:${chatbot.accountId}`).emit('message:new', message);

  const botReply = await maybeGenerateBotReply({
    conversation,
    chatbot,
    incomingMessage: body.text,
    imageUrl: body.imageUrl,
    io
  });

  res.status(201).json({
    message,
    botReply: botReply?.text || null,
    botImageReply: botReply?.image || null
  });
}));

const historyQuerySchema = z.object({ widgetKey: z.string().uuid() });

// widgetKey is required as a query param and cross-checked against the
// conversation, not just used to look up messages by conversationId alone
// — conversationId is a real UUID (hard to guess, but not secret: it's
// visible to the browser and persisted in localStorage, see
// public/widget.js), and without this check any caller who obtained one
// could read a completely different account's widget conversation. Same
// ownership check POST /message already does.
widgetRouter.get('/:conversationId/messages', asyncHandler(async (req, res) => {
  const { widgetKey } = historyQuerySchema.parse(req.query);
  const chatbot = await prisma.chatbot.findUnique({ where: { widgetKey } });

  if (!chatbot) {
    throw new ApiError(404, 'Unknown widget');
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.conversationId, accountId: chatbot.accountId, channel: 'WIDGET' }
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
