# Redis Phase 1 Report - ChatRealTime

Ngay trien khai: 2026-06-15

## Tom tat da lam

Redis Phase 1 da duoc trien khai theo pham vi nen tang, khong cache login response, khong bo Bearer flow, khong bo cookie auth flow, khong rotate refresh token, va khong cache conversation/message/friend/dashboard trong phase nay.

Da them:

- Redis client singleton dung `ioredis`.
- Cache helper JSON co key prefix, TTL jitter, fallback khi Redis loi.
- Cache maintenance public config de giam MongoDB read trong auth/maintenance checks.
- Redis health detail vao health summary hien co cua admin/system.
- Auth rate limit cho cac route nhay cam, fail-open khi Redis khong san sang.
- Helper hash refresh token va build refresh session key, chua cutover session MongoDB.
- Docker compose rieng cho Redis local dev.

## File da sua/tao

### Backend

- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/app/server.js`
- `backend/src/modules/auth/api/http/auth.route.js`
- `backend/src/modules/auth/infrastructure/refresh-session-key.service.js`
- `backend/src/modules/system/application/admin-maintenance.service.js`
- `backend/src/services/maintenanceService.js`
- `backend/src/middlewares/authRateLimitMiddleware.js`
- `backend/src/middlewares/redisRateLimit.js`
- `backend/src/shared/infrastructure/redis/redis-client.js`
- `backend/src/shared/infrastructure/cache/cache.service.js`
- `backend/src/shared/infrastructure/cache/cache-keys.js`

### Docker/report

- `docker-compose.redis.yml`
- `report/REDIS_PHASE1_REPORT.md`

## Dependency moi

- `ioredis@^5.11.1`

`npm install ioredis` da cap nhat `backend/package.json` va `backend/package-lock.json`. npm audit hien bao 14 vulnerabilities co san trong dependency tree; chua chay `npm audit fix` vi ngoai pham vi Phase 1 va co the doi package rong.

## Env moi/can them

| Env | Muc dich | Gia tri goi y |
|---|---|---|
| `REDIS_ENABLED` | Bat/tat Redis client | `true` production/staging, mac dinh code chi bat khi bang `true` |
| `REDIS_URL` | Redis connection string uu tien | `redis://localhost:6379` |
| `REDIS_HOST` | Host khi khong dung URL | `localhost` |
| `REDIS_PORT` | Port khi khong dung URL | `6379` |
| `REDIS_PASSWORD` | Password/ACL Redis | empty local, bat buoc production neu remote |
| `REDIS_DB` | Redis database index | `0` |
| `REDIS_TLS` | Bat TLS cho Redis remote | `false` local, `true` neu can |
| `REDIS_KEY_PREFIX` | Prefix key theo app/env | `chatrt:dev` |
| `CACHE_ENABLED` | Bat/tat cache helper | `true` |
| `RATE_LIMIT_ENABLED` | Bat/tat auth rate limit | `true` |
| `RATE_LIMIT_BYPASS` | Bypass rate limit thu cong | `false` |
| `LOAD_TEST` | Bypass rate limit cho k6 raw perf | `true` khi chay k6 baseline |
| `MAINTENANCE_CACHE_TTL_SECONDS` | TTL maintenance config | mac dinh `45` |

## Redis key da dung

Tat ca key qua `buildKey(...)` nen co prefix `REDIS_KEY_PREFIX`.

| Key logical | Key day du vi du | Ghi chu |
|---|---|---|
| Maintenance config | `chatrt:dev:maintenance:config` | Chi cache public fields, khong cache verification hashes |
| Login IP rate limit | `chatrt:dev:rl:auth:signin:ip:{sha256}` | Hash IP |
| Login user rate limit | `chatrt:dev:rl:auth:signin:user:{sha256}` | Hash email/userName normalized |
| Signup IP/user | `chatrt:dev:rl:auth:signup:ip:{sha256}` / `user:{sha256}` | Phase 1 protection bo sung |
| Forgot IP/email | `chatrt:dev:rl:auth:forgot:ip:{sha256}` / `email:{sha256}` | Hash email |
| Resend verification | `chatrt:dev:rl:auth:resend:ip:{sha256}` / `token:{sha256}` | Hash verification token |
| OTP verify | `chatrt:dev:rl:auth:otp:ip:{sha256}` / `user:{sha256}` | Hash email/userName |
| Refresh session planned | `chatrt:dev:session:refresh:{tokenHash}` | Helper only, chua luu session Redis |

## TTL da dung

| Data/rule | TTL/window |
|---|---:|
| Maintenance config | `MAINTENANCE_CACHE_TTL_SECONDS`, mac dinh 45s + jitter 10-20% |
| Cache helper default | 60s + jitter 10-20% |
| Login IP | 30 attempts / 5 minutes |
| Login username/email | 10 attempts / 10 minutes |
| Signup IP | 20 attempts / 15 minutes |
| Signup username/email | 10 attempts / 15 minutes |
| Forgot password IP | 10 attempts / 15 minutes |
| Forgot password email | 3 attempts / 15 minutes |
| Resend verification IP | 10 attempts / 15 minutes |
| Resend verification token | 5 attempts / 15 minutes |
| OTP verify IP | 10 attempts / 10 minutes |
| OTP verify user/email | 5 attempts / 10 minutes |
| Planned refresh session Redis | 14 days, chua cutover |

## Rate limit behavior

