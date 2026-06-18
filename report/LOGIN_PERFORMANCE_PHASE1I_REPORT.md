# ChatRealTime Backend - Login Performance Phase 1I

Ngày: 2026-06-16

## Mục tiêu

Thêm Redis cache an toàn cho auth user lookup trong `POST /api/auth/signin` để giảm áp lực MongoDB ở bước `User.findOne({ userName })`, không đổi auth response, cookie/Bearer flow, refresh token rotation, Redis session, Socket.IO, hoặc cache conversation/message/friend/dashboard.

## Tóm tắt kết quả

- Đã thêm cache helper riêng cho auth user lookup tại `backend/src/modules/auth/infrastructure/auth-user-lookup-cache.service.js`.
- Cache mặc định tắt, chỉ bật khi `AUTH_USER_LOOKUP_CACHE_ENABLED=true`, `REDIS_ENABLED=true`, và `CACHE_ENABLED=true`.
- Cache chỉ ghi user thỏa điều kiện `authProvider === "local"`, `emailVerified === true`, `status === "active"`.
- Redis lỗi, chưa ready, cache miss, parse lỗi, hoặc write lỗi đều fallback MongoDB và không làm fail login.
- Đã thêm timing fields vào `[SigninPipelineTiming]` để đo cache hit/miss/read/write.
- Đã thêm invalidation cho các flow đổi password, verify email, update profile/email, admin status, admin role, admin delete user, moderation ban/unban/delete-account.
- Không log password, token, cookie, Authorization header, raw user payload, raw username/email, hoặc raw Redis key trong helper auth user lookup.

## File đã đọc/tham chiếu

