# Redis Phase 1.1 Validation Report - ChatRealTime

Ngay thuc hien: 2026-06-15

## Tom tat

Da thuc hien vong verification/hardening cho Redis Phase 1 trong pham vi cho phep. Khong trien khai Redis Phase 2, khong cache conversation/message/friend/dashboard, khong doi auth response format, khong bo Bearer/cookie auth flow, khong rotate refresh token, khong cutover MongoDB `Session` sang Redis, khong them BullMQ/Kafka.

Co mot hardening nho duoc them cho auth rate limit: ho tro override threshold/window bang env test-only de co the test 429/TTL voi nguong nho ma khong anh huong default production.

## File da doc

- `report/REDIS_PHASE1_REPORT.md`
- `report/REDIS_UPGRADE_AUDIT.md`
- `report/TRANSPORT_SECURITY_PHASE1_REPORT.md`
- `backend/src/middlewares/authRateLimitMiddleware.js`
- `backend/src/middlewares/redisRateLimit.js`
- `backend/src/shared/infrastructure/redis/redis-client.js`
- `backend/src/shared/infrastructure/cache/cache.service.js`
- `backend/src/modules/admin-panel/api/http/admin.route.js`
- `backend/.env.test`
- `tests/load/login-test.js`

## File da sua

- `backend/src/middlewares/authRateLimitMiddleware.js`

Thay doi:

- Them env override dang:
  - `RATE_LIMIT_AUTH_{ACTION}_{SCOPE}_LIMIT`
  - `RATE_LIMIT_AUTH_{ACTION}_{SCOPE}_WINDOW_SECONDS`
- Neu env khong set hoac khong hop le, middleware giu nguyen threshold production hien co.
- Khong thay doi route, response auth, token/session flow.

## Redis local/container status

Lenh da thu:

```powershell
docker compose -f docker-compose.redis.yml up -d
```

Ket qua:

- Khong start duoc Redis vi Docker Desktop daemon khong san sang.
- Loi:

```text
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
The system cannot find the file specified.
```

Thu lai voi escalated permission van cung loi, nen nguyen nhan la Docker daemon/engine chua chay, khong phai sandbox.

Kiem tra bo sung:

- Port `127.0.0.1:6379` khong mo.
- Khong co `redis-server`/`redis-cli` trong PATH.

Cach khac phuc:

1. Mo Docker Desktop va cho den khi Linux engine san sang.
2. Chay lai:

```powershell
docker compose -f docker-compose.redis.yml up -d
docker ps --filter name=chat-realtime-redis
```

3. Sau do chay lai Redis-on verification cho rate limit 429, TTL expiry, maintenance cache.

## Redis health endpoint/result

Da test truc tiep Redis health module trong 2 trang thai.

### Redis disabled

Env:

```powershell
REDIS_ENABLED=false
CACHE_ENABLED=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_BYPASS=false
LOAD_TEST=false
```

Ket qua:

```json
{"enabled":false,"ok":false,"status":"disabled","latencyMs":null}
```

Nhan xet:

- Health khong crash.
- Rate-limit middleware fail-open va goi `next()`.

### Redis enabled nhung Redis down

Env:

```powershell
REDIS_ENABLED=true
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
CACHE_ENABLED=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_BYPASS=false
LOAD_TEST=false
```

Ket qua:

```json
{"enabled":true,"ok":false,"status":"error","error":"Connection is closed."}
```

Va health:

```json
{"enabled":true,"ok":false,"status":"error","latencyMs":4,"error":"Stream isn't writeable and enableOfflineQueue options is false"}
```

Nhan xet:

- Backend module khong crash khi Redis down.
- Rate-limit middleware fail-open va goi `next()`.
- Co log warning Redis connection refused, dung ky vong.

## Rate limit 429 end-to-end result

Chua xac minh duoc voi Redis that vi Redis local khong start duoc do Docker daemon khong chay.

Da harden de co the test nhanh khi Redis san sang:

Vi du test signin voi nguong nho:

