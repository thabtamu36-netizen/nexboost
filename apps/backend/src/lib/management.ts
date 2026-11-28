import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { env, getAdminChatIds, isSupabaseReady } from '../config/env.js';
import { getSupabase } from './supabase.js';

export const PLANS = {
  trial: { durationMs: 24 * 60 * 60 * 1000, amount: 0 },
  weekly: { durationMs: 7 * 24 * 60 * 60 * 1000, amount: 149 },
  monthly: { durationMs: 30 * 24 * 60 * 60 * 1000, amount: 349 }
} as const;

export type PlanName = keyof typeof PLANS;
export type PaymentStatus = 'pending' | 'approved' | 'rejected';
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'suspended' | 'inactive' | 'revoked';

export type UserRecord = {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  account_status: 'active' | 'blocked';
  created_at: string;
  updated_at: string;
};

export type PaymentRecord = {
  id: string;
  user_id: string;
  amount: number;
  payment_proof: string | null;
  payment_method: string;
  submitted_at: string;
  status: PaymentStatus;
  transaction_ref?: string;
  plan?: string;
  network?: string | null;
  device?: string | null;
  approved_by?: string | null;
  decision_note?: string | null;
};

export type SubscriptionRecord = {
  id: string;
  user_id: string;
  plan: string;
  start_date: string;
  expiry_date: string;
  status: SubscriptionStatus;
  demo_link?: string | null;
  demo_token_hash?: string | null;
};

export type ActivityLogRecord = {
  id: string;
  user_id: string;
  admin_id: string | null;
  action: string;
  details: string;
  created_at: string;
};

