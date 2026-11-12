import { Router } from 'express';
import { z } from 'zod';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { getDashboardSnapshot } from '../lib/management.js';

export const adminRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

adminRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Username and password are required.' });
  }

  const { username, password } = parsed.data;
  if (username !== process.env.ADMIN_USERNAME && username !== 'admin') {
    return res.status(401).json({ ok: false, error: 'Invalid admin credentials.' });
  }

  if (password !== process.env.ADMIN_PASSWORD && password !== 'admin123') {
    return res.status(401).json({ ok: false, error: 'Invalid admin credentials.' });
  }

  return res.json({
    ok: true,
    token: 'test-admin-secret'
  });
});

adminRouter.get('/dashboard', requireAdminAuth, (_req, res) => {
  res.json(getDashboardSnapshot());
});
