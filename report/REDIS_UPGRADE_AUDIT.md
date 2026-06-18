# Redis Upgrade Audit - ChatRealTime Backend

Ngày audit: 2026-06-15  
Phạm vi: chỉ đọc backend source/config/test/env names; không sửa logic, không cài package.

## Executive Summary

`POST /api/auth/signin` chậm dưới 100 VUs chủ yếu do tổ hợp: `bcrypt.compare` CPU-bound, mỗi login thành công ghi `Session` vào MongoDB, mỗi login còn đọc cấu hình maintenance từ MongoDB, và load test có thể tạo nhiều phiên MongoDB/token/cookie liên tục. Redis nên được đưa vào trước Kafka để giảm DB round-trip cho maintenance/auth/session/rate-limit/cache/presence. Kafka chưa cần ở phase này vì nhu cầu hiện tại là cache, TTL state, rate limit, presence và background job nhẹ; Redis + BullMQ đủ phù hợp.

## A. Tổng Quan Kiến Trúc Hiện Tại

### Backend entry file

- `backend/src/server.js`: gọi `startServer()`.
- `backend/src/app/server.js`: tạo Express app, HTTP server, connect MongoDB, init Socket.IO.
- `backend/src/app/http/registerRoutes.js`: mount toàn bộ route dưới `/api`.

### MongoDB connection

- `backend/src/shared/infrastructure/db/connect-db.js` dùng `mongoose.connect(process.env.MONGODB_CONNECTIONSTRING)`.
- `backend/src/libs/db.js` chỉ re-export `connectDB`.
- Hiện chưa thấy cấu hình pool size, server selection timeout, retry strategy hoặc instrumentation query latency.

### Middleware đang dùng

Global Express:

- `express.json()`
- `cookieParser()`
- `cors({ origin: process.env.CLIENT_URL, credentials: true })`
- `maintenanceCheckMiddleware`
- `swaggerUi.serve/setup` tại `/api-docs`

Route/module middleware:

- `protectedRoute`: verify JWT, đọc user từ MongoDB, kiểm tra banned/maintenance.
- `requireAdmin`, `requirePermission`, `requireAnyPermission`.
- `validateBody(...)` dùng Zod/schema validation.
- `uploadSingleFile`, `uploadSingleImage` dùng multer/Cloudinary flow.
- `checkFriendship`, `checkGroupMemberShip` cho chat.
- `socketAuthMiddleWare` cho Socket.IO.

### Auth flow hiện tại

- `POST /api/auth/signin` -> `auth.controller.signIn` -> `session.command-service.signInUser`.
- Input validate bằng `signInSchema`.
- Query `User.findOne({ userName: userName.toLowerCase() })`.
- Check password bằng `bcrypt.compare(password, user.hashedPassword)`.
- Check banned bằng status user.
- Check maintenance qua `ensureMaintenanceAccess(user)` -> `maintenanceService.isMaintenanceEnabled()` -> `Maintenance.findOne()`.
- Nếu user local chưa verify email: có thể gọi gửi email verification.
- Thành công: `createSession(user._id, res)` tạo JWT access token, random refresh token, `Session.create(...)`, set `refreshToken` và `accessToken` httpOnly cookie.
- Emit realtime admin login event qua `emitAuthLifecycle`.
- Refresh token hiện lưu trong MongoDB `Session`, có TTL index `expiresAt`.

### Socket.IO flow hiện tại

- `initSocket(server)` tạo `new Server(server, { cors })`.
- `io.use(socketAuthMiddleWare)`.
- Socket auth verify JWT qua `resolveAccessUserFromToken`, tức mỗi connect đọc `User.findById(...).select("-hashedPassword")` và check maintenance.
- Khi connect:
  - đọc `preferences.showOnlineStatus` nếu user payload chưa có.
  - lưu presence trong memory `Map` ở `user-presence.js`.
  - join room riêng `userId`, room admin nếu có quyền.
  - emit `online-users`.
  - lấy conversation ids bằng `Conversation.find({ "participants.userId": userId, ... }, { _id: 1 })`, rồi join từng room.
  - register call handlers.
- Disconnect xóa socket khỏi Map, emit online list và dashboard realtime update.
- Hiện presence, active conversation, online user count đều local process, chưa scale multi-instance.

### Model chính

- `User`: userName/email unique, auth provider, role/permissions/status, preferences, embedded `blockedUsers`.
- `Conversation`: direct/group/support, participants, lastMessage, unreadCounts, support fields, clearedFor.
- `Message`: conversationId, sender snapshot, content/image/reply/reactions/deleted flags/call metadata.
- `Friend`: userA/userB sorted pair, unique compound index.
- `FriendRequest`: from/to/status/message.
- `Report`: reporter, target fields, status, snapshots.
- `Blocking`: userId/blockedUserId, isActive, reason, direct-only type.
- `Session`: userId, refreshToken, expiresAt TTL.
- Không thấy model `Notification` riêng; notification hiện là Socket.IO/admin notification service, chưa persist thành collection.

