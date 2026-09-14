import { test, expect } from '../support/fixtures';
import { userFactory } from '../support/factories';
import { issueDemoToken } from '../../mock/auth';
import { environment } from '../../config/environment';
import type { User } from '../support/contracts';

test('registers and retrieves a normalized user profile', async ({ api }) => {
  const input = userFactory({ name: '  Alex Example  ' });
  input.email = `  ${input.email.toUpperCase()}  `;
  const response = await api.createUser(input);
  expect(response.status()).toBe(201);
  expect(response.headers()['content-type']).toContain('application/json');
  const created: User = await response.json();
  expect(created).toMatchUser({ ...input, name: 'Alex Example', email: input.email.trim().toLowerCase() });
  const retrieved = await api.getUser(created.id, issueDemoToken(created.id, environment.authSecret));
  expect(retrieved.status()).toBe(200);
  expect(await retrieved.json()).toEqual(created);
});

test('accepts a standard account', async ({ api }) => {
  const input = userFactory({ accountType: 'standard' });
  const response = await api.createUser(input);
  expect(response.status()).toBe(201);
  expect<unknown>(await response.json()).toMatchUser(input);
});

for (const [title, patch] of [
  ['missing name', { name: undefined }],
  ['blank name', { name: '   ' }],
  ['non-string name', { name: 123 }],
  ['missing email', { email: undefined }],
  ['malformed email', { email: 'invalid-email' }],
  ['non-string email', { email: 123 }],
  ['missing account type', { accountType: undefined }],
  ['unsupported account type', { accountType: 'administrator' }],
] as const) {
  test(`rejects ${title} without reserving the email`, async ({ api }) => {
    const valid = userFactory();
    await expect(await api.createUser({ ...valid, ...patch })).toHaveApiError(400, 'VALIDATION_ERROR');
    const corrected = await api.createUser(valid);
    expect(corrected.status()).toBe(201);
    expect<unknown>(await corrected.json()).toMatchUser(valid);
  });
}

test('rejects a duplicate normalized email without changing the original user', async ({ api, sender }) => {
  const duplicate = userFactory({ name: 'Different Person', email: ` ${sender.user.email.toUpperCase()} ` });
  await expect(await api.createUser(duplicate)).toHaveApiError(409, 'CONFLICT');
  const original = await api.getUser(sender.user.id, sender.token);
  expect(original.status()).toBe(200);
  expect(await original.json()).toEqual(sender.user);
});

test('concurrent registration of the same email creates exactly one user', async ({ api }) => {
  const input = userFactory();
  const responses = await Promise.all([api.createUser(input), api.createUser(input)]);
  expect(responses.map(r => r.status()).sort()).toEqual([201, 409]);
  const winner = responses.find(r => r.status() === 201)!;
  expect<unknown>(await winner.json()).toMatchUser(input);
  await expect(responses.find(r => r.status() === 409)!).toHaveApiError(409, 'CONFLICT');
});

test('returns a structured error for malformed JSON', async ({ api }) => {
  const response = await api.send('POST', '/api/users', {
    data: '{"name":', headers: { 'content-type': 'application/json' },
  });
  await expect(response).toHaveApiError(400, 'VALIDATION_ERROR');
});

test('returns a structured error for an unknown route', async ({ api }) => {
  await expect(await api.send('GET', '/api/unknown')).toHaveApiError(404, 'NOT_FOUND');
});
