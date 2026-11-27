import { randomUUID } from 'node:crypto';
import { env, getAdminChatIds, isSupabaseReady } from '../config/env.js';
import { getSupabase } from './supabase.js';
export const PLANS = {
    trial: { durationMs: 24 * 60 * 60 * 1000, amount: 0 },
    weekly: { durationMs: 7 * 24 * 60 * 60 * 1000, amount: 149 },
    monthly: { durationMs: 30 * 24 * 60 * 60 * 1000, amount: 349 }
};
const state = {
    users: [],
    payments: [],
    subscriptions: [],
    activityLogs: []
};
function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
        promise.then((value) => {
            clearTimeout(timer);
            resolve(value);
        }, (error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
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
                transaction_ref: payment.transaction_ref
            }));
        }
        if (subscriptionsResult.data) {
            state.subscriptions = subscriptionsResult.data.map((subscription) => ({
                id: subscription.id,
                user_id: subscription.user_id,
                plan: subscription.plan,
                start_date: subscription.start_date,
                expiry_date: subscription.expiry_date,
                status: subscription.status
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
    }
    catch {
        // Leave in-memory state as-is when the database is unavailable.
    }
}
async function syncUserToSupabase(user) {
    if (!isSupabaseReady) {
        return;
    }
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
        if (error)
            throw new Error(error.message);
    }
    catch (error) {
        throw error;
    }
}
async function syncPaymentToSupabase(payment) {
    if (!isSupabaseReady) {
        return;
    }
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
            created_at: payment.submitted_at
        }, { onConflict: 'transaction_ref' })), 12_000, 'supabase_payment_upsert');
        if (error)
            throw new Error(error.message);
    }
    catch (error) {
        throw error;
    }
}
async function syncSubscriptionToSupabase(subscription) {
    if (!isSupabaseReady) {
        return;
    }
    try {
        const supabase = getSupabase();
        await supabase.from('subscriptions').upsert({
            id: subscription.id,
            user_id: subscription.user_id,
            plan: subscription.plan,
            start_date: subscription.start_date,
            expiry_date: subscription.expiry_date,
            status: subscription.status,
            created_at: subscription.start_date,
            updated_at: subscription.start_date
        }, { onConflict: 'id' });
    }
    catch {
        // Ignore optional Supabase sync failures so the in-memory flow stays usable.
    }
}
async function syncActivityLogToSupabase(log) {
    if (!isSupabaseReady) {
        return;
    }
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
    }
    catch {
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
export function upsertUser(telegramUser) {
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
    const user = {
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
export async function createPaymentSubmission(input) {
    ensureSeedData();
    const plan = input.plan;
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
    await syncUserToSupabase(user);
    const existingPending = state.payments.find((payment) => payment.user_id === user.id && payment.status === 'pending');
    if (existingPending) {
        return { ok: true, payment: existingPending, user, duplicate: true };
    }
    const payment = {
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
        plan
    };
    state.payments.push(payment);
    const activityLog = {
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
export async function updatePaymentDecision(paymentId, decision, adminId) {
    ensureSeedData();
    const paymentIndex = state.payments.findIndex((payment) => payment.id === paymentId);
    if (paymentIndex === -1) {
        throw new Error('Payment not found.');
    }
    const payment = state.payments[paymentIndex];
    if (payment.status !== 'pending') {
        throw new Error('This payment has already been processed.');
    }
    payment.status = decision;
    payment.approved_by = adminId;
    payment.decision_note = decision === 'approved' ? 'Approved by admin' : 'Rejected by admin';
    const user = state.users.find((entry) => entry.id === payment.user_id);
    if (!user) {
        throw new Error('User record not found for this payment.');
    }
    if (decision === 'approved') {
        const plan = (payment.plan ?? 'monthly');
        const planConfig = PLANS[plan] ?? PLANS.monthly;
        const alreadyActive = state.subscriptions.some((subscription) => subscription.user_id === user.id && subscription.status === 'active');
        if (!alreadyActive) {
            const now = new Date();
            const expiry = new Date(now.getTime() + planConfig.durationMs);
            const subscription = {
                id: randomUUID(),
                user_id: user.id,
                plan,
                start_date: now.toISOString(),
                expiry_date: expiry.toISOString(),
                status: 'active'
            };
            state.subscriptions.push(subscription);
            await syncSubscriptionToSupabase(subscription);
        }
    }
    const activityLog = {
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
        const text = decision === 'approved'
            ? `Payment approved.\nPlan: ${payment.plan ?? 'subscription'}\nStart: ${state.subscriptions.find(s => s.user_id === user.id && s.status === 'active')?.start_date ?? ''}\nExpiry: ${state.subscriptions.find(s => s.user_id === user.id && s.status === 'active')?.expiry_date ?? ''}`
            : 'Your payment was rejected.';
        void fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: user.telegram_id, text })
        });
    }
    return {
        ok: true,
        payment,
        user
    };
}
export const notifyTelegramAdmins = async (message, paymentId, paymentProof) => {
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
                    { text: 'Approve', callback_data: `approve:${paymentId}` },
                    { text: 'Reject', callback_data: `reject:${paymentId}` }
                ]]
        }
        : undefined;
    // The Mini App sends screenshots as Base64 data URLs.
    const imageMatch = paymentProof?.match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\s]+)$/);
    const requests = adminIds.map(async (chatId) => {
        let response;
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
            response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: form
            });
        }
        else {
            response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                })
            });
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
export async function activateTrialForUser(input) {
    ensureSeedData();
    const user = upsertUser(input);
    const now = new Date();
    const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const trialExists = state.subscriptions.some((subscription) => subscription.user_id === user.id && subscription.status === 'trial');
    let subscription;
    if (!trialExists) {
        subscription = {
            id: randomUUID(),
            user_id: user.id,
            plan: 'trial',
            start_date: now.toISOString(),
            expiry_date: expiry.toISOString(),
            status: 'trial'
        };
        state.subscriptions.push(subscription);
        await syncSubscriptionToSupabase(subscription);
    }
    const activityLog = {
        id: randomUUID(),
        user_id: user.id,
        admin_id: null,
        action: 'free_trial_activated',
        details: '24h free trial activated for customer.',
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
            status: 'trial'
        }
    };
}
