import { createApp } from './app.js';
import { env } from './config/env.js';
import { hydrateStateFromSupabase } from './lib/management.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(JSON.stringify({
    event: 'backend_listening',
    port: env.PORT,
    health: '/health'
  }));
});

void hydrateStateFromSupabase()
  .then(() => {
    console.log(JSON.stringify({ event: 'supabase_hydrate_complete' }));
  })
  .catch((error) => {
    console.error(JSON.stringify({
      event: 'supabase_hydrate_failed',
      message: error instanceof Error ? error.message : 'unknown'
    }));
  });
