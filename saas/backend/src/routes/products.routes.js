import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';

export const productsRouter = Router();
productsRouter.use(requireAuth);

productsRouter.get('/', asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({
    where: { accountId: req.user.accountId },
    orderBy: { createdAt: 'desc' }
  });

  res.json(products);
}));

const productSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  price: z.number().nonnegative().optional()
});

productsRouter.post('/', asyncHandler(async (req, res) => {
  const body = productSchema.parse(req.body);
  const product = await prisma.product.create({ data: { ...body, accountId: req.user.accountId } });
  res.status(201).json(product);
}));

productsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const body = productSchema.partial().parse(req.body);

  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, accountId: req.user.accountId }
  });

  if (!existing) {
    throw new ApiError(404, 'Product not found');
  }

  const product = await prisma.product.update({ where: { id: existing.id }, data: body });
  res.json(product);
}));

productsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, accountId: req.user.accountId }
  });

  if (!existing) {
    throw new ApiError(404, 'Product not found');
  }

  await prisma.product.delete({ where: { id: existing.id } });
  res.status(204).send();
}));
