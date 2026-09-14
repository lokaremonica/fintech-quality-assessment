# Design decisions

## Contract assumptions

The assessment supplied four endpoints and example payloads, but no running service, authentication flow, or response schemas. These are the mock's explicit assumptions:

| Endpoint | Success | Access |
| --- | --- | --- |
| `POST /api/users` | `201`; user fields plus generated `id` | Public registration |
| `GET /api/users/:id` | `200`; stored user | Own profile only |
| `POST /api/transactions` | `201`; transaction fields plus generated `id` | Authenticated sender owns `userId` |
| `GET /api/transactions/:userId` | `200`; array, empty for a new sender | Own initiated transfers only |

- Names are trimmed; emails are normalized and unique. Account types are `standard` or `premium`.
- Transfers require an existing, different recipient, `type: "transfer"`, and a positive numeric amount with at most two decimal places. Unknown input fields cannot override generated IDs or internal fields.
- Amounts represent USD. Decimal digits are converted to integer cents using `BigInt`, checked against the safe integer limit, and stored as numbers. JSON numbers cannot recover precision already lost by a client. A regression covers the large-amount rounding defect discovered during review.
- HMAC-signed demo tokens expire after one hour. Registration supplies the UI's token in `x-demo-token`; fixtures use a test-only signer. Replace this adapter for a real identity provider.
- Errors follow `{ error: { code, message } }`: validation `400`, unauthenticated `401`, forbidden `403`, missing route/recipient `404`, duplicate email `409`, oversized payload `413`, unexpected failure `500`.
- Foreign profile/list IDs return `403` whether or not the account exists. JSON parsing precedes authentication; malformed JSON returns `400`.

## Isolation and architecture

Tests use Playwright's HTTP client against the running Express application. Browser tests submit real forms and check persistence through the API. Only resilience cases intercept requests to inject connection/service errors; recovery uses the real API.

Factories generate UUID-based emails; fixtures provision independent senders and recipients and dispose request contexts. Playwright supplies a fresh browser context per test. Managed-server shutdown discards all mock data. Tests do not depend on execution order or a public reset endpoint.

The API client handles requests and sanitized logging. Custom assertions check response fields and error shapes. Tests keep scenario-specific assertions visible, particularly ownership checks and absence of writes after rejection.

## Environments

Configuration reads exported process variables; `.env.example` is a reference and is not loaded automatically.

| Variable | Behavior |
| --- | --- |
| `TEST_ENV` | `local` by default; `ci` when `CI` is set; `external` for a compatible running demo |
| `MOCK_PORT` | 3100 locally; 3101 in CI |
| `START_MOCK` | `true` locally/in CI; must be `false` for external |
| `API_BASE_URL`, `UI_BASE_URL` | Managed origin by default; both required when mock startup is disabled |
| `MOCK_AUTH_SECRET` | Public local demo default; explicitly required for external |

Conflicting URLs, invalid ports, and unknown environments fail early. To use a different local port:

```sh
MOCK_PORT=3200 npm run verify
```

To run a separate copy of this demo, start it in one terminal:

```sh
MOCK_PORT=3200 MOCK_AUTH_SECRET=example-demo-secret npm start
```

Then run tests in another:

```sh
TEST_ENV=external \
API_BASE_URL=http://127.0.0.1:3200 \
UI_BASE_URL=http://127.0.0.1:3200 \
MOCK_AUTH_SECRET=example-demo-secret npm test
```

Real staging needs compatible schemas, its own credential adapter, and agreed data provisioning/cleanup. Local configuration alone does not establish compatibility with another system.

## Two-hour scope

One framework, one browser, and an ephemeral mock make the submission runnable without building unspecified services. Create/read cover the supplied routes; update/delete remain an explicit contract gap. The overview mentions performance, but no workload or performance target was supplied.

For real services, prioritize gateway/service contracts, database persistence, balance conservation, atomic transfers, idempotency, and notification delivery. Disabling a UI button prevents ordinary resubmission while pending; it does not establish safe retries after a committed transfer loses its response.

## Diagnostics

API attachments log method, sanitized URL, status, and sanitized JSON. Tokens and identity fields are redacted; non-JSON bodies are omitted. Screenshots and opt-in traces can contain synthetic data, and traces include raw credentials. The deliberate failure demo uses a separate configuration/report and verifies its sentinel failure, screenshot, and redacted browser response attachment.
