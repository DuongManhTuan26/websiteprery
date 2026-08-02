import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(120)
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(120)
});

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER')
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER'])
});
