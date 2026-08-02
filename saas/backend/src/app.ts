import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './modules/health/router.js';
import { authRouter } from './modules/auth/router.js';
import { workspacesRouter } from './modules/workspaces/router.js';
import { chatbotsRouter } from './modules/chatbots/router.js';

// Factory (not a module-level singleton) so tests can build a fresh app
// instance without binding a port.
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.DASHBOARD_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json());

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/workspaces', workspacesRouter);
  app.use('/workspaces/:workspaceId/chatbots', chatbotsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
