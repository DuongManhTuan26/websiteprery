import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import { billingRouter } from './routes/billing.routes.js';
import { publicPlansRouter } from './routes/plans.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // contentSecurityPolicy is meant for HTML-serving apps — this is a pure
  // JSON API + uploaded-asset host, so it's disabled rather than fighting
  // it. crossOriginResourcePolicy is explicitly relaxed: the default
  // 'same-origin' would silently block real Facebook Messenger servers
  // and third-party sites embedding the widget from ever loading
  // /uploads/* images — the exact class of cross-origin access this app
  // deliberately supports (see the widget CORS comment below).
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));

  // The embeddable widget (see widget.routes.js, public/widget.js) is
  // designed to run on arbitrary third-party sites, not just this app's
  // own frontend — its public, widgetKey-scoped endpoints must accept
  // cross-origin requests from anywhere. No cookies are sent by the widget
  // script, so this stays credentials:false. Registered before the
  // strict, single-origin CORS below so it wins for both these paths
  // (matched first, and cors() ends OPTIONS preflights immediately).
  const widgetCors = cors({ origin: true });
  app.use('/api/widget', widgetCors);
  app.use('/api/uploads/widget', widgetCors);

  // Everything else (dashboard SPA, admin, billing, the refresh-token
  // cookie flow) is only ever called from this app's own real frontend
  // origin — reflecting an arbitrary origin here with credentials:true
  // would let any third-party page ride an authenticated visitor's
  // session (CORS-based CSRF), so this intentionally stays strict.
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
  app.use('/api/billing', billingRouter);
  app.use('/api/plans', publicPlansRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
