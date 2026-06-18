# Báo cáo Login Performance Phase 1F

Ngày thực hiện: 2026-06-16

## Mục tiêu phase

Đo end-to-end pipeline thật của `POST /api/auth/signin` bằng sampling để tìm đoạn gây tail latency cao khi k6 25/50 VUs.

Phase này chỉ thêm instrumentation. Không thay đổi:

- Auth response format.
- Cookie name.
- Bearer token flow.
- Refresh token behavior.
- Redis session behavior.
- Rate limit behavior.
- Maintenance cache behavior.
- Socket.IO behavior.
- Conversation/message/friend/dashboard cache.

## File đã đọc

- `report/LOGIN_PERFORMANCE_PHASE1B_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1C_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1D_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1E_REPORT.md`
- `backend/src/app/server.js`
- `backend/src/modules/auth/api/http/auth.route.js`
- `backend/src/modules/auth/api/http/auth.controller.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/modules/auth/infrastructure/auth-timing.js`
- `backend/src/middlewares/authMiddleware.js`
- `backend/src/middlewares/authRateLimitMiddleware.js`
- `backend/src/middlewares/friendMiddleware.js`
- `backend/src/middlewares/httpsMiddleware.js`
- `backend/src/middlewares/maintenanceMiddleware.js`
- `backend/src/middlewares/redisRateLimit.js`
- `backend/src/middlewares/securityHeaders.js`
- `backend/src/middlewares/socketMiddleWare.js`
- `backend/src/middlewares/uploadMiddleWare.js`
- `backend/src/middlewares/validationMiddleware.js`

## File đã sửa

- `backend/src/shared/infrastructure/perf/signin-pipeline-timing.js`
- `backend/src/shared/api/http/controller-factory.js`
- `backend/src/modules/auth/api/http/auth.route.js`
- `backend/src/modules/auth/api/http/auth.controller.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `report/LOGIN_PERFORMANCE_PHASE1F_REPORT.md`

## Env flag mới

| Env | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `SIGNIN_PIPELINE_TIMING_ENABLED` | `false` | Bật sampling log cho `POST /api/auth/signin` |
| `SIGNIN_PIPELINE_SAMPLE_RATE` | `0.05` | Tỷ lệ log ngẫu nhiên, từ `0` đến `1` |
| `SIGNIN_PIPELINE_SLOW_MS` | `500` | Luôn log request có `totalReqMs` lớn hơn hoặc bằng ngưỡng này |

Các flag này độc lập với `AUTH_TIMING_DEBUG` và `LOAD_TEST`.

## Log format

Prefix:

```text
[SigninPipelineTiming]
```

Ví dụ:

```json
{
  "pid": 41168,
  "workerId": null,
  "method": "POST",
  "path": "/api/auth/signin",
  "statusCode": 200,
  "totalReqMs": 0.381,
  "controllerMs": 0.094,
  "serviceTotalMs": 12.3,
  "userLookupMs": 1.1,
  "bcryptMs": 9.9,
  "maintenanceCheckMs": 0.2,
  "createSessionMs": 0.8,
  "responseFinishMs": 0.101,
  "sampled": true,
  "slow": false
}
```

Không log:

- password
- accessToken
- refreshToken
- cookie value
- Authorization header
- request headers nhạy cảm
- raw body
- userName/email

## Cách hoạt động

Instrumentation được gắn riêng vào route:

```text
POST /api/auth/signin
```

Thứ tự route hiện tại:

```text
signinPipelineTimingMiddleware -> rateLimitAuthSignin -> signIn
```

Điều này giúp `totalReqMs` bao gồm cả rate-limit middleware trong route. Các middleware cấp app đứng trước router như `express.json`, cookie parser, CORS, security headers và maintenance middleware không nằm trong `totalReqMs` này. Nếu `totalReqMs` vẫn thấp nhưng k6 cao, cần đo thêm tầng app-level trước router.

Controller timing được ghi qua `makeCommandHandler` nhưng chỉ có tác dụng khi request đã được middleware signin đặt state timing. Các route khác không bị log.

Service timing được truyền bằng object nội bộ `pipelineTiming`, không đưa vào response body.

## Cách bật sampling

Single process:

```bash
cd /d/HHTL/ChatRealTime/backend

