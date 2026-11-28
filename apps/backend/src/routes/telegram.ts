import { Router } from 'express';
import { env, getAdminChatIds } from '../config/env.js';
import {
  getAdminOverview,
  getDemoDnsList,
  getPaymentsByStatus,
  issueOrResendDemoDnsForUser,
  renewSubscriptionForUser,
  revokeDemoDnsForUser,
  updatePaymentDecision
} from '../lib/management.js';

export const telegramRouter = Router();

function isAdmin(telegramId: string): boolean {
  return getAdminChatIds().includes(telegramId.trim());
}

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegram(method: string, payload: Record<string, unknown>) {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.json().catch(() => null);
}

async function sendReceiptCardToChat(chatId: string, item: any) {
  if (!env.TELEGRAM_BOT_TOKEN) return;

  const fullName = [item.user?.first_name, item.user?.last_name].filter(Boolean).join(' ') || 'N/A';
  const usernameStr = item.user?.username ? `@${escapeHtml(item.user.username)}` : 'No username';
  const tgId = item.user?.telegram_id ?? 'Unknown';
  const networkStr = item.network === 'safaricom' ? 'Safaricom Ethiopia' : 'Ethio Telecom';
  const deviceStr = item.device ? String(item.device).toUpperCase() : 'Android';

  const caption =
    `🧾 <b>PAYMENT RECORD (${String(item.status).toUpperCase()})</b>\n\n` +
    `👤 <b>User:</b> ${escapeHtml(fullName)} (${usernameStr})\n` +
    `🆔 <b>Telegram ID:</b> <code>${tgId}</code>\n` +
    `📡 <b>Network:</b> ${escapeHtml(networkStr)}\n` +
    `📱 <b>Device:</b> ${escapeHtml(deviceStr)}\n` +
    `📦 <b>Plan:</b> ${escapeHtml(String(item.plan ?? 'monthly').toUpperCase())} (${item.amount} ETB)\n` +
    `🏦 <b>Method:</b> ${escapeHtml(String(item.payment_method).toUpperCase())}\n` +
    `🔢 <b>Reference:</b> <code>${escapeHtml(item.transaction_ref ?? 'N/A')}</code>\n` +
    `🕒 <b>Submitted:</b> ${new Date(item.submitted_at).toUTCString()}`;

  const inlineKeyboard =
    item.status === 'pending'
      ? [[
          { text: '✅ Approve & Send Demo DNS', callback_data: `approve:${item.id}` },
          { text: '❌ Reject Payment', callback_data: `reject:${item.id}` }
        ]]
      : [];

  const imageMatch = typeof item.payment_proof === 'string'
    ? item.payment_proof.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/)
    : null;

  if (imageMatch) {
    const mimeType = imageMatch[1];
    const base64Data = imageMatch[2].replace(/\s/g, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('photo', new Blob([imageBuffer], { type: mimeType }), 'receipt.jpg');
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
    if (inlineKeyboard.length > 0) {
      form.append('reply_markup', JSON.stringify({ inline_keyboard: inlineKeyboard }));
    }

    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form
    });
  } else {
    await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: `${caption}\n\n⚠️ <i>No screenshot attached to this record.</i>`,
      parse_mode: 'HTML',
      reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined
    });
  }
}

function adminMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '⏳ Pending Payments', callback_data: 'admin:payments:pending' }],
      [
        { text: '✅ Approved Payments', callback_data: 'admin:payments:approved' },
        { text: '❌ Rejected Payments', callback_data: 'admin:payments:rejected' }
      ],
      [
        { text: '👥 All Users', callback_data: 'admin:users' },
        { text: '🌐 Demo DNS Management', callback_data: 'admin:dns:menu' }
      ],
      [{ text: '👤 Admin Profile', callback_data: 'admin:profile' }]
    ]
  };
}