## B. Phân Tích Điểm Nghẽn Hiệu Năng

### POST /api/auth/signin

File xử lý:

- Route: `backend/src/modules/auth/api/http/auth.route.js`
- Controller: `backend/src/modules/auth/api/http/auth.controller.js`
- Service: `backend/src/modules/auth/application/session.command-service.js`
- Token/session: `backend/src/modules/auth/infrastructure/token.service.js`

DB/query trong request:

- `User.findOne({ userName: userName.toLowerCase() })`
- `Maintenance.findOne()` qua `ensureMaintenanceAccess` sau khi password đúng.
- `Session.create({ userId, refreshToken, expiresAt })` khi login thành công.
- Nếu email chưa verify: update/read email verification fields và gửi mail qua verification service.

Bcrypt:

- Có dùng `bcrypt.compare`.
- Cost hash khi signup/reset/google random password là `bcrypt.hash(..., 10)`, nên signin compare tương ứng cost 10 với user local.
- Đây là CPU-bound và sẽ chiếm libuv worker pool dưới 100 VUs nếu nhiều login đồng thời.

Populate:

- Signin không dùng `populate`.

Ghi DB phụ:

- Login thành công luôn ghi `Session` vào MongoDB.
- Có thể ghi/gửi verification nếu local email chưa verify.
- Emit admin notification không thấy persist notification model, nhưng có thể kéo dashboard realtime stats ở một số event khác.

Token/cookie:

- Access token JWT TTL `30m`, ký bằng `ACCESS_TOKEN_SECRET`.
- Refresh token random 64 bytes hex, TTL 14 ngày, lưu MongoDB `Session`.
- Set `refreshToken` và `accessToken` httpOnly cookie, secure/sameSite tùy `NODE_ENV`.

Middleware nặng:

- Với `/api/auth/signin`, global `maintenanceCheckMiddleware` bypass do `isAuthRoute`, nên không query maintenance ở middleware.
- Nhưng service signin vẫn query maintenance sau bcrypt.
- Không có rate limit hiện tại cho login/register/forgot-password.

Nhận định load test:

- Nếu k6 dùng cùng credential, hệ thống tạo rất nhiều session mới trong MongoDB, tạo áp lực write/index TTL.
- `bcrypt.compare` cost 10 dưới 100 VUs có thể làm p95 lên vài giây dù DB ổn.
- Redis không làm bcrypt nhanh hơn, nhưng giảm DB write/read phụ, thêm rate limit để tránh storm, và chuyển refresh session khỏi MongoDB sẽ giảm tail latency.

### API đọc nhiều và khả năng cache

| Nhóm | Endpoint | File xử lý | Query chính | Cache? |
|---|---|---|---|---|
| Conversation list | `GET /api/conversations` | `conversation.query-service.js` | `Conversation.find({ participants.userId, $or support }).sort(lastMessageAt).populate(participants,lastMessage.senderId,seenBy)` | Có, per-user TTL ngắn; invalidate khi send/edit/delete/seen/member/group/avatar/block |
| Message list | `GET /api/conversations/:conversationId/messages?limit&cursor` | `conversation.query-service.js` | `Conversation.findById(...).select`, `Message.find({ conversationId, deletedFor, createdAt cursor }).sort(createdAt).limit` | Có, per conversation + user + cursor; TTL rất ngắn; tránh cache nếu chứa dữ liệu đã xóa riêng theo user mà key không có user |
| Group detail | `GET /api/conversations/:id/details` | `conversation.query-service.js` | `Conversation.findById().populate(participants, group.createdBy)` | Có, invalidate khi member/name/avatar đổi |
| User profile | `GET /api/users/me` | `user-profile.service.js` | Không query thêm, trả `req.user` từ `protectedRoute`; `protectedRoute` đã query User | Cache user access ở auth middleware được; endpoint response cache ít lợi |
| User search | `GET /api/users/search?q&limit` | `userDiscoveryService.js`, `userDiscoveryRepository.js` | context: Friend/User/FriendRequest; search `User.find({ regex userName/displayName })` | Có TTL ngắn theo viewer+query; index cần hỗ trợ prefix/text |
| Suggestions | `GET /api/users/suggestions` | `userDiscoveryService.js` | Friend list, incoming blocks, pending requests, `User.aggregate($sample)`, candidate friendships | Có TTL 30-60s per viewer; invalidate friend/block/request |
| Friend list | `GET /api/friends` | `friendship.service.js` | `Friend.find($or userA/userB).populate(userA,userB)` | Có per-user, invalidate accept/remove |
| Friend requests | `GET /api/friends/requests` | `friendship.service.js` | `FriendRequest.find({ from,status }).populate`, `find({ to,status }).populate` | Có TTL 15-30s; invalidate send/accept/decline/cancel |
| My reports | `GET /api/reports/me` | `report-user.service.js` | `Report.find({ reporterId,status,targetType }).sort(createdAt).skip.limit`, `countDocuments` | Có per-user/page/filter TTL 30-60s; invalidate create/status update |
| Admin dashboard overview | `GET /api/admin/dashboard/overview` | `dashboard.service.js` | nhiều `countDocuments`, latest users, maintenance | Có TTL 10-30s; invalidate/event refresh |
| Admin dashboard charts | `GET /api/admin/dashboard/charts/*` | `admin-read.service.js` | aggregate users/messages/reports/support | Có TTL 60-300s theo days |
| Admin users | `GET /api/admin/users` | `user-management.service.js` | `User.find(filter regex/status).sort.skip.limit`, `countDocuments` | Cache chọn lọc TTL 30s, ưu tiên index |
| Admin conversations | `GET /api/admin/conversations` | `admin-read.service.js` | `Conversation.find(filter).sort.skip.limit`, count, aggregate Message count | Có TTL 30s; invalidate chat writes |
| Admin messages | `GET /api/admin/messages` | `admin-read.service.js` | `Message.find().populate(...).sort(createdAt).skip.limit`, count | Có TTL 15-30s; invalidate message writes |
| Admin reports | `GET /api/admin/reports` | `report-admin.service.js` | `Report.find(query).sort.skip.limit.populate`, count | Có TTL 30s; invalidate create/status/action |
| Admin blocks | `GET /api/admin/blocks` | `admin-read.service.js` | `syncBlockingDocumentsFromEmbeddedState()`, `Blocking.find(filter).populate`, count | Cache cẩn thận; sync side-effect làm GET không thuần |

