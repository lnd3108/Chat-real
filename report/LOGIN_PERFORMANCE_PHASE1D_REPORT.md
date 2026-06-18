# Báo cáo Login Performance Phase 1D

Ngày thực hiện: 2026-06-16

## Mục tiêu phase

Đo Node process saturation khi valid login tăng từ 10 lên 25/50 VUs, tập trung vào CPU, bcrypt concurrency, event loop delay và dấu hiệu nghẽn một Node process.

Phase này chỉ thêm instrumentation an toàn. Không triển khai Node cluster/PM2 production, không thay đổi business logic login, Redis session, cookie/Bearer flow, rate limit, maintenance cache, Socket.IO hoặc Redis Phase 2.

## File đã đọc

- `report/LOGIN_PERFORMANCE_PHASE1A_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1B_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1C0_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1C_REPORT.md`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/shared/infrastructure/db/connect-db.js`
- `backend/src/app/server.js`
- `backend/src/server.js`
- `backend/package.json`

## File đã sửa

- `backend/src/app/server.js`
- `backend/src/shared/infrastructure/perf/perf-monitor.js`
- `backend/scripts/bcrypt-concurrency-benchmark.js`
- `report/LOGIN_PERFORMANCE_PHASE1D_REPORT.md`

## Env flag mới

| Env | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PERF_MONITOR_ENABLED` | `false` | Bật log định kỳ `[PerfMonitor]` khi bằng `true` |
| `PERF_MONITOR_INTERVAL_MS` | `5000` | Khoảng cách log monitor, đơn vị ms |
| `BCRYPT_CONCURRENCY_LIST` | `10,25,50` | Danh sách concurrency cho script benchmark bcrypt |
| `BCRYPT_ROUNDS` | `10` | Cost dùng để tạo hash synthetic trong script benchmark |

`PERF_MONITOR_ENABLED` không phụ thuộc `LOAD_TEST`.

## Chỉ số đo được

`[PerfMonitor]` log JSON gọn với các field:

- `uptimeSec`: thời gian process đã chạy.
- `intervalMs`: chu kỳ đo.
- `eventLoopUtilization`: mức sử dụng event loop trong interval.
- `eventLoopDelayMeanMs`: delay trung bình của event loop.
- `eventLoopDelayP95Ms`: p95 delay của event loop.
- `eventLoopDelayMaxMs`: delay lớn nhất của event loop trong interval.
- `cpuUserMs`: CPU user time tăng thêm trong interval.
- `cpuSystemMs`: CPU system time tăng thêm trong interval.
- `rssMb`: resident memory.
- `heapUsedMb`: heap đang dùng.
- `heapTotalMb`: tổng heap.
- `externalMb`: external memory.
- `activeHandles`: số active handles nếu Node cho phép đọc.
- `activeRequests`: số active requests nếu Node cho phép đọc.

Không log token, password, cookie, userName, email, raw payload hoặc connection string.

## Cách chạy backend với perf monitor

```bash
cd /d/HHTL/ChatRealTime/backend

export UV_THREADPOOL_SIZE=32
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1d
export CACHE_ENABLED=true
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_BYPASS=true
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=false
export AUTH_REDIS_SESSION_ENABLED=true
export MONGO_MAX_POOL_SIZE=50
export MONGO_MIN_POOL_SIZE=5
export PERF_MONITOR_ENABLED=true

npm run dev
```

PowerShell:

```powershell
$env:UV_THREADPOOL_SIZE="32"
$env:NODE_ENV="development"
$env:REDIS_ENABLED="true"
$env:REDIS_HOST="127.0.0.1"
$env:REDIS_PORT="6379"
$env:REDIS_KEY_PREFIX="chatrt:phase1d"
$env:CACHE_ENABLED="true"
$env:RATE_LIMIT_ENABLED="true"
$env:RATE_LIMIT_BYPASS="true"
$env:LOAD_TEST="true"
$env:AUTH_TIMING_DEBUG="false"
$env:AUTH_REDIS_SESSION_ENABLED="true"
$env:MONGO_MAX_POOL_SIZE="50"
$env:MONGO_MIN_POOL_SIZE="5"
$env:PERF_MONITOR_ENABLED="true"
npm run dev
```

Ví dụ log:

```text
[PerfMonitor] {"uptimeSec":12.345,"intervalMs":5000,"eventLoopUtilization":0.82,"eventLoopDelayP95Ms":45.2,"eventLoopDelayMaxMs":130.5,"cpuUserMs":4870,"cpuSystemMs":120,"rssMb":180.4,"heapUsedMb":75.3,"activeHandles":12,"activeRequests":0}
```

## Lệnh k6 10/25/50 VUs

```bash
cd /d/HHTL/ChatRealTime

export BASE_URL=http://127.0.0.1:5001
export LOAD_TEST=true
export NODE_ENV=development
export MODE=valid
export TEST_USERNAME=vanh
export TEST_PASSWORD=1234567

export VUS=10
k6 run tests/load/login-compare-test.js

export VUS=25
k6 run tests/load/login-compare-test.js

export VUS=50
k6 run tests/load/login-compare-test.js
```

## Benchmark bcrypt concurrency

Script mới:

```bash
cd /d/HHTL/ChatRealTime/backend

export UV_THREADPOOL_SIZE=32
export BCRYPT_ROUNDS=10
export BCRYPT_CONCURRENCY_LIST=10,25,50
node scripts/bcrypt-concurrency-benchmark.js
```

