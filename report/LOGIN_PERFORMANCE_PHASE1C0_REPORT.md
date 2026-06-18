# Báo cáo Login Performance Phase 1C.0

Ngày thực hiện: 2026-06-16

## Mục tiêu phase

Tách log `[AuthTiming]` khỏi biến môi trường `LOAD_TEST`.

Sau thay đổi này:

- `LOAD_TEST=true` chỉ còn phục vụ chế độ load test, bypass/rate-limit/email theo logic hiện có của dự án.
- `[AuthTiming]` chỉ được in khi `AUTH_TIMING_DEBUG=true`.
- Không thay đổi auth response, cookie name, Bearer flow, refresh token behavior, Redis session Phase 1B, rate limit, maintenance cache, Socket.IO, BullMQ/Kafka hoặc các cache API đọc nhiều.

## File đã đọc

- `backend/src/modules/auth/infrastructure/auth-timing.js`
- `backend/src/modules/auth/infrastructure/token.service.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `report/LOGIN_PERFORMANCE_PHASE1A_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1B_REPORT.md`

## File đã sửa

- `backend/src/modules/auth/infrastructure/auth-timing.js`
- `report/LOGIN_PERFORMANCE_PHASE1C0_REPORT.md`

## Logic cũ và logic mới

Logic cũ:

```js
process.env.LOAD_TEST === "true" || process.env.AUTH_TIMING_DEBUG === "true"
```

Hệ quả: khi chạy k6 với `LOAD_TEST=true`, backend tự in rất nhiều dòng `[AuthTiming]`, có thể làm nhiễu latency trên Windows terminal.

Logic mới:

```js
process.env.AUTH_TIMING_DEBUG === "true"
```

Hệ quả: chạy k6 với `LOAD_TEST=true` sẽ không tự bật `[AuthTiming]`. Muốn đo chi tiết signin thì bật riêng `AUTH_TIMING_DEBUG=true`.

## Cách bật/tắt AuthTiming

Bật log timing:

```bash
export AUTH_TIMING_DEBUG=true
```

Tắt log timing:

```bash
export AUTH_TIMING_DEBUG=false
```

Hoặc không set biến `AUTH_TIMING_DEBUG`.

Lưu ý: `LOAD_TEST=true` không còn bật `[AuthTiming]`.

## Chính sách dữ liệu nhạy cảm

Thay đổi này không thêm trường log mới.

Các log hiện tại vẫn không ghi:

- password
- accessToken
- refreshToken
- cookie value
- Authorization header
- raw user payload
- hashedPassword
- email/userName

## Kiểm thử đã chạy

### Smoke test: chỉ có LOAD_TEST=true

Lệnh đã chạy:

```powershell
$env:LOAD_TEST='true'
$env:AUTH_TIMING_DEBUG='false'
node --input-type=module -e "import { shouldLogAuthTiming } from './backend/src/modules/auth/infrastructure/auth-timing.js'; console.log(JSON.stringify({ loadTest: process.env.LOAD_TEST, authTimingDebug: process.env.AUTH_TIMING_DEBUG, shouldLogAuthTiming: shouldLogAuthTiming() }));"
```

Kết quả:

```json
{"loadTest":"true","authTimingDebug":"false","shouldLogAuthTiming":false}
```

### Smoke test: AUTH_TIMING_DEBUG=true

Lệnh đã chạy:

```powershell
$env:LOAD_TEST='true'
$env:AUTH_TIMING_DEBUG='true'
node --input-type=module -e "import { shouldLogAuthTiming } from './backend/src/modules/auth/infrastructure/auth-timing.js'; console.log(JSON.stringify({ loadTest: process.env.LOAD_TEST, authTimingDebug: process.env.AUTH_TIMING_DEBUG, shouldLogAuthTiming: shouldLogAuthTiming() }));"
```

Kết quả:

```json
{"loadTest":"true","authTimingDebug":"true","shouldLogAuthTiming":true}
```

### Smoke test: logAuthTiming không in khi debug tắt

Lệnh đã chạy:

```powershell
$env:LOAD_TEST='true'
$env:AUTH_TIMING_DEBUG='false'
node --input-type=module -e "import { logAuthTiming } from './backend/src/modules/auth/infrastructure/auth-timing.js'; logAuthTiming('smoke_no_debug', { ok: true }); console.log('done');"
```

Kết quả:

```text
done
```

Không có dòng `[AuthTiming]`.

### Smoke test: logAuthTiming có in khi debug bật

Lệnh đã chạy:

```powershell
$env:LOAD_TEST='true'
$env:AUTH_TIMING_DEBUG='true'
node --input-type=module -e "import { logAuthTiming } from './backend/src/modules/auth/infrastructure/auth-timing.js'; logAuthTiming('smoke_debug', { ok: true }); console.log('done');"
```

Kết quả:

```text
[AuthTiming] {"phase":"smoke_debug","ok":true}
done
```

## Kết quả test backend

Lệnh theo yêu cầu:

```powershell
cd backend
npm test
```

Kết quả:

```text
Error: spawn EPERM
```

Đây là lỗi Jest worker trên Windows/sandbox đã từng gặp trước đó.

Lệnh fallback đã chạy:

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

## Lệnh k6 cần chạy lại

Terminal backend:

```bash
cd /d/HHTL/ChatRealTime/backend

export UV_THREADPOOL_SIZE=32
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1c0
export CACHE_ENABLED=true
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_BYPASS=true
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=false
export AUTH_REDIS_SESSION_ENABLED=true

npm run dev
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
export VUS=50

k6 run tests/load/login-compare-test.js
```

Kỳ vọng:

- Terminal backend không còn spam `[AuthTiming]`.
- `LOAD_TEST=true` vẫn giữ đúng vai trò load-test mode.
- Nếu p95 giảm rõ so với Phase 1B khoảng 2.73s, console log là một phần nguyên nhân gây nhiễu.
- Nếu p95 vẫn cao, chuyển sang Phase 1C chính để phân tích Mongo pool/query select/Node saturation.

## Rollback plan

Rollback code:

- Đưa `shouldLogAuthTiming()` về logic cũ nếu thật sự cần:

```js
process.env.LOAD_TEST === "true" || process.env.AUTH_TIMING_DEBUG === "true"
```

Rollback runtime không cần deploy:

- Nếu muốn tắt log: set `AUTH_TIMING_DEBUG=false` hoặc bỏ biến này.
- Nếu muốn bật log trong lúc k6: set `AUTH_TIMING_DEBUG=true`.

## Ghi chú

Các báo cáo Phase 1A/1B vẫn giữ lại thông tin lịch sử rằng trước đây `[AuthTiming]` có thể bật theo `LOAD_TEST=true`. Từ Phase 1C.0 trở đi, báo cáo này là nguồn tham chiếu mới cho cách bật/tắt AuthTiming.
