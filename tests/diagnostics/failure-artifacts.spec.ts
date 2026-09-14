import { test, expect } from '../support/fixtures';
import { LedgerPage } from '../support/ledger-page';
import { userFactory } from '../support/factories';

// Excluded from the assessment suites. The wrapper verifies this intentional failure.
test('intentional failure produces a screenshot and sanitized API log', async ({ page }) => {
  const ledger = new LedgerPage(page);
  await ledger.open();
  await ledger.register(userFactory());
  await expect(ledger.registration.getByRole('status')).toContainText('Account created successfully');
  expect(false, 'DIAGNOSTIC_SENTINEL: intentional failure after successful registration').toBe(true);
});
