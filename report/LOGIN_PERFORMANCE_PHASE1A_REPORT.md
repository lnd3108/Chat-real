# Login Performance Phase 1A Report

Ngay thuc hien: 2026-06-16

## Tom tat

Da them timing instrumentation an toan cho signin flow va session creation. Thay doi chi them log co dieu kien, khong doi auth response, cookie/Bearer flow, refresh token rotation, Redis session, cache APIs, hay business logic.

Log chi bat khi:

- `LOAD_TEST=true`
- hoac `AUTH_TIMING_DEBUG=true`

Prefix log:

```text
[AuthTiming]
```

## File da sua/tao

- `backend/src/modules/auth/infrastructure/auth-timing.js`
- `backend/src/modules/auth/infrastructure/token.service.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `report/LOGIN_PERFORMANCE_PHASE1A_REPORT.md`

## Log fields

### Signin flow

Phases:

- `signin_missing_user`
- `signin_wrong_password`
- `signin_banned`
- `signin_maintenance_denied`
- `signin_email_unverified`
- `signin_email_unverified_cooldown`
- `signin_email_unverified_error`
- `signin_success`

Fields:

- `phase`
- `userId` only after user is known
- `findUserMs`
- `bcryptMs`
- `maintenanceCheckMs`
- `createSessionTotalMs`
- `totalSigninMs`
- `ok`
- `errorCode` for known non-success status in email verification error path

### Create session

Phase:

- `create_session`

Fields:

- `phase`
- `userId`
- `randomRefreshTokenMs`
- `jwtSignMs`
- `sessionCreateMs`
- `setCookieMs`
- `createSessionTotalMs`
- `ok`
- `errorCode` if `createSession` throws

## Sensitive data policy

Khong log:

- password
- access token
- refresh token
- cookie value
- Authorization header
- raw user payload
- username/email
- password hash

`userId` duoc log dang string chi khi user da duoc xac dinh.

## Smoke validation

### Missing user

Command da chay qua `supertest` voi `LOAD_TEST=true`, `AUTH_TIMING_DEBUG=true`.

Ket qua:

```text
[AuthTiming] {"phase":"signin_missing_user","findUserMs":495.907,"totalSigninMs":495.959,"ok":false}
status 401
```

### Create session breakdown

Command smoke tao session bang ObjectId gia, sau do xoa session vua tao.

Ket qua:

```text
[AuthTiming] {"phase":"create_session","userId":"6a30ae45631c515150928322","ok":true,"jwtSignMs":1.679,"randomRefreshTokenMs":0.021,"sessionCreateMs":427.591,"setCookieMs":0.115,"createSessionTotalMs":429.489}
cookies [{"name":"refreshToken","hasValue":true,"httpOnly":true},{"name":"accessToken","hasValue":true,"httpOnly":true}]
```

Log khong hien token/cookie value.

## Tests

Lenh theo yeu cau:

```bash
npm test
```

Tren Windows/npm hien tai, `npm test -- --runInBand` bi npm/Jest bo qua tham so va spawn worker, gay `EPERM`. Da chay Jest truc tiep de xac minh regression:

```bash
cd backend
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --runInBand
```

Ket qua:

```text
Test Suites: 9 passed, 9 total
Tests: 44 passed, 44 total
```

## Cach bat timing logs

PowerShell:

```powershell
$env:LOAD_TEST="true"
$env:AUTH_TIMING_DEBUG="true"
npm run dev
```

Bash:

```bash
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=true
npm run dev
```

Tat log:

```bash
unset AUTH_TIMING_DEBUG
export LOAD_TEST=false
```

## Manual validation commands

### Start backend with timing enabled

```bash
export UV_THREADPOOL_SIZE=32
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase12
export CACHE_ENABLED=true
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_BYPASS=true
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=true
npm run dev
```

### k6 missing user

```bash
export BASE_URL=http://127.0.0.1:5001
export LOAD_TEST=true
export NODE_ENV=development
export MODE=missing_user
export VUS=50
k6 run tests/load/login-compare-test.js
```

### k6 wrong password

```bash
export MODE=wrong_password
export TEST_USERNAME=vanh
export TEST_PASSWORD=1234567
export VUS=50
k6 run tests/load/login-compare-test.js
```

### k6 valid login

```bash
export MODE=valid
export TEST_USERNAME=vanh
export TEST_PASSWORD=1234567
export VUS=50
k6 run tests/load/login-compare-test.js
```

## Expected use

Doc log theo phase:

- `missing_user`: chu yeu xem `findUserMs`.
- `wrong_password`: xem `findUserMs` + `bcryptMs`.
- `valid`: xem `findUserMs`, `bcryptMs`, `maintenanceCheckMs`, `createSessionTotalMs`.
- `create_session`: xem `sessionCreateMs` co dominate hay khong.

Neu valid login p95 cao va log cho thay `sessionCreateMs` cao, nghi ngo MongoDB session write pressure. Neu `bcryptMs` cao, nghi ngo CPU/libuv worker pool. Neu `maintenanceCheckMs` cao, kiem tra Redis maintenance cache/Mongo fallback.

## Rollback

Rollback code:

- Revert `backend/src/modules/auth/infrastructure/auth-timing.js`.
- Revert imports/usages trong:
  - `backend/src/modules/auth/infrastructure/token.service.js`
  - `backend/src/modules/auth/application/session.command-service.js`

Rollback runtime khong can deploy:

- Set `AUTH_TIMING_DEBUG=false`
- Set `LOAD_TEST=false`

Khi ca hai env khong bang `true`, `[AuthTiming]` khong ghi log.
