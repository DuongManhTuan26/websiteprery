import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './modules/health/router.js';
import { authRouter } from './modules/auth/router.js';
import { workspacesRouter } from './modules/workspaces/router.js';
import { chatbotsRouter } from './modules/chatbots/router.js';
import { widgetRouter } from './modules/widget/router.js';
import { conversationsRouter } from './modules/conversations/router.js';
import { crmRouter } from './modules/crm/router.js';
import { settingsRouter } from './modules/settings/router.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIDGET_DIST_DIR = path.resolve(__dirname, '../../widget/dist');

// Factory (not a module-level singleton) so tests can build a fresh app
// instance without binding a port.
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(express.json());

  // Two different CORS policies, applied per-router rather than globally:
  // dashboard/API routes only accept the configured dashboard origin
  // (credentialed), while the widget is meant to be embedded on arbitrary
  // third-party sites and is authorized by an unguessable per-chatbot token
  // in the URL rather than by origin, so it allows any origin and carries
  // no credentials.
  const dashboardCors = cors({ origin: env.DASHBOARD_ORIGIN, credentials: true });
  const widgetCors = cors({ origin: true });

  app.use('/health', healthRouter);
  app.use('/auth', dashboardCors, authRouter);
  app.use('/workspaces', dashboardCors, workspacesRouter);
  app.use('/workspaces/:workspaceId/chatbots', dashboardCors, chatbotsRouter);
  app.use('/workspaces/:workspaceId/conversations', dashboardCors, conversationsRouter);
  app.use('/workspaces/:workspaceId/contacts', dashboardCors, crmRouter);
  app.use('/workspaces/:workspaceId/settings', dashboardCors, settingsRouter);
  app.use('/widget', widgetCors, widgetRouter);

  // Serves the built widget bundle (saas/widget/dist/widget.js) so a
  // customer's <script src="<this-api>/widget.js"> just works without a
  // separate CDN/hosting step. helmet's default Cross-Origin-Resource-Policy
  // is same-origin, which would silently block the browser from executing
  // this script when loaded from a third-party page even though CORS allows
  // it (CORP and CORS are separate mechanisms) — relaxed to cross-origin
  // for this one static route only, nowhere else.
  app.get('/widget.js', (_req, res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.sendFile(path.join(WIDGET_DIST_DIR, 'widget.js'), err => {
      if (err) res.status(404).json({ error: { code: 'not_found', message: 'Widget bundle not built' } });
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
