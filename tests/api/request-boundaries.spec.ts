import { randomUUID } from 'node:crypto';
import { test, expect } from '../support/fixtures';
import { userFactory, transactionFactory } from '../support/factories';
import { issueDemoToken } from '../../mock/auth';
import { environment } from '../../config/environment';
import type { User, Transaction } from '../support/contracts';

test('oversized registration is rejected without reserving the email', async ({ api }) => {
  const input = userFactory();
  await expect(await api.createUser({ ...input, name: 'x'.repeat(17 * 1024) }))
    .toHaveApiError(413, 'PAYLOAD_TOO_LARGE');
  const corrected = await api.createUser(input);
  expect(corrected.status()).toBe(201);
  expect<unknown>(await corrected.json()).toMatchUser(input);
});

for (const malformed of ['malformed JSON', 'oversized JSON', 'array body', 'null body'] as const) {
  test(`${malformed} cannot alter existing transactions`, async ({ api, sender, recipient }) => {
    const input = transactionFactory(sender.user.id, recipient.user.id);
    const seed = await api.createTransaction(input, sender.token);
    expect(seed.status()).toBe(201);
    const original = await seed.json();
    const data = malformed === 'malformed JSON' ? '{"amount":'
      : malformed === 'oversized JSON' ? JSON.stringify({ ...input, extra: 'x'.repeat(17 * 1024) })
      : malformed === 'array body' ? JSON.stringify([input]) : 'null';
    const response = await api.send('POST', '/api/transactions', {
      data, token: sender.token, headers: { 'content-type': 'application/json' },
    });
    const oversized = malformed === 'oversized JSON';
    await expect(response).toHaveApiError(oversized ? 413 : 400, oversized ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR');
    const after = await api.getTransactions(sender.user.id, sender.token);
    expect(after.status()).toBe(200);
    expect(await after.json()).toEqual([original]);
  });
}

test('registration ignores injected IDs and privileged fields', async ({ api }) => {
  const input = userFactory();
  const injectedId = randomUUID();
  const response = await api.createUser({ ...input, id: injectedId, role: 'admin', balance: 1_000_000 });
  expect(response.status()).toBe(201);
  const user: User = await response.json();
  expect(user).toMatchUser(input);
  expect(user.id).not.toBe(injectedId);
  const stored = await api.getUser(user.id, issueDemoToken(user.id, environment.authSecret));
  expect(stored.status()).toBe(200);
  expect(await stored.json()).toEqual(user);
});

test('transaction creation ignores injected IDs and internal money fields', async ({ api, sender, recipient }) => {
  const input = transactionFactory(sender.user.id, recipient.user.id);
  const injectedId = randomUUID();
  const response = await api.createTransaction({ ...input, id: injectedId, amountMinor: 1, status: 'settled' }, sender.token);
  expect(response.status()).toBe(201);
  const transaction: Transaction = await response.json();
  expect(transaction).toMatchTransaction(input);
  expect(transaction.id).not.toBe(injectedId);
  const stored = await api.getTransactions(sender.user.id, sender.token);
  expect(stored.status()).toBe(200);
  expect(await stored.json()).toEqual([transaction]);
});
