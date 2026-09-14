import { test, expect } from '@playwright/test';
import { sanitize, sanitizedURL } from '../support/logging';

test('redacts nested identity fields, credentials, and arrays without mutating the response', () => {
  const source = {
    id: '123', name: 'Alex Example', email: 'alex@example.com', amount: 100.5,
    nested: [{ recipientId: '456', authorization: 'Bearer secret-value', 'x-demo-token': 'secret-value', message: 'Contact alex@example.com' }],
  };
  expect(sanitize(source)).toEqual({
    id: '[REDACTED]', name: '[REDACTED]', email: '[REDACTED]', amount: 100.5,
    nested: [{ recipientId: '[REDACTED]', authorization: '[REDACTED]', 'x-demo-token': '[REDACTED]', message: 'Contact [REDACTED]' }],
  });
  expect(source.email).toBe('alex@example.com');
});

test('removes credentials, query strings, fragments, and route IDs from logged URLs', () => {
  expect(sanitizedURL('https://user:password@example.com/api/users/private-id?token=secret#fragment'))
    .toBe('https://example.com/api/users/[REDACTED]');
  expect(sanitizedURL('https://example.com/api/transactions/456')).toBe('https://example.com/api/transactions/[REDACTED]');
});

test('redacts bearer tokens and UUIDs embedded in free text', () => {
  expect(sanitize('Bearer secret-value belongs to 00000000-0000-0000-0000-000000000000'))
    .toBe('Bearer [REDACTED] belongs to [REDACTED]');
});
