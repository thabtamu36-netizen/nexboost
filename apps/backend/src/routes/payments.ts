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
  paymentProof: z.string().min(1).max(30_000_000).optional().nullable(),
  network: z.string().optional().nullable(),
  device: z.string().optional().nullable()
});

const paymentDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected'])
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

paymentsRouter.post('/submit', async (req, res) => {
  const startedAt = Date.now();
  const requestId = req.header('x-request-id') ?? 'none';
  const authHeader = req.header('authorization') ?? '';

  if (!authHeader.startsWith('tma ')) {
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
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Telegram authentication failed.'
    });
  }

  const parsed = paymentSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
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
      paymentProof: parsed.data.paymentProof ?? null,
      network: parsed.data.network ?? null,
      device: parsed.data.device ?? null
    });

    if (!result.duplicate) {
      const fullName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || 'N/A';
      const usernameStr = telegramUser.username ? `@${escapeHtml(telegramUser.username)}` : 'No username';
      const networkStr = parsed.data.network === 'safaricom' ? 'Safaricom Ethiopia' : 'Ethio Telecom';
      const deviceStr = parsed.data.device ? parsed.data.device.toUpperCase() : 'Android';

      const caption =
        `💳 <b>NEW PAYMENT SUBMISSION</b>\n\n` +
        `👤 <b>User:</b> ${escapeHtml(fullName)} (${usernameStr})\n` +
        `🆔 <b>Telegram ID:</b> <code>${telegramUser.id}</code>\n` +
        `📡 <b>Network:</b> ${escapeHtml(networkStr)}\n` +
        `📱 <b>Device:</b> ${escapeHtml(deviceStr)}\n` +
        `📦 <b>Plan:</b> ${escapeHtml(parsed.data.plan.toUpperCase())} (${result.payment.amount} ETB)\n` +
        `🏦 <b>Method:</b> ${escapeHtml(parsed.data.paymentMethod.toUpperCase())}\n` +
        `🧾 <b>Reference:</b> <code>${escapeHtml(parsed.data.transactionRef)}</code>\n` +
        `🕒 <b>Submitted:</b> ${new Date(result.payment.submitted_at).toUTCString()}\n` +
        `⏳ <b>Status:</b> PENDING`;

      void notifyTelegramAdmins(
        caption,
        result.payment.id,
        parsed.data.paymentProof ?? null
      ).catch((err) => {
        console.error('Admin notification error:', err);
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
      message: error instanceof Error ? error.message : 'unknown',
      durationMs: Date.now() - startedAt
    }));
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to submit payment.'
    });
  }
});

paymentsRouter.post('/:id/decision', requireAdminAuth, async (req, res) => {
  const parsed = paymentDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid payment decision payload.' });
  }

  try {
    const adminRequest = req as typeof req & { admin?: { username?: string } };
    const paymentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await updatePaymentDecision(
      paymentId,
      parsed.data.decision,
      adminRequest.admin?.username ?? 'admin'
    );
    return res.json({ ok: true, payment: result.payment, user: result.user });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to update payment decision.'
    });
  }
});
