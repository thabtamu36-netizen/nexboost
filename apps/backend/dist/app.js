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
    // CORS configuration
    app.use(cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: [
            'Authorization',
            'Content-Type',
            'X-Request-Id'
        ]
    }));
    // Security headers
    app.use(helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        crossOriginEmbedderPolicy: false
    }));
    app.use(morgan('dev'));
    // Parse JSON requests (single parser, 10 MB limit)
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({
        extended: true,
        limit: '10mb'
    }));
    // Health check
    app.get('/health', (_req, res) => {
        res.status(200).json({
            ok: true,
            service: 'NEXBOOST backend'
        });
    });
    // API routes
    app.use('/api/health', healthRouter);
    app.use('/api/telegram', telegramRouter);
    app.use('/api/payments', paymentsRouter);
    app.use('/api/admin', adminRouter);
    // Error handler
    app.use((err, _req, res, _next) => {
        if (err?.type === 'entity.too.large' || err?.status === 413) {
            return res.status(413).json({
                ok: false,
                error: 'Payment proof image is too large. Please upload a smaller screenshot.'
            });
        }
        const status = typeof err?.status === 'number' && err.status >= 400
            ? err.status
            : 500;
        return res.status(status).json({
            ok: false,
            error: err?.message || 'Unexpected server error.'
        });
    });
    return app;
}
