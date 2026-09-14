import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { issueDemoToken, verifyDemoToken } from './auth';

type User = { id: string; name: string; email: string; accountType: 'standard' | 'premium' };
type StoredTransaction = { id: string; userId: string; amountMinor: number; type: 'transfer'; recipientId: string };
const codes: Record<number, string> = {
  400: 'VALIDATION_ERROR', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN',
  404: 'NOT_FOUND', 409: 'CONFLICT', 413: 'PAYLOAD_TOO_LARGE', 500: 'INTERNAL_ERROR',
};

export function createApp(secret: string) {
  const app = express();
  const users = new Map<string, User>();
  const emails = new Set<string>();
  const transactions: StoredTransaction[] = [];
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  const fail = (res: express.Response, status: number, message: string) =>
    res.status(status).json({ error: { code: codes[status], message } });

  const authenticate: RequestHandler = (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const match = /^Bearer ([^\s]+)$/i.exec(header);
    const userId = match && verifyDemoToken(match[1], secret);
    if (!userId || !users.has(userId)) {
      fail(res, 401, 'Valid authentication is required.');
      return;
    }
    res.locals.userId = userId;
    next();
  };

  app.get('/health', (_req, res) => res.json({ status: 'ok', application: 'assessment-mock' }));

  app.post('/api/users', (req, res) => {
    const { name, email, accountType } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      return fail(res, 400, 'Name is required.');
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return fail(res, 400, 'A valid email address is required.');
    }
    if (accountType !== 'standard' && accountType !== 'premium') {
      return fail(res, 400, 'Account type must be standard or premium.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (emails.has(normalizedEmail)) return fail(res, 409, 'An account with this email already exists.');
    const user: User = { id: randomUUID(), name: name.trim(), email: normalizedEmail, accountType };
    users.set(user.id, user);
    emails.add(user.email);
    // Lets the demo registration UI continue as the newly created user.
    res.set('x-demo-token', issueDemoToken(user.id, secret));
    return res.status(201).json(user);
  });

  app.get('/api/users/:id', authenticate, (req, res) => {
    if (req.params.id !== res.locals.userId) return fail(res, 403, 'You may only access your own profile.');
    return res.json(users.get(res.locals.userId));
  });

  app.post('/api/transactions', authenticate, (req, res) => {
    const { userId, amount, type, recipientId } = req.body ?? {};
    if (typeof userId !== 'string' || !userId.trim() || typeof recipientId !== 'string' || !recipientId.trim()) {
      return fail(res, 400, 'Sender and recipient IDs are required.');
    }
    if (userId !== res.locals.userId) return fail(res, 403, 'You may only create your own transactions.');
    // Convert decimal digits directly: amount * 100 can round valid large amounts by a cent.
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 ||
        !/^\d+(\.\d{1,2})?$/.test(String(amount))) {
      return fail(res, 400, 'Amount must be a positive number with at most two decimal places.');
    }
    const [whole, fraction = ''] = String(amount).split('.');
    const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
      return fail(res, 400, 'Amount must be a positive number with at most two decimal places.');
    }
    if (type !== 'transfer') return fail(res, 400, 'Transaction type must be transfer.');
    if (recipientId === userId) return fail(res, 400, 'Sender and recipient must be different users.');
    if (!users.has(recipientId)) return fail(res, 404, 'Recipient was not found.');
    const record: StoredTransaction = { id: randomUUID(), userId, recipientId, type, amountMinor: Number(minor) };
    transactions.push(record);
    return res.status(201).json(present(record));
  });

  app.get('/api/transactions/:userId', authenticate, (req, res) => {
    if (req.params.userId !== res.locals.userId) return fail(res, 403, 'You may only access your own transactions.');
    return res.json(transactions.filter(t => t.userId === req.params.userId).map(present));
  });

  app.use(express.static(path.resolve('mock/public')));
  app.use((_req, res) => fail(res, 404, 'Route was not found.'));
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') { fail(res, 400, 'Request body must contain valid JSON.'); return; }
    if (error.type === 'entity.too.large') { fail(res, 413, 'Request body is too large.'); return; }
    fail(res, 500, 'An unexpected error occurred.');
  };
  app.use(errorHandler);
  return app;
}

function present({ amountMinor, ...record }: StoredTransaction) {
  return { ...record, amount: amountMinor / 100 };
}
