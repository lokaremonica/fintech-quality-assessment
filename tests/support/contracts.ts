// Test expectations are independent of the mock's storage and validation implementation.
export type UserInput = { name: string; email: string; accountType: 'standard' | 'premium' };
export type User = UserInput & { id: string };
export type TransactionInput = { userId: string; amount: number; type: 'transfer'; recipientId: string };
export type Transaction = TransactionInput & { id: string };
export type Actor = { user: User; token: string };
