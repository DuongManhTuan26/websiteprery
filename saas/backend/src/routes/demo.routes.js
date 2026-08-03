import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { DEMO_CHATBOT_ID } from '../config/demoIds.js';

// Public — powers the homepage's own embedded demo chat widget (mirrors
// the real preny.ai homepage, which embeds its own "bot-embed.js" — see
// SiteHeader.jsx's comment on where that's observed from). Backed by a
// real Chatbot row seeded by prisma/seed.js (DEMO_CHATBOT_ID) — if a
// fresh deployment hasn't run the seed yet, this returns 404 rather than
// a fabricated key, and Home.jsx simply doesn't render the widget.
export const demoRouter = Router();

demoRouter.get('/widget-key', asyncHandler(async (req, res) => {
  const chatbot = await prisma.chatbot.findUnique({ where: { id: DEMO_CHATBOT_ID } });

  if (!chatbot) {
    return res.status(404).json({ error: 'Demo chatbot not seeded on this deployment' });
  }

  res.json({ widgetKey: chatbot.widgetKey });
}));