const state = {
  users: [] as UserRecord[],
  payments: [] as PaymentRecord[],
  subscriptions: [] as SubscriptionRecord[],
  activityLogs: [] as ActivityLogRecord[]
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function generateDemoDnsCredentials(prefix = 'ethio-demo') {
  const token = randomBytes(12).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const rawDomain = (env as Record<string, unknown>).DEMO_DNS_DOMAIN;
  const baseDomain = typeof rawDomain === 'string' && rawDomain.trim()
    ? rawDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
    : 'demo.nexboost.net';
  const demoLink = `https://${baseDomain}/dns-query/${prefix}-${token.slice(0, 10)}`;
  return { demoLink, tokenHash };
}

function expireOutdatedSubscriptions() {
  const nowMs = Date.now();
  for (const sub of state.subscriptions) {
    if ((sub.status === 'active' || sub.status === 'trial') && new Date(sub.expiry_date).getTime() <= nowMs) {
      sub.status = 'expired';
      void syncSubscriptionToSupabase(sub);
    }
  }
}

export async function hydrateStateFromSupabase() {
  if (!isSupabaseReady) {
    console.log(JSON.stringify({ event: 'supabase_hydrate_skipped', reason: 'not_configured' }));
    return;
  }

  try {
    const supabase = getSupabase();
    const [usersResult, paymentsResult, subscriptionsResult, activityLogsResult] = await withTimeout(Promise.all([
      supabase.from('users').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('subscriptions').select('*'),
      supabase.from('activity_logs').select('*')
    ]), 8_000, 'supabase_hydrate');

    if (usersResult.data) {
      state.users = usersResult.data.map((user) => ({
        id: user.id,
        telegram_id: Number(user.telegram_id),
        username: user.username ?? null,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        account_status: user.account_status,
        created_at: user.created_at,
        updated_at: user.updated_at
      }));
    }

    if (paymentsResult.data) {
      state.payments = paymentsResult.data.map((payment) => ({
        id: payment.id,
        user_id: payment.user_id,
        amount: Number(payment.amount),
        payment_proof: payment.payment_proof ?? null,
        payment_method: payment.payment_method,
        submitted_at: payment.submitted_at,
        status: payment.status,
        approved_by: payment.approved_by ?? null,
        decision_note: payment.decision_note ?? null,
        transaction_ref: payment.transaction_ref,
        plan: payment.plan ?? undefined,
        network: payment.network ?? null,
        device: payment.device ?? null
      }) as PaymentRecord & { transaction_ref: string });
    }

    if (subscriptionsResult.data) {
      state.subscriptions = subscriptionsResult.data.map((subscription) => ({
        id: subscription.id,
        user_id: subscription.user_id,
        plan: subscription.plan,
        start_date: subscription.start_date,
        expiry_date: subscription.expiry_date,
        status: subscription.status,
        demo_link: subscription.demo_link ?? null,
        demo_token_hash: subscription.demo_token_hash ?? null
      }));
    }

    if (activityLogsResult.data) {
      state.activityLogs = activityLogsResult.data.map((log) => ({
        id: log.id,
        user_id: log.user_id,
        admin_id: log.admin_id ?? null,
        action: log.action,
        details: log.details,
        created_at: log.created_at
      }));
    }
  } catch {
    // Leave in-memory state as-is when the database is unavailable.
  }
}

async function syncUserToSupabase(user: UserRecord) {
  if (!isSupabaseReady) return;
  try {
    const supabase = getSupabase();
    const { error } = await withTimeout(Promise.resolve(supabase.from('users').upsert({
      id: user.id,
      telegram_id: user.telegram_id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      account_status: user.account_status,
      created_at: user.created_at,
      updated_at: user.updated_at
    }, { onConflict: 'telegram_id' })), 10_000, 'supabase_user_upsert');
    if (error) throw new Error(error.message);
  } catch (error) {
    throw error;
  }
}

async function syncPaymentToSupabase(payment: PaymentRecord & { transaction_ref: string }) {
  if (!isSupabaseReady) return;
  try {
    const supabase = getSupabase();
    const { error } = await withTimeout(Promise.resolve(supabase.from('payments').upsert({
      id: payment.id,
      user_id: payment.user_id,
      amount: payment.amount,
      payment_proof: payment.payment_proof,
      payment_method: payment.payment_method,
      submitted_at: payment.submitted_at,
      status: payment.status,
      approved_by: payment.approved_by,
      decision_note: payment.decision_note,
      transaction_ref: payment.transaction_ref,
      plan: payment.plan,
      network: payment.network ?? null,
      device: payment.device ?? null,
      created_at: payment.submitted_at
    }, { onConflict: 'transaction_ref' })), 12_000, 'supabase_payment_upsert');
    if (error) throw new Error(error.message);
  } catch (error) {
    throw error;
  }
}

async function syncSubscriptionToSupabase(subscription: SubscriptionRecord) {
  if (!isSupabaseReady) return;
  try {
    const supabase = getSupabase();
    await supabase.from('subscriptions').upsert({
      id: subscription.id,
      user_id: subscription.user_id,
      plan: subscription.plan,
      start_date: subscription.start_date,
      expiry_date: subscription.expiry_date,
      status: subscription.status,
      demo_link: subscription.demo_link ?? null,
      demo_token_hash: subscription.demo_token_hash ?? null,
      created_at: subscription.start_date,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch {
    // Ignore optional Supabase sync failures so the in-memory flow stays usable.
  }
}

async function syncActivityLogToSupabase(log: ActivityLogRecord) {
  if (!isSupabaseReady) return;
  try {
    const supabase = getSupabase();
    await supabase.from('activity_logs').insert({
      id: log.id,
      user_id: log.user_id,
      admin_id: log.admin_id,
      action: log.action,
      details: log.details,
      created_at: log.created_at
    });
  } catch {
    // Ignore optional Supabase sync failures so the in-memory flow stays usable.
  }
}

const ensureSeedData = () => {
  if (state.users.length > 0 || state.payments.length > 0 || state.subscriptions.length > 0) {
    return;
  }

  const userId = randomUUID();
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  state.users.push({
    id: userId,
    telegram_id: 123456789,
    username: 'demo_admin',
    first_name: 'Demo',
    last_name: 'Admin',
    account_status: 'active',
    created_at: now,
    updated_at: now
  });

  state.subscriptions.push({
    id: randomUUID(),
    user_id: userId,
    plan: 'monthly',
    start_date: now,
    expiry_date: future,
    status: 'active'
  });

  state.payments.push({
    id: randomUUID(),
    user_id: userId,
    amount: 349,
    payment_proof: 'https://example.com/proof/demo.jpg',
    payment_method: 'telebirr',
    submitted_at: now,
    status: 'approved',
    approved_by: 'admin-bot',
    decision_note: 'Demo approval'
  });

  state.activityLogs.push({
    id: randomUUID(),
    user_id: userId,
    admin_id: null,
    action: 'dashboard_seeded',
    details: 'Seed data initialized for the management dashboard.',
    created_at: now
  });
};

export function getDashboardSnapshot() {
  ensureSeedData();
  expireOutdatedSubscriptions();

  const stats = {
    totalUsers: state.users.length,
    activeSubscriptions: state.subscriptions.filter((s) => s.status === 'active').length,
    pendingPayments: state.payments.filter((p) => p.status === 'pending').length,
    approvedPayments: state.payments.filter((p) => p.status === 'approved').length,
    rejectedPayments: state.payments.filter((p) => p.status === 'rejected').length,
    totalRevenue: state.payments.reduce((sum, payment) => sum + (payment.status === 'approved' ? payment.amount : 0), 0)
  };

  return {
    stats,
    users: state.users,
    payments: state.payments,
    subscriptions: state.subscriptions,
    activityLogs: state.activityLogs,
    realtimeEnabled: isSupabaseReady
  };
}

export function upsertUser(telegramUser: {
  telegramId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  ensureSeedData();
  const existing = state.users.find((user) => user.telegram_id === telegramUser.telegramId);
  if (existing) {
    const updated = {
      ...existing,
      username: telegramUser.username ?? existing.username,
      first_name: telegramUser.firstName ?? existing.first_name,
      last_name: telegramUser.lastName ?? existing.last_name,
      updated_at: new Date().toISOString()
    };
    const index = state.users.findIndex((user) => user.id === existing.id);
    state.users[index] = updated;
    void syncUserToSupabase(updated);
    return updated;
  }

  const user: UserRecord = {
    id: randomUUID(),
    telegram_id: telegramUser.telegramId,
    username: telegramUser.username ?? null,
    first_name: telegramUser.firstName ?? null,
    last_name: telegramUser.lastName ?? null,
    account_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  state.users.push(user);
  void syncUserToSupabase(user);
  return user;
}

export async function createPaymentSubmission(input: {
  telegramId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  plan: string;
  amount: number;
  paymentMethod: string;
  transactionRef: string;
  paymentProof?: string | null;
  network?: string | null;
  device?: string | null;
}) {
  ensureSeedData();
  const plan = input.plan as PlanName;
  const planConfig = PLANS[plan];
  if (!planConfig) {
    throw new Error('Invalid payment plan.');
  }

  const user = upsertUser({
    telegramId: input.telegramId,
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName
  });

  const existingPending = state.payments.find(
    (p) => p.transaction_ref === input.transactionRef && p.status === 'pending'
  );
  if (existingPending) {
    return { ok: true, payment: existingPending, user, duplicate: true };
  }

  const payment: PaymentRecord & { transaction_ref: string; plan: string } = {
    id: randomUUID(),
    user_id: user.id,
    amount: planConfig.amount,
    payment_proof: input.paymentProof ?? null,
    payment_method: input.paymentMethod,
    submitted_at: new Date().toISOString(),
    status: 'pending',
    approved_by: null,
    decision_note: null,
    transaction_ref: input.transactionRef,
    plan,
    network: input.network ?? null,
    device: input.device ?? null
  };
  state.payments.push(payment);

  const activityLog: ActivityLogRecord = {
    id: randomUUID(),
    user_id: user.id,
    admin_id: null,
    action: 'payment_submitted',
    details: `${input.plan} payment submitted via ${input.paymentMethod} (${input.transactionRef})`,
    created_at: payment.submitted_at
  };
  state.activityLogs.push(activityLog);

  await syncPaymentToSupabase(payment);
  await syncActivityLogToSupabase(activityLog);
  return { ok: true, payment, user, duplicate: false };
}

export async function updatePaymentDecision(
  paymentId: string,
  decision: 'approved' | 'rejected',
  adminId: string | null
) {
  ensureSeedData();
  const paymentIndex = state.payments.findIndex((payment) => payment.id === paymentId);
  if (paymentIndex === -1) {
    throw new Error('Payment not found.');
  }

  const payment = state.payments[paymentIndex] as PaymentRecord & { transaction_ref: string };
  if (payment.status !== 'pending') {
    throw new Error('This payment has already been processed.');
  }

  const user = state.users.find((entry) => entry.id === payment.user_id);
  if (!user) {
    throw new Error('User record not found for this payment.');
  }

  payment.status = decision;
  payment.approved_by = adminId;
  payment.decision_note = decision === 'approved' ? 'Approved by admin' : 'Rejected by admin';

  let demoLink: string | null = null;
  if (decision === 'approved') {
    expireOutdatedSubscriptions();
    const plan = (payment.plan ?? 'monthly') as PlanName;
    const planConfig = PLANS[plan] ?? PLANS.monthly;
    const existingActive = state.subscriptions.find(
      (sub) => sub.user_id === user.id && sub.status === 'active'
    );
    if (existingActive) {
      throw new Error('User already has an active subscription.');
    }

    const now = new Date();
    const expiry = new Date(now.getTime() + planConfig.durationMs);
    const creds = generateDemoDnsCredentials(payment.network === 'safaricom' ? 'safari-pro' : 'ethio-pro');
    demoLink = creds.demoLink;

    const subscription: SubscriptionRecord = {
      id: randomUUID(),
      user_id: user.id,
      plan,
      start_date: now.toISOString(),
      expiry_date: expiry.toISOString(),
      status: 'active',
      demo_link: creds.demoLink,
      demo_token_hash: creds.tokenHash
    };
    state.subscriptions.push(subscription);
    await syncSubscriptionToSupabase(subscription);
  }

  const activityLog: ActivityLogRecord = {
    id: randomUUID(),
    user_id: user.id,
    admin_id: adminId,
    action: `payment_${decision}`,
    details: `Payment ${payment.transaction_ref} marked as ${decision}.`,
    created_at: new Date().toISOString()
  };
  state.activityLogs.push(activityLog);

  await syncPaymentToSupabase(payment);
  await syncActivityLogToSupabase(activityLog);

  if (env.TELEGRAM_BOT_TOKEN && user.telegram_id) {
    const activeSub = state.subscriptions.find((s) => s.user_id === user.id && s.status === 'active');
    const text =
      decision === 'approved'
        ? `✅ <b>Payment Approved!</b>\n\n` +
          `📦 <b>Plan:</b> ${String(payment.plan ?? 'monthly').toUpperCase()}\n` +
          `🌐 <b>Your Demo Access Link:</b>\n<code>${demoLink}</code>\n\n` +
          `⏳ <b>Expires:</b> ${activeSub ? new Date(activeSub.expiry_date).toUTCString() : ''}\n\n` +
          `<i>Note: This is a demo access link for testing your NEXBOOST configuration.</i>`
        : `❌ <b>Payment Rejected</b>\n\nYour payment reference <code>${payment.transaction_ref}</code> could not be verified. Please check your receipt and resubmit in NEXBOOST.`;

    void fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegram_id,
        text,
        parse_mode: 'HTML'
      })
    });
  }

  return {
    ok: true,
    payment,
    user,
    demoLink
  };
}

export const notifyTelegramAdmins = async (
  message: string,
  paymentId?: string,
  paymentProof?: string | null
) => {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, reason: 'Telegram bot is not configured.' };
  }

  const adminIds = getAdminChatIds();
  if (adminIds.length === 0) {
    return { ok: false, reason: 'No admin chat IDs configured.' };
  }

  const replyMarkup = paymentId
    ? {
        inline_keyboard: [[
          { text: '✅ Approve & Send Demo DNS', callback_data: `approve:${paymentId}` },
          { text: '❌ Reject Payment', callback_data: `reject:${paymentId}` }
        ]]
      }
    : undefined;

  const imageMatch = paymentProof?.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/
  );

  const requests = adminIds.map(async (chatId) => {
    let response: Response;
    if (imageMatch) {
      const mimeType = imageMatch[1];
      const base64Data = imageMatch[2].replace(/\s/g, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('photo', new Blob([imageBuffer], { type: mimeType }), 'payment-proof.jpg');
      form.append('caption', message);
      form.append('parse_mode', 'HTML');
      if (replyMarkup) {
        form.append('reply_markup', JSON.stringify(replyMarkup));
      }
      response = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
        { method: 'POST', body: form }
      );
    } else {
      response = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            reply_markup: replyMarkup
          })
        }
      );
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Telegram admin notification failed for ${chatId}:`, errorBody);
    }
    return response.ok;
  });

  const results = await Promise.all(requests);
  return {
    ok: results.every(Boolean),
    sent: results.filter(Boolean).length,
    failed: results.filter((success) => !success).length
  };
};

export async function activateTrialForUser(input: {
  telegramId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  ensureSeedData();
  expireOutdatedSubscriptions();
  const user = upsertUser(input);

  const trialAlreadyClaimed = state.subscriptions.some(
    (sub) => sub.user_id === user.id && sub.plan === 'trial'
  );
  if (trialAlreadyClaimed) {
    throw new Error('Free trial has already been claimed for this Telegram account.');
  }

  const now = new Date();
  const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const creds = generateDemoDnsCredentials('ethio-trial');

  const subscription: SubscriptionRecord = {
    id: randomUUID(),
    user_id: user.id,
    plan: 'trial',
    start_date: now.toISOString(),
    expiry_date: expiry.toISOString(),
    status: 'trial',
    demo_link: creds.demoLink,
    demo_token_hash: creds.tokenHash
  };
  state.subscriptions.push(subscription);
  await syncSubscriptionToSupabase(subscription);

  const activityLog: ActivityLogRecord = {
    id: randomUUID(),
    user_id: user.id,
    admin_id: null,
    action: 'free_trial_activated',
    details: '24h demo free trial activated.',
    created_at: now.toISOString()
  };
  state.activityLogs.push(activityLog);
  await syncActivityLogToSupabase(activityLog);

  return {
    ok: true,
    user,
    trial: {
      plan: 'trial',
      startDate: now.toISOString(),
      expiryDate: expiry.toISOString(),
      status: 'trial',
      demoLink: creds.demoLink
    }
  };
}

export function getAdminOverview() {
  ensureSeedData();
  expireOutdatedSubscriptions();

  const usersWithStatus = state.users.map((u) => {
    const latestSub = [...state.subscriptions]
      .filter((s) => s.user_id === u.id)
      .sort((a, b) => new Date(b.expiry_date).getTime() - new Date(a.expiry_date).getTime())[0];
    return {
      ...u,
      subStatus: latestSub ? latestSub.status : 'none'
    };
  });

  return {
    totalUsers: state.users.length,
    pendingPayments: state.payments.filter((p) => p.status === 'pending').length,
    approvedPayments: state.payments.filter((p) => p.status === 'approved').length,
    rejectedPayments: state.payments.filter((p) => p.status === 'rejected').length,
    activeDns: state.subscriptions.filter((s) => s.status === 'active' || s.status === 'trial').length,
    users: usersWithStatus
  };
}

export function getPaymentsByStatus(status: PaymentStatus) {
  ensureSeedData();
  return state.payments
    .filter((p) => p.status === status)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .map((p) => ({
      ...p,
      user: state.users.find((u) => u.id === p.user_id) ?? null
    }));
}

export function getDemoDnsList(filter: 'active' | 'expired' | 'revoked') {
  ensureSeedData();
  expireOutdatedSubscriptions();

  return state.subscriptions
    .filter((sub) => {
      if (filter === 'active') return sub.status === 'active' || sub.status === 'trial';
      return sub.status === filter;
    })
    .map((sub) => ({
      ...sub,
      demoLink: sub.demo_link ?? null,
      user: state.users.find((u) => u.id === sub.user_id) ?? null
    }));
}

export async function issueOrResendDemoDnsForUser(userId: string, _adminId: string) {
  const user = state.users.find((u) => u.id === userId);
  if (!user) throw new Error('User not found.');

  const sub = [...state.subscriptions]
    .filter((s) => s.user_id === user.id && (s.status === 'active' || s.status === 'trial'))
    .sort((a, b) => new Date(b.expiry_date).getTime() - new Date(a.expiry_date).getTime())[0];
  if (!sub) {
    throw new Error('User does not have an active subscription or trial.');
  }

  const creds = generateDemoDnsCredentials('ethio-demo');
  sub.demo_link = creds.demoLink;
  sub.demo_token_hash = creds.tokenHash;
  await syncSubscriptionToSupabase(sub);

  if (env.TELEGRAM_BOT_TOKEN && user.telegram_id) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegram_id,
        text: `🌐 <b>Your Demo Access Link:</b>\n<code>${creds.demoLink}</code>\n\n⏳ <b>Expires:</b> ${new Date(sub.expiry_date).toUTCString()}`,
        parse_mode: 'HTML'
      })
    });
  }

  return { ok: true, demoLink: creds.demoLink };
}

export async function renewSubscriptionForUser(userId: string, plan: PlanName, _adminId: string) {
  const user = state.users.find((u) => u.id === userId);
  if (!user) throw new Error('User not found.');

  const planConfig = PLANS[plan] ?? PLANS.monthly;
  const now = new Date();
  const expiry = new Date(now.getTime() + planConfig.durationMs);
  const creds = generateDemoDnsCredentials('ethio-pro');

  const subscription: SubscriptionRecord = {
    id: randomUUID(),
    user_id: user.id,
    plan,
    start_date: now.toISOString(),
    expiry_date: expiry.toISOString(),
    status: 'active',
    demo_link: creds.demoLink,
    demo_token_hash: creds.tokenHash
  };
  state.subscriptions.push(subscription);
  await syncSubscriptionToSupabase(subscription);

  if (env.TELEGRAM_BOT_TOKEN && user.telegram_id) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegram_id,
        text: `🔄 <b>Subscription Renewed!</b>\n\n🌐 <b>New Demo Link:</b>\n<code>${creds.demoLink}</code>\n⏳ <b>Expires:</b> ${expiry.toUTCString()}`,
        parse_mode: 'HTML'
      })
    });
  }

  return { ok: true, demoLink: creds.demoLink };
}

export async function revokeDemoDnsForUser(userId: string, _adminId: string) {
  const user = state.users.find((u) => u.id === userId);
  if (!user) throw new Error('User not found.');

  let revokedCount = 0;
  for (const sub of state.subscriptions) {
    if (sub.user_id === user.id && (sub.status === 'active' || sub.status === 'trial')) {
      sub.status = 'revoked';
      sub.demo_link = null;
      sub.demo_token_hash = null;
      await syncSubscriptionToSupabase(sub);
      revokedCount++;
    }
  }

  if (revokedCount === 0) {
    throw new Error('No active Demo DNS found to revoke.');
  }

  if (env.TELEGRAM_BOT_TOKEN && user.telegram_id) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegram_id,
        text: '🚫 Your NEXBOOST demo access has been revoked by an administrator.'
      })
    });
  }

  return { ok: true };
}
