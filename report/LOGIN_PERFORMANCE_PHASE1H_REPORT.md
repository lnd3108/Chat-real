# Báo cáo Login Performance Phase 1H

Ngày thực hiện: 2026-06-16

## Mục tiêu phase

Đo sâu MongoDB driver để xác định `userLookupAwaitMs` cao trong request thật đến từ:

- chờ checkout connection từ pool,
- Mongo command `find` trên collection `users` chạy chậm,
- queue nội bộ driver/Mongoose,
- hoặc yếu tố runtime cluster khác.

Phase này chỉ thêm monitoring an toàn. Không thay đổi auth response, cookie name, Bearer flow, refresh token behavior, Redis session behavior, rate limit behavior, maintenance cache behavior, Socket.IO hoặc cache conversation/message/friend/dashboard.

## File đã đọc

- `report/LOGIN_PERFORMANCE_PHASE1F_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1G_REPORT.md`
- `backend/src/shared/infrastructure/db/connect-db.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/shared/infrastructure/perf/signin-pipeline-timing.js`
- `backend/src/models/User.js`

## File đã sửa

- `backend/src/shared/infrastructure/db/connect-db.js`
- `backend/src/shared/infrastructure/perf/mongo-driver-monitor.js`
- `report/LOGIN_PERFORMANCE_PHASE1H_REPORT.md`

## Env flag mới

| Env | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `MONGO_POOL_MONITOR_ENABLED` | `false` | Bật aggregate Mongo pool event monitor |
| `MONGO_COMMAND_MONITOR_ENABLED` | `false` | Bật Mongo command monitoring |
| `MONGO_MONITOR_SAMPLE_RATE` | `0.02` | Tỷ lệ log command ngẫu nhiên |
| `MONGO_MONITOR_SLOW_MS` | `100` | Luôn log command có duration lớn hơn hoặc bằng ngưỡng |
| `MONGO_MONITOR_INTERVAL_MS` | `5000` | Chu kỳ log aggregate pool stats |

`monitorCommands: true` chỉ được truyền vào `mongoose.connect()` khi:

```text
MONGO_COMMAND_MONITOR_ENABLED=true
```

## Log format mới

### Command monitor

Prefix:

```text
[MongoCommandMonitor]
```

Ví dụ:

```json
{
  "pid": 35624,
  "workerId": null,
  "event": "commandSucceeded",
  "databaseName": "test",
  "collectionName": "users",
  "commandName": "find",
  "durationMs": 55,
  "requestId": 27,
  "connectionId": "3",
  "slow": true,
  "sampled": true
}
```

Chỉ track command:

```text
find trên collection users
```

Không log command payload, filter, userName, email, password, token, cookie, Authorization header hoặc raw body.

### Pool monitor

Prefix:

```text
[MongoPoolMonitor]
```

Ví dụ:

```json
{
  "pid": 35624,
  "workerId": null,
  "event": "poolStats",
  "intervalMs": 1000,
  "checkoutStarted": 6,
  "checkedOut": 6,
  "checkoutFailed": 0,
  "checkedIn": 6,
  "poolCreated": 0,
  "poolReady": 0,
  "poolCleared": 0,
  "approximateInUse": 0,
  "approximatePendingCheckout": 0
}
```

Pool monitor log aggregate theo interval vì Mongo driver events không map an toàn 1-1 tới từng HTTP signin request trong code hiện tại.

## Cách bật Mongo pool/command monitoring

Cluster 4, pool 50:

```bash
cd /d/HHTL/ChatRealTime/backend

export CLUSTER_ENABLED=true
export CLUSTER_WORKERS=4
export UV_THREADPOOL_SIZE=8
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1h-c4-p50
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
export MONGO_POOL_MONITOR_ENABLED=true
export MONGO_COMMAND_MONITOR_ENABLED=true
export MONGO_MONITOR_SAMPLE_RATE=0.02
export MONGO_MONITOR_SLOW_MS=100

npm run start:cluster 2>&1 | tee ../mongo-monitor-c4-p50.log
```

PowerShell tương đương:

```powershell
$env:CLUSTER_ENABLED="true"
$env:CLUSTER_WORKERS="4"
$env:UV_THREADPOOL_SIZE="8"
$env:NODE_ENV="development"
$env:REDIS_ENABLED="true"
$env:REDIS_HOST="127.0.0.1"
$env:REDIS_PORT="6379"
$env:REDIS_KEY_PREFIX="chatrt:phase1h-c4-p50"
$env:CACHE_ENABLED="true"
$env:RATE_LIMIT_ENABLED="true"
$env:RATE_LIMIT_BYPASS="true"
$env:LOAD_TEST="true"
$env:AUTH_TIMING_DEBUG="false"
$env:AUTH_REDIS_SESSION_ENABLED="true"
$env:MONGO_MAX_POOL_SIZE="50"
$env:MONGO_MIN_POOL_SIZE="5"
$env:PERF_MONITOR_ENABLED="true"
$env:SIGNIN_PIPELINE_TIMING_ENABLED="true"
$env:SIGNIN_PIPELINE_SAMPLE_RATE="0.02"
$env:SIGNIN_PIPELINE_SLOW_MS="500"
$env:MONGO_POOL_MONITOR_ENABLED="true"
$env:MONGO_COMMAND_MONITOR_ENABLED="true"
$env:MONGO_MONITOR_SAMPLE_RATE="0.02"
$env:MONGO_MONITOR_SLOW_MS="100"
npm run start:cluster
```

## Cách chạy k6 cluster 4 pool 20/50

Backend pool 20:

