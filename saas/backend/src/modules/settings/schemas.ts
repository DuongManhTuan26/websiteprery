import { z } from 'zod';

export const providerParamSchema = z.enum(['OPENAI']); // MOCK needs no key, never settable here

export const setApiKeySchema = z.object({
  apiKey: z.string().min(1).max(500)
});
