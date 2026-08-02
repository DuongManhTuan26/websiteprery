import { Router } from 'express';
import { parseOrThrow } from '../../utils/validate.js';
import { widgetMessageSchema } from './schemas.js';
import * as widgetService from './service.js';

// Deliberately public — no requireAuth/requireWorkspaceMember. A website
// visitor embedding this widget has no account; access is scoped entirely
// by the unguessable per-chatbot widgetToken (UUID) in the URL, never by
// workspace or session. Mounted with permissive CORS in app.ts since this
// is meant to be called from arbitrary third-party origins.
export const widgetRouter = Router();

widgetRouter.get('/:widgetToken/config', async (req, res, next) => {
  try {
    const config = await widgetService.getPublicConfig(String(req.params.widgetToken));
    res.json(config);
  } catch (err) {
    next(err);
  }
});

widgetRouter.post('/:widgetToken/message', async (req, res, next) => {
  try {
    const { message, history } = parseOrThrow(widgetMessageSchema, req.body);
    const reply = await widgetService.sendMessage(String(req.params.widgetToken), message, history);
    res.json({ reply });
  } catch (err) {
    next(err);
  }
});