```powershell
$env:REDIS_ENABLED="true"
$env:RATE_LIMIT_ENABLED="true"
$env:RATE_LIMIT_BYPASS="false"
$env:LOAD_TEST="false"
$env:RATE_LIMIT_AUTH_SIGNIN_USER_LIMIT="2"
$env:RATE_LIMIT_AUTH_SIGNIN_USER_WINDOW_SECONDS="3"
```

Ky vong:

- Request 1-2 tiep tuc vao controller.
- Request 3 tra `429`.
- Response co `Retry-After`.
- Redis key co dang `chatrt:<env>:rl:auth:signin:user:{sha256}`.
- Key khong chua email/userName/IP raw.

## TTL expiry result

Chua xac minh duoc voi Redis that vi Redis local khong start duoc.

Test plan sau khi Docker/Redis san sang:

1. Set `RATE_LIMIT_AUTH_SIGNIN_USER_LIMIT=1`.
2. Set `RATE_LIMIT_AUTH_SIGNIN_USER_WINDOW_SECONDS=2`.
3. Goi cung identifier 2 lan, lan 2 phai `429`.
4. Doi 3 giay.
5. Goi lai, request phai tiep tuc vao controller.
6. Kiem tra Redis `TTL` cua key giam ve 0 va key expire.

## Maintenance cache hit/miss/invalidate result

Chua xac minh duoc voi Redis that vi Redis local khong start duoc.

Da xac nhan ve code/flow:

- Maintenance cache key logical: `maintenance:config`.
- Full key co prefix: `REDIS_KEY_PREFIX:maintenance:config`.
- TTL default: `45s` + jitter 10-20%.
- Cache chi luu public fields:
  - `isEnabled`
  - `message`
  - `enabledAt`
  - `enabledBy`
  - `disabledAt`
  - `disabledBy`
- Khong cache `confirmationCodeHash`, `passwordVerificationHash`, OTP/hash noi bo.
- `toggleMaintenanceMode` va `updateMaintenanceMessage` deu goi `invalidateMaintenanceCache()`.

Can chay lai khi Redis san sang:

1. Bat `DEBUG_CACHE=true`.
2. Goi `getMaintenanceStatus()` lan 1, ky vong MISS va set cache.
3. Goi lan 2, ky vong HIT.
4. Goi admin update/toggle maintenance.
5. Kiem tra key `maintenance:config` bi delete.
6. Goi lai status, ky vong doc gia tri moi.

## Redis off/fail-open result

Da xac minh.

Ket qua:

- `REDIS_ENABLED=false`: health tra disabled, middleware rate-limit goi `next()`.
- `REDIS_ENABLED=true` nhung Redis down: connect/health bao error nhung middleware rate-limit van goi `next()`.
- Redis outage khong lam crash auth middleware.
- Cache helper duoc harden de khong gui lenh Redis khi client chua ready.

## Browser manual regression

Chua chay duoc end-to-end browser manual trong turn nay.

Ly do:

- Backend startup/k6 smoke dang duoc chuan bi thi user interrupt va yeu cau tra report ngay.
- Khong tiep tuc start frontend/backend dev sau khi user yeu cau dung va tra bao cao.

Da chay smoke regression bang `createApp()`:

```json
{
  "docsStatus": 301,
  "frame": "DENY",
  "nosniff": "nosniff",
  "corsStatus": 204,
  "acao": "http://localhost:5173",
  "credentials": "true"
}
```

Nhan xet:

- `/api-docs` mo route va redirect trailing slash binh thuong.
- Security headers Phase 1 van co `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- CORS preflight cho `http://localhost:5173` tra ACAO va credentials dung.

## k6 result

Chua chay k6 sau Phase 1.1.

Tinh trang:

- `k6` co san: `k6.exe v2.0.0-rc1`.
- MongoDB connect OK qua config backend.
- Redis local khong san sang.
- Backend dev server startup dang duoc chuan bi thi user interrupt va yeu cau tra report ngay.

Lenh can chay lai:

```powershell
$env:RATE_LIMIT_BYPASS="true"
$env:LOAD_TEST="true"
$env:NODE_ENV="development"
k6 run tests/load/login-test.js
```

Luu y neu p95 van gan 5s:

