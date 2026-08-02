import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole, requireWorkspaceMember } from '../../middleware/requireWorkspaceMember.js';
import { parseOrThrow } from '../../utils/validate.js';
import { createChatbotSchema, updateChatbotSchema } from './schemas.js';
import * as chatbotService from './service.js';

// Mounted at /workspaces/:workspaceId/chatbots — mergeParams so :workspaceId
// from the parent router is visible here.
export const chatbotsRouter = Router({ mergeParams: true });

chatbotsRouter.use(requireAuth, requireWorkspaceMember);

chatbotsRouter.post('/', async (req, res, next) => {
  try {
    const input = parseOrThrow(createChatbotSchema, req.body);
    const chatbot = await chatbotService.createChatbot(req.workspaceId!, input);
    res.status(201).json({ chatbot });
  } catch (err) {
    next(err);
  }
});

chatbotsRouter.get('/', async (req, res, next) => {
  try {
    const chatbots = await chatbotService.listChatbots(req.workspaceId!);
    res.json({ chatbots });
  } catch (err) {
    next(err);
  }
});

chatbotsRouter.get('/:chatbotId', async (req, res, next) => {
  try {
    const chatbot = await chatbotService.getChatbot(req.workspaceId!, String(req.params.chatbotId));
    res.json({ chatbot });
  } catch (err) {
    next(err);
  }
});

chatbotsRouter.patch('/:chatbotId', async (req, res, next) => {
  try {
    const input = parseOrThrow(updateChatbotSchema, req.body);
    const chatbot = await chatbotService.updateChatbot(req.workspaceId!, String(req.params.chatbotId), input);
    res.json({ chatbot });
  } catch (err) {
    next(err);
  }
});

chatbotsRouter.delete('/:chatbotId', requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    await chatbotService.deleteChatbot(req.workspaceId!, String(req.params.chatbotId));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
