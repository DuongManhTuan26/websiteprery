import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole, requireWorkspaceMember } from '../../middleware/requireWorkspaceMember.js';
import { parseOrThrow } from '../../utils/validate.js';
import { providerParamSchema, setApiKeySchema } from './schemas.js';
import * as settingsService from './service.js';
import { ValidationError } from '../../middleware/errorHandler.js';

// Mounted at /workspaces/:workspaceId/settings.
export const settingsRouter = Router({ mergeParams: true });

settingsRouter.use(requireAuth, requireWorkspaceMember);

settingsRouter.get('/api-keys', async (req, res, next) => {
  try {
    const statuses = await settingsService.listApiKeyStatuses(req.workspaceId!);
    res.json({ apiKeys: statuses });
  } catch (err) {
    next(err);
  }
});

// API keys are a sensitive, workspace-wide credential — only OWNER/ADMIN
// may set or remove them (consistent with other admin-only actions like
// deleting a chatbot), unlike most read/write chatbot operations which any
// member can do.
settingsRouter.put('/api-keys/:provider', requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const providerResult = providerParamSchema.safeParse(req.params.provider);
    if (!providerResult.success) {
      throw new ValidationError(`Unsupported provider: ${req.params.provider}`);
    }

    const { apiKey } = parseOrThrow(setApiKeySchema, req.body);
    const status = await settingsService.setApiKey(req.workspaceId!, providerResult.data, apiKey);
    res.json({ apiKey: status });
  } catch (err) {
    next(err);
  }
});

settingsRouter.delete('/api-keys/:provider', requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const providerResult = providerParamSchema.safeParse(req.params.provider);
    if (!providerResult.success) {
      throw new ValidationError(`Unsupported provider: ${req.params.provider}`);
    }

    await settingsService.deleteApiKey(req.workspaceId!, providerResult.data);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
