# ChatRealTime Backend - Phase 2A: Redis Socket.IO Adapter và Scalable Presence

Ngày: 2026-06-17

## Mục tiêu phase

Phase 2A tập trung mở rộng realtime scalability cho backend ChatRealTime:

- Thêm Redis adapter cho Socket.IO để emit/broadcast hoạt động giữa nhiều worker/process.
- Chuẩn hóa online presence để không chỉ phụ thuộc Map local của một worker.
- Giữ tương thích với các event realtime hiện có: message, conversation, friend, notification, admin, voice/video call signaling.
- Không đổi frontend, API contract, auth response, cookie/Bearer flow, refresh token behavior, Redis session, Kafka hoặc BullMQ.

## File đã đọc

- `report/REDIS_PHASE1_REPORT.md`
- `report/REDIS_PHASE1_VALIDATION_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1I_REPORT.md`
- `report/LOGIN_PERFORMANCE_PHASE1J_REPORT.md`
- `backend/src/app/socket/initSocket.js`
- `backend/src/cluster-server.js`
- `backend/src/shared/infrastructure/realtime/user-presence.js`
- `backend/src/shared/infrastructure/realtime/socket-gateway.js`
- `backend/src/shared/infrastructure/realtime/socket-registry.js`
- `backend/src/shared/infrastructure/redis/redis-client.js`
- `backend/src/modules/calls/api/socket/call.socket-handler.js`
- `backend/src/modules/calls/application/call.service.js`
- `backend/src/modules/chat/infrastructure/realtime/message-realtime.js`
- `backend/src/modules/chat/application/message.command-service.js`
- `backend/src/modules/chat/application/conversation.command-service.js`
- `backend/src/services/dashboardRealtimeService.js`
- `backend/src/shared/domain/constants/socket-events.js`
- `backend/src/config/cors.js`
- `backend/package.json`

## File đã sửa/thêm

- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/shared/infrastructure/redis/redis-client.js`
- `backend/src/shared/infrastructure/realtime/socket-redis-adapter.js`
- `backend/src/shared/infrastructure/realtime/user-presence.js`
- `backend/src/app/socket/initSocket.js`
- `backend/src/app/server.js`
- `backend/src/modules/chat/infrastructure/realtime/message-realtime.js`
- `backend/src/modules/chat/application/message.command-service.js`
- `backend/src/modules/chat/application/conversation.command-service.js`
- `backend/src/modules/calls/application/call.service.js`
- `report/PHASE2A_SOCKET_REDIS_ADAPTER_REPORT.md`

## Dependency mới

Đã thêm:

```json
"@socket.io/redis-adapter": "^8.3.0"
```

Lệnh đã chạy:

```bash
cd backend
npm install "@socket.io/redis-adapter"
```

Npm audit sau install báo `34 vulnerabilities` trong dependency tree hiện tại. Chưa chạy `npm audit fix` vì ngoài scope Phase 2A và có thể gây thay đổi package rộng.

## Env flag mới

| Env | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `SOCKET_REDIS_ADAPTER_ENABLED` | `false` | Bật Redis adapter cho Socket.IO |
| `PRESENCE_REDIS_ENABLED` | `false` | Bật Redis-backed presence |
| `PRESENCE_TTL_SECONDS` | `120` | TTL cho socket presence keys |

Các flag Redis nền vẫn dùng lại:

| Env | Ý nghĩa |
| --- | --- |
| `REDIS_ENABLED` | Bật Redis client |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_URL` | Cấu hình Redis |
| `REDIS_PASSWORD` / `REDIS_TLS` / `REDIS_DB` | Bảo mật và database Redis |
| `REDIS_KEY_PREFIX` | Namespace key theo môi trường |

## Kiến trúc Socket.IO Redis adapter

File mới:

```text
backend/src/shared/infrastructure/realtime/socket-redis-adapter.js
```

Thiết kế:

- Dùng `@socket.io/redis-adapter`.
- Tạo Redis pub/sub clients riêng cho Socket.IO adapter.
- Không dùng chung command Redis singleton chính cho pub/sub.
- Adapter chỉ bật khi:

```text
SOCKET_REDIS_ADAPTER_ENABLED=true
REDIS_ENABLED=true
```

