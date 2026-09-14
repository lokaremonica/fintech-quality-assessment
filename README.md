# Fintech quality automation

TypeScript + Playwright tests for user registration and financial transfers, backed by a self-contained Express mock and frontend.

**Verified: 95 passed in 2.9 seconds · 67 API · 15 browser · 13 framework checks**

## Run

Requires Node.js 22+.

```sh
npm ci
npx playwright install chromium
npm run verify
npm run report
```

`verify` typechecks, builds and starts the mock, runs all 95 tests, and shuts the mock down. No manual server or database setup. On Linux, install Chromium with `npx playwright install --with-deps chromium`.

## What the tests prove

| Risk | Test evidence |
| --- | --- |
| Unauthorized access to financial data | [Ownership tests](tests/api/access-control.spec.ts) reject cross-user reads and sender impersonation |
| Rejected transfers change stored data | [Transaction tests](tests/api/transactions.spec.ts) compare existing records before and after invalid requests |
| Money changes during conversion | A regression preserves `35184372088832.02`; the original rounding implementation changed it by a cent |
| UI success disagrees with the API | [Browser journeys](tests/ui/transactions.spec.ts) verify stored transaction contents; [resilience tests](tests/ui/resilience.spec.ts) check failure recovery |

The API suite covers all supplied routes: `POST /api/users`, `GET /api/users/:id`, `POST /api/transactions`, and `GET /api/transactions/:userId`. It includes input validation, duplicate registration, concurrent writes, authentication, authorization, and request boundaries.

Unique synthetic data, per-test actors, fresh browser contexts, and discarded mock storage keep tests independent. Fixtures, factories, a page helper, and custom assertions keep setup reusable and expectations readable. Tests run in parallel with no retries or fixed sleeps.

## Find your way around

```text
playwright.config.ts   Test projects, reporting, and managed server
config/                Local, CI, and external-demo settings
mock/                  Express API, demo authentication, and frontend
tests/api/             Endpoint, validation, and access-control tests
tests/ui/              Registration, transfers, and failure recovery
tests/support/         Fixtures, factories, API client, assertions, logs
```

Start with the ownership tests, then follow a transfer from the browser to API retrieval. [Design decisions](docs/decisions.md) explains the contract and environment settings. [Verification](docs/verification.md) records the completed full-suite run and diagnostic evidence.

## Reports and debugging

Each run produces **HTML, JSON, JUnit, and console results**, plus sanitized API response attachments. Failed UI tests capture screenshots automatically. GitHub Actions runs the same verification command and uploads reports even on failure.

| Command | Use |
| --- | --- |
| `npm run test:api` | API suite through real HTTP |
| `npm run test:ui` | Browser suite |
| `npm run test:ui:trace` | Visible browser, one test at a time, traces for every result |
| `npm run test:ui:debug` | Step through browser actions in Playwright Inspector |
| `npm run test:diagnostics` | Verify screenshots and API logging using one deliberate UI failure |

Normal reports: `npm run report`. Failure-demo report: `npx playwright show-report diagnostic-report`. The intentional failure is excluded from the normal suite. Trace recording is opt-in because raw traces include demo credentials and bodies; API attachments are redacted.

## Scope

The mock represents the four supplied endpoints in one process. Create/read are covered; update/delete contracts were not supplied. Demo bearer tokens and in-memory storage stand in for unspecified infrastructure. Transactions record intent; balances, MongoDB, Redis, notifications, and distributed-service behavior are outside this submission.