Endpoint không nên cache hoặc chỉ cache helper nhỏ: login/register/reset/change password, mutation routes, upload routes, signout/refresh, `PATCH seen`, `POST messages`, report creation, block/unblock.

## C. Kiểm Tra MongoDB Index

### Index hiện có

- `User`: unique `userName`, unique `email`, unique sparse `googleId`.
- `Conversation`:
  - `{ "participants.userId": 1, lastMessageAt: -1 }`
  - `{ type: 1, supportStatus: 1, lastMessageAt: -1 }`
  - `{ supportCreatedByUserId: 1, type: 1 }`
  - `{ assignedAdminId: 1, supportStatus: 1 }`
- `Message`:
  - field index `conversationId`
  - `{ conversationId: 1, createdAt: -1 }`
- `Friend`: `{ userA: 1, userB: 1 }` unique.
- `FriendRequest`: field index `status`; `{ from: 1, to: 1 }` unique; `{ from: 1 }`; `{ to: 1 }`.
- `Report`: field indexes reporter/target/status; `{ status: 1, createdAt: -1 }`; `{ reporterId: 1, createdAt: -1 }`; `{ targetType: 1, status: 1 }`.
- `Blocking`: field index `isActive`; `{ userId: 1, blockedUserId: 1 }` unique; `{ isActive: 1, createdAt: -1 }`.
- `Session`: field index `userId`; unique `refreshToken`; TTL `{ expiresAt: 1 }`.
- `AuditLog`: field indexes `actorId`, `targetUserId`, `action`.
- `AdminDeletionLog`: `{ deletedByAdminId: 1, deletedAt: -1 }`, `{ targetUserId: 1, deletedAt: -1 }`.
- OTP/email/call models cũng có TTL/compound indexes, nhưng không thuộc luồng read hot chính.

### Index đề xuất

