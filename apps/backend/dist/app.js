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
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.get('/health', (_req, res) => {
        res.status(200).json({ ok: true, service: 'NEXBOOST backend' });
    });
    app.use('/api/health', healthRouter);
    app.use('/api/telegram', telegramRouter);
    app.use('/api/payments', paymentsRouter);
    app.use('/api/admin', adminRouter);
    return app;
}
