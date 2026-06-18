# Báo cáo Login Performance Phase 1G

Ngày thực hiện: 2026-06-16

## Mục tiêu phase

Deep dive `userLookupMs` trong `POST /api/auth/signin` để biết tail latency đến từ bước build query, await Mongo/Mongoose query, post-processing, maintenance read/decision hay phần khác.

Phase này chỉ thêm đo lường và benchmark script. Không thay đổi auth response, cookie name, Bearer flow, refresh token behavior, Redis session behavior, rate limit behavior, Socket.IO hoặc cache conversation/message/friend/dashboard.

## File đã đọc

- `report/LOGIN_PERFORMANCE_PHASE1C_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1D_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1E_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1F_REPORT.md`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/models/User.js`
- `backend/src/shared/infrastructure/db/connect-db.js`
- `backend/src/shared/infrastructure/perf/signin-pipeline-timing.js`
- `backend/src/modules/auth/infrastructure/maintenance-access.service.js`
- `backend/src/shared/infrastructure/cache/cache.service.js`
- `backend/src/shared/infrastructure/redis/redis-client.js`

## File đã sửa

- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/modules/auth/infrastructure/maintenance-access.service.js`
- `backend/src/shared/infrastructure/perf/signin-pipeline-timing.js`
- `backend/scripts/user-lookup-concurrency-benchmark.js`
- `report/LOGIN_PERFORMANCE_PHASE1G_REPORT.md`

## Timing mới

Trong `signInUser`, đã tách user lookup thành:

- `userLookupBuildMs`: thời gian normalize `userName`, build filter/query input.
- `userLookupAwaitMs`: thời gian await Mongo/Mongoose query.
- `userLookupPostMs`: thời gian sau query để set trạng thái nội bộ.
- `userLookupMs`: giữ lại để tương thích log cũ, đo tổng user lookup.
- `findUserMs`: giữ lại alias tương thích Phase 1A/1B.

Trong maintenance check, đã tách:

- `maintenanceReadMs`: thời gian đọc trạng thái/thông điệp maintenance qua service/cache/Mongo.
- `maintenanceDecisionMs`: thời gian logic quyết định ngoài phần read.
- `maintenanceCheckMs`: giữ lại tổng thời gian maintenance check.

`[SigninPipelineTiming]` giờ có thêm:

- `userLookupBuildMs`
- `userLookupAwaitMs`
- `userLookupPostMs`
- `maintenanceReadMs`
- `maintenanceDecisionMs`

Không log userName, email, password, token, cookie, Authorization header hoặc raw user payload.

## Benchmark user lookup concurrency

Đã thêm script:

```text
backend/scripts/user-lookup-concurrency-benchmark.js
```

Env:

```bash
USER_LOOKUP_USERNAME=vanh
USER_LOOKUP_CONCURRENCY_LIST=10,25,50
USER_LOOKUP_ITERATIONS=100
USER_LOOKUP_USE_LEAN=false
```

Script dùng cùng query login:

```js
User.findOne({ userName: normalizedUserName }).select(LOGIN_USER_SELECT)
```

Nếu `USER_LOOKUP_USE_LEAN=true`, script chỉ benchmark thêm `.lean()` để so sánh. Login runtime chưa chuyển sang `.lean()`.

## Kết quả benchmark đã chạy

### Document mode, pool 10

Env chính:

```text
MONGO_MAX_POOL_SIZE=10
MONGO_MIN_POOL_SIZE=2
USER_LOOKUP_USE_LEAN=false
```

| Concurrency | Avg | P50 | P90 | P95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10 | 107.794ms | 64.026ms | 315.159ms | 403.987ms | 843.470ms |
| 25 | 150.311ms | 128.886ms | 307.518ms | 340.723ms | 355.979ms |
| 50 | 246.599ms | 159.436ms | 610.363ms | 643.613ms | 677.736ms |

### Document mode, pool 25

Env chính:

```text
MONGO_MAX_POOL_SIZE=25
MONGO_MIN_POOL_SIZE=2
USER_LOOKUP_USE_LEAN=false
```

| Concurrency | Avg | P50 | P90 | P95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10 | 122.285ms | 67.077ms | 339.333ms | 443.663ms | 931.819ms |
| 25 | 117.386ms | 75.483ms | 150.701ms | 382.949ms | 487.146ms |
| 50 | 120.192ms | 106.167ms | 157.101ms | 186.480ms | 519.018ms |

### Document mode, pool 50

Env chính:

```text
MONGO_MAX_POOL_SIZE=50
MONGO_MIN_POOL_SIZE=5
USER_LOOKUP_USE_LEAN=false
```

| Concurrency | Avg | P50 | P90 | P95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10 | 108.197ms | 61.963ms | 294.668ms | 416.907ms | 800.592ms |
| 25 | 117.583ms | 73.350ms | 150.969ms | 362.772ms | 521.395ms |
| 50 | 118.672ms | 105.111ms | 155.074ms | 189.682ms | 492.645ms |

## So sánh `.select()` document vs `.lean()`

Đã chạy `.lean()` với pool 50:

```text
MONGO_MAX_POOL_SIZE=50
MONGO_MIN_POOL_SIZE=5
USER_LOOKUP_USE_LEAN=true
```

| Concurrency | Avg | P50 | P90 | P95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10 | 116.910ms | 55.514ms | 303.248ms | 394.648ms | 717.632ms |
| 25 | 113.244ms | 73.847ms | 153.756ms | 431.630ms | 501.664ms |
| 50 | 121.137ms | 108.642ms | 161.405ms | 179.864ms | 488.122ms |