| Collection | Index đề xuất | Lý do/query |
|---|---|---|
| users | `{ userName: 1 }` đã có unique | Signin `User.findOne({ userName })`; đạt yêu cầu. |
| users | `{ email: 1 }` đã có unique | Forgot/reset/google/email flows; đạt yêu cầu. |
| users | `{ status: 1, createdAt: -1 }` | Admin users filter status + dashboard counts/new users. |
| users | `{ createdAt: -1 }` | latest users/dashboard/admin sort default. |
| users | Text index `{ userName: "text", displayName: "text", email: "text" }` hoặc normalized prefix fields | Regex `i` hiện khó dùng index nếu không prefix/normalized; admin/user search dễ scan. |
| users | `{ "blockedUsers.userId": 1 }` | `getIncomingBlockedUserIds`: `User.find({ "blockedUsers.userId": userId })`. |
| conversations | `{ "participants.userId": 1, type: 1, lastMessageAt: -1 }` | Conversation list và socket join có participant + support/direct/group filter. |
| conversations | `{ "participants.userId": 1, type: 1, updatedAt: -1 }` | Admin/user detail count direct/group by participant+type. |
| conversations | `{ type: 1, updatedAt: -1 }` | Admin conversation list sort updatedAt by type. |
| conversations | `{ type: 1, createdAt: -1 }` | Admin sort/filter createdAt and dashboard new group count. |
| conversations | `{ type: 1, supportStatus: 1, updatedAt: -1 }` | Support/admin support dashboard/list if sorted by updatedAt. |
| messages | `{ conversationId: 1, createdAt: -1 }` đã có | Message pagination. |
| messages | `{ senderId: 1, createdAt: -1 }` | Admin user detail `Message.countDocuments({ senderId })`, possible user message history. |
| messages | `{ createdAt: -1 }` | Admin messages list `Message.find().sort({ createdAt: -1 })`. |
| messages | `{ conversationId: 1, "replyTo.messageId": 1 }` hoặc `{ "replyTo.messageId": 1 }` | Recall message updates `Message.find({ conversationId, "replyTo.messageId" })`. |
| friends | `{ userA: 1, userB: 1 }` đã có unique | Pair lookup. |
| friends | `{ userA: 1, createdAt: -1 }`, `{ userB: 1, createdAt: -1 }` | Friend list `$or userA/userB`; single compound unique cannot fully optimize both branches. |
| friendrequests | `{ from: 1, status: 1, createdAt: -1 }` | sent pending list. |
| friendrequests | `{ to: 1, status: 1, createdAt: -1 }` | received pending list. |
| friendrequests | `{ status: 1, createdAt: -1 }` | Admin friend requests by status/sort. |
| reports | `{ status: 1, createdAt: -1 }` đã có | Admin reports status/sort. |
| reports | `{ reporterId: 1, status: 1, targetType: 1, createdAt: -1 }` | `GET /reports/me` with filters. |
| reports | `{ targetType: 1, status: 1, createdAt: -1 }` | Admin targetType+status list. |
| blocks | `{ userId: 1, blockedUserId: 1 }` đã có unique | direct block relation. |
| blocks | `{ userId: 1, isActive: 1, createdAt: -1 }` | user blocked count/list. |
| blocks | `{ blockedUserId: 1, isActive: 1, createdAt: -1 }` | blockedBy count/admin lookup. |
| blocks | `{ isActive: 1, createdAt: -1 }` đã gần đủ | Admin blocks list, active count. |
| sessions | unique `refreshToken`, TTL `expiresAt` đã có | Refresh/logout. Nếu chuyển Redis, giảm phụ thuộc collection này. |

## D. Đề Xuất Redis Usage

### 1. Redis cache

Nên cache:

- Maintenance config: `maintenance:config`, TTL 30-60s hoặc cache-aside + invalidate khi admin update/toggle.
- Auth user access payload: `auth:user:{userId}`, TTL 5-15m, xóa khi user/status/role/profile/preferences đổi.
- Conversation list: `user:{userId}:conversations`, TTL 15-30s.
- Message page: `conversation:{conversationId}:messages:user:{userId}:limit:{limit}:cursor:{cursorHash}`, TTL 10-30s.
- Group details: `conversation:{conversationId}:details:user:{userId}`, TTL 60s.
- Friends: `user:{userId}:friends`, TTL 60-300s.
- Friend requests: `user:{userId}:friend_requests`, TTL 15-60s.
- Suggestions/search: `user:{userId}:suggestions:{limit}`, `user:{userId}:search:{queryHash}:{limit}`, TTL 30-60s.
- Reports/me and admin reports list: TTL 30-60s.
- Admin dashboard/charts: TTL 10-300s tùy dữ liệu.

Không cache:

- Password hash/raw token/OTP plaintext.
- Mutation response cần realtime chính xác.
- Access decision nhạy cảm quá lâu: banned/status/role phải TTL ngắn hoặc invalidate chắc.
- Message payload không được key thiếu `userId` vì `deletedFor` và cleared state là per-user.

Invalidation:

- Send/edit/delete/reaction message: xóa message page keys theo conversation, conversation list của participants, admin message/dashboard keys.
- Mark seen: xóa conversation list user hiện tại; có thể không xóa message pages.
- Group member/name/avatar: xóa conversation detail/list participants.
- Friend request accept/decline/cancel/send/remove: xóa friend/friend_request/suggestions/search của hai user.
- Block/unblock: xóa blocks, suggestions/search, conversation list của hai user.
- Report create/status/action: xóa report list/detail/dashboard report chart.
- User profile/avatar/status/role/preferences: xóa `auth:user`, profile/search/suggestions/conversation list có participant snapshot.

### 2. Redis session/token

Nên chuyển refresh token session sang Redis hoặc song song migration:

- Key: `session:refresh:{sha256(refreshToken)}`
- Value: JSON `{ userId, createdAt, userAgent?, ip?, revokedAt? }`
- TTL: 14 ngày, bằng `REFRESH_TOKEN_TTL`.
- Logout: `DEL session:refresh:{hash}` và clear cookie.
- Ban/delete user: xóa theo set phụ `user:{userId}:sessions` chứa token hashes, hoặc scan hạn chế theo set.
- Refresh flow: lookup Redis thay `Session.findOne`, verify user status từ cache/DB, cấp access token mới.
- Không lưu refresh token raw; hash token trước khi làm key để giảm rủi ro leak Redis.