- `report/LOGIN_PERFORMANCE_PHASE1F_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1G_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1H_REPORT.md`
- `report/REDIS_PHASE1_REPORT.md`
- `report/REDIS_PHASE1_VALIDATION_REPORT.md`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/modules/auth/infrastructure/token.service.js`
- `backend/src/models/Session.js`
- `backend/src/modules/auth/api/http/auth.controller.js`
- `backend/src/shared/infrastructure/cache/cache.service.js`
- `backend/src/shared/infrastructure/cache/cache-keys.js`
- `backend/src/shared/infrastructure/redis/redis-client.js`
- `backend/src/shared/infrastructure/perf/signin-pipeline-timing.js`
- `backend/src/modules/auth/application/account-management.command-service.js`
- `backend/src/modules/auth/application/email-verification.command-service.js`
- `backend/src/services/emailChangeService.js`
- `backend/src/modules/admin-panel/application/user-management.service.js`
- `backend/src/services/adminRoleService.js`
- `backend/src/modules/moderation/application/report-admin.service.js`
- `backend/scripts/user-lookup-concurrency-benchmark.js`

## File đã sửa

- `backend/src/modules/auth/infrastructure/auth-user-lookup-cache.service.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/shared/infrastructure/perf/signin-pipeline-timing.js`
- `backend/scripts/user-lookup-concurrency-benchmark.js`
- `backend/src/modules/auth/application/account-management.command-service.js`
- `backend/src/modules/auth/application/email-verification.command-service.js`
- `backend/src/services/emailChangeService.js`
- `backend/src/modules/admin-panel/application/user-management.service.js`
- `backend/src/services/adminRoleService.js`
- `backend/src/modules/moderation/application/report-admin.service.js`

## Thiết kế cache

Key format:

```text
${REDIS_KEY_PREFIX}:auth:user-lookup:username:${normalizedUserName}
```

Ví dụ với `REDIS_KEY_PREFIX=chatrt:phase1i`:

```text
chatrt:phase1i:auth:user-lookup:username:vanh
```

Lưu ý bảo mật: key có chứa normalized username theo đúng yêu cầu task, nên helper auth lookup không dùng debug log key của cache service chung để tránh leak raw username/key.

Value cache là plain JSON user subset từ `LOGIN_USER_SELECT`, bao gồm cả `hashedPassword` vì `bcrypt.compare()` cần hash để verify password. Đây là rủi ro bảo mật cần kiểm soát bằng cách để cache opt-in, TTL ngắn, Redis private network/password/TLS nếu remote, và không log payload/key.

TTL mặc định: `AUTH_USER_LOOKUP_CACHE_TTL_SECONDS=60`.

## Signin flow sau Phase 1I

1. Normalize `userName.toLowerCase()`.
2. Nếu auth user lookup cache bật, đọc Redis key theo normalized username.
3. Hit thì dùng plain user từ Redis; miss/Redis unavailable/read error thì fallback Mongo.
4. Nếu không có cached user, query Mongo `User.findOne({ userName: normalizedUserName }).select(LOGIN_USER_SELECT)`.
5. Nếu user cacheable (`local`, `emailVerified`, `active`) thì ghi Redis với TTL.
6. Tiếp tục bcrypt, maintenance check, unverified email flow, session create như cũ.

## Timing fields mới

`[SigninPipelineTiming]` đã có thêm:

- `authUserCacheEnabled`
- `authUserCacheHit`
- `authUserCacheReadMs`
- `authUserCacheWriteMs`
- `authUserCacheFallbackReason`

`authUserCacheFallbackReason` có thể là `disabled`, `redis_unavailable`, `miss`, `read_error`, `write_error`, hoặc `not_cacheable`. Timing log không có raw username/email/key/payload.

## Invalidation đã thêm

| Flow | File | Cách invalidate | Lý do |
| --- | --- | --- | --- |
| Change password | `backend/src/modules/auth/application/account-management.command-service.js` | Theo `user.userName` sau khi save password mới | Cache có `hashedPassword`, phải xóa ngay |
| Verify signup/email | `backend/src/modules/auth/application/email-verification.command-service.js` | Theo `user.userName` sau khi `emailVerified=true` | Login eligibility thay đổi |
| Update profile không đổi email | `backend/src/services/emailChangeService.js` | Xóa username cũ và username mới | `displayName/userName/phone/bio` có thể nằm trong response |
| Verify email change/profile pending | `backend/src/services/emailChangeService.js` | Xóa username cũ và username mới | `email/emailVerified/userName/profile` thay đổi |
| Admin lock/unlock user | `backend/src/modules/admin-panel/application/user-management.service.js` | Theo `user.userName` sau khi save status | Login eligibility thay đổi |
| Admin delete user | `backend/src/modules/admin-panel/application/user-management.service.js` | Theo deleted user | Tránh stale login data |
| Admin role update | `backend/src/services/adminRoleService.js` | Theo updated user | Role/permissions trong auth response thay đổi |
| Moderation ban/unban/delete-account | `backend/src/modules/moderation/application/report-admin.service.js` | Theo `targetUserId` rồi lookup username để delete key | Status login thay đổi |

## Chưa làm trong Phase 1I

- Không cache missing user/negative lookup.
- Không cache unverified, banned, inactive, Google-only user.
- Không Redis session cutover.
- Không refresh token rotation.
- Không cache conversation/message/friend/dashboard.
- Không Redis Socket.IO adapter/presence.
- Không BullMQ/Kafka.

## Cách bật để test

PowerShell:

```powershell
$env:NODE_ENV="development"
$env:REDIS_ENABLED="true"
$env:REDIS_HOST="127.0.0.1"
$env:REDIS_PORT="6379"
$env:REDIS_KEY_PREFIX="chatrt:phase1i"
$env:CACHE_ENABLED="true"
$env:AUTH_USER_LOOKUP_CACHE_ENABLED="true"
$env:AUTH_USER_LOOKUP_CACHE_TTL_SECONDS="60"
$env:SIGNIN_PIPELINE_TIMING_ENABLED="true"
$env:SIGNIN_PIPELINE_SAMPLE_RATE="1"
$env:SIGNIN_PIPELINE_SLOW_MS="0"
$env:RATE_LIMIT_BYPASS="true"
$env:LOAD_TEST="true"
npm run dev
```

Bash:

```bash
export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase1i
export CACHE_ENABLED=true
export AUTH_USER_LOOKUP_CACHE_ENABLED=true
export AUTH_USER_LOOKUP_CACHE_TTL_SECONDS=60
export SIGNIN_PIPELINE_TIMING_ENABLED=true
export SIGNIN_PIPELINE_SAMPLE_RATE=1
export SIGNIN_PIPELINE_SLOW_MS=0
export RATE_LIMIT_BYPASS=true
export LOAD_TEST=true
npm run dev
```

## Lệnh k6 để so sánh cache off/on

Cache off baseline:

```bash
export BASE_URL=http://127.0.0.1:5001
export LOAD_TEST=true
export NODE_ENV=development
export MODE=valid
export TEST_USERNAME=vanh
export TEST_PASSWORD=1234567
export VUS=50
export AUTH_USER_LOOKUP_CACHE_ENABLED=false
k6 run tests/load/login-compare-test.js
```

Cache on:

```bash
export BASE_URL=http://127.0.0.1:5001
export LOAD_TEST=true
export NODE_ENV=development
export MODE=valid
export TEST_USERNAME=vanh
export TEST_PASSWORD=1234567
export VUS=50
export AUTH_USER_LOOKUP_CACHE_ENABLED=true
export CACHE_ENABLED=true
export REDIS_ENABLED=true
k6 run tests/load/login-compare-test.js
```

Kỳ vọng log:

```text
[SigninPipelineTiming] {"authUserCacheEnabled":true,"authUserCacheHit":false,...}
[SigninPipelineTiming] {"authUserCacheEnabled":true,"authUserCacheHit":true,...}
```

## Kết quả validation

| Hạng mục | Kết quả |
| --- | --- |
| `npm test` | Failed do Jest spawn worker gặp `spawn EPERM` trên Windows sandbox |
| Fallback test | Passed |
| Lệnh fallback | `node --experimental-vm-modules ./node_modules/jest/bin/jest.js --runInBand` |
| Test suites | 9 passed / 9 total |
| Tests | 44 passed / 44 total |
| `git diff --check` | Không có whitespace error, chỉ có warning LF/CRLF của Windows |

Chưa chạy k6 trong lượt code này vì cần backend/dev Redis/k6 dataset đang live và credential hợp lệ. Lệnh chạy lại đã ghi ở trên.

## Rủi ro còn lại

| Rủi ro | Mức độ | Giảm thiểu |
| --- | --- | --- |
| Redis value có `hashedPassword` | High | Cache opt-in, TTL ngắn, Redis private network, password/TLS nếu remote, không log payload |
| Key có raw normalized username | Medium | Không log raw key trong helper auth lookup; dùng theo format task yêu cầu |
| Stale role/status/profile nếu có flow update user khác chưa invalidate | Medium | Đã thêm các flow chính; cần audit tiếp nếu thêm admin/user update mới |
| Cache hit vẫn phải bcrypt và create session | Medium | Phase này chỉ giảm Mongo user lookup, không giảm bcrypt/session write |
| Redis outage | Low | Helper fallback Mongo và không fail login |

## Rollback

Nhanh nhất:

```bash
AUTH_USER_LOOKUP_CACHE_ENABLED=false
```

Rollback key namespace nếu cần:

```bash
redis-cli --scan --pattern "chatrt:phase1i:auth:user-lookup:*" | xargs redis-cli del
```

Rollback code nếu cần revert các file Phase 1I:

- `backend/src/modules/auth/infrastructure/auth-user-lookup-cache.service.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/shared/infrastructure/perf/signin-pipeline-timing.js`
- Các file invalidation trong auth/admin/profile/moderation.

## Đề xuất bước tiếp theo

1. Chạy k6 valid login cache off/on với `SIGNIN_PIPELINE_SAMPLE_RATE=1` để xác nhận `userLookupAwaitMs` giảm và `authUserCacheHit=true` sau request đầu.
2. Kiểm tra Redis memory/key TTL bằng `TTL`/`GET` với user test, không in payload vào log chung.
3. Nếu valid login p95 vẫn cao, tiếp tục tập trung vào bcrypt/libuv và `createSession`/Mongo session write, vì Phase 1I không thay đổi hai điểm này.
