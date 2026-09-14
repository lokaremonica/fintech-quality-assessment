import { randomUUID } from 'node:crypto';
import { test, expect } from '../support/fixtures';
import { LedgerPage } from '../support/ledger-page';
import { userFactory } from '../support/factories';
import { issueDemoToken } from '../../mock/auth';
import { environment } from '../../config/environment';
import type { Transaction } from '../support/contracts';

test('creates a transfer in the browser and verifies its persisted contents', async ({ page, api, sender, recipient }) => {
  const ledger = new LedgerPage(page);
  await ledger.open(sender);
  await ledger.transfer(recipient.user.id, '100.50');
  await expect(ledger.transfers.getByRole('status')).toContainText('Transfer recorded: $100.50.');
  await expect(ledger.transfers.getByRole('alert')).toBeHidden();
  const response = await api.getTransactions(sender.user.id, sender.token);
  expect(response.status()).toBe(200);
  const records: Transaction[] = await response.json();
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchTransaction({ userId: sender.user.id, recipientId: recipient.user.id, amount: 100.50, type: 'transfer' });
  await expect(ledger.transfers.getByRole('status')).toContainText(records[0].id);
});

test('registration credentials support a transfer without fixture authentication', async ({ page, api, recipient }) => {
  const ledger = new LedgerPage(page);
  await ledger.open();
  await ledger.register(userFactory());
  await expect(ledger.registration.getByRole('status')).toContainText('Account created successfully');
  const senderId = (await page.locator('#account-id').innerText()).trim();
  await ledger.transfer(recipient.user.id, '12.34');
  await expect(ledger.transfers.getByRole('status')).toContainText('Transfer recorded: $12.34.');
  const response = await api.getTransactions(senderId, issueDemoToken(senderId, environment.authSecret));
  expect(response.status()).toBe(200);
  const records: Transaction[] = await response.json();
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchTransaction({ userId: senderId, recipientId: recipient.user.id, amount: 12.34, type: 'transfer' });
});

for (const amount of ['0', '-10', '1.001']) {
  test(`rejects amount ${amount} in the UI without creating a transaction`, async ({ page, api, sender, recipient }) => {
    const ledger = new LedgerPage(page);
    await ledger.open(sender);
    const posts: string[] = [];
    page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
    await ledger.transfer(recipient.user.id, amount);
    await expect(ledger.transfers.getByRole('alert')).toHaveText('Enter an amount greater than zero with at most two decimal places.');
    await expect(ledger.transfers.getByRole('status')).toBeHidden();
    expect(posts).toEqual([]);
    const response = await api.getTransactions(sender.user.id, sender.token);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);
  });
}

test('shows a missing recipient server error and recovers on correction', async ({ page, api, sender, recipient }) => {
  const ledger = new LedgerPage(page);
  await ledger.open(sender);
  await ledger.transfer(randomUUID(), '5.00');
  await expect(ledger.transfers.getByRole('alert')).toHaveText('Recipient was not found.');
  await expect(ledger.transfers.getByRole('status')).toBeHidden();
  const before = await api.getTransactions(sender.user.id, sender.token);
  expect(before.status()).toBe(200);
  expect(await before.json()).toEqual([]);
  await ledger.transfer(recipient.user.id, '5.00');
  await expect(ledger.transfers.getByRole('status')).toContainText('Transfer recorded: $5.00.');
  await expect(ledger.transfers.getByRole('alert')).toBeHidden();
  const after = await api.getTransactions(sender.user.id, sender.token);
  expect(after.status()).toBe(200);
  const records: Transaction[] = await after.json();
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchTransaction({ userId: sender.user.id, recipientId: recipient.user.id, amount: 5, type: 'transfer' });
});

test('shows an expired-session error without recording a transfer', async ({ page, api, sender, recipient }) => {
  const ledger = new LedgerPage(page);
  await ledger.open({ ...sender, token: issueDemoToken(sender.user.id, environment.authSecret, Date.now() - 1000) });
  await ledger.transfer(recipient.user.id, '5.00');
  await expect(ledger.transfers.getByRole('alert')).toHaveText('Valid authentication is required.');
  await expect(ledger.transfers.getByRole('status')).toBeHidden();
  const response = await api.getTransactions(sender.user.id, sender.token);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual([]);
});
