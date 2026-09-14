import { test, expect } from '../support/fixtures';
import { LedgerPage } from '../support/ledger-page';
import { userFactory } from '../support/factories';
import type { Transaction } from '../support/contracts';

test('registration recovers from a connection failure using the same email', async ({ page }) => {
  const ledger = new LedgerPage(page);
  const input = userFactory();
  await ledger.open();
  await page.route('**/api/users', route => route.abort('failed'));
  await ledger.register(input);
  await expect(ledger.registration.getByRole('alert')).toHaveText('Unable to connect. Please try again.');
  await expect(ledger.registration.getByRole('status')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Send transfer' })).toBeDisabled();

  await page.unroute('**/api/users');
  await ledger.register(input);
  await expect(ledger.registration.getByRole('status')).toContainText('Account created successfully');
  await expect(ledger.registration.getByRole('alert')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Send transfer' })).toBeEnabled();
});

for (const failure of ['connection failure', 'service unavailable'] as const) {
  test(`transfer recovers from ${failure} without a false success`, async ({ page, api, sender, recipient }) => {
    const ledger = new LedgerPage(page);
    await ledger.open(sender);
    // Fault injection stops this request before it reaches the real API.
    // A lost response AFTER a committed write requires server idempotency, outside this demo.
    await page.route('**/api/transactions', route => failure === 'connection failure'
      ? route.abort('failed')
      : route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Service temporarily unavailable.' } }) }));
    await ledger.transfer(recipient.user.id, '12.34');
    await expect(ledger.transfers.getByRole('alert')).toHaveText(failure === 'connection failure'
      ? 'Unable to connect. Please try again.' : 'Service temporarily unavailable.');
    await expect(ledger.transfers.getByRole('status')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Send transfer' })).toBeEnabled();
    await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('12.34');
    const before = await api.getTransactions(sender.user.id, sender.token);
    expect(before.status()).toBe(200);
    expect(await before.json()).toEqual([]);

    await page.unroute('**/api/transactions');
    await ledger.transfer(recipient.user.id, '12.34');
    await expect(ledger.transfers.getByRole('status')).toContainText('Transfer recorded: $12.34.');
    await expect(ledger.transfers.getByRole('alert')).toBeHidden();
    const after = await api.getTransactions(sender.user.id, sender.token);
    expect(after.status()).toBe(200);
    const records: Transaction[] = await after.json();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchTransaction({ userId: sender.user.id, recipientId: recipient.user.id, amount: 12.34, type: 'transfer' });
  });
}

test('an in-flight transfer disables resubmission and persists exactly once', async ({ page, api, sender, recipient }) => {
  const ledger = new LedgerPage(page);
  await ledger.open(sender);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/api/transactions', async route => {
    requests++;
    await gate;
    await route.continue();
  });
  try {
    await ledger.transfer(recipient.user.id, '5.00');
    await expect(page.getByRole('button', { name: 'Send transfer' })).toBeDisabled();
    await page.getByLabel('Amount', { exact: true }).press('Enter');
  } finally {
    release();
  }
  await expect(ledger.transfers.getByRole('status')).toContainText('Transfer recorded: $5.00.');
  await expect(page.getByRole('button', { name: 'Send transfer' })).toBeEnabled();
  const after = await api.getTransactions(sender.user.id, sender.token);
  expect(after.status()).toBe(200);
  const records: Transaction[] = await after.json();
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchTransaction({ userId: sender.user.id, recipientId: recipient.user.id, amount: 5, type: 'transfer' });
  expect(requests).toBe(1);
});