```bash
export MONGO_MAX_POOL_SIZE=20
export MONGO_MIN_POOL_SIZE=2
npm run start:cluster 2>&1 | tee ../mongo-monitor-c4-p20.log
```

Backend pool 50:

```bash
export MONGO_MAX_POOL_SIZE=50
export MONGO_MIN_POOL_SIZE=5
npm run start:cluster 2>&1 | tee ../mongo-monitor-c4-p50.log
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

Lọc log:

```bash
grep "\[SigninPipelineTiming\]" mongo-monitor-c4-p50.log > signin-pipeline-c4-p50-only.log
grep "\[Mongo" mongo-monitor-c4-p50.log > mongo-monitor-only.log
tail -n 40 signin-pipeline-c4-p50-only.log
tail -n 80 mongo-monitor-only.log
```

PowerShell lọc log:

```powershell
Select-String -Path ..\mongo-monitor-c4-p50.log -Pattern "\[SigninPipelineTiming\]" | Set-Content ..\signin-pipeline-c4-p50-only.log
Select-String -Path ..\mongo-monitor-c4-p50.log -Pattern "\[Mongo" | Set-Content ..\mongo-monitor-only.log
Get-Content ..\signin-pipeline-c4-p50-only.log -Tail 40
Get-Content ..\mongo-monitor-only.log -Tail 80
```

## Cách đọc log

Nếu `[MongoPoolMonitor]` có `approximatePendingCheckout` tăng cao:

- Worker đang chờ connection từ pool.
- Tăng pool size có thể giúp, nhưng phải tính tổng connection của 4 workers.
- So sánh pool 20 và pool 50.

Nếu `checkoutStarted` tăng nhanh nhưng `checkedOut` tăng chậm:

- Có dấu hiệu checkout wait hoặc pool contention.

Nếu `checkoutFailed` lớn hơn 0:

- Kiểm tra pool timeout, network, Mongo server capacity và `serverSelectionTimeoutMS`.

Nếu `[MongoCommandMonitor] durationMs` cao cho `find/users`:

- Mongo command thật đang chậm.
- Kiểm tra Mongo server metrics, disk/CPU/network, query plan và lock/wait.

Nếu command duration thấp nhưng `userLookupAwaitMs` trong `[SigninPipelineTiming]` cao:

- Nghiêng về Mongoose/driver queue, pool checkout wait, hoặc runtime cluster contention trước khi command được gửi.
- Đối chiếu cùng interval với `[MongoPoolMonitor] approximatePendingCheckout`.

Nếu cả command duration và pending checkout đều thấp nhưng `userLookupAwaitMs` cao:

- Cần đo thêm Mongoose middleware/hydration/runtime scheduling hoặc app-level async contention.
- Có thể thêm AsyncLocalStorage/request id trong phase sau để correlate command với signin request chính xác hơn.

## Kết quả test

### Kiểm tra cú pháp

Đã chạy:

```powershell
cd backend
node --check src/shared/infrastructure/perf/mongo-driver-monitor.js
node --check src/shared/infrastructure/db/connect-db.js
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

### Smoke Mongo monitor

Đã chạy smoke với:

```text
MONGO_COMMAND_MONITOR_ENABLED=true
MONGO_POOL_MONITOR_ENABLED=true
MONGO_MONITOR_SAMPLE_RATE=1
MONGO_MONITOR_SLOW_MS=0
MONGO_MONITOR_INTERVAL_MS=1000
```

Kết quả có log command và pool:

```text
[MongoCommandMonitor] {"pid":35624,"workerId":null,"event":"commandSucceeded","databaseName":"test","collectionName":"users","commandName":"find","durationMs":55,"requestId":27,"connectionId":"3","slow":true,"sampled":true}
[MongoPoolMonitor] {"pid":35624,"workerId":null,"event":"poolStats","intervalMs":1000,"checkoutStarted":6,"checkedOut":6,"checkoutFailed":0,"checkedIn":6,"poolCreated":0,"poolReady":0,"poolCleared":0,"approximateInUse":0,"approximatePendingCheckout":0}
```

Không có filter, userName, email, password, token, cookie hoặc Authorization header trong log.

## Kết luận

Phase 1H đã bổ sung driver-level monitoring để kiểm tra phần còn thiếu giữa `userLookupAwaitMs` và Mongo explain đơn lẻ.

Giới hạn hiện tại:

- Pool monitor là aggregate theo worker/interval, chưa map chính xác từng HTTP request.
- Command monitor track `find/users` metadata, không log query filter.
- `connectionPoolCreated`/`connectionPoolReady` có thể đã xảy ra trước khi monitor attach sau `mongoose.connect()`, nên counters này có thể là `0` trong smoke.

Nếu k6 cho thấy pending checkout cao, bước tiếp theo là tuning pool theo worker và tổng connection. Nếu command duration cao, điều tra Mongo server. Nếu cả hai thấp nhưng `userLookupAwaitMs` cao, bước tiếp theo nên là correlation sâu hơn bằng request id/AsyncLocalStorage hoặc đo Mongoose hydration/runtime scheduling.

## Rollback plan

Rollback runtime:

- Set `MONGO_POOL_MONITOR_ENABLED=false`.
- Set `MONGO_COMMAND_MONITOR_ENABLED=false`.
- Bỏ `MONGO_MONITOR_*` env.

Rollback code:

- Gỡ import và lời gọi `attachMongoDriverMonitoring()` trong `backend/src/shared/infrastructure/db/connect-db.js`.
- Gỡ `monitorCommands` khỏi Mongo options.
- Xóa `backend/src/shared/infrastructure/perf/mongo-driver-monitor.js`.

Mặc định monitor đang tắt, nên không ảnh hưởng production nếu không set env.
