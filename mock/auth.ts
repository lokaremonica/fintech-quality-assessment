import { createHmac, timingSafeEqual } from 'node:crypto';

// Deliberately test-only. A real identity provider must replace this adapter.
export const LOCAL_DEMO_SECRET = 'assessment-local-only-secret-do-not-deploy';

export function issueDemoToken(userId: string, secret: string, expiresAt = Date.now() + 3_600_000): string {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: expiresAt })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyDemoToken(token: string, secret: string): string | undefined {
  const parts = token.split('.');
  if (parts.length !== 2) return;
  const [payload, signature] = parts;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const received = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (received.length !== wanted.length || !timingSafeEqual(received, wanted)) return;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof claims.sub === 'string' && typeof claims.exp === 'number' && claims.exp > Date.now()) {
      return claims.sub;
    }
  } catch { /* Malformed credentials are unauthenticated. */ }
}
