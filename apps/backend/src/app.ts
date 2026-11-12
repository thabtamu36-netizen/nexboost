import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { adminRouter } from './routes/admin.js';
import { paymentsRouter } from './routes/payments.js';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(helmet());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'nexboost-backend', status: 'healthy' });
  });

  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin', adminRouter);

  return app;
}
