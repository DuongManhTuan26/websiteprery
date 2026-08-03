import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

ordersRouter.get('/', asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { accountId: req.user.accountId },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
    take: 200
  });

  res.json(orders);
}));

const createSchema = z.object({
  customerId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  productName: z.string().min(1).max(300),
  quantity: z.number().int().min(1).default(1),
  amount: z.number().nonnegative()
});

// "chốt đơn" — an agent (or, later, the AI itself via a tool call) marks a
// conversation as having produced a real order.
ordersRouter.post('/', asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);

  const customer = await prisma.customer.findFirst({
    where: { id: body.customerId, accountId: req.user.accountId }
  });

  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const order = await prisma.order.create({
    data: { ...body, accountId: req.user.accountId }
  });

  res.status(201).json(order);
}));

const statusSchema = z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']) });

ordersRouter.patch('/:id/status', asyncHandler(async (req, res) => {
  const body = statusSchema.parse(req.body);

  const existing = await prisma.order.findFirst({
    where: { id: req.params.id, accountId: req.user.accountId }
  });

  if (!existing) {
    throw new ApiError(404, 'Order not found');
  }

  const order = await prisma.order.update({ where: { id: existing.id }, data: body });
  res.json(order);
}));
