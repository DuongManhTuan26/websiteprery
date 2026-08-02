import { Router } from 'express';
import { prisma } from '../../db/client.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let dbOk = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? 'ok' : 'degraded';
  res.status(dbOk ? 200 : 503).json({ status, uptimeSeconds: process.uptime(), db: dbOk ? 'ok' : 'unreachable' });
});
