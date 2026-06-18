# Login Performance Phase 1B Report

Date: 2026-06-16

## Goal

Move the valid-login refresh session hot path from MongoDB `Session.create` to Redis when explicitly enabled, while preserving the existing MongoDB session behavior as the fallback path.

## Scope

Implemented:

- Added Redis-backed refresh session read/write/delete helpers.
- Added feature flag `AUTH_REDIS_SESSION_ENABLED=true`.
- Changed `createSession` to write refresh session metadata to Redis when Redis is enabled and ready.
- Preserved MongoDB `Session.create` fallback when Redis is disabled, not ready, or write fails.
- Changed refresh-token lookup to check Redis first when enabled, then fallback to MongoDB.
- Changed logout/session cleanup to delete Redis refresh session by hashed token key and keep existing MongoDB cleanup.
- Extended auth timing logs with `sessionStoreMode`, `redisSessionWriteMs`, and `mongoSessionCreateMs`.

Not implemented:

- No auth response format change.
- No cookie name change.
- No Bearer access token removal.
- No refresh token rotation.
- No Redis conversation/message/friend/dashboard cache.
- No Redis Socket.IO adapter or presence.
- No BullMQ/Kafka.

## Files Changed

- `backend/src/modules/auth/infrastructure/refresh-session-redis.service.js`
- `backend/src/modules/auth/infrastructure/token.service.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `report/LOGIN_PERFORMANCE_PHASE1B_REPORT.md`

## Design

### Feature Flag

Redis refresh sessions are only used when all of these are true:

- `AUTH_REDIS_SESSION_ENABLED=true`
- `REDIS_ENABLED=true`
- Redis client status is `ready`

Default behavior remains MongoDB session storage when the new flag is absent or false.

### Redis Key

Key format:

```text
{REDIS_KEY_PREFIX}:session:refresh:{sha256(refreshToken)}
```

Example prefix used in smoke test:

```text
chatrt:phase1b:session:refresh:{64-char-sha256}
```

The raw refresh token is never stored in the Redis key.

### Redis Value

Stored JSON fields:

```json
{
  "userId": "string",
  "createdAt": "ISO date",
  "expiresAt": "ISO date",
  "source": "redis"
}
```

The raw refresh token is not stored in the Redis value.

### TTL

Redis TTL is derived from `expiresAt` and matches the existing refresh token lifetime:

```text
REFRESH_TOKEN_TTL = REFRESH_TOKEN_MAX_AGE_MS
```

## Runtime Behavior

### Login / Create Session

When Redis refresh sessions are enabled and ready:

1. Generate access token.
2. Generate refresh token.
3. Write hashed refresh session metadata to Redis with TTL.
4. Set existing `refreshToken` and `accessToken` cookies.
5. Return the existing auth response unchanged.

When Redis is disabled, not ready, or write fails:

1. Use existing MongoDB `Session.create`.
2. Set existing cookies.
3. Return the existing auth response unchanged.

### Refresh Access Token

When Redis refresh sessions are enabled:

1. Lookup `sha256(refreshToken)` in Redis.
2. If hit, use Redis session metadata.
3. If miss or Redis not ready, fallback to `Session.findOne({ refreshToken })`.
4. Preserve existing user status, maintenance, and access-token response behavior.

### Logout

Logout now attempts both cleanup paths:

- Delete Redis refresh session key built from `sha256(refreshToken)`.
- Delete MongoDB session document by raw `refreshToken`.

This keeps rollback and mixed-mode sessions safe.

## Timing Logs

Logs are still gated by:

```text
LOAD_TEST=true
```

or:

```text
AUTH_TIMING_DEBUG=true
```

Prefix:

```text
[AuthTiming]
```

`create_session` fields now include:

- `phase`
- `userId`
- `ok`
- `sessionStoreMode`: `redis`, `mongo`, or `mongo_fallback`
- `jwtSignMs`
- `randomRefreshTokenMs`
- `redisSessionWriteMs` when Redis path is attempted
- `mongoSessionCreateMs` when MongoDB fallback path is used
- `sessionCreateMs` for MongoDB compatibility with Phase 1A logs
- `setCookieMs`
- `createSessionTotalMs`
- `errorCode` on error

No password, access token, refresh token, cookie value, Authorization header, or raw user payload is logged.

## Validation Results

### Docker Redis

Command:

```powershell
docker compose -f docker-compose.redis.yml ps
```

Result:

```text
chat-realtime-redis Up About an hour (healthy) 0.0.0.0:6379->6379/tcp
```

### Automated Tests

Command:

```powershell
npm test
```

Working directory:

```text
backend
```

Result:

```text
Test Suites: 9 passed, 9 total
Tests: 44 passed, 44 total
```

### Redis Hot Path Smoke Test

Environment used:

```text
REDIS_ENABLED=true
AUTH_REDIS_SESSION_ENABLED=true
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_KEY_PREFIX=chatrt:phase1b
LOAD_TEST=true
AUTH_TIMING_DEBUG=true
```

Result summary:

```json
{
  "ok": true,
  "redisHealth": {
    "enabled": true,
    "ok": true,
    "status": "ready"
  },
  "keyPrefixOk": true,
  "keyHashLength": 64,
  "redisHitAfterCreate": true,
  "redisValueFields": ["createdAt", "expiresAt", "source", "userId"],
  "mongoSessionCountForToken": 0,
  "refreshStatus": 200,
  "accessCookieSetOnRefresh": true,
  "redisExistsAfterLogout": 0,
  "logoutClearedCookies": ["accessToken", "refreshToken"]
}
```

Observed timing log:

```text
[AuthTiming] {"phase":"create_session","ok":true,"sessionStoreMode":"redis","jwtSignMs":1.925,"randomRefreshTokenMs":0.045,"redisSessionWriteMs":3.73,"setCookieMs":0.133,"createSessionTotalMs":5.985}
```

Interpretation:

- Redis was ready.
- Refresh session was written to Redis.
- Redis key used a 64-character SHA-256 hash.
- Redis value did not contain the raw refresh token.
- MongoDB `sessions` was not written for this refresh token.
- Refresh token flow returned HTTP 200.
- Logout removed the Redis key.

### MongoDB Fallback Smoke Test

Environment used:

```text
REDIS_ENABLED=false
AUTH_REDIS_SESSION_ENABLED=true
LOAD_TEST=true
AUTH_TIMING_DEBUG=true
```

Result summary:

```json
{
  "ok": true,
  "mongoCountAfterCreate": 1,
  "refreshStatus": 200,
  "accessCookieSetOnRefresh": true,
  "mongoCountAfterLogout": 0,
  "logoutClearedCookies": ["accessToken", "refreshToken"]
}
```

Observed timing log:

```text
[AuthTiming] {"phase":"create_session","ok":true,"sessionStoreMode":"mongo_fallback","jwtSignMs":2.744,"randomRefreshTokenMs":0.052,"mongoSessionCreateMs":143.156,"sessionCreateMs":143.156,"setCookieMs":0.11,"createSessionTotalMs":146.226}
```

Interpretation:

- Redis disabled did not break login/session creation.
- Existing MongoDB session path still works.
- Refresh token flow returned HTTP 200.
- Logout removed the MongoDB session.

## Manual k6 Commands

Start backend with timing and Redis session hot path enabled:

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
export AUTH_REDIS_SESSION_ENABLED=true
npm run dev
```

