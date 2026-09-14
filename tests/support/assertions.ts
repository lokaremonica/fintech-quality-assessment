import { expect as baseExpect, type APIResponse } from '@playwright/test';
import type { TransactionInput, UserInput } from './contracts';

export const expect = baseExpect.extend({
  async toHaveApiError(response: APIResponse, status: number, code: string) {
    let actual: unknown;
    try {
      actual = await response.json();
      baseExpect(response.status()).toBe(status);
      baseExpect(response.headers()['content-type']).toContain('application/json');
      baseExpect(actual).toEqual({ error: { code, message: baseExpect.any(String) } });
      baseExpect((actual as { error: { message: string } }).error.message.trim().length).toBeGreaterThan(0);
      return { pass: true, message: () => `Expected response not to have ${status} / ${code}` };
    } catch {
      return { pass: false, message: () => `Expected JSON error ${status} / ${code}; received HTTP ${response.status()}. See sanitized API attachment.` };
    }
  },
  toMatchUser(actual: unknown, expected: UserInput) {
    try {
      baseExpect(actual).toEqual({ id: baseExpect.any(String), ...expected });
      baseExpect((actual as { id: string }).id.length).toBeGreaterThan(0);
      return { pass: true, message: () => 'Expected user not to match the contract.' };
    } catch {
      return { pass: false, message: () => 'User response did not match the expected fields and generated ID. See sanitized API attachment.' };
    }
  },
  toMatchTransaction(actual: unknown, expected: TransactionInput) {
    try {
      baseExpect(actual).toEqual({ id: baseExpect.any(String), ...expected });
      baseExpect((actual as { id: string }).id.length).toBeGreaterThan(0);
      return { pass: true, message: () => 'Expected transaction not to match the contract.' };
    } catch {
      return { pass: false, message: () => 'Transaction response did not match the submitted fields and generated ID. See sanitized API attachment.' };
    }
  },
});
