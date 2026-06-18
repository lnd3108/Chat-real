# Báo cáo Login Performance Phase 1C

Ngày thực hiện: 2026-06-16

## Mục tiêu phase

Tối ưu valid login dưới tải sau khi Redis Session Fast Path đã giảm `createSessionTotalMs` xuống còn vài ms.

Trọng tâm của phase này:

- Thêm cấu hình MongoDB connection pool qua env để có thể benchmark 25-50 VUs linh hoạt.
- Giảm payload query login bằng `.select()` nhưng không đổi response.
- Giữ `[AuthTiming]` chỉ bật khi `AUTH_TIMING_DEBUG=true`.
- Không triển khai Redis Phase 2, không cache conversation/message/friend/dashboard.

## File đã đọc

- `report/LOGIN_PERFORMANCE_PHASE1A_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1B_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1C0_REPORT.md`
- `backend/src/shared/infrastructure/db/connect-db.js`
- `backend/src/models/User.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/modules/auth/infrastructure/token.service.js`
- `backend/src/modules/auth/infrastructure/auth-timing.js`
- `backend/src/utils/sanitizeUser.js`
- `backend/src/shared/domain/rbac/access-policy.js`
- `backend/src/modules/auth/infrastructure/maintenance-access.service.js`

## File đã sửa

- `backend/src/shared/infrastructure/db/connect-db.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `report/LOGIN_PERFORMANCE_PHASE1C_REPORT.md`

## Mongo pool env mới

Đã thêm hỗ trợ các biến môi trường sau:

| Env | Mongoose option | Ý nghĩa |
| --- | --- | --- |
| `MONGO_MAX_POOL_SIZE` | `maxPoolSize` | Số connection tối đa trong pool |
| `MONGO_MIN_POOL_SIZE` | `minPoolSize` | Số connection tối thiểu cần giữ |
| `MONGO_SERVER_SELECTION_TIMEOUT_MS` | `serverSelectionTimeoutMS` | Timeout chọn Mongo server |
| `MONGO_SOCKET_TIMEOUT_MS` | `socketTimeoutMS` | Timeout socket MongoDB |

Behavior mặc định được giữ nguyên: nếu env không được set hoặc không phải số nguyên hợp lệ, option đó không được truyền vào `mongoose.connect()`, Mongoose dùng default hiện tại.

Backend có log an toàn:

```text
[MongoDB] Pool config: { maxPoolSize, minPoolSize, serverSelectionTimeoutMS, socketTimeoutMS }
```

Log này không in `MONGODB_CONNECTIONSTRING`.

## Query login trước/sau

Trước Phase 1C:

```js
User.findOne({ userName: userName.toLowerCase() })
```

Sau Phase 1C:

```js
const userLookupFilter = { userName: userName.toLowerCase() };
const userQuery = User.findOne(userLookupFilter);
const user =
  typeof userQuery?.select === "function"
    ? await userQuery.select(LOGIN_USER_SELECT)
    : await userQuery;
```

`LOGIN_USER_SELECT` gồm:

```text
_id
userName
displayName
email
avatarUrl
authProvider
emailVerified
emailVerificationCodeHash
emailVerificationExpiresAt
emailVerificationLastSentAt
phone
bio
role
roles
permissions
status
hashedPassword
createdAt
updatedAt
```

## Có dùng `.select()` không?

Có.

Mục đích:

- Giảm dữ liệu không cần thiết được hydrate trong login path.
- Vẫn giữ đủ field cho `bcrypt.compare`, maintenance/RBAC, email verification flow, realtime lifecycle và `buildAuthResponse`.

Các field RBAC `role`, `roles`, `permissions` được giữ vì `sanitizeAuthResponse()` gọi `serializeUserAccess()`.

Các field email verification `emailVerificationCodeHash`, `emailVerificationExpiresAt`, `emailVerificationLastSentAt` được giữ vì nhánh local user chưa xác minh có thể gọi `sendEmailVerificationForUser(user)` và `user.save()`.

## Có dùng `.lean()` không?

Không.

Lý do:

- Nhánh email chưa xác minh cần Mongoose document để set field verification và gọi `user.save()`.
- Dùng `.lean()` trong phase này có rủi ro phá behavior của flow verification.
- Phase này chỉ giảm payload bằng `.select()`, chưa đổi kiểu dữ liệu trả về.

## Timing mới

Trong `signInUser`, log timing vẫn chỉ xuất hiện khi:

```text
AUTH_TIMING_DEBUG=true
```

Các field liên quan login lookup:

- `userPayloadBuildMs`
- `userLookupQueryMs`
- `findUserMs` giữ lại để tương thích đọc log Phase 1A/1B
- `bcryptMs`
- `maintenanceCheckMs`
- `createSessionTotalMs`
- `totalSigninMs`

Không log password, token, cookie, Authorization header, raw payload, email hoặc userName.

## Cách chạy backend với pool config

```bash
cd /d/HHTL/ChatRealTime/backend

