import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { adminRouter } from './routes/admin.js';
import { healthRouter } from './routes/health.js';
import { paymentsRouter } from './routes/payments.js';
import { telegramRouter } from './routes/telegram.js';

export function createApp() {
  const app = express();
  // Add these two lines right here so Telegram is never blocked
  app.use(cors({ origin: '*' }));
  app.options('*', cors());

  app.use(express.json());

  // ... keep the rest of your routes below ...

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id']
  }));
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false
  }));
  app.use(morgan('dev'));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'NEXBOOST backend' });
  });
  app.use('/api/health', healthRouter);

  app.use('/api/telegram', telegramRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin', adminRouter);

  app.use((err: Error & { status?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      return res.status(413).json({
        ok: false,
        error: 'Payment proof image is too large. Please upload a smaller screenshot.'
      });
    }
    const status = typeof err?.status === 'number' && err.status >= 400 ? err.status : 500;
    return res.status(status).json({
      ok: false,
      error: err?.message || 'Unexpected server error.'
    });
  });

  return app;
}
