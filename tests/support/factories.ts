import { randomUUID } from 'node:crypto';
import type { TransactionInput, UserInput } from './contracts';

export function userFactory(overrides: Partial<UserInput> = {}): UserInput {
  return { name: 'Alex Example', email: `qa-${randomUUID()}@example.com`, accountType: 'premium', ...overrides };
}

export function transactionFactory(userId: string, recipientId: string, overrides: Partial<TransactionInput> = {}): TransactionInput {
  return { userId, recipientId, amount: 100.50, type: 'transfer', ...overrides };
}
