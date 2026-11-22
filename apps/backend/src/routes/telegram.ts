import { Router } from 'express';
import { env, getAdminChatIds } from '../config/env.js';
import { updatePaymentDecision } from '../lib/management.js';

export const telegramRouter = Router();

telegramRouter.post('/webhook', async (req, res) => {
  const secret = req.header('x-telegram-bot-api-secret-token') ?? '';
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false });
  }

  const body = req.body as any;

  // Handle incoming messages (e.g. /start)
  const message = body?.message;
  if (message?.chat?.id && message?.text) {
    const chatId = message.chat.id;
    const text = String(message.text).trim();
    if (text === '/start' || text.startsWith('/start ')) {
      if (env.TELEGRAM_BOT_TOKEN) {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: 'Welcome to NEXBOOST. Open the Mini App to get started.',
            reply_markup: {
              inline_keyboard: [[{ text: 'Open NEXBOOST', web_app: { url: env.MINIAPP_BASE_URL } }]]
            }
          })
        });
      }
      return res.json({ ok: true });
    }
    // Gracefully handle other text messages
    if (env.TELEGRAM_BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: 'Use /start to open NEXBOOST.'
        })
      });
    }
    return res.json({ ok: true });
  }

  const callback = body?.callback_query;
  if (callback?.data) {
    const adminId = String(callback.from?.id ?? '');
    const allowed = (env.TELEGRAM_ADMIN_IDS ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!allowed.includes(adminId)) {
      if (env.TELEGRAM_BOT_TOKEN && callback.id) {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callback.id, text: 'Not authorized' })
        });
      }
      return res.json({ ok: true });
    }
    const [action, paymentId] = String(callback.data).split(':');
    if ((action === 'approve' || action === 'reject') && paymentId) {
      try {
        await updatePaymentDecision(paymentId, action === 'approve' ? 'approved' : 'rejected', adminId);
        if (env.TELEGRAM_BOT_TOKEN && callback.id) {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callback.id, text: `Payment ${action}d` })
          });
        }
        if (env.TELEGRAM_BOT_TOKEN && callback.message?.chat?.id && callback.message?.message_id) {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: callback.message.chat.id,
              message_id: callback.message.message_id,
              reply_markup: { inline_keyboard: [] }
            })
          });
        }
      } catch (error) {
        if (env.TELEGRAM_BOT_TOKEN && callback.id) {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callback.id, text: 'Failed' })
          });
        }
      }
    }
  }

  return res.json({ ok: true });
});