- Middleware file theo spec: `backend/src/middlewares/redisRateLimit.js`.
- Logic chinh nam o `authRateLimitMiddleware.js`, export lai qua `redisRateLimit.js`.
- Atomic counter dung Lua script `INCR` + `EXPIRE`.
- Neu vuot nguong tra HTTP `429` va header `Retry-After`.
- Email/userName/IP/token deu hash sha256 trong key, khong log raw identifier.
- Neu `RATE_LIMIT_BYPASS=true` hoac `LOAD_TEST=true`, middleware bypass.
- Neu Redis disabled/down/not ready, middleware fail-open va request tiep tuc nhu truoc.

Routes da gan:

- `POST /api/auth/signin`
- `POST /api/auth/signup`
- `POST /api/auth/forgot-password`
- `POST /api/auth/resend-verification`
- `POST /api/auth/verify-forgot-password-otp`

## Redis fallback behavior

- `REDIS_ENABLED` chi bat client khi gia tri dung `true`; mac dinh khong lam backend phu thuoc Redis.
- Redis connect loi: log warning, server van chay.
- Cache read/write/delete loi: return miss/false/0, code tiep tuc query MongoDB.
- Rate limit Redis loi/not ready: fail-open.
- Health route khong expose secret env hoac Redis URL day du.
- `checks.redis` pass khi Redis disabled co chu dich; `details.redis` van hien `enabled/status/latencyMs`.

## Docker Redis local

Da them `docker-compose.redis.yml`:

```bash
docker compose -f docker-compose.redis.yml up -d
```

Service dung `redis:7-alpine`, healthcheck `redis-cli ping`, expose `6379:6379` chi cho local dev. Production khong duoc expose Redis public; nen dung private network, password/ACL, va TLS neu Redis di qua network khong tin cay.

## Test da chay

Backend regression:

```bash
cd backend
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --runInBand
```

Ket qua sau Redis Phase 1: 9 test suites passed, 44 tests passed.

Redis local cache smoke:

- Da start Redis local bang `docker compose -f docker-compose.redis.yml up -d`.
- `connectRedis()` tra OK.
- `setJson/getJson/del` voi key `chatrt:test:smoke:phase1` hoat dong.
- `getRedisHealth()` tra `{ enabled: true, ok: true, status: "ready" }` va latency hop le.

Redis down/fail-open smoke:

- Khi Docker daemon/Redis mat ket noi, cache helper va rate limiter khong lam crash process.
- Rate limiter fail-open va cho request tiep tuc.

## Test chua chay duoc

- Chua xac nhan rate limit 429 end-to-end voi Redis that vi Docker daemon mat ket noi sau khi cache smoke thanh cong.
- Chua test TTL expiry cua rate limit bang Redis that.
- Chua test toggle/update maintenance invalidate cache bang flow admin thuc.
- Chua chay k6 login sau Phase 1.
- Chua chay browser manual cho login/refresh/logout/socket/swagger sau Redis Phase 1.

## k6

Chua chay lai k6 trong turn nay. Khi chay login raw performance, set:

```powershell
$env:RATE_LIMIT_BYPASS="true"
$env:LOAD_TEST="true"
k6 run tests/load/login-test.js
```

Nen chay them test rate limit rieng voi `RATE_LIMIT_ENABLED=true`, `RATE_LIMIT_BYPASS=false`, `LOAD_TEST=false` va threshold test nho hon hoac lap request vuot nguong de xac nhan `429`.

## Nhung gi chua lam

- Chua cache conversation/message/friend/dashboard.
- Chua them Redis Socket.IO adapter.
- Chua them Redis presence.
- Chua them BullMQ.
- Chua them Kafka.
- Chua rotate refresh token.
- Chua chuyen sang cookie-only access token.
- Chua cutover refresh session tu MongoDB sang Redis.
- Chua dual-write refresh session Redis; chi tao helper hash/key.
- Chua them cache stampede lock single-flight; Phase 1 moi co TTL jitter.

## Rui ro con lai

| Level | Rui ro | Ghi chu |
|---|---|---|
| High | `bcrypt.compare` van la CPU-bound | Redis Phase 1 khong lam bcrypt nhanh hon |
| High | Login thanh cong van ghi MongoDB `Session` | Helper Redis session da co, nhung chua cutover |
| Medium | Rate limit chua duoc smoke 429 voi Redis that | Docker daemon mat ket noi trong test |
| Medium | Maintenance cache co stale toi khoang 45s + jitter neu invalidate fail | Redis loi thi fallback MongoDB |
| Medium | Redis local expose `6379:6379` | Chi dung local dev, khong dung production |
| Medium | Raw refresh token van luu trong MongoDB Session | Nam ngoai phase, can migration sau |
| Low | Health response them `details` | Da giu `checks.database/smtp` boolean de giam rui ro UI cu |

## Rollback plan

- Tat Redis toan bo: set `REDIS_ENABLED=false` va restart backend.
- Tat cache nhung giu Redis/rate limit: set `CACHE_ENABLED=false`.
- Tat auth rate limit: set `RATE_LIMIT_ENABLED=false` hoac tam thoi `RATE_LIMIT_BYPASS=true`.
- Doi key namespace neu can invalidate tat ca cache: doi `REDIS_KEY_PREFIX`, vi du `chatrt:dev:v2`.
- Neu middleware rate limit gay loi auth, go cac middleware Redis trong `auth.route.js` hoac tat flag env truoc.
- Neu health Redis lam admin health cham, tat `REDIS_ENABLED` hoac chuyen health ping sang timeout ngan hon o phase tiep theo.
- MongoDB `Session` van la source of truth, nen rollback Redis khong lam mat login/refresh/logout logic hien tai.