k6 missing user:

```bash
export BASE_URL=http://127.0.0.1:5001
export LOAD_TEST=true
export NODE_ENV=development
export MODE=missing_user
export VUS=50
k6 run tests/load/login-compare-test.js
```

k6 wrong password:

```bash
export MODE=wrong_password
export TEST_USERNAME=vanh
export TEST_PASSWORD=1234567
export VUS=50
k6 run tests/load/login-compare-test.js
```

k6 valid login:

```bash
export MODE=valid
export TEST_USERNAME=vanh
export TEST_PASSWORD=1234567
export VUS=50
k6 run tests/load/login-compare-test.js
```

Expected valid-login signal:

- `create_session.sessionStoreMode` should be `redis`.
- `redisSessionWriteMs` should appear.
- `mongoSessionCreateMs` should not appear unless Redis fallback happened.
- `createSessionTotalMs` should drop significantly compared with Phase 1A MongoDB `Session.create` dominated timings.

## Security Notes

- Refresh token is still transported by the existing httpOnly cookie.
- Raw refresh token is not logged.
- Raw refresh token is not used in the Redis key.
- Raw refresh token is not stored in the Redis value.
- Redis value contains only session metadata required for refresh lookup.
- MongoDB fallback preserves the previous behavior for Redis outage or rollback.

## Risks

- Redis memory pressure can evict refresh sessions if Redis eviction policy is not configured carefully.
- Restarting non-persistent Redis will remove Redis-only sessions; users may need to log in again unless fallback/migration is added.
- Mixed rollout can create both Redis and MongoDB sessions depending on instance flags and Redis readiness.
- `Session.deleteMany({ userId })` for banned users only deletes MongoDB sessions and the current Redis token; full per-user Redis session revocation would require a user session index/set.
- Redis must remain private and password/TLS-protected in non-local environments.

## Rollback Plan

Fast rollback:

```text
AUTH_REDIS_SESSION_ENABLED=false
```

Then restart backend instances.

Expected rollback behavior:

- New logins return to MongoDB `Session.create`.
- Refresh lookup uses MongoDB sessions.
- Existing Redis-only refresh sessions will not be found after rollback, so those users may need to log in again.

Safer rollback during a live rollout:

1. Set `AUTH_REDIS_SESSION_ENABLED=false` for new backend deploy.
2. Keep Redis running until old instances are drained.
3. Monitor `403` refresh-token responses.
4. If needed, ask affected users to log in again.

## Next Steps

- Run the three k6 login modes with `AUTH_REDIS_SESSION_ENABLED=true`.
- Compare Phase 1A valid-login p95 against Phase 1B valid-login p95.
- If valid-login p95 remains high, inspect bcrypt/libuv worker pool, MongoDB user lookup latency, maintenance check latency, Node process saturation, and client-side connection reuse.
- Add full user-level Redis session index only if product requirements need global logout/revoke-all-sessions across Redis sessions.