- Redis Phase 1 chua lam `bcrypt.compare` nhanh hon.
- Login thanh cong van ghi MongoDB `Session.create`.
- Node van single process.
- k6 co the dung nhieu login tao session write pressure lon.

## Process cleanup

Trong luc verification, co backend/node process bi start do lenh foreground/background bi interrupt. Da kiem tra va dung cac PID con sot:

- PID `18236`
- PID `2808`
- PID `4888`

Sau do khong tiep tuc start server nua vi user yeu cau tra report.

## Bug/hardening da sua

### Test-only rate limit override

Van de:

- Production threshold hard-code cao, kho test 429/TTL nhanh trong local/test.

Sua:

- Them env override cho limit/window theo action/scope.
- Default production khong doi.

Vi du:

```powershell
$env:RATE_LIMIT_AUTH_SIGNIN_USER_LIMIT="2"
$env:RATE_LIMIT_AUTH_SIGNIN_USER_WINDOW_SECONDS="3"
```

Rui ro:

- Neu set nham env nay o production co the lam rate limit qua chat/qua long.

Giam thieu:

- Khong set cac env override nay o production.
- Chi dung trong smoke/test.

## Test da chay

### Redis disabled fail-open smoke

Ket qua:

```text
health {"enabled":false,"ok":false,"status":"disabled","latencyMs":null}
nextCalled true
```

### Redis enabled but down fail-open smoke

Ket qua:

```text
connect {"enabled":true,"ok":false,"status":"error","error":"Connection is closed."}
health {"enabled":true,"ok":false,"status":"error","latencyMs":4,"error":"Stream isn't writeable and enableOfflineQueue options is false"}
nextCalled true
```

### Swagger/CORS/security headers smoke

Ket qua:

```json
{
  "docsStatus": 301,
  "frame": "DENY",
  "nosniff": "nosniff",
  "corsStatus": 204,
  "acao": "http://localhost:5173",
  "credentials": "true"
}
```

## Test chua chay/chua pass

| Hang muc | Trang thai | Ly do |
|---|---|---|
| Redis container healthy | Blocked | Docker daemon khong chay |
| Redis health endpoint OK voi Redis that | Blocked | Redis local khong start duoc |
| Rate limit 429 end-to-end | Blocked | Redis local khong start duoc |
| Rate limit TTL expiry | Blocked | Redis local khong start duoc |
| Maintenance hit/miss/invalidate voi Redis that | Blocked | Redis local khong start duoc |
| Browser manual login/refresh/logout/socket/swagger | Not run | User yeu cau tra report ngay truoc khi tiep tuc |
| k6 login sau Redis Phase 1 | Not run | User yeu cau tra report ngay truoc khi tiep tuc |

## Rui ro con lai

| Level | Rui ro | Ghi chu |
|---|---|---|
| High | Chua co ket qua 429/TTL voi Redis that | Can Docker/Redis local hoac Redis managed dev |
| High | `bcrypt.compare` van la nut that CPU | Redis Phase 1 khong giai quyet CPU-bound bcrypt |
| High | Login thanh cong van ghi MongoDB Session | Chua Redis session cutover theo dung scope |
| Medium | Maintenance cache chua duoc verify runtime voi Redis that | Code co invalidation, nhung can test Redis-on |
| Medium | Docker Desktop dependency lam verification local de bi chan | Can ensure Docker daemon running truoc test |
| Medium | Env override rate-limit co the bi set nham | Chi nen dung trong test/local |

## De xuat buoc tiep theo

1. Mo Docker Desktop, xac nhan engine Linux running.
2. Chay:

```powershell
docker compose -f docker-compose.redis.yml up -d
docker ps --filter name=chat-realtime-redis
```

3. Chay lai Redis-on tests:
   - Health Redis OK.
   - Rate limit 429 voi env override nho.
   - TTL expiry.
   - Maintenance hit/miss/invalidate voi `DEBUG_CACHE=true`.
4. Start backend/frontend dev va browser manual regression.
5. Chay k6 voi `RATE_LIMIT_BYPASS=true`, so sanh p95/failure voi baseline.
6. Sau khi Phase 1.1 xanh, moi sang Phase 2 cache read-heavy APIs.
