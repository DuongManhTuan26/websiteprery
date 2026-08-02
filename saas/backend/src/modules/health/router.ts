import { Router } from 'express';

export const healthRouter = Router();

// Extended in the database phase to also verify DB connectivity — kept
// dependency-free for now so the server has a working liveness check from
// the very first commit.
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: process.uptime() });
});
