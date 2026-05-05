# Safe Load Test Kit

Run these tests only against local or staging environments that use a dedicated
test database.

## Folder Layout

```text
backend/
  .env.test
  scripts/
    seed-test-users.js
    cleanup-test-data.js
  src/utils/loadTestGuard.js
tests/
  load/
    login-test.js
    socket-test.js
    socket-test.yml
    socket-processor.cjs
    README.md
```

## Pre-Run Checklist

- Confirm the target is local or staging, never production.
- Confirm `NODE_ENV` is `test` or `staging`, never `production`.
- Confirm MongoDB points to the dedicated test database, for example `chat-test`.
- Confirm `LOAD_TEST=true`, `DISABLE_EMAIL=true`, and `MOCK_OTP=123456`.
- Confirm test users are seeded.
- Confirm virtual users are capped before increasing load.
- Backup staging data if it is not disposable.

## Post-Run Checklist

- Review success rate.
- Review average response time.
- Review p95 response time.
- Review error rate.
- Review CPU and RAM on the API host.
- Review MongoDB connection count and slow queries.
- Run cleanup for test users, sessions, messages, and related test data.

## Commands

From `backend/`:

```powershell
npm install
node scripts/seed-test-users.js
node --env-file=.env.test src/server.js
node scripts/cleanup-test-data.js
```

From the repo root:

```powershell
k6 run -e NODE_ENV=test -e LOAD_TEST=true -e BASE_URL=http://127.0.0.1:5001 tests/load/login-test.js
npm install -D artillery socket.io-client
$env:NODE_ENV = "test"; $env:LOAD_TEST = "true"; $env:BASE_URL = "http://127.0.0.1:5001"
npx artillery run tests/load/socket-test.js
# or:
npx artillery run tests/load/socket-test.yml
```
