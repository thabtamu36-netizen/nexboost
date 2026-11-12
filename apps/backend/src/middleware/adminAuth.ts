import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const expectedToken = env.ADMIN_SESSION_SECRET ?? 'test-admin-secret';
  if (token && token === expectedToken) {
    (req as typeof req & { admin?: { username?: string } }).admin = {
      username: 'admin'
    };
    return next();
  }

  if (req.headers['x-admin-secret'] === expectedToken) {
    (req as typeof req & { admin?: { username?: string } }).admin = {
      username: 'admin'
    };
    return next();
  }

  return res.status(401).json({ ok: false, error: 'Admin authorization required.' });
}