- `initSocket(server)` trở thành async và `await setupSocketRedisAdapter(io)` trước khi đăng ký `connection`.
- Nếu Redis adapter setup lỗi, backend log warning và fallback local adapter thay vì crash app.
- Log chỉ gồm trạng thái enabled/ready/error message; không log token, cookie, user payload hoặc socket auth payload.

Ảnh hưởng:

- `emitToUser(userId, ...)` vẫn emit vào room `userId`.
- `emitToRoom(conversationId, ...)` vẫn emit vào room conversation.
- `io.emit(...)` vẫn là global broadcast.
- Khi Redis adapter bật, các emit này được fan-out qua nhiều worker/process.

## Kiến trúc Redis presence

File chính:

```text
backend/src/shared/infrastructure/realtime/user-presence.js
```

Presence vẫn giữ Map local làm fallback khi Redis tắt/lỗi, nhưng khi `PRESENCE_REDIS_ENABLED=true` và Redis ready thì dùng Redis làm source cho online/presence cross-worker.

### Redis keys

Tất cả key đi qua `buildKey(...)`, có prefix `REDIS_KEY_PREFIX`.

| Logical key | Ví dụ đầy đủ | Ý nghĩa |
| --- | --- | --- |
| `presence:user:{userId}:sockets` | `chatrt:phase2a:presence:user:abc:sockets` | Set socketIds của user |
| `presence:socket:{socketId}:user` | `chatrt:phase2a:presence:socket:s1:user` | Reverse mapping socketId -> userId |
| `presence:socket:{socketId}:conversation` | `chatrt:phase2a:presence:socket:s1:conversation` | Conversation đang active của socket |
| `presence:user:{userId}:visible` | `chatrt:phase2a:presence:user:abc:visible` | Preference showOnlineStatus |
| `presence:user:{userId}:meta` | `chatrt:phase2a:presence:user:abc:meta` | User meta tối thiểu cho presence |
| `presence:users:online` | `chatrt:phase2a:presence:users:online` | Set user online |
| `presence:users:visible` | `chatrt:phase2a:presence:users:visible` | Set user online visible, không gồm admin |

### Connect flow

Khi socket connect:

1. Auth middleware giữ nguyên.
2. Socket join room `userId`.
3. Nếu user có admin access thì join room `admins`.
4. `registerSocketConnection(...)`:
   - Ghi local Map fallback.
   - Nếu Redis presence bật: add socket vào Redis set user, set reverse socket->user, set visible/meta, add visible user nếu phù hợp.
   - Prune socket stale trước khi tính `wasOffline`.
5. Emit `online-users`.
6. Nếu user từ offline thành online thì emit admin presence + update dashboard.
7. Start heartbeat để refresh TTL Redis presence.

### Disconnect flow

Khi socket disconnect:

1. Clear heartbeat.
2. `unregisterSocketConnection(...)`:
   - Xóa socket khỏi local Map.
   - Nếu Redis presence bật: remove socket khỏi Redis set, delete reverse keys, prune stale sockets.
   - Nếu user không còn socket nào thì xóa visible/meta và remove khỏi online/visible sets.
3. Emit `online-users`.
4. Nếu user thành offline thì cleanup call state hiện tại và emit admin presence offline.

### Active conversation

`conversation:active` giờ ghi cả local Map và Redis key `presence:socket:{socketId}:conversation`.

`isConversationActiveForUser(userId, conversationId)` trở thành async. `updateConversationAfterCreateMessage(...)` cũng đã được đổi thành async để unread count có thể kiểm tra active conversation xuyên worker trước khi save conversation.

### Voice/video call signaling

Call signaling vẫn dùng room/user emit cũ:

- Direct call dùng `emitToUser`.
- Group call dùng room `group-call:{callSessionId}` và user room.
- `inviteCall` giờ `await isUserOnline(receiverId)` để kiểm tra Redis presence khi chạy cluster.

Không đổi event name, payload, ACK shape, hoặc frontend contract.

## Cross-worker maintenance disconnect

Vì maintenance toggle cần ngắt non-admin sockets, Phase 2A thêm event nội bộ:

```text
presence:disconnect-non-admin
```

Khi Redis adapter bật, `disconnectAllNonAdminSockets()` dùng `io.serverSideEmit(...)` để yêu cầu các worker khác tự ngắt socket non-admin local. Đây là event nội bộ server-to-server, không phải client event.

