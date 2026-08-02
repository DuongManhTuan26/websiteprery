import { z } from 'zod';

export const createChatbotSchema = z.object({
  name: z.string().min(1).max(120),
  systemPrompt: z.string().min(1).max(4000).optional(),
  aiProvider: z.enum(['MOCK', 'OPENAI']).optional(),
  aiModel: z.string().max(120).optional()
});

export const testReplySchema = z.object({
  message: z.string().min(1).max(4000)
});

export const updateChatbotSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  systemPrompt: z.string().min(1).max(4000).optional(),
  aiProvider: z.enum(['MOCK', 'OPENAI']).optional(),
  aiModel: z.string().max(120).nullable().optional(),
  isActive: z.boolean().optional()
});
