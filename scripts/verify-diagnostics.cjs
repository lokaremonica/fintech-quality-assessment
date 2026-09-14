const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const resultsFile = path.resolve('diagnostic-results/results.json');
// Remove stale evidence so a startup failure cannot be mistaken for a valid probe.
fs.rmSync(resultsFile, { force: true });
const run = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config=playwright.diagnostics.config.ts'], { stdio: 'inherit' });
try {
  assert.equal(run.status, 1, 'The intentional diagnostic must exit with a test failure.');
  const report = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  assert.equal(report.errors.length, 0, 'The runner must not have startup errors.');
  const tests = [];
  function collect(suite) {
    for (const spec of suite.specs ?? []) tests.push(...spec.tests);
    for (const child of suite.suites ?? []) collect(child);
  }
  report.suites.forEach(collect);
  assert.equal(tests.length, 1, 'Exactly one diagnostic test must run.');
  const result = tests[0].results[0];
  assert.equal(result.status, 'failed');
  assert.ok(result.errors.some(error => error.message?.includes('DIAGNOSTIC_SENTINEL')), 'The test must reach the intentional failure.');
  const screenshot = result.attachments.find(item => item.contentType === 'image/png');
  assert.ok(screenshot?.path && fs.statSync(screenshot.path).size > 0, 'A failure screenshot must exist.');
  const log = result.attachments.find(item => item.name === 'api-post-201');
  assert.ok(log, 'A browser API response must be attached.');
  const text = log.body ? Buffer.from(log.body, 'base64').toString() : fs.readFileSync(log.path, 'utf8');
  const exchange = JSON.parse(text);
  assert.equal(exchange.body.email, '[REDACTED]');
  assert.equal(exchange.body.id, '[REDACTED]');
  assert.equal(exchange.body.name, '[REDACTED]');
  assert.ok(!text.includes('@example.com'), 'Synthetic email values must still be redacted.');
  console.log('Diagnostic verified: intentional failure, nonempty screenshot, and sanitized browser API attachment.');
} catch (error) {
  console.error('Diagnostic verification failed:', error.message);
  process.exitCode = 1;
}
