import { randomUUID } from 'node:crypto';
import { test, expect } from '../support/fixtures';
import { transactionFactory } from '../support/factories';
import type { Transaction } from '../support/contracts';

test('a new sender has no transactions', async ({ api, sender }) => {
  const response = await api.getTransactions(sender.user.id, sender.token);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual([]);
});

for (const amount of [100.50, 0.01, 0.29, 10, 35184372088832.02, 90071992547409.9]) {
  test(`creates and persists a transfer of ${amount}`, async ({ api, sender, recipient }) => {
    const input = transactionFactory(sender.user.id, recipient.user.id, { amount });
    const response = await api.createTransaction(input, sender.token);
    expect(response.status()).toBe(201);
    const created: Transaction = await response.json();
    expect(created).toMatchTransaction(input);
    const list = await api.getTransactions(sender.user.id, sender.token);
    expect(list.status()).toBe(200);
    expect(await list.json()).toEqual([created]);
  });
}

for (const [title, patch] of [
  ['zero amount', { amount: 0 }],
  ['negative amount', { amount: -1 }],
  ['numeric string', { amount: '100.50' }],
  ['excess precision', { amount: 1.001 }],
  ['unsafe amount', { amount: Number.MAX_SAFE_INTEGER }],
  ['amount above the safe minor-unit boundary', { amount: 90071992547409.92 }],
  ['null amount', { amount: null }],
  ['missing amount', { amount: undefined }],
  ['missing sender', { userId: undefined }],
  ['non-string sender', { userId: 123 }],
  ['missing recipient', { recipientId: undefined }],
  ['blank recipient', { recipientId: ' ' }],
  ['missing transaction type', { type: undefined }],
  ['unsupported transaction type', { type: 'withdrawal' }],
] as const) {
  test(`rejects ${title} without altering existing transactions`, async ({ api, sender, recipient }) => {
    const input = transactionFactory(sender.user.id, recipient.user.id);
    const seed = await api.createTransaction(input, sender.token);
    expect(seed.status()).toBe(201);
    const previous = await seed.json();
    await expect(await api.createTransaction({ ...input, ...patch }, sender.token)).toHaveApiError(400, 'VALIDATION_ERROR');
    const after = await api.getTransactions(sender.user.id, sender.token);
    expect(after.status()).toBe(200);
    expect(await after.json()).toEqual([previous]);
  });
}

test('rejects a self-transfer without creating a record', async ({ api, sender }) => {
  await expect(await api.createTransaction(transactionFactory(sender.user.id, sender.user.id), sender.token))
    .toHaveApiError(400, 'VALIDATION_ERROR');
  const list = await api.getTransactions(sender.user.id, sender.token);
  expect(list.status()).toBe(200);
  expect(await list.json()).toEqual([]);
});

test('rejects a nonexistent recipient without creating a record', async ({ api, sender }) => {
  await expect(await api.createTransaction(transactionFactory(sender.user.id, randomUUID()), sender.token))
    .toHaveApiError(404, 'NOT_FOUND');
  const list = await api.getTransactions(sender.user.id, sender.token);
  expect(list.status()).toBe(200);
  expect(await list.json()).toEqual([]);
});

test('transaction lists isolate each sender, including concurrent writes', async ({ api, sender, recipient }) => {
  const inputs = [
    transactionFactory(sender.user.id, recipient.user.id, { amount: 12.34 }),
    transactionFactory(sender.user.id, recipient.user.id, { amount: 56.78 }),
    transactionFactory(recipient.user.id, sender.user.id, { amount: 9.01 }),
  ];
  const responses = await Promise.all(inputs.map((input, i) => api.createTransaction(input, i === 2 ? recipient.token : sender.token)));
  const records: Transaction[] = [];
  for (let i = 0; i < responses.length; i++) {
    expect(responses[i].status()).toBe(201);
    const record: Transaction = await responses[i].json();
    expect(record).toMatchTransaction(inputs[i]);
    records.push(record);
  }
  expect(new Set(records.map(r => r.id)).size).toBe(3);
  const senderList = await api.getTransactions(sender.user.id, sender.token);
  expect(senderList.status()).toBe(200);
  expect(await senderList.json()).toHaveLength(2);
  expect(await senderList.json()).toEqual(expect.arrayContaining(records.slice(0, 2)));
  const recipientList = await api.getTransactions(recipient.user.id, recipient.token);
  expect(recipientList.status()).toBe(200);
  expect(await recipientList.json()).toEqual([records[2]]);
});
