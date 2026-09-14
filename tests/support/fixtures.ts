import { test as base, type Response } from '@playwright/test';
import { environment } from '../../config/environment';
import { issueDemoToken } from '../../mock/auth';
import { ApiClient } from './api-client';
import { expect } from './assertions';
import { userFactory } from './factories';
import { attachExchange } from './logging';
import type { Actor, User } from './contracts';

type Fixtures = { api: ApiClient; sender: Actor; recipient: Actor };

export const test = base.extend<Fixtures>({
  api: async ({ playwright }, use, testInfo) => {
    // Independent request context: credentials never become global defaults.
    const request = await playwright.request.newContext({ baseURL: environment.apiBaseURL });
    try { await use(new ApiClient(request, testInfo)); }
    finally { await request.dispose(); }
  },
  sender: async ({ api }, use) => { await use(await createActor(api)); },
  recipient: async ({ api }, use) => { await use(await createActor(api)); },
  page: async ({ page }, use, testInfo) => {
    const pending: Promise<void>[] = [];
    const failures: string[] = [];
    const listener = (response: Response) => {
      if (!new URL(response.url()).pathname.startsWith('/api/')) return;
      pending.push((async () => {
        await attachExchange(testInfo, response.request().method(), response.url(), response.status(), await response.text());
      })().catch(() => { failures.push('A browser API response could not be attached.'); }));
    };
    page.on('response', listener);
    try { await use(page); }
    finally {
      page.off('response', listener);
      await Promise.all(pending);
      if (failures.length) await testInfo.attach('api-log-warning', { body: failures.join('\n'), contentType: 'text/plain' });
    }
  },
});

async function createActor(api: ApiClient): Promise<Actor> {
  const input = userFactory();
  const response = await api.createUser(input);
  expect(response.status()).toBe(201);
  const user: User = await response.json();
  expect(user).toMatchUser(input);
  return { user, token: issueDemoToken(user.id, environment.authSecret) };
}

export { expect };