### 3. Redis rate limit

Áp dụng:

- `POST /api/auth/signin`
- `POST /api/auth/signup`
- `POST /api/auth/forgot-password`
- `POST /api/auth/resend-verification`
- `POST /api/auth/verify-forgot-password-otp`

Key đề xuất:

- `rl:auth:signin:ip:{ip}`
- `rl:auth:signin:user:{normalizedUserNameOrEmail}`
- `rl:auth:forgot:ip:{ip}`
- `rl:auth:forgot:email:{emailHash}`

Threshold đề xuất:

- Login IP: 30 attempts / 5 phút.
- Login username/email: 10 attempts / 10 phút.
- Forgot password IP: 10 / 15 phút.
- Forgot password email: 3 / 15 phút.
- OTP verify: 5 / 10 phút.

Cách làm:

- Atomic `INCR` + `EXPIRE` hoặc Lua/fixed-window/sliding-window.
- Trả `429` kèm `Retry-After`.
- Không rate limit quá thấp cho load test internal; dùng env whitelist nếu cần.

### 4. Redis Socket.IO presence

Nên lưu presence vào Redis khi muốn scale nhiều server:

- Socket.IO adapter: `@socket.io/redis-adapter`.
- Presence keys:
  - `presence:user:{userId}` -> JSON `{ visible, status, lastSeenAt, serverId }`, TTL 60-90s.
  - `presence:user:{userId}:sockets` -> set socket ids, TTL heartbeat.
  - `presence:online` -> sorted set userId score timestamp.
  - `presence:active_conversation:{conversationId}` -> set userIds/sockets TTL ngắn.
- Heartbeat: refresh TTL mỗi 20-30s, expire offline nếu không renew.
- Multi-server sync:
  - Socket rooms qua Redis adapter.
  - Presence read từ Redis, không từ local Map.
  - Disconnect user dùng adapter remote disconnect hoặc pub/sub command channel.

### 5. Redis queue hoặc BullMQ

Nên đưa nền:

- Email verification/forgot password/account deletion email.
- Admin notification/audit log emission nếu có persist sau này.
- Dashboard stats recompute/broadcast.
- Cloudinary delete cleanup khi remove friend/delete messages.
- Report snapshot/notification side tasks nếu latency API cao.

Đề xuất: BullMQ + Redis.

Lý do:

- Task hiện là job nội bộ, retry/delay/TTL, không cần event streaming phân tán phức tạp.
- Kafka chỉ đáng cân nhắc khi có nhiều consumer độc lập, audit/event replay lâu dài, stream analytics hoặc tích hợp hệ thống ngoài. Phase này chưa cần.

## E. Kiến Trúc Redis Cụ Thể Cho Project

Package:

- Khuyến nghị `ioredis` nếu dùng BullMQ và cần reconnect/cluster tốt.
- Nếu chỉ cache đơn giản, package `redis` official cũng được; nhưng BullMQ dùng `ioredis` phổ biến hơn, nên chọn `ioredis` để thống nhất.

File/folder nên tạo:

- `backend/src/shared/infrastructure/redis/redis-client.js`
- `backend/src/shared/infrastructure/cache/cache.service.js`
- `backend/src/shared/infrastructure/cache/cache-keys.js`
- `backend/src/shared/infrastructure/cache/cache-invalidation.js`
- `backend/src/middlewares/rateLimitMiddleware.js`
- `backend/src/shared/infrastructure/queue/bullmq.js` ở phase 4

File cần sửa khi triển khai:

- `backend/src/app/server.js`: init Redis, health lifecycle.
- `backend/src/modules/system/application/maintenance-*` hoặc `services/maintenanceService.js`: cache maintenance.
- `backend/src/modules/auth/application/session.command-service.js`, `token.service.js`: Redis refresh sessions/rate-limit.
- `backend/src/modules/identity/application/resolve-access-user-from-token.js`: cache user access ngắn hạn.
- `backend/src/modules/chat/application/*`: cache conversation/message and invalidation.
- `backend/src/modules/friendship/application/friendship.service.js`: friend cache invalidation.
- `backend/src/modules/user-profile/application/user-profile.service.js`: profile/suggestions/cache invalidation.
- `backend/src/modules/admin-panel/application/*`: dashboard/list cache.
- `backend/src/app/socket/initSocket.js`, `user-presence.js`: Redis presence + adapter.

Env variables:

