import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { fanpagesRouter } from './routes/fanpages.routes.js';
import { chatbotsRouter } from './routes/chatbots.routes.js';
import { customersRouter } from './routes/customers.routes.js';
import { conversationsRouter } from './routes/conversations.routes.js';
import { ordersRouter } from './routes/orders.routes.js';
import { leadsRouter } from './routes/leads.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { widgetRouter } from './routes/widget.routes.js';
import { webhooksRouter } from './routes/webhooks.routes.js';
import { uploadsRouter } from './routes/uploads.routes.js';
import { uploadsDir } from './services/storage.service.js';
import { productsRouter } from './routes/products.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(cookieParser());

  // Mounted before express.json() on purpose: the Facebook webhook route
  // needs the exact raw request bytes to verify Facebook's HMAC signature
  // (see webhooks.routes.js) — parsing to JSON first would make that
  // verification impossible.
  app.use('/api/webhooks', webhooksRouter);

  app.use(express.json({ limit: '2mb' }));
  app.use('/uploads', express.static(uploadsDir));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRouter);
  app.use('/api/fanpages', fanpagesRouter);
  app.use('/api/chatbots', chatbotsRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/leads', leadsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/widget', widgetRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
