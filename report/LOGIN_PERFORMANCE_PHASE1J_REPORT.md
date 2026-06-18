# ChatRealTime Backend - Login Performance Phase 1J

Ngày: 2026-06-17

## Mục tiêu phase

Tối ưu maintenance check trên hot path login sau khi Phase 1I đã giảm được `users.find` bằng Redis auth user lookup cache. Phase này chỉ giảm độ trễ `maintenanceReadMs`, không đổi business logic maintenance mode, auth response, cookie/Bearer flow, Redis refresh session, refresh token behavior, Socket.IO, hoặc cache conversation/message/friend/dashboard.

## File đã đọc

- `report/LOGIN_PERFORMANCE_PHASE1H_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1I_REPORT.md`
- `report/REDIS_PHASE1_REPORT.md`
- `report/REDIS_PHASE1_VALIDATION_REPORT.md`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/modules/auth/infrastructure/maintenance-access.service.js`
- `backend/src/services/maintenanceService.js`
- `backend/src/modules/system/application/admin-maintenance.service.js`
- `backend/src/shared/infrastructure/cache/cache.service.js`
- `backend/src/shared/infrastructure/redis/redis-client.js`
- `backend/src/shared/infrastructure/perf/signin-pipeline-timing.js`
- `backend/src/middlewares/maintenanceMiddleware.js`
- `backend/src/modules/system/application/maintenance-access.service.js`
- `backend/src/modules/system/application/maintenance-mode.service.js`
- `backend/src/app/server.js`

## File đã sửa

- `backend/src/services/maintenanceService.js`
- `backend/src/modules/auth/infrastructure/maintenance-access.service.js`
- `backend/src/modules/system/application/maintenance-access.service.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/shared/infrastructure/perf/signin-pipeline-timing.js`
- `backend/src/tests/auth/test.js`
- `report/LOGIN_PERFORMANCE_PHASE1J_REPORT.md`

## Maintenance check đang đọc từ đâu

Flow login hiện tại:

1. `POST /api/auth/signin` vào `signInUser`.
2. Sau user lookup, bcrypt và banned check, `signInUser` gọi `ensureMaintenanceAccess(user, maintenanceTiming)`.
3. `ensureMaintenanceAccess` đọc maintenance public config từ `maintenanceService`.
4. `maintenanceService` trước Phase 1J dùng Redis cache key `${REDIS_KEY_PREFIX}:maintenance:config`; khi cache miss thì fallback MongoDB qua `Maintenance.findOne()` hoặc tạo document mặc định nếu chưa có.
5. `maintenanceCheckMiddleware` ở app-level bypass `/api/auth`, nên signin không bị middleware này check trước route; signin tự check trong service.

## Nguyên nhân `maintenanceReadMs` spike

Sau Phase 1I, `authUserCacheHit=true` làm `userLookupAwaitMs` thường chỉ còn khoảng 0.7-3ms. Slow log mới cho thấy `maintenanceReadMs` có thể lên 2300-4900ms, gần bằng `maintenanceCheckMs`.

Nguyên nhân hợp lý nhất trong code hiện tại:

- Maintenance public config chỉ có Redis L2 cache TTL khoảng 45s + jitter.
- Khi Redis key miss/expired hoặc Redis chậm, nhiều request login đồng thời cùng gọi `getPublicMaintenanceConfig()`.
- Trước Phase 1J không có L1 per-worker cache và không có single-flight, nên nhiều request có thể cùng dồn vào Redis/Mongo ở thời điểm cache miss/expired.
- Khi maintenance bật, code cũ có thể gọi `isMaintenanceEnabled()` rồi `getMaintenanceMessage()`, tức có nguy cơ đọc public config hai lần trong cùng request.

Phase 1J xử lý các điểm này bằng L1 TTL ngắn, single-flight per worker, và đọc maintenance public config một lần cho quyết định login.

## Thiết kế L1 cache/single-flight

### L1 cache per worker

- Cache nằm trong memory của từng Node worker/process.
- Chỉ cache public maintenance fields:
  - `isEnabled`
  - `message`
  - `enabledAt`
  - `enabledBy`
  - `disabledAt`
  - `disabledBy`
- Không cache confirmation code hash, password verification hash, token, cookie, hoặc dữ liệu nhạy cảm.
- TTL ngắn, mặc định `1000ms`.
- Mặc định tắt, bật bằng env rõ ràng để rollback nhanh.

### Single-flight

- Khi L1 miss/expired, chỉ request đầu tiên tạo promise đọc Redis/Mongo.
- Các request đồng thời còn lại await cùng promise.
- Promise luôn được clear trong `finally`.
- Nếu admin invalidate trong lúc đang có in-flight read, version guard ngăn kết quả cũ ghi lại L1 cache.

### Source chain

Thứ tự đọc:

1. L1 memory nếu còn TTL.
2. Single-flight promise nếu đã có request khác đang đọc.
3. Redis L2 cache key `maintenance:config`.
4. MongoDB `Maintenance.findOne()` và ghi lại Redis L2 nếu cần.

## Env flag mới

| Env | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `MAINTENANCE_L1_CACHE_ENABLED` | `false` | Bật/tắt L1 in-memory cache per worker |
| `MAINTENANCE_L1_CACHE_TTL_MS` | `1000` | TTL L1 cache tính bằng milliseconds |

Env cũ vẫn giữ:

| Env | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `MAINTENANCE_CACHE_TTL_SECONDS` | `45` | TTL Redis L2 cache cho maintenance public config |

## Timing fields mới

Đã bổ sung vào `[SigninPipelineTiming]`:

- `maintenanceL1Enabled`
- `maintenanceL1Hit`
- `maintenanceSource`
- `maintenanceSingleFlightShared`
- `maintenanceReadMs`
- `maintenanceDecisionMs`

`maintenanceSource` có thể là:

- `l1_memory`
- `redis`
- `mongo`
- `single_flight` trong lúc đang await shared promise, sau resolve sẽ ghi source thực tế của promise
- `bypass_admin`

Không log maintenance message, raw user payload, token, cookie, password, Authorization header, hoặc dữ liệu nhạy cảm.

## Invalidation

`invalidateMaintenanceCache()` hiện xóa cả:

- L1 in-memory cache của worker hiện tại.
- Redis L2 key `${REDIS_KEY_PREFIX}:maintenance:config`.

Các flow admin đang gọi invalidate:

- `toggleMaintenanceMode(adminId, enable)`
- `updateMaintenanceMessage(message)`

Trong multi-worker/cluster, invalidation L1 hiện chỉ tác động worker xử lý request admin. Các worker khác sẽ nhất quán lại sau TTL ngắn `MAINTENANCE_L1_CACHE_TTL_MS`. Phase này không thêm Redis pub/sub để tránh mở rộng scope; rủi ro eventual consistency đã được giảm bằng TTL mặc định 1000ms.

## Business logic

Không đổi logic maintenance:

- Admin vẫn bypass maintenance.
- User thường vẫn bị chặn khi `isEnabled=true`.
- Response maintenance vẫn dùng `503` và code `MAINTENANCE_MODE`.
- Message maintenance vẫn lấy từ public config.
- Auth response, cookie name, Bearer flow, refresh token behavior và Redis refresh session behavior không đổi.

## Cách chạy backend + k6 cache ON + maintenance L1 ON

Backend:

```bash
cd /d/HHTL/ChatRealTime/backend

