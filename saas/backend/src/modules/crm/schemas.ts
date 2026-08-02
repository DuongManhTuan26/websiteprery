import { z } from 'zod';

export const createContactSchema = z.object({
  name: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string().max(40)).max(20).optional()
});

export const updateContactSchema = createContactSchema.partial();
