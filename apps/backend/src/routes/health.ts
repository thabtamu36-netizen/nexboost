import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ ok: true, service: 'nexbooster-backend', environment: process.env.NODE_ENV ?? 'development', status: 'healthy' });
});