Script dùng password và hash synthetic, không dùng mật khẩu thật và không in hash ra log.

Output gồm:

- `totalMs`
- `avgMs`
- `p50Ms`
- `p95Ms`
- `maxMs`
- `uvThreadpoolSize`
- `rounds`

## Kết quả kiểm thử

### npm test

Lệnh bắt buộc:

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

### Smoke PerfMonitor

Lệnh:

```powershell
$env:PERF_MONITOR_ENABLED='true'
$env:PERF_MONITOR_INTERVAL_MS='200'
node --input-type=module -e "import { startPerfMonitor } from './backend/src/shared/infrastructure/perf/perf-monitor.js'; const stop = startPerfMonitor(); setTimeout(() => { stop(); }, 450); setTimeout(() => {}, 600);"
```

Kết quả:

```text
[PerfMonitor] Started { intervalMs: 200 }
[PerfMonitor] {"uptimeSec":0.243,"intervalMs":200,"eventLoopUtilization":0.0215,"eventLoopDelayMeanMs":22.37,"eventLoopDelayP95Ms":30.441,"eventLoopDelayMaxMs":30.441,"cpuUserMs":0,"cpuSystemMs":15,"rssMb":48.66,"heapUsedMb":4.74,"heapTotalMb":5.55,"externalMb":1.76,"activeHandles":2,"activeRequests":0}
[PerfMonitor] Stopped
```

### Smoke bcrypt benchmark

Lệnh smoke nhẹ:

```powershell
$env:BCRYPT_CONCURRENCY_LIST='2,3'
$env:BCRYPT_ROUNDS='4'
node scripts/bcrypt-concurrency-benchmark.js
```

Kết quả:

```json
{
  "rounds": 4,
  "uvThreadpoolSize": "default",
  "concurrencyList": [2, 3],
  "results": [
    { "concurrency": 2, "totalMs": 1.05, "avgMs": 0.976, "p50Ms": 0.936, "p95Ms": 1.015, "maxMs": 1.015 },
    { "concurrency": 3, "totalMs": 0.95, "avgMs": 0.923, "p50Ms": 0.921, "p95Ms": 0.939, "maxMs": 0.939 }
  ]
}
```

Smoke chỉ xác nhận script hoạt động. Cần chạy lại với `BCRYPT_ROUNDS=10` và concurrency `10,25,50` để so với k6 thật.

## Cách đọc kết quả

Nếu `eventLoopDelayP95Ms` hoặc `eventLoopDelayMaxMs` tăng mạnh khi 25/50 VUs:

- Node event loop đang bị nghẽn.
- Kiểm tra synchronous work trong request path.
- Cân nhắc Node cluster/PM2 sau khi xử lý Socket.IO adapter/sticky session.

Nếu `eventLoopUtilization` tiến gần `1.0` và `cpuUserMs` gần bằng `intervalMs` hoặc cao hơn nhiều do nhiều core accounting:

- Process đang dùng CPU rất cao.
- Với valid login, bcrypt/libuv là nghi vấn chính.
- So sánh với script bcrypt concurrency để xem p95 bcrypt đơn lẻ có cùng biên độ với p95 k6 không.

Nếu bcrypt benchmark p95 tăng mạnh từ concurrency 10 lên 25/50:

- Bcrypt/libuv threadpool là bottleneck lớn.
- Thử benchmark với `UV_THREADPOOL_SIZE=16` và `32`.
- Nếu vẫn nghẽn, cân nhắc cluster/PM2 hoặc tách auth worker.

Nếu active requests/handles tăng đều và không giảm:

- Có thể có request bị giữ lâu hoặc tài nguyên chưa được giải phóng.
- Cần soi thêm connection, timeout và socket behavior.

Nếu event loop delay thấp nhưng k6 p95 vẫn cao:

- Nghiêng về libuv threadpool, CPU bcrypt hoặc upstream Mongo/Redis wait.
- Bật `AUTH_TIMING_DEBUG=true` trong một lượt ngắn để lấy mẫu, không bật trong toàn bộ k6 dài.

## Kết luận đề xuất

Chưa nên bật Node cluster/PM2 production trong Phase 1D. Dự án có Socket.IO/presence/call realtime, nên cluster production cần chuẩn bị:

- Redis Socket.IO adapter.
- Sticky session ở load balancer/proxy.
- Kiểm tra presence/call state khi nhiều instance.

Nếu k6 25/50 VUs cho thấy CPU/event loop/bcrypt bão hòa rõ rệt, Phase 1E nên là benchmark Node cluster/PM2 trong môi trường dev/staging có kiểm soát, kèm kế hoạch Redis Socket.IO adapter/sticky session trước khi đưa production.

## Rollback plan

Rollback runtime:

- Set `PERF_MONITOR_ENABLED=false` hoặc bỏ biến này.
- Không cần đổi code để tắt monitor.

Rollback code:

- Gỡ import và lời gọi `startPerfMonitor()` trong `backend/src/app/server.js`.
- Xóa `backend/src/shared/infrastructure/perf/perf-monitor.js`.
- Xóa `backend/scripts/bcrypt-concurrency-benchmark.js` nếu không cần giữ script benchmark.

Khi `PERF_MONITOR_ENABLED` không bằng `true`, monitor không tạo interval và không log `[PerfMonitor]`.