export UV_THREADPOOL_SIZE=32
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1c
export CACHE_ENABLED=true
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_BYPASS=true
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=false
export AUTH_REDIS_SESSION_ENABLED=true
export MONGO_MAX_POOL_SIZE=50
export MONGO_MIN_POOL_SIZE=5
export MONGO_SERVER_SELECTION_TIMEOUT_MS=5000
export MONGO_SOCKET_TIMEOUT_MS=45000

npm run dev
```

PowerShell tương đương:

```powershell
$env:UV_THREADPOOL_SIZE="32"
$env:NODE_ENV="development"
$env:REDIS_ENABLED="true"
$env:REDIS_HOST="127.0.0.1"
$env:REDIS_PORT="6379"
$env:REDIS_KEY_PREFIX="chatrt:phase1c"
$env:CACHE_ENABLED="true"
$env:RATE_LIMIT_ENABLED="true"
$env:RATE_LIMIT_BYPASS="true"
$env:LOAD_TEST="true"
$env:AUTH_TIMING_DEBUG="false"
$env:AUTH_REDIS_SESSION_ENABLED="true"
$env:MONGO_MAX_POOL_SIZE="50"
$env:MONGO_MIN_POOL_SIZE="5"
$env:MONGO_SERVER_SELECTION_TIMEOUT_MS="5000"
$env:MONGO_SOCKET_TIMEOUT_MS="45000"
npm run dev
```

## Kết quả test

Lệnh bắt buộc đã chạy:

```powershell
cd backend
npm test
```

Kết quả:

```text
Error: spawn EPERM
```

Đây là lỗi Jest worker trên Windows/sandbox đã gặp ở các phase trước.

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

Ghi chú: lần chạy fallback đầu tiên phát hiện mock test `User.findOne` không hỗ trợ `.select()`. Đã điều chỉnh code để tương thích cả Mongoose query thật và mock test:

```js
typeof userQuery?.select === "function"
  ? await userQuery.select(LOGIN_USER_SELECT)
  : await userQuery
```

## Lệnh k6 cần chạy

Terminal backend:

```bash
cd /d/HHTL/ChatRealTime/backend

export UV_THREADPOOL_SIZE=32
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1c
export CACHE_ENABLED=true
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_BYPASS=true
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=false
export AUTH_REDIS_SESSION_ENABLED=true
export MONGO_MAX_POOL_SIZE=50
export MONGO_MIN_POOL_SIZE=5
export MONGO_SERVER_SELECTION_TIMEOUT_MS=5000
export MONGO_SOCKET_TIMEOUT_MS=45000

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

export VUS=10
k6 run tests/load/login-compare-test.js

export VUS=25
k6 run tests/load/login-compare-test.js

export VUS=50
k6 run tests/load/login-compare-test.js
```

Kỳ vọng:

- Không còn spam `[AuthTiming]` khi `AUTH_TIMING_DEBUG=false`.
- Login response giữ nguyên.
- Redis session vẫn là hot path.
- `p95` valid login giảm so với baseline Phase 1C.0 khoảng `2.64s` ở 50 VUs nếu bottleneck có liên quan tới Mongo pool/payload.

## Nếu p95 vẫn cao

Nếu sau Phase 1C, valid login 50 VUs vẫn quanh 2-3s:

- Kiểm tra Node single process và cân nhắc Node cluster/PM2.
- Kiểm tra bcrypt cost và libuv worker pool dưới tải.
- Benchmark nhiều user thay vì dồn toàn bộ vào một credential `vanh`.
- Đo event loop delay và CPU saturation.
- Cân nhắc tách auth worker hoặc giới hạn concurrency login hợp lý.

## Rollback plan

Rollback Mongo pool config:

- Gỡ các env `MONGO_MAX_POOL_SIZE`, `MONGO_MIN_POOL_SIZE`, `MONGO_SERVER_SELECTION_TIMEOUT_MS`, `MONGO_SOCKET_TIMEOUT_MS`.
- Restart backend để Mongoose dùng default.

Rollback query select:

- Đưa login query về:

```js
User.findOne({ userName: userName.toLowerCase() })
```

Rollback timing:

- Không cần rollback runtime nếu không muốn log: giữ `AUTH_TIMING_DEBUG=false`.

## Kết luận

Phase 1C đã thêm khả năng tinh chỉnh Mongo pool an toàn và giảm payload login query bằng `.select()` mà không đổi response hoặc Redis session behavior. Kết quả test tự động đã pass với Jest `--runInBand`. Cần chạy lại k6 ở 10/25/50 VUs để xác nhận tác động thực tế lên p95.
