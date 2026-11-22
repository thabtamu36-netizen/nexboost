
import { afterEach, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { createApp } from '../app.js';

const servers: Server[] = [];

async function startTestServer() {
  const server = createApp().listen(0);
  servers.push(server);

  await once(server, 'listening');

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Could not determine test server address.');
  }

  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    servers.map(
      server =>
        new Promise<void>((resolve, reject) => {
          server.close(error => {
            if (error) reject(error);
            else resolve();
          });
        })
    )
  );

  servers.length = 0;
});

describe('backend health service', () => {
  it('returns a healthy response from the health endpoint', async () => {
    const baseUrl = await startTestServer();

    const response = await fetch(`${baseUrl}/api/health`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.service).toBe('nexbooster-backend');
    expect(payload.environment).toBeDefined();
  });

  it('rejects payment submissions using legacy bearer authentication', async () => {
    const baseUrl = await startTestServer();

    const response = await fetch(`${baseUrl}/api/payments/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-admin-secret'
      },
      body: JSON.stringify({
        telegramId: 987654321,
        plan: 'monthly',
        transactionRef: 'TEST-REF-001'
      })
    });

    expect(response.status).toBe(401);
  });
});