- `REDIS_URL=redis://localhost:6379`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` nếu không dùng URL.
- `REDIS_TLS=false`
- `CACHE_ENABLED=true`
- `CACHE_DEFAULT_TTL_SECONDS=60`
- `RATE_LIMIT_ENABLED=true`
- `SOCKET_REDIS_ADAPTER_ENABLED=false` cho phase rollout.
- `BULLMQ_ENABLED=false`

Docker compose Redis:

- Thêm service `redis:7-alpine`, expose `6379`, healthcheck `redis-cli ping`, optional volume nếu cần persistence cho BullMQ/session.

Fallback nếu Redis lỗi:

- Cache read/write fail-open: log warn, query MongoDB bình thường.
- Rate limit fail-open hoặc fail-closed tùy endpoint; với login nên fail-open ngắn hạn để tránh outage do Redis.
- Session Redis lỗi: trong migration nên dual-read MongoDB fallback; sau cutover cần quyết định fail-closed cho refresh để an toàn.
- Presence Redis lỗi: fallback local Map nhưng cảnh báo scale degraded.

Tránh cache stampede:

- TTL jitter 10-20%.
- Single-flight lock: `lock:cache:{key}` với `SET NX PX`.
- Stale-while-revalidate cho dashboard/conversation list nếu có cache cũ.
- Cache null ngắn cho misses như group detail/user detail 404, TTL 5-10s.

Serialize/deserialize an toàn:

- Chỉ JSON plain object, không cache Mongoose document.
- Convert ObjectId/Date thành string ISO khi serialize.
- Validate shape hoặc version field: `{ v: 1, data, cachedAt }`.
- Không cache secret fields: `hashedPassword`, OTP hash/token raw, sensitive reset fields.

## F. Kế Hoạch Triển Khai Theo Phase

### Phase 1

- Thêm Redis connection singleton.
- Thêm `/api/admin/health` hoặc health detail có Redis ping.
- Thêm cache helper `get/set/del/delPattern/wrap`.
- Cache maintenance config.
- Thêm rate limit cho login/register/forgot-password.
- Tùy chọn: lưu refresh token mới vào Redis song song MongoDB để migration an toàn.

### Phase 2

- Cache API đọc nhiều:
  - conversations
  - messages
  - group details
  - friends/friend requests
  - suggestions/search
  - reports/admin dashboard
- Thêm invalidation tại create/update/delete/send message, seen, group member changes, friend changes, block/report/user changes.
- Thêm metrics cache hit/miss.

### Phase 3

- Thêm `@socket.io/redis-adapter`.
- Chuyển presence từ in-memory Map sang Redis-backed presence.
- Thêm heartbeat TTL, online sorted set, active conversation TTL.
- Test multi-instance local bằng 2 backend process cùng Redis.

### Phase 4

- Thêm BullMQ cho email, notification, audit log, dashboard recompute, Cloudinary cleanup.
- Retry/backoff/dead-letter queue.
- Dashboard stats precompute hoặc refresh-on-event.
- Kafka chỉ review lại nếu có yêu cầu event replay, analytics stream hoặc nhiều service consumer độc lập.

## G. Test Plan

Unit/integration:

- Redis client fallback khi Redis down.
- Cache helper hit/miss/TTL/jitter/JSON parse lỗi.
- Invalidation functions xóa đúng pattern/key.
- Auth rate limit IP + username/email.
- Refresh token Redis create/lookup/revoke/logout.
- Protected route user cache invalidated khi ban/role update.
- Conversation cache per-user không leak `deletedFor/clearedFor`.
- Message page cache key có `userId`, `conversationId`, `limit`, `cursor`.
- Presence heartbeat expiry và multi-socket same user.

Test cache hit/miss:

- Mock Redis: lần 1 gọi service phải query Mongo, set cache; lần 2 trả cache, không gọi query.
- Kiểm tra TTL và cache version.
- Force Redis error, expect fallback MongoDB.

Test invalidation:

- Send message -> conversation list participants bị xóa, message page conversation bị xóa.
- Edit/delete/reaction -> message cache bị xóa.
- Friend accept/remove -> friend list/suggestions của cả hai user bị xóa.
- Block/unblock -> blocks/suggestions/conversation list bị xóa.
- Report status update -> admin reports/dashboard report chart bị xóa.

Test login rate limit:

- N attempts dưới threshold trả 401/200 theo credential.
- N+1 trả 429 với `Retry-After`.
- TTL hết thì reset.
- Key theo IP và username/email hoạt động độc lập.

Chạy lại k6:

- Baseline hiện tại: lưu p50/p90/p95, failure rate, Mongo CPU/ops, Node CPU, event loop delay.
- Sau Phase 1: chạy lại `tests/load/login-test.js` với cùng VUs/duration.
- Tách 2 kịch bản:
  - Login hợp lệ tạo session.
  - Login sai password để đo bcrypt + read, không session write.
- Thêm kịch bản refresh token nếu chuyển Redis.

Metrics kỳ vọng:

- `signin` p95 giảm nếu session write/maintenance read là nút thắt; nếu bcrypt là nút chính thì p95 chỉ giảm vừa phải.
- Failure/timeout giảm nhờ giảm Mongo write pressure và rate limit.
- Conversation/dashboard APIs kỳ vọng p95 giảm rõ khi cache hit, thường từ DB/populate/aggregate xuống Redis single-digit ms.
- Cache hit ratio mục tiêu: dashboard >80%, friends/suggestions >60%, conversation list 40-70% tùy realtime activity.

## H. Output Tổng Hợp

### Danh sách file đã đọc

- `backend/package.json`
- `backend/.env` key names only
- `backend/.env.test` key names only
- `backend/src/server.js`
- `backend/src/app/server.js`
- `backend/src/app/http/registerRoutes.js`
- `backend/src/libs/db.js`
- `backend/src/shared/infrastructure/db/connect-db.js`
- `backend/src/modules/auth/api/http/auth.route.js`
- `backend/src/modules/auth/api/http/auth.controller.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/modules/auth/infrastructure/token.service.js`
- `backend/src/modules/identity/api/http/auth.middleware.js`
- `backend/src/modules/identity/application/resolve-access-user-from-token.js`
- `backend/src/modules/identity/api/socket/socket-auth.middleware.js`
- `backend/src/middlewares/maintenanceMiddleware.js`
- `backend/src/modules/system/application/maintenance-access.service.js`
- `backend/src/modules/auth/infrastructure/maintenance-access.service.js`
- `backend/src/services/maintenanceService.js`
- `backend/src/models/User.js`
- `backend/src/models/Conversation.js`
- `backend/src/models/Message.js`
- `backend/src/models/Friend.js`
- `backend/src/models/FriendRequest.js`
- `backend/src/models/Report.js`
- `backend/src/models/Blocking.js`
- `backend/src/models/Session.js`
- `backend/src/models/AuditLog.js`
- `backend/src/models/AdminDeletionLog.js`
- `backend/src/models/PasswordResetOtp.js`
- `backend/src/app/socket/initSocket.js`
- `backend/src/socket/index.js`
- `backend/src/shared/infrastructure/realtime/user-presence.js`
- `backend/src/shared/infrastructure/realtime/socket-gateway.js`
- `backend/src/shared/infrastructure/realtime/socket-registry.js`
- `backend/src/modules/chat/api/http/conversation.route.js`
- `backend/src/modules/chat/api/http/conversation.controller.js`
- `backend/src/modules/chat/application/conversation.query-service.js`
- `backend/src/modules/chat/application/conversation.command-service.js`
- `backend/src/modules/chat/api/http/message.route.js`
- `backend/src/modules/chat/api/http/message.controller.js`
- `backend/src/modules/chat/application/message.command-service.js`
- `backend/src/middlewares/friendMiddleware.js`
- `backend/src/modules/friendship/api/http/friend.route.js`
- `backend/src/modules/friendship/api/http/friend.controller.js`
- `backend/src/modules/friendship/application/friendship.service.js`
- `backend/src/services/userDiscoveryService.js`
- `backend/src/repositories/userDiscoveryRepository.js`
- `backend/src/modules/user-profile/api/http/user.route.js`
- `backend/src/modules/user-profile/api/http/user.controller.js`
- `backend/src/modules/user-profile/application/user-profile.service.js`
- `backend/src/modules/moderation/api/http/report.route.js`
- `backend/src/modules/moderation/api/http/report.controller.js`
- `backend/src/modules/moderation/application/report-user.service.js`
- `backend/src/modules/moderation/application/report-admin.service.js`
- `backend/src/modules/admin-panel/api/http/admin.route.js`
- `backend/src/modules/admin-panel/api/http/admin.controller.js`
- `backend/src/modules/admin-panel/application/dashboard.service.js`
- `backend/src/modules/admin-panel/application/admin-read.service.js`
- `backend/src/modules/admin-panel/application/user-management.service.js`
- `backend/src/services/dashboardRealtimeService.js`

### Endpoint nên cache

- `GET /api/conversations`
- `GET /api/conversations/:conversationId/messages`
- `GET /api/conversations/:conversationId/details`
- `GET /api/friends`
- `GET /api/friends/requests`
- `GET /api/users/search`
- `GET /api/users/suggestions`
- `GET /api/users/blocks`
- `GET /api/reports/me`
- `GET /api/admin/dashboard`
- `GET /api/admin/dashboard/overview`
- `GET /api/admin/dashboard/charts/users`
- `GET /api/admin/dashboard/charts/messages`
- `GET /api/admin/dashboard/charts/reports`
- `GET /api/admin/dashboard/charts/support`
- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `GET /api/admin/friends`
- `GET /api/admin/friend-requests`
- `GET /api/admin/conversations`
- `GET /api/admin/conversations/:id`
- `GET /api/admin/messages`
- `GET /api/admin/reports`
- `GET /api/admin/reports/:id`
- `GET /api/admin/blocks`
- `GET /api/admin/blocks/:id`

### Endpoint không nên cache

- `POST /api/auth/signin`, `signup`, `signout`, `refresh`, password/email verification flows.
- All mutation routes: `POST/PATCH/DELETE /api/messages/*`, `/api/conversations/*`, `/api/friends/*`, `/api/users/me`, `/api/users/blocks/*`, `/api/reports`, admin mutation routes.
- Upload routes with files.
- `PATCH /api/conversations/:id/seen` because it mutates unread state.

### Redis key naming convention

- Prefix app/env: `chatrt:{env}:...`
- Use lowercase resource names and stable IDs.
- Hash unsafe/high-cardinality query strings: `q:{sha256(JSON.stringify(query))}`.
- Examples:
  - `chatrt:prod:maintenance:config`
  - `chatrt:prod:auth:user:{userId}`
  - `chatrt:prod:session:refresh:{tokenHash}`
  - `chatrt:prod:user:{userId}:conversations`
  - `chatrt:prod:conversation:{conversationId}:messages:user:{userId}:q:{queryHash}`
  - `chatrt:prod:user:{userId}:friends`
  - `chatrt:prod:admin:dashboard:overview`
  - `chatrt:prod:rl:auth:signin:ip:{ipHash}`
  - `chatrt:prod:presence:user:{userId}`

### TTL table

| Data | TTL |
|---|---:|
| maintenance config | 30-60s |
| auth user payload | 5-15m |
| refresh session | 14d |
| login rate limit window | 5-10m |
| forgot password rate limit | 15m |
| conversation list | 15-30s |
| message page | 10-30s |
| group detail | 60s |
| friend list | 1-5m |
| friend requests | 15-60s |
| suggestions/search | 30-60s |
| reports list | 30-60s |
| admin dashboard overview | 10-30s |
| admin charts | 1-5m |
| presence heartbeat | 60-90s |
| cache lock | 3-10s |

### Invalidation table

| Event | Keys/patterns cần xóa |
|---|---|
| login/logout | `session:*`, optional user session set |
| user status/role/profile/avatar/preferences update | `auth:user:{id}`, `user:{id}:*`, search/suggestions related keys |
| send message | `conversation:{id}:messages:*`, `user:{participant}:conversations`, admin dashboard/messages |
| edit/delete/reaction message | `conversation:{id}:messages:*`, `user:{participant}:conversations` if lastMessage affected |
| mark seen | `user:{userId}:conversations` |
| create/delete/leave group | participant conversation lists, group detail, admin conversations/dashboard |
| group name/avatar/member update | `conversation:{id}:details:*`, participant conversation lists |
| friend request send/cancel/accept/decline | both users friend request/suggestions/search keys; accept also friend lists |
| remove friend | both users friend lists/conversation lists/suggestions; conversation/message caches if direct chat deleted |
| block/unblock | blocker blocks, both users suggestions/search/conversation lists |
| report create/status/action | user reports, admin reports, dashboard report chart/overview |
| maintenance toggle/message update | `maintenance:config`, dashboard overview |

### Implementation checklist

- [ ] Add Redis client with connection events and graceful shutdown.
- [ ] Add cache helper with JSON serialization, TTL jitter, safe fallback.
- [ ] Add cache key builder and invalidation helper.
- [ ] Add Redis health check.
- [ ] Cache maintenance config first.
- [ ] Add auth rate limiter.
- [ ] Move refresh session to Redis with hashed token key.
- [ ] Cache `resolveAccessUserFromToken` user payload with safe invalidation.
- [ ] Cache conversation/message/friend/suggestion/report/dashboard reads.
- [ ] Add invalidation at every mutation path.
- [ ] Add metrics: hit/miss, Redis latency, fallback count.
- [ ] Add Socket.IO Redis adapter.
- [ ] Move presence to Redis heartbeat model.
- [ ] Add BullMQ for background tasks.
- [ ] Rerun k6 and compare p95/failure rate.

### Rủi ro và rollback plan

Rủi ro:

- Cache stale làm user bị ban vẫn dùng được nếu auth payload TTL quá dài.
- Message cache có thể leak dữ liệu nếu key thiếu `userId`.
- Pattern delete quá rộng có thể gây Redis block khi key count lớn.
- Redis outage có thể ảnh hưởng login/session nếu cutover không có fallback.
- Presence multi-instance cần adapter, nếu chỉ chuyển Map sang Redis một phần sẽ lệch room emit.

Rollback:

- Dùng env flags: `CACHE_ENABLED`, `RATE_LIMIT_ENABLED`, `REDIS_SESSION_ENABLED`, `SOCKET_REDIS_ADAPTER_ENABLED`.
- Phase 1 dual-write/dual-read session Redis + MongoDB trước khi bỏ MongoDB `Session`.
- Nếu Redis lỗi: tắt cache/rate-limit bằng env và restart, app quay về MongoDB source of truth.
- Giữ MongoDB indexes/migrations độc lập với Redis rollout.
- Log cache key version để invalidate toàn bộ bằng đổi prefix version: `chatrt:{env}:v2:*`.