telegramRouter.post('/webhook', async (req, res) => {
  const secret = req.header('x-telegram-bot-api-secret-token') ?? '';
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false });
  }

  const body = req.body as any;

  // 1. Handle Incoming Text Commands
  const message = body?.message;
  if (message?.chat?.id && message?.text) {
    const chatId = String(message.chat.id);
    const senderId = String(message.from?.id ?? chatId);
    const text = String(message.text).trim();

    if (text === '/start' || text.startsWith('/start ')) {
      const keyboard: any[][] = [
        [{ text: '🚀 Open NEXBOOST Mini App', web_app: { url: env.MINIAPP_BASE_URL } }]
      ];
      if (isAdmin(senderId)) {
        keyboard.push([{ text: '🛡️ Admin Control Panel', callback_data: 'admin:home' }]);
      }

      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text: 'Welcome to NEXBOOST. Open the Mini App to get started.',
        reply_markup: { inline_keyboard: keyboard }
      });
      return res.json({ ok: true });
    }

    if (text === '/admin') {
      if (!isAdmin(senderId)) {
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: `⛔ Not authorized. Your Telegram ID is: <code>${escapeHtml(senderId)}</code>`,
          parse_mode: 'HTML'
        });
        return res.json({ ok: true });
      }

      const stats = getAdminOverview();
      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text:
          `🛡️ <b>NEXBOOST ADMIN PANEL</b>\n\n` +
          `👥 Total Users: <b>${stats.totalUsers}</b>\n` +
          `⏳ Pending Payments: <b>${stats.pendingPayments}</b>\n` +
          `✅ Approved Payments: <b>${stats.approvedPayments}</b>\n` +
          `❌ Rejected Payments: <b>${stats.rejectedPayments}</b>\n` +
          `🌐 Active Demo DNS: <b>${stats.activeDns}</b>`,
        parse_mode: 'HTML',
        reply_markup: adminMainMenuKeyboard()
      });
      return res.json({ ok: true });
    }

    await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: isAdmin(senderId)
        ? 'Use /start to open NEXBOOST or /admin to manage payments & Demo DNS.'
        : 'Use /start to open NEXBOOST.'
    });
    return res.json({ ok: true });
  }

  // 2. Handle Inline Keyboard Callbacks
  const callback = body?.callback_query;
  if (callback?.data) {
    const adminId = String(callback.from?.id ?? '');
    const chatId = String(callback.message?.chat?.id ?? adminId);
    const data = String(callback.data);

    if (!isAdmin(adminId)) {
      await sendTelegram('answerCallbackQuery', {
        callback_query_id: callback.id,
        text: `Not authorized (ID: ${adminId})`,
        show_alert: true
      });
      return res.json({ ok: true });
    }

    // Main Admin Home
    if (data === 'admin:home') {
      await sendTelegram('answerCallbackQuery', { callback_query_id: callback.id });
      const stats = getAdminOverview();
      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text:
          `🛡️ <b>NEXBOOST ADMIN PANEL</b>\n\n` +
          `👥 Total Users: <b>${stats.totalUsers}</b>\n` +
          `⏳ Pending Payments: <b>${stats.pendingPayments}</b>\n` +
          `✅ Approved Payments: <b>${stats.approvedPayments}</b>\n` +
          `❌ Rejected Payments: <b>${stats.rejectedPayments}</b>\n` +
          `🌐 Active Demo DNS: <b>${stats.activeDns}</b>`,
        parse_mode: 'HTML',
        reply_markup: adminMainMenuKeyboard()
      });
      return res.json({ ok: true });
    }

    // List Payments by Status (with Receipt Photo!)
    if (data.startsWith('admin:payments:')) {
      const status = data.split(':')[2] as 'pending' | 'approved' | 'rejected';
      await sendTelegram('answerCallbackQuery', { callback_query_id: callback.id });

      const items = getPaymentsByStatus(status);
      if (items.length === 0) {
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: `No <b>${escapeHtml(status.toUpperCase())}</b> payments found.`,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Admin Menu', callback_data: 'admin:home' }]] }
        });
        return res.json({ ok: true });
      }

      for (const item of items.slice(0, 10)) {
        await sendReceiptCardToChat(chatId, item);
      }
      return res.json({ ok: true });
    }

    // All Users Summary
    if (data === 'admin:users') {
      await sendTelegram('answerCallbackQuery', { callback_query_id: callback.id });
      const stats = getAdminOverview();
      const lines = stats.users.slice(0, 20).map((u, idx) => {
        const uname = u.username ? `@${escapeHtml(u.username)}` : escapeHtml(u.first_name ?? 'User');
        return `${idx + 1}. ${uname} (<code>${u.telegram_id}</code>) — <b>${escapeHtml(u.subStatus)}</b>`;
      });

      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text: `👥 <b>ALL REGISTERED USERS (${stats.totalUsers})</b>\n\n${lines.join('\n') || 'No users yet.'}`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Admin Menu', callback_data: 'admin:home' }]] }
      });
      return res.json({ ok: true });
    }

    // Admin Profile
    if (data === 'admin:profile') {
      await sendTelegram('answerCallbackQuery', { callback_query_id: callback.id });
      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text:
          `👤 <b>ADMIN PROFILE</b>\n\n` +
          `• Admin Name: ${escapeHtml(callback.from?.first_name ?? 'Admin')}\n` +
          `• Username: ${callback.from?.username ? '@' + escapeHtml(callback.from.username) : 'N/A'}\n` +
          `• Admin Telegram ID: <code>${adminId}</code>\n` +
          `• Role: Super Admin (Verified)`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Admin Menu', callback_data: 'admin:home' }]] }
      });
      return res.json({ ok: true });
    }

    // Demo DNS Management Menu
    if (data === 'admin:dns:menu') {
      await sendTelegram('answerCallbackQuery', { callback_query_id: callback.id });
      await sendTelegram('sendMessage', {
        chat_id: chatId,
        text: '🌐 <b>DEMO DNS MANAGEMENT</b>\nSelect a filter to manage user demo access:',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🟢 Active Demo Users', callback_data: 'admin:dns:list:active' }],
            [
              { text: '⌛ Expired Users', callback_data: 'admin:dns:list:expired' },
              { text: '🚫 Revoked Users', callback_data: 'admin:dns:list:revoked' }
            ],
            [{ text: '⬅️ Back to Admin Menu', callback_data: 'admin:home' }]
          ]
        }
      });
      return res.json({ ok: true });
    }

    // List Demo DNS Users (active | expired | revoked)
    if (data.startsWith('admin:dns:list:')) {
      const filter = data.split(':')[3] as 'active' | 'expired' | 'revoked';
      await sendTelegram('answerCallbackQuery', { callback_query_id: callback.id });

      const list = getDemoDnsList(filter);
      if (list.length === 0) {
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: `No <b>${escapeHtml(filter.toUpperCase())}</b> Demo DNS users found.`,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to DNS Menu', callback_data: 'admin:dns:menu' }]] }
        });
        return res.json({ ok: true });
      }

      for (const entry of list.slice(0, 10)) {
        const uname = entry.user?.username ? `@${escapeHtml(entry.user.username)}` : `ID ${entry.user?.telegram_id}`;
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text:
            `🌐 <b>DEMO DNS (${filter.toUpperCase()})</b>\n` +
            `- User: ${uname} (<code>${entry.user?.telegram_id}</code>)\n` +
            `- Plan: ${escapeHtml(entry.plan)}\n` +
            `- Demo Link: <code>${escapeHtml(entry.demoLink ?? 'Not generated')}</code>\n` +
            `- Expires: ${new Date(entry.expiry_date).toUTCString()}`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 Generate / Resend Link', callback_data: `dns:resend:${entry.user_id}` },
                { text: '➕ Renew +30d', callback_data: `dns:renew:${entry.user_id}` }
              ],
              [
                { text: '🚫 Revoke Access', callback_data: `dns:revoke:${entry.user_id}` }
              ]
            ]
          }
        });
      }
      return res.json({ ok: true });
    }

    // DNS Actions: Resend / Generate, Renew, Revoke
    if (data.startsWith('dns:')) {
      const [, dnsAction, targetUserId] = data.split(':');
      try {
        if (dnsAction === 'resend') {
          const resObj = await issueOrResendDemoDnsForUser(targetUserId, adminId);
          await sendTelegram('answerCallbackQuery', { callback_query_id: callback.id, text: 'Demo DNS sent to user!' });
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: `✅ Demo DNS link generated & sent to user:\n<code>${escapeHtml(resObj.demoLink)}</code>`,
            parse_mode: 'HTML'
          });
        } else if (dnsAction === 'renew') {
          const resObj = await renewSubscriptionForUser(targetUserId, 'monthly', adminId);
          await sendTelegram('answerCallbackQuery', { callback_query_id: callback.id, text: 'Renewed for 30 days!' });
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: `✅ Subscription renewed (+30 days) & Demo DNS sent:\n<code>${escapeHtml(resObj.demoLink)}</code>`,
            parse_mode: 'HTML'
          });
        } else if (dnsAction === 'revoke') {
          await revokeDemoDnsForUser(targetUserId, adminId);
          await sendTelegram('answerCallbackQuery', { callback_query_id: callback.id, text: 'Demo access revoked.' });
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: `🚫 Demo DNS access revoked for user <code>${escapeHtml(targetUserId)}</code>.`,
            parse_mode: 'HTML'
          });
        }
      } catch (err) {
        await sendTelegram('answerCallbackQuery', {
          callback_query_id: callback.id,
          text: err instanceof Error ? err.message : 'Action failed',
          show_alert: true
        });
      }
      return res.json({ ok: true });
    }

    // Approve or Reject Payment
    const [action, paymentId] = data.split(':');
    if ((action === 'approve' || action === 'reject') && paymentId) {
      try {
        const result = await updatePaymentDecision(
          paymentId,
          action === 'approve' ? 'approved' : 'rejected',
          adminId
        );
        await sendTelegram('answerCallbackQuery', {
          callback_query_id: callback.id,
          text: action === 'approve' ? 'Approved & Demo DNS sent!' : 'Payment rejected.'
        });
        if (callback.message?.message_id) {
          await sendTelegram('editMessageReplyMarkup', {
            chat_id: chatId,
            message_id: callback.message.message_id,
            reply_markup: { inline_keyboard: [] }
          });
        }
        const userLabel = result.user?.username ? `@${escapeHtml(result.user.username)}` : `ID ${result.user?.telegram_id}`;
        const statusMsg =
          action === 'approve'
            ? `✅ <b>APPROVED</b> by Admin (<code>${adminId}</code>)\nUser: ${userLabel}\nDemo Link Sent: <code>${escapeHtml(result.demoLink ?? '')}</code>`
            : `❌ <b>REJECTED</b> by Admin (<code>${adminId}</code>)\nUser: ${userLabel}`;
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: statusMsg,
          parse_mode: 'HTML'
        });
      } catch (error) {
        await sendTelegram('answerCallbackQuery', {
          callback_query_id: callback.id,
          text: error instanceof Error ? error.message : 'Failed',
          show_alert: true
        });
      }
    }
  }

  return res.json({ ok: true });
});
