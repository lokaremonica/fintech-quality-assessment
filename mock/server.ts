import { createApp } from './app';
import { LOCAL_DEMO_SECRET } from './auth';

const port = Number(process.env.MOCK_PORT ?? 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('MOCK_PORT must be an integer from 1024 to 65535.');
const server = createApp(process.env.MOCK_AUTH_SECRET ?? LOCAL_DEMO_SECRET).listen(port, '127.0.0.1', (error?: Error) => {
  if (error) {
    console.error(`Cannot start assessment mock: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Assessment mock listening at http://127.0.0.1:${port}`);
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
