import { randomUUID } from 'node:crypto';
import { test, expect } from '../support/fixtures';
import { transactionFactory } from '../support/factories';
import { issueDemoToken } from '../../mock/auth';
import { environment } from '../../config/environment';

for (const credential of ['missing', 'invalid', 'expired', 'tampered', 'wrong signing secret', 'nonexistent user'] as const) {
  for (const endpoint of ['profile', 'transaction list', 'create transaction'] as const) {
    test(`${endpoint} rejects ${credential} credentials`, async ({ api, sender, recipient }) => {
      const token = credential === 'missing' ? undefined
        : credential === 'invalid' ? 'not-a-valid-token'
        : credential === 'expired' ? issueDemoToken(sender.user.id, environment.authSecret, Date.now() - 1000)
        : credential === 'tampered' ? `${sender.token}x`
        : credential === 'wrong signing secret' ? issueDemoToken(sender.user.id, `${environment.authSecret}-wrong`)
        : issueDemoToken(randomUUID(), environment.authSecret);
      const response = endpoint === 'profile' ? await api.getUser(sender.user.id, token)
        : endpoint === 'transaction list' ? await api.getTransactions(sender.user.id, token)
        : await api.createTransaction(transactionFactory(sender.user.id, recipient.user.id), token);
      await expect(response).toHaveApiError(401, 'UNAUTHENTICATED');
      if (endpoint === 'create transaction') {
        const list = await api.getTransactions(sender.user.id, sender.token);
        expect(list.status()).toBe(200);
        expect(await list.json()).toEqual([]);
      }
    });
  }
}

test('a user cannot read another user profile', async ({ api, sender, recipient }) => {
  await expect(await api.getUser(recipient.user.id, sender.token)).toHaveApiError(403, 'FORBIDDEN');
});

test('a user cannot read another user transaction list containing records', async ({ api, sender, recipient }) => {
  const created = await api.createTransaction(transactionFactory(recipient.user.id, sender.user.id), recipient.token);
  expect(created.status()).toBe(201);
  await expect(await api.getTransactions(recipient.user.id, sender.token)).toHaveApiError(403, 'FORBIDDEN');
});

test('a user cannot create a transaction as another user', async ({ api, sender, recipient }) => {
  const impersonated = transactionFactory(recipient.user.id, sender.user.id);
  await expect(await api.createTransaction(impersonated, sender.token)).toHaveApiError(403, 'FORBIDDEN');
  for (const actor of [sender, recipient]) {
    const list = await api.getTransactions(actor.user.id, actor.token);
    expect(list.status()).toBe(200);
    expect(await list.json()).toEqual([]);
  }
});

test('foreign profile and list IDs do not reveal whether an account exists', async ({ api, sender }) => {
  const unknown = randomUUID();
  await expect(await api.getUser(unknown, sender.token)).toHaveApiError(403, 'FORBIDDEN');
  await expect(await api.getTransactions(unknown, sender.token)).toHaveApiError(403, 'FORBIDDEN');
});