export CLUSTER_ENABLED=true
export CLUSTER_WORKERS=4
export UV_THREADPOOL_SIZE=8
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1j
export CACHE_ENABLED=true
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_BYPASS=true
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=false
export AUTH_REDIS_SESSION_ENABLED=true
export AUTH_USER_LOOKUP_CACHE_ENABLED=true
export AUTH_USER_LOOKUP_CACHE_TTL_SECONDS=300
export MAINTENANCE_L1_CACHE_ENABLED=true
export MAINTENANCE_L1_CACHE_TTL_MS=1000
export MONGO_MAX_POOL_SIZE=50
export MONGO_MIN_POOL_SIZE=5
export PERF_MONITOR_ENABLED=true
export SIGNIN_PIPELINE_TIMING_ENABLED=true
export SIGNIN_PIPELINE_SAMPLE_RATE=0.02
export SIGNIN_PIPELINE_SLOW_MS=500

npm run start:cluster 2>&1 | tee ../phase1j-cache-on-k6.log
```

Warm cache:

```bash
cd /d/HHTL/ChatRealTime

curl.exe -s -X POST http://127.0.0.1:5001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d "{\"userName\":\"vanh\",\"password\":\"1234567\"}" > /dev/null

curl.exe -s -X POST http://127.0.0.1:5001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d "{\"userName\":\"vanh\",\"password\":\"1234567\"}" > /dev/null
```

k6:

```bash
cd /d/HHTL/ChatRealTime

