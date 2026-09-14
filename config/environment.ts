import { LOCAL_DEMO_SECRET } from '../mock/auth';

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env) {
  const name = source.TEST_ENV ?? (source.CI ? 'ci' : 'local');
  if (!['local', 'ci', 'external'].includes(name)) throw new Error('TEST_ENV must be local, ci, or external.');
  const startValue = source.START_MOCK ?? (name === 'external' ? 'false' : 'true');
  if (!['true', 'false'].includes(startValue)) throw new Error('START_MOCK must be true or false.');
  const startMock = startValue === 'true';
  if (name === 'external' && startMock) throw new Error('External environments must use START_MOCK=false.');
  const port = Number(source.MOCK_PORT ?? (name === 'ci' ? 3101 : 3100));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('MOCK_PORT must be an integer from 1024 to 65535.');
  const origin = `http://127.0.0.1:${port}`;
  function baseURL(value: string | undefined, variable: string) {
    if (!value && !startMock) throw new Error(`${variable} is required when START_MOCK=false.`);
    const url = new URL(value ?? origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error(`${variable} must be an HTTP(S) origin without credentials, path, query, or fragment.`);
    }
    if (startMock && url.origin !== origin) throw new Error(`${variable} must match the managed mock origin ${origin}.`);
    return url.origin;
  }
  if (!startMock && !source.MOCK_AUTH_SECRET) throw new Error('MOCK_AUTH_SECRET is required for the external demo credential adapter.');
  return {
    name, port, startMock,
    apiBaseURL: baseURL(source.API_BASE_URL, 'API_BASE_URL'),
    uiBaseURL: baseURL(source.UI_BASE_URL, 'UI_BASE_URL'),
    authSecret: source.MOCK_AUTH_SECRET ?? LOCAL_DEMO_SECRET,
  };
}

export const environment = loadEnvironment();
