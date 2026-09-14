import type { APIRequestContext, APIResponse, TestInfo } from '@playwright/test';
import { attachExchange } from './logging';

type SendOptions = { data?: unknown; token?: string; headers?: Record<string, string> };

export class ApiClient {
  constructor(private readonly request: APIRequestContext, private readonly testInfo: TestInfo) {}

  async send(method: 'GET' | 'POST', path: string, options: SendOptions = {}): Promise<APIResponse> {
    const response = await this.request.fetch(path, {
      method,
      ...(options.data === undefined ? {} : { data: options.data }),
      headers: { ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...options.headers },
      failOnStatusCode: false,
    });
    await attachExchange(this.testInfo, method, response.url(), response.status(), await response.text());
    return response;
  }

  createUser(data: unknown) { return this.send('POST', '/api/users', { data }); }
  getUser(id: string, token?: string) { return this.send('GET', `/api/users/${encodeURIComponent(id)}`, { token }); }
  createTransaction(data: unknown, token?: string) { return this.send('POST', '/api/transactions', { data, token }); }
  getTransactions(userId: string, token?: string) { return this.send('GET', `/api/transactions/${encodeURIComponent(userId)}`, { token }); }
}
