# Báo cáo Login Performance Phase 1E

Ngày thực hiện: 2026-06-16

## Mục tiêu phase

Tạo đường chạy benchmark Node cluster ở dev/local để so sánh login CPU-bound giữa single process, 2 workers và 4 workers.

Phase này không triển khai cluster production. Mục tiêu chỉ là benchmark HTTP login local/dev sau khi các phase trước đã:

- Chuyển refresh session hot path sang Redis.
- Thêm Mongo pool env và `.select()` cho login query.
- Tách `[AuthTiming]` khỏi `LOAD_TEST`.
- Thêm `[PerfMonitor]` để đo CPU/event loop/memory.

## File đã đọc

- `report/LOGIN_PERFORMANCE_PHASE1A_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1B_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1C_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1D_REPORT.md`
- `backend/src/server.js`
- `backend/src/app/server.js`
- `backend/src/app/socket/initSocket.js`
- `backend/package.json`

## File đã sửa

- `backend/src/cluster-server.js`
- `backend/src/shared/infrastructure/perf/perf-monitor.js`
- `backend/package.json`
- `report/LOGIN_PERFORMANCE_PHASE1E_REPORT.md`

## Thay đổi đã thêm

### Entry cluster dev

Thêm file:

```text
backend/src/cluster-server.js
```

Behavior:

- Nếu `CLUSTER_ENABLED` không bằng `true`, chạy single process qua `startServer()` như cũ.
- Nếu `CLUSTER_ENABLED=true` và `CLUSTER_WORKERS > 1`, process primary fork số worker tương ứng.
- Worker chạy cùng `startServer()` hiện tại.
- Worker chết ngoài ý muốn sẽ được restart để benchmark ổn định hơn.

### Script npm mới

Thêm script:

```json
"start:cluster": "node src/cluster-server.js"
```

Các script cũ giữ nguyên:

- `npm run dev`
- `npm start`
- `npm test`

### PerfMonitor trong cluster

`[PerfMonitor]` đã thêm:

- `pid`
- `workerId`

Ví dụ:

```text
[PerfMonitor] {"pid":29812,"workerId":null,"uptimeSec":0.247,"intervalMs":200,"eventLoopUtilization":0.0172}
```

Trong cluster worker, `workerId` sẽ là id của worker Node cluster.

## Cách chạy single process baseline

```bash
cd /d/HHTL/ChatRealTime/backend

export UV_THREADPOOL_SIZE=32
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1e-single
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

Baseline kỳ vọng hiện tại:

- 10 VUs p95 khoảng 147ms.
- 25 VUs p95 khoảng 913ms.
- 50 VUs p95 khoảng 2.09s.

## Cách chạy cluster 2 workers

```bash
cd /d/HHTL/ChatRealTime/backend

export CLUSTER_ENABLED=true
export CLUSTER_WORKERS=2
export UV_THREADPOOL_SIZE=16
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1e-c2
export CACHE_ENABLED=true
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_BYPASS=true
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=false
export AUTH_REDIS_SESSION_ENABLED=true
export MONGO_MAX_POOL_SIZE=50
export MONGO_MIN_POOL_SIZE=5
export PERF_MONITOR_ENABLED=true

npm run start:cluster
```

PowerShell:

```powershell
$env:CLUSTER_ENABLED="true"
$env:CLUSTER_WORKERS="2"
$env:UV_THREADPOOL_SIZE="16"
$env:NODE_ENV="development"
$env:REDIS_ENABLED="true"
$env:REDIS_HOST="127.0.0.1"
$env:REDIS_PORT="6379"
$env:REDIS_KEY_PREFIX="chatrt:phase1e-c2"
$env:CACHE_ENABLED="true"
$env:RATE_LIMIT_ENABLED="true"
$env:RATE_LIMIT_BYPASS="true"
$env:LOAD_TEST="true"
$env:AUTH_TIMING_DEBUG="false"
$env:AUTH_REDIS_SESSION_ENABLED="true"
$env:MONGO_MAX_POOL_SIZE="50"
$env:MONGO_MIN_POOL_SIZE="5"
$env:PERF_MONITOR_ENABLED="true"
npm run start:cluster
```

## Cách chạy cluster 4 workers

```bash
cd /d/HHTL/ChatRealTime/backend

export CLUSTER_ENABLED=true
export CLUSTER_WORKERS=4
export UV_THREADPOOL_SIZE=8
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1e-c4
export CACHE_ENABLED=true
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_BYPASS=true
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=false
export AUTH_REDIS_SESSION_ENABLED=true
export MONGO_MAX_POOL_SIZE=80
export MONGO_MIN_POOL_SIZE=5
export PERF_MONITOR_ENABLED=true