## Rollback plan

Rollback runtime nhanh:

```bash
SOCKET_REDIS_ADAPTER_ENABLED=false
PRESENCE_REDIS_ENABLED=false
```

Nếu cần tắt toàn bộ Redis realtime/presence:

```bash
REDIS_ENABLED=false
```

Nếu cần xóa presence keys:

```bash
redis-cli --scan --pattern "chatrt:phase2a:presence:*" | xargs redis-cli del
```

Rollback code nếu cần:

- Gỡ `@socket.io/redis-adapter` khỏi `backend/package.json`.
- Revert `socket-redis-adapter.js`.
- Revert `user-presence.js` về Map local.
- Revert `initSocket` không còn async adapter setup/heartbeat.
- Revert `updateConversationAfterCreateMessage` về sync nếu muốn quay lại hoàn toàn local presence.

## Kết quả test

Đã chạy syntax check:

```bash
node --check backend/src/app/socket/initSocket.js
node --check backend/src/shared/infrastructure/realtime/user-presence.js
node --check backend/src/shared/infrastructure/realtime/socket-redis-adapter.js
node --check backend/src/shared/infrastructure/redis/redis-client.js
node --check backend/src/modules/chat/infrastructure/realtime/message-realtime.js
node --check backend/src/modules/chat/application/message.command-service.js
node --check backend/src/modules/chat/application/conversation.command-service.js
node --check backend/src/modules/calls/application/call.service.js
```

Kết quả: pass.

Đã kiểm tra import thực tế:

```bash
node -e "import('./backend/src/shared/infrastructure/realtime/socket-redis-adapter.js').then(()=>console.log('adapter import ok'))"
node -e "import('./backend/src/app/socket/initSocket.js').then(()=>console.log('initSocket import ok'))"
```

Kết quả: pass.

Đã chạy Jest fallback:

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

`git diff --check` không báo whitespace error, chỉ có warning LF/CRLF trên Windows.

## Manual smoke chưa chạy

Chưa chạy browser/manual smoke trong lượt này vì cần Redis local, backend cluster, frontend/client đăng nhập hai user và thao tác nhiều tab. Các lệnh chạy thủ công ở phần dưới.

Cần kiểm tra thủ công:

- Start Redis.
- Start backend cluster 4 workers.
- Login 2 users.
- Mở 2 tab/client.
- Kiểm tra `online-users` không bị miss khi user kết nối ở worker khác nhau.
- Kiểm tra message realtime vẫn tới đúng user/conversation.
- Kiểm tra call invite/offer/answer/ice candidate vẫn realtime.
- Kiểm tra disconnect/logout/admin lock không để presence stale.

## Lệnh chạy thủ công

Start Redis:

```bash
docker compose -f docker-compose.redis.yml up -d
```

Start backend cluster:

```bash
cd /d/HHTL/ChatRealTime/backend

export NODE_ENV=development
export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export CACHE_ENABLED=true
export SOCKET_REDIS_ADAPTER_ENABLED=true
export PRESENCE_REDIS_ENABLED=true
export PRESENCE_TTL_SECONDS=120
export CLUSTER_ENABLED=true
export CLUSTER_WORKERS=4

npm run start:cluster
```

Kiểm tra Redis presence keys:

```bash
redis-cli --scan --pattern "chatrt:dev:presence:*"
```

## Hạn chế còn lại

- Presence Redis dùng heartbeat TTL; nếu worker chết đột ngột, stale socket sẽ được prune khi user lookup/register/unregister hoặc hết TTL reverse key.
- `presence:users:online` và `presence:users:visible` là sets tổng hợp; stale members được cleanup theo các flow presence chính, nhưng có thể cần job dọn nền nếu muốn tuyệt đối sạch trong production lớn.
- Direct/group call active state vẫn có một số Map local trong `call.service.js` cho busy/ringing timeout. Phase 2A không rewrite call state sang Redis để tránh phá signaling; Redis adapter giúp emit/signaling xuyên worker, còn call orchestration distributed hoàn chỉnh nên là phase riêng nếu cần.
- Manual multi-tab/cluster smoke chưa chạy trong lượt này.