export BASE_URL=http://127.0.0.1:5001
export LOAD_TEST=true
export NODE_ENV=development
export MODE=valid
export TEST_USERNAME=vanh
export TEST_PASSWORD=1234567

export VUS=40
k6 run tests/load/login-compare-test.js

export VUS=50
k6 run tests/load/login-compare-test.js
```

Lọc log:

```bash
grep "\[SigninPipelineTiming\]" phase1j-cache-on-k6.log > phase1j-signin-only.log
tail -n 80 phase1j-signin-only.log
grep '"slow":true' phase1j-cache-on-k6.log | tail -n 80
```

Kỳ vọng:

- Sau warmup, phần lớn request có `maintenanceL1Hit=true`.
- `maintenanceReadMs` ổn định ở mức rất thấp trong từng worker khi L1 hit.
- Khi L1 hết hạn, chỉ một request đọc Redis/Mongo; request đồng thời có thể thấy `maintenanceSingleFlightShared=true`.

## Kết quả test

Đã chạy:

```bash
cd backend
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --runInBand
```

Kết quả:

```text
Test Suites: 9 passed, 9 total
Tests: 44 passed, 44 total
Snapshots: 0 total
```

Đã chạy thêm kiểm tra cú pháp:

```bash
node --check backend/src/services/maintenanceService.js
node --check backend/src/modules/auth/infrastructure/maintenance-access.service.js
node --check backend/src/modules/system/application/maintenance-access.service.js
```

Kết quả: pass.

`git diff --check` không báo whitespace error; chỉ có warning LF/CRLF trên Windows.

Chưa chạy k6 trong lượt này vì task yêu cầu chính là sửa code + chạy Jest fallback; lệnh k6 chạy lại đã ghi ở trên.

## Rủi ro còn lại

| Rủi ro | Mức độ | Giảm thiểu |
| --- | --- | --- |
| Multi-worker L1 không được broadcast invalidate | Medium | TTL rất ngắn, mặc định 1000ms; ghi rõ eventual consistency |
| Redis L2/Mongo vẫn có thể spike khi tất cả worker cùng hết L1 | Medium | Single-flight per worker giảm stampede trong mỗi worker; nếu cần tuyệt đối hơn mới xét Redis pub/sub/lock phase sau |
| Bật nhầm TTL quá cao | Medium | Giữ default 1000ms, chỉ cấu hình cao hơn khi hiểu rủi ro |
| Maintenance bật/tắt có thể trễ tối đa TTL ở worker khác | Medium | Dùng TTL ngắn; admin event/socket vẫn phát như cũ |
| Source timing không correlate cross-worker | Low | Timing log có `pid` và `workerId` để phân tích theo worker |

## Rollback plan

Rollback runtime nhanh:

```bash
MAINTENANCE_L1_CACHE_ENABLED=false
```

Nếu cần xóa Redis L2 maintenance cache:

```bash
redis-cli DEL chatrt:phase1j:maintenance:config
```

Rollback code nếu cần:

- Revert `backend/src/services/maintenanceService.js` về dùng Redis `wrapCache` trực tiếp.
- Revert `backend/src/modules/auth/infrastructure/maintenance-access.service.js` về gọi `isMaintenanceEnabled()`/`getMaintenanceMessage()`.
- Revert timing fields mới trong `session.command-service.js` và `signin-pipeline-timing.js`.

Vì business logic không đổi và flag L1 mặc định tắt, rollback runtime bằng env là cách an toàn nhất.
