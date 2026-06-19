# Lệnh cài đặt, chạy, test và smoke hệ thống ChatRealTime

## 1. Yêu cầu môi trường

- Node.js và npm.
- MongoDB local hoặc MongoDB Atlas/cloud.
- Redis local bằng Docker hoặc Redis server riêng.
- Docker Desktop nếu dùng `docker compose`.
- Git Bash hoặc PowerShell trên Windows.
- k6 nếu muốn chạy load test.
- `redis-cli` nếu muốn kiểm tra Redis key thủ công.

## 2. Cài đặt backend

Git Bash:

```bash
cd /d/HHTL/ChatRealTime/backend
npm install
```

PowerShell:

```powershell
cd D:\HHTL\ChatRealTime\backend
npm install
```

## 3. Cài đặt frontend

Git Bash:

```bash
cd /d/HHTL/ChatRealTime/frontend
npm install
```

PowerShell:

```powershell
cd D:\HHTL\ChatRealTime\frontend
npm install
```

## 4. Chạy Redis

```bash
cd /d/HHTL/ChatRealTime/backend
docker compose -f docker-compose.redis.yml up -d
```

Kiểm tra:

```bash
redis-cli ping
```

Kỳ vọng:

```text
PONG
```

## 5. Chạy backend dev

Git Bash:

```bash
cd /d/HHTL/ChatRealTime/backend

export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:dev
export CACHE_ENABLED=true

npm run dev
```

PowerShell:

```powershell
cd D:\HHTL\ChatRealTime\backend

$env:NODE_ENV="development"
$env:REDIS_ENABLED="true"
$env:REDIS_HOST="127.0.0.1"
$env:REDIS_PORT="6379"
$env:REDIS_KEY_PREFIX="chatrt:dev"
$env:CACHE_ENABLED="true"

npm run dev
```

## 6. Chạy frontend dev

Git Bash:

```bash
cd /d/HHTL/ChatRealTime/frontend
npm run dev
```

PowerShell:

```powershell
cd D:\HHTL\ChatRealTime\frontend
npm run dev
```

## 7. Chạy backend cluster

```bash
cd /d/HHTL/ChatRealTime/backend

export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:cluster
export CACHE_ENABLED=true
export CLUSTER_ENABLED=true
export CLUSTER_WORKERS=4

npm run start:cluster
```

## 8. Chạy Socket.IO Redis Adapter và Redis Presence

```bash
cd /d/HHTL/ChatRealTime/backend

export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:phase2a
export SOCKET_REDIS_ADAPTER_ENABLED=true
export PRESENCE_REDIS_ENABLED=true
export PRESENCE_TTL_SECONDS=120
export PRESENCE_DEBUG_ENABLED=true
export CLUSTER_ENABLED=true
export CLUSTER_WORKERS=4

npm run start:cluster
```

Smoke cần kiểm tra:

- Login hai user.
- Mở hai tab hoặc hai browser.
- Kiểm tra online/offline.
- Gửi message realtime.
- Tắt một tab và xác nhận presence cập nhật.

## 9. Bật Redis cache các API đọc nhiều

```bash
export REDIS_ENABLED=true
export CACHE_ENABLED=true

export CONVERSATION_LIST_CACHE_ENABLED=true
export CONVERSATION_LIST_CACHE_TTL_SECONDS=30
export CONVERSATION_LIST_CACHE_DEBUG=true

export FRIEND_CACHE_ENABLED=true
export FRIEND_CACHE_TTL_SECONDS=30
export FRIEND_CACHE_DEBUG=true

export ADMIN_DASHBOARD_CACHE_ENABLED=true
export ADMIN_DASHBOARD_CACHE_TTL_SECONDS=30
export ADMIN_DASHBOARD_CACHE_DEBUG=true
```

Smoke cần kiểm tra:

- Conversation list lần 1 miss, lần 2 hit.
- Gửi message hoặc update conversation thì cache bị invalidate.
- Friend list/request/suggestions lần 1 miss, lần 2 hit.
- Accept/remove friend thì friend cache bị invalidate.
- Admin dashboard lần 1 miss, lần 2 hit.

## 10. Bật auth performance cache

```bash
export REDIS_ENABLED=true
export CACHE_ENABLED=true
export AUTH_USER_LOOKUP_CACHE_ENABLED=true
export AUTH_USER_LOOKUP_CACHE_DEBUG=true
export MAINTENANCE_L1_CACHE_ENABLED=true
```

Chạy backend rồi kiểm tra login valid user bằng k6 hoặc request thủ công. Log timing chỉ bật khi:

```bash
export LOAD_TEST=true
export AUTH_TIMING_DEBUG=true
```

## 11. Chạy BullMQ email worker

Terminal worker:

```bash
cd /d/HHTL/ChatRealTime/backend

export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:queue
export BULLMQ_ENABLED=true
export EMAIL_QUEUE_ENABLED=true
export EMAIL_QUEUE_DEBUG=true
export QUEUE_PREFIX=chatrt:queue
export QUEUE_WORKER_ENABLED=true

npm run worker:queues
```

Kỳ vọng:

- Worker email start.
- Email job được enqueue khi gọi flow gửi email.
- Worker completed job.
- Không log OTP, token, cookie hoặc HTML email.

## 12. Bật cleanup jobs

