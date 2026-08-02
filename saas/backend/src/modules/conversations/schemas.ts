import { z } from 'zod';

export const setContactSchema = z.object({
  contactId: z.string().uuid().nullable()
});
