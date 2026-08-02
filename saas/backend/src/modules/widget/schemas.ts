import { z } from 'zod';

export const widgetMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  // Omitted on the first message of a session; the server creates a new
  // Conversation and returns its id, which the widget then sends on every
  // subsequent message so history is loaded from real storage rather than
  // trusted from the client (see conversations phase — this replaced an
  // earlier client-supplied `history` array design).
  conversationId: z.string().uuid().optional()
});
