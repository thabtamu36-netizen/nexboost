import { createClient } from '@supabase/supabase-js';
import { env, isSupabaseReady } from '../config/env.js';

export function getSupabase() {
  if (!isSupabaseReady || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase is not configured.');
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
