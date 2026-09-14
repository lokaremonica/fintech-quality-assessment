import type { TestInfo } from '@playwright/test';

const sensitiveKey = /^(authorization|proxy-authorization|cookie|set-cookie|.*token.*|.*secret.*|.*password.*|email|name|firstName|lastName|phone|address|id|userId|recipientId|sub)$/i;

export function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitiveKey.test(key) ? '[REDACTED]' : sanitize(item)]));
  }
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[^\s"<>]+/gi, 'Bearer [REDACTED]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED]')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[REDACTED]');
  }
  return value;
}

export function sanitizedURL(rawURL: string): string {
  const url = new URL(rawURL);
  // Route templates preserve diagnostics without logging IDs or query parameters.
  const route = url.pathname.replace(/^(\/api\/(?:users|transactions))\/[^/]+/, '$1/[REDACTED]');
  return url.origin + route;
}

export async function attachExchange(testInfo: TestInfo, method: string, url: string, status: number, rawBody: string) {
  let body: unknown;
  try { body = sanitize(JSON.parse(rawBody)); }
  catch { body = '[Non-JSON response omitted]'; }
  await testInfo.attach(`api-${method.toLowerCase()}-${status}`, {
    body: Buffer.from(JSON.stringify({ method, url: sanitizedURL(url), status, body }, null, 2)),
    contentType: 'application/json',
  });
}
