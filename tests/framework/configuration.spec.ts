import { test, expect } from '@playwright/test';
import { loadEnvironment } from '../../config/environment';

test('local and CI use distinct managed mock origins', () => {
  expect(loadEnvironment({}).apiBaseURL).toBe('http://127.0.0.1:3100');
  expect(loadEnvironment({ TEST_ENV: 'ci' }).apiBaseURL).toBe('http://127.0.0.1:3101');
  expect(loadEnvironment({ CI: '1' }).name).toBe('ci');
});

test('external configuration requires URLs and a credential adapter secret', () => {
  expect(() => loadEnvironment({ TEST_ENV: 'external' })).toThrow('MOCK_AUTH_SECRET');
  expect(() => loadEnvironment({ TEST_ENV: 'external', MOCK_AUTH_SECRET: 'demo' })).toThrow('API_BASE_URL');
  expect(() => loadEnvironment({ TEST_ENV: 'external', MOCK_AUTH_SECRET: 'demo', API_BASE_URL: 'https://api.example.com' })).toThrow('UI_BASE_URL');
  const result = loadEnvironment({ TEST_ENV: 'external', API_BASE_URL: 'https://api.example.com', UI_BASE_URL: 'https://ui.example.com', MOCK_AUTH_SECRET: 'demo' });
  expect(result.startMock).toBe(false);
  expect(result.apiBaseURL).toBe('https://api.example.com');
});

for (const input of [
  { TEST_ENV: 'typo' },
  { MOCK_PORT: 'NaN' },
  { MOCK_PORT: '80' },
  { START_MOCK: 'maybe' },
  { API_BASE_URL: 'https://unexpected.example.com' },
  { TEST_ENV: 'external', START_MOCK: 'true' },
  { API_BASE_URL: 'http://user:pass@127.0.0.1:3100' },
  { UI_BASE_URL: 'http://127.0.0.1:3100/?token=secret' },
]) {
  test(`rejects invalid configuration ${JSON.stringify(input)}`, () => {
    expect(() => loadEnvironment(input)).toThrow();
  });
}