export UV_THREADPOOL_SIZE=32
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1f
export CACHE_ENABLED=true
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_BYPASS=true
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=false
export AUTH_REDIS_SESSION_ENABLED=true
export MONGO_MAX_POOL_SIZE=50
export MONGO_MIN_POOL_SIZE=5
export PERF_MONITOR_ENABLED=true
export SIGNIN_PIPELINE_TIMING_ENABLED=true
export SIGNIN_PIPELINE_SAMPLE_RATE=0.02
export SIGNIN_PIPELINE_SLOW_MS=500

npm run dev
```

Cluster 4 workers:

```bash
cd /d/HHTL/ChatRealTime/backend

export CLUSTER_ENABLED=true
export CLUSTER_WORKERS=4
export UV_THREADPOOL_SIZE=8
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1f-c4
export CACHE_ENABLED=true
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_BYPASS=true
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=false
export AUTH_REDIS_SESSION_ENABLED=true
export MONGO_MAX_POOL_SIZE=80
export MONGO_MIN_POOL_SIZE=5
export PERF_MONITOR_ENABLED=true
export SIGNIN_PIPELINE_TIMING_ENABLED=true
export SIGNIN_PIPELINE_SAMPLE_RATE=0.02
export SIGNIN_PIPELINE_SLOW_MS=500

npm run start:cluster
```

## Lệnh k6 cần chạy

```bash
cd /d/HHTL/ChatRealTime

export BASE_URL=http://127.0.0.1:5001
export LOAD_TEST=true
export NODE_ENV=development
export MODE=valid
export TEST_USERNAME=vanh
export TEST_PASSWORD=1234567

export VUS=25
k6 run tests/load/login-compare-test.js

