import { z } from 'zod';

const historyEntrySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000)
});

export const widgetMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  // No server-side persistence yet (that's the conversation-storage phase)
  // — the widget keeps its own short-lived history client-side and resends
  // it so replies have context. Capped so a malicious client can't force
  // unbounded token usage against a configured AI provider.
  history: z.array(historyEntrySchema).max(20).optional()
});
