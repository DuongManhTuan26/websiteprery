import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireWorkspaceMember } from '../../middleware/requireWorkspaceMember.js';
import * as conversationService from './service.js';

// Mounted at /workspaces/:workspaceId/conversations — read-only for now
// (any workspace member; nothing here is destructive/admin-only).
export const conversationsRouter = Router({ mergeParams: true });

conversationsRouter.use(requireAuth, requireWorkspaceMember);

conversationsRouter.get('/', async (req, res, next) => {
  try {
    const conversations = await conversationService.listConversations(req.workspaceId!);
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

conversationsRouter.get('/:conversationId', async (req, res, next) => {
  try {
    const conversation = await conversationService.getConversation(req.workspaceId!, String(req.params.conversationId));
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
});