Nhận xét:

- `.lean()` không tạo cải thiện rõ ràng trong benchmark này.
- Ở concurrency 50, `.lean()` p95 tốt hơn nhẹ: `179.864ms` so với document `189.682ms`.
- Ở concurrency 25, `.lean()` p95 tệ hơn: `431.630ms` so với document `362.772ms`.
- Chưa nên đổi login runtime sang `.lean()` vì nhánh email chưa xác minh vẫn cần Mongoose document để `user.save()`.

## So sánh pool size

Với document mode:

- Pool 10 bị nghẽn rõ ở concurrency 50: p95 `643.613ms`.
- Pool 25 và pool 50 tốt hơn nhiều ở concurrency 50: p95 lần lượt `186.480ms` và `189.682ms`.
- Pool 25 gần như tương đương pool 50 trong benchmark user lookup standalone, thậm chí nhỉnh hơn nhẹ ở p95 concurrency 50.

Kết luận tạm thời:

- Với single process benchmark user lookup, `MONGO_MAX_POOL_SIZE=25` hoặc `50` đều hợp lý hơn `10`.
- Với cluster 4, nên benchmark thêm theo matrix:
  - mỗi worker pool 10
  - mỗi worker pool 20
  - mỗi worker pool 50
- Chưa hard-code production value.

## Kết quả k6 sau instrumentation

Chưa chạy lại k6 trong task này.

Lệnh đề xuất:

```bash
cd /d/HHTL/ChatRealTime/backend

export CLUSTER_ENABLED=true
export CLUSTER_WORKERS=4
export UV_THREADPOOL_SIZE=8
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1g-c4
export CACHE_ENABLED=true
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_BYPASS=true
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=false
export AUTH_REDIS_SESSION_ENABLED=true
export MONGO_MAX_POOL_SIZE=20
export MONGO_MIN_POOL_SIZE=2
export PERF_MONITOR_ENABLED=true
export SIGNIN_PIPELINE_TIMING_ENABLED=true
export SIGNIN_PIPELINE_SAMPLE_RATE=0.02
export SIGNIN_PIPELINE_SLOW_MS=500

npm run start:cluster
```

Terminal k6:

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

## Kết quả test

### Kiểm tra cú pháp

Đã chạy:

```powershell
cd backend
node --check scripts/user-lookup-concurrency-benchmark.js
node --check src/modules/auth/application/session.command-service.js
node --check src/modules/auth/infrastructure/maintenance-access.service.js
node --check src/shared/infrastructure/perf/signin-pipeline-timing.js
```

Kết quả: pass, không có lỗi cú pháp.

### npm test

Đã chạy:

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

Đã chạy:

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

### Smoke `[SigninPipelineTiming]`

Đã chạy smoke với sample rate 1. Kết quả có đủ field mới:

```text
[SigninPipelineTiming] {"pid":12940,"workerId":null,"method":"POST","path":"/api/auth/signin","statusCode":200,"totalReqMs":0.195,"controllerMs":0.055,"serviceTotalMs":12.3,"userLookupMs":8.1,"userLookupBuildMs":0.1,"userLookupAwaitMs":7.8,"userLookupPostMs":0.2,"bcryptMs":2.9,"maintenanceCheckMs":0.5,"maintenanceReadMs":0.4,"maintenanceDecisionMs":0.1,"createSessionMs":0.8,"responseFinishMs":0.052,"sampled":true,"slow":false}
```

## Kết luận bottleneck chính

Từ số liệu benchmark standalone:

- User lookup query riêng với pool 25/50 ở concurrency 50 có p95 khoảng `186-190ms`.
- Trong k6 slow request Phase 1F, `userLookupMs` từng lên `708-813ms`.

Điều này gợi ý tail latency trong request thật không chỉ là Mongo index hoặc hydrate đơn lẻ. Khả năng cao hơn:

- Pool wait hoặc contention trong cluster/runtime thật.
- Mỗi worker có pool riêng, tổng connection và queue behavior khác benchmark single script.
- Cạnh tranh CPU/libuv/Mongoose/Redis/maintenance trong cùng request pipeline.
- Workload k6 dùng cùng credential có thể tạo pattern truy cập lặp không giống benchmark script.

## Đề xuất bước tiếp theo

1. Chạy lại k6 cluster 4 với timing mới để xem slow request nằm ở `userLookupAwaitMs` hay phần khác.
2. Chạy pool matrix cluster 4:
   - `MONGO_MAX_POOL_SIZE=10`
   - `MONGO_MAX_POOL_SIZE=20`
   - `MONGO_MAX_POOL_SIZE=50`
3. Nếu `userLookupAwaitMs` vẫn cao, đo Mongo driver command monitoring/checkout wait nếu cần.
4. Nếu `maintenanceReadMs` cao, bật debug cache ngắn hạn hoặc đo riêng maintenance cache hit/miss.
5. Chưa đổi login runtime sang `.lean()` cho tới khi tách flow email verification hoặc chứng minh không cần Mongoose document.

## Rollback plan

Rollback runtime:

- Tắt log pipeline bằng `SIGNIN_PIPELINE_TIMING_ENABLED=false`.
- Không chạy script benchmark.

Rollback code:

- Gỡ các field timing mới trong `signInUser`.
- Gỡ optional timing param trong `ensureMaintenanceAccess`.
- Gỡ các field mới khỏi `signin-pipeline-timing.js`.
- Xóa `backend/scripts/user-lookup-concurrency-benchmark.js`.

Các thay đổi hiện tại chỉ thêm đo lường và script benchmark, không đổi response public.