export VUS=50
k6 run tests/load/login-compare-test.js
```

## Cách đọc log

Nếu `totalReqMs` cao và `serviceTotalMs` cũng cao:

- Nút thắt nằm trong service login.
- Xem tiếp `userLookupMs`, `bcryptMs`, `maintenanceCheckMs`, `createSessionMs`.

Nếu `userLookupMs` cao nhưng Mongo explain vẫn `0ms`:

- Nghi ngờ Mongoose connection wait, Mongo pool hoặc queue nội bộ driver.
- Thử tăng/giảm `MONGO_MAX_POOL_SIZE`, kiểm tra Mongo server metrics.

Nếu `bcryptMs` trong request thật cao hơn benchmark standalone:

- Nghi ngờ libuv contention hoặc CPU contention từ workload khác.
- So sánh với `[PerfMonitor] cpuUserMs`, `eventLoopUtilization` và `eventLoopDelayP95Ms`.

Nếu `createSessionMs` cao dù Redis bật:

- Kiểm tra Redis latency hoặc fallback MongoDB.
- Bật `AUTH_TIMING_DEBUG=true` trong một lượt ngắn để xem `sessionStoreMode`.

Nếu `totalReqMs` cao nhưng `controllerMs` và `serviceTotalMs` thấp:

- Vấn đề có thể nằm trước controller hoặc sau controller.
- Vì middleware hiện tại đặt ở route, cần đo thêm app-level middleware nếu muốn bao gồm `express.json`, CORS, security headers và maintenance middleware.

Nếu `responseFinishMs` cao:

- Có thể response/socket flush chậm, client/network chậm hoặc event loop bận sau khi controller hoàn tất.

Nếu log có `workerId` khác nhau trong cluster:

- So sánh tail latency và `[PerfMonitor]` theo từng worker để xem tải có phân bố đều không.

## Kết quả test

### Kiểm tra cú pháp

Lệnh:

```powershell
cd backend
node --check src/shared/infrastructure/perf/signin-pipeline-timing.js
node --check src/modules/auth/api/http/auth.controller.js
node --check src/shared/api/http/controller-factory.js
```

Kết quả: pass, không có lỗi cú pháp.

### npm test

Lệnh:

```powershell
cd backend
npm test
```

Kết quả:

```text
Error: spawn EPERM
```

Đây là lỗi Jest worker trên Windows/sandbox đã gặp ở các phase trước.

### Jest fallback

Lệnh:

```powershell
cd backend
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --runInBand
```

Kết quả:

```text
Test Suites: 9 passed, 9 total
Tests: 44 passed, 44 total
Snapshots: 0 total
```

### Smoke SigninPipelineTiming

Lệnh:

```powershell
$env:SIGNIN_PIPELINE_TIMING_ENABLED='true'
$env:SIGNIN_PIPELINE_SAMPLE_RATE='1'
$env:SIGNIN_PIPELINE_SLOW_MS='999999'
node --input-type=module -e "import { EventEmitter } from 'node:events'; import { signinPipelineTimingMiddleware, markSigninPipelineControllerStart, markSigninPipelineControllerEnd, recordSigninPipelineServiceTiming } from './backend/src/shared/infrastructure/perf/signin-pipeline-timing.js'; const req = { method: 'POST', baseUrl: '/api/auth', route: { path: '/signin' }, path: '/signin' }; const res = new EventEmitter(); res.statusCode = 200; signinPipelineTimingMiddleware(req, res, () => {}); markSigninPipelineControllerStart(req); recordSigninPipelineServiceTiming(req, { serviceTotalMs: 12.3, userLookupMs: 1.1, bcryptMs: 9.9, maintenanceCheckMs: 0.2, createSessionMs: 0.8 }); markSigninPipelineControllerEnd(req); res.emit('finish');"
```

Kết quả:

```text
[SigninPipelineTiming] {"pid":41168,"workerId":null,"method":"POST","path":"/api/auth/signin","statusCode":200,"totalReqMs":0.381,"controllerMs":0.094,"serviceTotalMs":12.3,"userLookupMs":1.1,"bcryptMs":9.9,"maintenanceCheckMs":0.2,"createSessionMs":0.8,"responseFinishMs":0.101,"sampled":true,"slow":false}
```

## Kết luận bước tiếp theo

Chạy k6 25/50 VUs với `SIGNIN_PIPELINE_SAMPLE_RATE=0.02` và `SIGNIN_PIPELINE_SLOW_MS=500`, sau đó phân loại log chậm:

- Nếu `bcryptMs` chiếm phần lớn: tiếp tục tối ưu bcrypt/concurrency hoặc worker process.
- Nếu `userLookupMs` chiếm phần lớn: điều tra Mongo pool/Mongoose driver wait.
- Nếu `serviceTotalMs` thấp nhưng `totalReqMs` cao: thêm app-level timing trước router.
- Nếu `responseFinishMs` cao: kiểm tra flush/network/event loop sau response.

Phase này tạo dữ liệu đủ chi tiết để quyết định bước tiếp theo thay vì đoán dựa trên benchmark bcrypt standalone.

## Rollback plan

Rollback runtime:

- Set `SIGNIN_PIPELINE_TIMING_ENABLED=false` hoặc bỏ biến này.

Rollback code:

- Gỡ `signinPipelineTimingMiddleware` khỏi route `/signin`.
- Gỡ `recordSigninPipelineServiceTiming` khỏi `auth.controller.js`.
- Gỡ `pipelineTiming` khỏi `signInUser`.
- Gỡ import/mark trong `controller-factory.js`.
- Xóa `backend/src/shared/infrastructure/perf/signin-pipeline-timing.js`.

Khi flag không bật, middleware không tạo state timing và không log `[SigninPipelineTiming]`.
