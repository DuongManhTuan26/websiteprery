import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';

export const customersRouter = Router();
customersRouter.use(requireAuth);

customersRouter.get('/', asyncHandler(async (req, res) => {
  const customers = await prisma.customer.findMany({
    where: { accountId: req.user.accountId },
    orderBy: { updatedAt: 'desc' },
    take: 200
  });

  res.json(customers);
}));

customersRouter.get('/:id', asyncHandler(async (req, res) => {
  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, accountId: req.user.accountId },
    include: { orders: true, conversations: { orderBy: { lastMessageAt: 'desc' }, take: 20 } }
  });

  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  res.json(customer);
}));

const updateSchema = z.object({
  name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional()
});

customersRouter.patch('/:id', asyncHandler(async (req, res) => {
  const body = updateSchema.parse(req.body);

  const existing = await prisma.customer.findFirst({
    where: { id: req.params.id, accountId: req.user.accountId }
  });

  if (!existing) {
    throw new ApiError(404, 'Customer not found');
  }

  const customer = await prisma.customer.update({ where: { id: existing.id }, data: body });
  res.json(customer);
}));
