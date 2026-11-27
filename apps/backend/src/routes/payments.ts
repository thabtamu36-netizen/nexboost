import { Router } from 'express';
import { z } from 'zod';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import {
  createPaymentSubmission,
  notifyTelegramAdmins,
  updatePaymentDecision
} from '../lib/management.js';
import { verifyTelegramInitData } from '../lib/telegramAuth.js';

export const paymentsRouter = Router();

const PLAN_ALIASES: Record<string, 'trial' | 'weekly' | 'monthly'> = {
  trial: 'trial',
  weekly: 'weekly',
  monthly: 'monthly',
  'weekly access': 'weekly',
  'monthly vip pro': 'monthly',
  'monthly vip': 'monthly'
};

const paymentSubmitSchema = z.object({
  plan: z.string().min(1).transform((value, ctx) => {
    const mapped = PLAN_ALIASES[value.trim().toLowerCase()];
    if (!mapped) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid payment plan.' });
      return z.NEVER;
    }
    return mapped;
  }),
  amount: z.coerce.number().min(0).optional(),
  paymentMethod: z.string().min(1),
  transactionRef: z.string().trim().min(3).max(128),
  paymentProof: z.string().min(1).max(30_000_000).optional().nullable()
});

const paymentDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected'])
});

paymentsRouter.post('/submit', async (req, res) => {
  const startedAt = Date.now();
  const requestId = req.header('x-request-id') ?? 'none';
  const authHeader = req.header('authorization') ?? '';
  const contentLength = Number(req.header('content-length') ?? 0);

  console.log(JSON.stringify({
    event: 'payment_submit_start',
    requestId,
    origin: req.header('origin') ?? null,
    hasTmaPrefix: authHeader.startsWith('tma '),
    initDataChars: authHeader.startsWith('tma ') ? Math.max(authHeader.length - 4, 0) : 0,
    contentLength,
    path: '/api/payments/submit'
  }));

  if (!authHeader.startsWith('tma ')) {
    console.warn(JSON.stringify({
      event: 'payment_submit_rejected',
      requestId,
      reason: 'missing_tma_auth',
      durationMs: Date.now() - startedAt
    }));
    return res.status(401).json({
      ok: false,
      error: 'Telegram authentication is required. Reopen NEXBOOST from Telegram.'
    });
  }

  let telegramUser;

  try {
    const initData = authHeader.slice(4);
    telegramUser = verifyTelegramInitData(initData);
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'payment_submit_rejected',
      requestId,
      reason: 'telegram_auth_failed',
      durationMs: Date.now() - startedAt
    }));
    return res.status(401).json({
      ok: false,
      error: error instanceof Error
        ? error.message
        : 'Telegram authentication failed.'
    });
  }

  const parsed = paymentSubmitSchema.safeParse(req.body);

  if (!parsed.success) {
    console.warn(JSON.stringify({
      event: 'payment_submit_rejected',
      requestId,
      reason: 'invalid_payload',
      fieldErrors: parsed.error.issues.map((issue) => issue.path.join('.') || 'body'),
      durationMs: Date.now() - startedAt
    }));
    return res.status(400).json({
      ok: false,
      error: 'Invalid payment submission payload.'
    });
  }

  try {
    const result = await createPaymentSubmission({
      telegramId: telegramUser.id,
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      lastName: telegramUser.last_name ?? null,
      plan: parsed.data.plan,
      amount: parsed.data.amount ?? 0,
      paymentMethod: parsed.data.paymentMethod,
      transactionRef: parsed.data.transactionRef,
      paymentProof: parsed.data.paymentProof ?? null
    });

    console.log(JSON.stringify({
      event: 'payment_submit_ok',
      requestId,
      duplicate: result.duplicate,
      plan: parsed.data.plan,
      method: parsed.data.paymentMethod,
      proofChars: parsed.data.paymentProof?.length ?? 0,
      durationMs: Date.now() - startedAt
    }));

    if (!result.duplicate) {
      void notifyTelegramAdmins(
        `New payment submitted by @${telegramUser.username ?? 'customer'} for ${parsed.data.plan}.\nAmount: ${parsed.data.amount} ETB\nMethod: ${parsed.data.paymentMethod}\nReference: ${parsed.data.transactionRef}`,
        result.payment.id
      ).catch(() => {
        setTimeout(() => {
          void notifyTelegramAdmins(
            `New payment submitted by @${telegramUser.username ?? 'customer'} for ${parsed.data.plan}.\nAmount: ${parsed.data.amount} ETB\nMethod: ${parsed.data.paymentMethod}\nReference: ${parsed.data.transactionRef}`
          );
        }, 2000);
      });
    }

    return res.json({
      ok: true,
      payment: result.payment,
      user: result.user,
      duplicate: result.duplicate
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'payment_submit_failed',
      requestId,
      reason: 'persistence_error',
      message: error instanceof Error ? error.message : 'unknown',
      durationMs: Date.now() - startedAt
    }));
    return res.status(500).json({
      ok: false,
      error: error instanceof Error
        ? error.message
        : 'Unable to submit payment.'
    });
  }
});

paymentsRouter.post('/:id/decision', requireAdminAuth, async (req, res) => {
  const parsed = paymentDecisionSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid payment decision payload.'
    });
  }

  try {
    const adminRequest = req as typeof req & {
      admin?: { username?: string };
    };

    const paymentId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const result = await updatePaymentDecision(
      paymentId,
      parsed.data.decision,
      adminRequest.admin?.username ?? 'admin'
    );

    return res.json({
      ok: true,
      payment: result.payment,
      user: result.user
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error
        ? error.message
        : 'Failed to update payment decision.'
    });
  }
});