```bash
cd /d/HHTL/ChatRealTime/backend

export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:cleanup
export BULLMQ_ENABLED=true
export QUEUE_WORKER_ENABLED=true
export QUEUE_PREFIX=chatrt:cleanup

export CLEANUP_QUEUE_ENABLED=true
export CLEANUP_QUEUE_DEBUG=true
export CLEANUP_QUEUE_REPEAT_EVERY_MS=60000
export CLEANUP_STALE_PRESENCE_ENABLED=true
export CLEANUP_OLD_QUEUE_JOBS_ENABLED=true
export CLEANUP_QUEUE_JOB_RETENTION_HOURS=1

npm run worker:queues
```

Kỳ vọng log:

```text
[CleanupQueue] repeatable jobs scheduled
[CleanupWorker] ready
```

## 13. Chạy test backend

```bash
cd /d/HHTL/ChatRealTime/backend
npm test
```

Hoặc chạy Jest fallback:

```bash
cd /d/HHTL/ChatRealTime/backend
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --runInBand
```

Kết quả gần nhất trong report: 9 suites passed, 44 tests passed.

## 14. Chạy `node --check`

```bash
cd /d/HHTL/ChatRealTime/backend

node --check src/app/server.js
node --check src/app/socket/initSocket.js
node --check src/shared/infrastructure/realtime/user-presence.js
node --check src/shared/infrastructure/queue/queue-worker.js
node --check src/shared/infrastructure/queue/email.queue.js
node --check src/shared/infrastructure/queue/email.worker.js
node --check src/shared/infrastructure/queue/cleanup.queue.js
node --check src/shared/infrastructure/queue/cleanup.worker.js
node --check src/shared/infrastructure/queue/cleanup.jobs.js
```

## 15. Audit MongoDB index

```bash
cd /d/HHTL/ChatRealTime/backend
node scripts/audit-indexes.js
```

Dùng để kiểm tra index thực tế so với index đề xuất trong audit.

## 16. Kiểm tra Redis keys

```bash
redis-cli --scan --pattern "chatrt:*"
redis-cli --scan --pattern "chatrt:*presence*"
redis-cli --scan --pattern "chatrt:*conversation*"
redis-cli --scan --pattern "chatrt:*friend*"
redis-cli --scan --pattern "chatrt:*dashboard*"
redis-cli --scan --pattern "*bull*"
```

## 17. Xóa Redis test keys

Chỉ dùng cho dev/test. Không chạy trên production.

```bash
redis-cli --scan --pattern "chatrt:phase2*:*" | xargs redis-cli del
```

PowerShell dev/test:

```powershell
redis-cli --scan --pattern "chatrt:phase2*:*" | ForEach-Object { redis-cli del $_ }
```

## 18. Chạy k6 login load test

Ví dụ chạy login compare:

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

Các mode thường dùng:

```bash
export MODE=missing_user
k6 run tests/load/login-compare-test.js

export MODE=wrong_password
k6 run tests/load/login-compare-test.js

export MODE=valid
k6 run tests/load/login-compare-test.js
```

PowerShell:

```powershell
cd D:\HHTL\ChatRealTime

$env:BASE_URL="http://127.0.0.1:5001"
$env:LOAD_TEST="true"
$env:NODE_ENV="development"
$env:MODE="valid"
$env:TEST_USERNAME="vanh"
$env:TEST_PASSWORD="1234567"
$env:VUS="50"

k6 run tests/load/login-compare-test.js
```

## 19. Smoke test checklist

- Login user thường.
- Refresh trang vẫn giữ session.
- Refresh token flow hoạt động.
- Logout clear cookie.
- Socket.IO connect.
- Mở `/api-docs`.
- Chat 1-1 realtime.
- Chat nhóm realtime.
- Send message with image.
- Seen/unread update.
- Online/offline presence.
- Friend request/accept/decline/cancel.
- Conversation list cache hit/miss/invalidate.
- Friend cache hit/miss/invalidate.
- Admin dashboard cache hit/miss/invalidate.
- Admin maintenance toggle.
- Email queue enqueue và worker completed.
- Cleanup worker chạy repeatable jobs.
- Report creation và admin report list.
- Voice/video call invite/accept/end nếu có thiết bị và browser thật.

## 20. Rollback nhanh theo env

Tắt Redis cache:

```bash
export CACHE_ENABLED=false
```

Tắt auth user lookup cache:

```bash
export AUTH_USER_LOOKUP_CACHE_ENABLED=false
```

Tắt Socket.IO Redis adapter:

```bash
export SOCKET_REDIS_ADAPTER_ENABLED=false
```

Tắt Redis presence:

```bash
export PRESENCE_REDIS_ENABLED=false
```

Tắt BullMQ:

```bash
export BULLMQ_ENABLED=false
export EMAIL_QUEUE_ENABLED=false
export CLEANUP_QUEUE_ENABLED=false
export QUEUE_WORKER_ENABLED=false
```

Tắt HTTPS enforcement tạm thời khi debug dev/proxy:

```bash
export FORCE_HTTPS=false
```

Lưu ý: rollback bằng env chỉ nên dùng để khôi phục nhanh khi smoke lỗi; sau đó cần tìm nguyên nhân và bật lại các lớp bảo mật/cache phù hợp.