npm run start:cluster
```

PowerShell:

```powershell
$env:CLUSTER_ENABLED="true"
$env:CLUSTER_WORKERS="4"
$env:UV_THREADPOOL_SIZE="8"
$env:NODE_ENV="development"
$env:REDIS_ENABLED="true"
$env:REDIS_HOST="127.0.0.1"
$env:REDIS_PORT="6379"
$env:REDIS_KEY_PREFIX="chatrt:phase1e-c4"
$env:CACHE_ENABLED="true"
$env:RATE_LIMIT_ENABLED="true"
$env:RATE_LIMIT_BYPASS="true"
$env:LOAD_TEST="true"
$env:AUTH_TIMING_DEBUG="false"
$env:AUTH_REDIS_SESSION_ENABLED="true"
$env:MONGO_MAX_POOL_SIZE="80"
$env:MONGO_MIN_POOL_SIZE="5"
$env:PERF_MONITOR_ENABLED="true"
npm run start:cluster
```

## Lệnh k6 cho mỗi mode

Chạy cùng bộ lệnh này cho single process, cluster 2 workers và cluster 4 workers:

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

Ghi lại cho từng mode:

- `http_req_duration avg/med/p90/p95`
- `http_req_failed`
- `[PerfMonitor]` theo từng `pid`/`workerId`
- phân bố CPU giữa workers
- có worker restart hay không

## Cách đọc kết quả

Nếu cluster 2/4 workers giảm p95 rõ ở 25/50 VUs:

- Bottleneck rất có khả năng nằm ở CPU/bcrypt/libuv concurrency.
- Phase tiếp theo có thể benchmark production-like cluster/PM2, nhưng cần xử lý Socket.IO trước.

Nếu cluster không cải thiện nhiều:

- Kiểm tra bcrypt cost, credential test chỉ dùng một user, Mongo/Redis latency, client connection reuse hoặc giới hạn CPU máy local.
- So sánh với `backend/scripts/bcrypt-concurrency-benchmark.js`.

Nếu worker có `[PerfMonitor] cpuUserMs` cao nhưng event loop delay thấp:

- CPU/libuv worker pool bận, đúng với nghi vấn bcrypt.

Nếu event loop delay tăng mạnh:

- Có synchronous work khác trong request path hoặc logging/terminal/GC gây nghẽn.

## Cảnh báo Socket.IO production

Cluster trong Phase 1E chỉ phục vụ benchmark HTTP login local/dev.

Không được xem cấu hình này là production-ready cho realtime vì dự án đang có Socket.IO, presence, call signaling và room state trong memory từng process.

Trước khi production cluster/PM2 cần:

- Redis Socket.IO adapter.
- Sticky session ở reverse proxy/load balancer.
- Kiểm thử login/refresh/logout song song với Socket.IO connect.
- Kiểm thử presence online/offline nhiều instance.
- Kiểm thử chat room join/leave nhiều instance.
- Kiểm thử call signaling/group call khi user nằm trên worker khác nhau.
- Kiểm thử admin dashboard realtime events.

## Kết quả test

### Kiểm tra cú pháp

Lệnh:

```powershell
cd backend
node --check src/cluster-server.js
node --check src/shared/infrastructure/perf/perf-monitor.js
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

### Smoke PerfMonitor

Lệnh:

```powershell
$env:PERF_MONITOR_ENABLED='true'
$env:PERF_MONITOR_INTERVAL_MS='200'
node --input-type=module -e "import { startPerfMonitor } from './backend/src/shared/infrastructure/perf/perf-monitor.js'; const stop = startPerfMonitor(); setTimeout(() => { stop(); }, 260); setTimeout(() => {}, 360);"
```

Kết quả:

```text
[PerfMonitor] Started { intervalMs: 200, pid: 29812, workerId: null }
[PerfMonitor] {"pid":29812,"workerId":null,"uptimeSec":0.247,"intervalMs":200,"eventLoopUtilization":0.0172}
[PerfMonitor] Stopped { pid: 29812, workerId: null }
```

### Kiểm tra npm script

Lệnh:

```powershell
cd backend
npm run
```

Kết quả có script:

```text
start
dev
start:cluster
```

## Rollback plan

Rollback runtime:

- Không set `CLUSTER_ENABLED=true`.
- Dùng lại `npm run dev` hoặc `npm start`.

Rollback code:

- Xóa script `start:cluster` khỏi `backend/package.json`.
- Xóa `backend/src/cluster-server.js`.
- Nếu muốn bỏ phân biệt worker trong monitor, gỡ import `node:cluster` và field `pid`/`workerId` khỏi `backend/src/shared/infrastructure/perf/perf-monitor.js`.

Mặc định hiện tại vẫn là single process nên rollback runtime chỉ cần không dùng lệnh cluster.

## Kết luận

Phase 1E đã tạo đường benchmark cluster dev an toàn bằng Node cluster built-in, không thêm package và không thay đổi login business logic. Cần chạy k6 cho single/2 workers/4 workers để xác nhận p95 25/50 VUs có giảm như kỳ vọng hay không. Nếu cluster cải thiện rõ, bước tiếp theo là thiết kế Phase 1F cho Socket.IO adapter/sticky session trước khi nghĩ tới production cluster.
