import { test, expect } from '../support/fixtures';
import { userFactory } from '../support/factories';
import { LedgerPage } from '../support/ledger-page';
import { issueDemoToken } from '../../mock/auth';
import { environment } from '../../config/environment';

test('registers through the browser and persists the new profile', async ({ page, api }) => {
  const ledger = new LedgerPage(page);
  const input = userFactory({ accountType: 'standard' });
  await ledger.open();
  await expect(page.getByRole('button', { name: 'Send transfer' })).toBeDisabled();
  await ledger.register(input);
  await expect(ledger.registration.getByRole('status')).toContainText('Account created successfully');
  await expect(page.getByRole('button', { name: 'Send transfer' })).toBeEnabled();
  const id = (await page.locator('#account-id').innerText()).trim();
  expect(id).not.toBe('');
  const response = await api.getUser(id, issueDemoToken(id, environment.authSecret));
  expect(response.status()).toBe(200);
  expect<unknown>(await response.json()).toMatchUser(input);
});

test('shows a server-side duplicate email error without a success state', async ({ page, sender }) => {
  const ledger = new LedgerPage(page);
  await ledger.open();
  await ledger.register(userFactory({ email: sender.user.email }));
  await expect(ledger.registration.getByRole('alert')).toHaveText('An account with this email already exists.');
  await expect(ledger.registration.getByRole('status')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Send transfer' })).toBeDisabled();
});

for (const [title, input, message] of [
  ['missing name', { name: '' }, 'Enter your full name.'],
  ['invalid email', { email: 'not-an-email' }, 'Enter a valid email address.'],
] as const) {
  test(`shows ${title} validation before sending a request`, async ({ page }) => {
    const ledger = new LedgerPage(page);
    await ledger.open();
    const posts: string[] = [];
    page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
    await ledger.register(userFactory(input));
    await expect(ledger.registration.getByRole('alert')).toHaveText(message);
    await expect(ledger.registration.getByRole('status')).toBeHidden();
    expect(posts).toEqual([]);
  });
}
