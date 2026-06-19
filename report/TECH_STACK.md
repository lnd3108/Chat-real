# Tech Stack - ChatRealTime

## 1. Tổng quan stack

| Nhóm | Công nghệ | Vai trò |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite | Xây dựng giao diện người dùng dạng SPA |
| Routing/API | React Router, Axios | Điều hướng trang và gọi REST API |
| State Management | Zustand | Quản lý trạng thái auth, socket, chat, user, admin |
| UI | Tailwind CSS, Radix UI, shadcn-style components, lucide-react, sonner | Xây dựng UI responsive, modal, icon, toast |
| Backend | Node.js, Express | REST API, middleware, route nghiệp vụ |
| Database | MongoDB, Mongoose | Lưu dữ liệu chính và định nghĩa schema/model |
| Realtime | Socket.IO | Chat realtime, notification, presence, call signaling |
| Cache/Session/Presence | Redis, ioredis | Cache, rate limit, refresh session helper, presence, BullMQ backend |
| Realtime Scale | @socket.io/redis-adapter | Đồng bộ emit/broadcast Socket.IO giữa nhiều worker/process |
| Queue | BullMQ | Background jobs, email queue, scheduled cleanup jobs |
| Email | Nodemailer | Gửi email xác thực, OTP, đổi email, xóa tài khoản, bảo trì |
| Media | Cloudinary, multer | Upload ảnh đại diện, ảnh nhóm, ảnh tin nhắn |
| Auth | JWT, httpOnly cookie, Bearer token | Xác thực REST API và Socket.IO |
| Security | Helmet, CORS whitelist, HTTPS middleware, cookie helper | Bảo mật transport, header, cookie và origin |
| Validation | Zod | Validate input request |
| Test | Jest, Supertest | Unit/integration test backend |
| Load Test | k6 | Kiểm thử tải endpoint login |
| Runtime | Node.js cluster | Chạy nhiều worker backend trong môi trường dev/benchmark |
| Documentation | Markdown report, Swagger UI | Tài liệu kỹ thuật và API docs |

## 2. Frontend

Frontend dùng React + TypeScript + Vite. Ứng dụng được chia theo feature như auth, chat, friend, admin, settings, notification và call. Axios gọi REST API với `withCredentials` để hỗ trợ cookie auth. Socket.IO client kết nối realtime sau khi đăng nhập.

Các nhóm màn hình chính:

- Auth: đăng nhập, đăng ký, quên mật khẩu, xác minh email.
- Chat: danh sách hội thoại, chat 1-1, chat nhóm, gửi ảnh, reply, reaction, seen.
- Friend: danh sách bạn bè, lời mời kết bạn, gợi ý bạn bè.
- Profile/settings: hồ sơ, avatar, đổi mật khẩu, tùy chọn online, chặn/báo cáo.
- Admin: dashboard, quản lý user, conversation, message, report, support, maintenance.
- Call: voice/video call 1-1 và group call MVP bằng WebRTC mesh.

## 3. Backend

Backend dùng Express REST API kết hợp Socket.IO. Code được tổ chức theo các lớp route/controller/service/model và các module nghiệp vụ:

- `auth`: đăng nhập, đăng ký, refresh, logout, đổi mật khẩu, xác minh email, quên mật khẩu.
- `chat`: conversation, message, group, support conversation.
- `friendship`: bạn bè, lời mời kết bạn, suggestion.
- `user-profile`: hồ sơ, avatar, preference, block.
- `moderation`: report, block, admin moderation.
- `admin-panel`: dashboard, user management, report/admin list.
- `system`: maintenance mode, health, config hệ thống.
- `calls`: voice/video call signaling và call session.

Middleware chính gồm auth middleware, role/permission guard, maintenance check, validation, CORS, security headers, HTTPS enforcement, rate limit auth bằng Redis và Swagger `/api-docs`.

## 4. MongoDB

MongoDB là source of truth của hệ thống. Các collection/model chính:

- `User`: tài khoản, email, mật khẩu hash, vai trò/quyền, trạng thái, avatar, profile, preference, blockedUsers.
- `Session`: refresh token/session, userId, expiresAt TTL.
- `Conversation`: hội thoại direct/group/support, participants, lastMessage, unread count, support status.
- `Message`: nội dung tin nhắn, sender snapshot, image, reply, reaction, delete flags, call metadata.
- `Friend`: quan hệ bạn bè theo cặp userA/userB.
- `FriendRequest`: lời mời kết bạn, from/to/status/message.
- `Report`: báo cáo vi phạm, reporter, target, status, snapshot.
- `Blocking`: quan hệ chặn, blocker/blocked, trạng thái active.
- `Maintenance`: trạng thái bảo trì và thông tin xác nhận bật/tắt.
- `AuditLog` và `AdminDeletionLog`: nhật ký quản trị.
- `PasswordResetOtp`, `EmailChangeVerification`: OTP có TTL.
- `CallSession`: trạng thái phiên gọi, participant, loại cuộc gọi, metadata.

Index quan trọng đã/được đề xuất gồm `users.userName`, `users.email`, conversation theo `participants.userId + lastMessageAt/updatedAt`, message theo `conversationId + createdAt`, friend pair, friend request by from/to/status, report by status/createdAt, block by user pair và session TTL.

## 5. Redis

Redis được dùng cho các nhóm sau:

- Auth user lookup cache trong signin.
- Refresh session helper dùng key hash refresh token, không log raw token.
- Maintenance L2 cache và kết hợp L1 in-memory cache per worker.
- Rate limit auth endpoints như login/register/forgot-password.
- Conversation list cache.
- Friend list, friend request, suggestion cache.
- Admin dashboard cache.
- Socket.IO Redis adapter để broadcast xuyên worker.
- Redis presence để lưu user online/socketIds thay vì phụ thuộc Map local.
- BullMQ backend cho email queue và scheduled cleanup jobs.

Key naming được đặt theo prefix môi trường, ví dụ `chatrt:dev:*`, `chatrt:queue:*`, `chatrt:phase2a:*`, để dễ cô lập dev/test/benchmark.

## 6. BullMQ

BullMQ được thêm ở Phase 2D theo hướng mặc định tắt bằng env flag:

- `BULLMQ_ENABLED=false`
- `EMAIL_QUEUE_ENABLED=false`
- `QUEUE_WORKER_ENABLED=false`
- `CLEANUP_QUEUE_ENABLED=false`

Các queue/job chính:

- Email queue: gửi email xác minh, OTP, đổi email, xóa tài khoản, maintenance confirmation ở background worker.
- `cleanup-stale-presence`: dọn Redis presence key stale bằng `SCAN`, không dùng `KEYS`.
- `cleanup-old-queue-jobs`: dọn job BullMQ cũ ở trạng thái `completed`/`failed`, không xóa `active/waiting/delayed`.

Nếu queue tắt hoặc Redis/BullMQ lỗi, luồng gửi email có fallback SMTP trực tiếp để không làm hỏng API chính.

## 7. Bảo mật

Các lớp bảo mật chính:qư

- JWT access token cho REST API và Socket.IO.
- Refresh token qua httpOnly cookie.
- Vẫn giữ Bearer flow để tương thích frontend/API hiện tại.
- Cookie helper chuẩn hóa `httpOnly`, `secure`, `sameSite`, `maxAge`, path.
- CORS whitelist cho Express và Socket.IO; không dùng wildcard `*` với credentials.
- Helmet/security headers, HSTS khi production HTTPS.
- HTTPS enforcement có rollback flag.
- Production env validation cho URL HTTPS/WSS.
- Không log password, token, cookie, Authorization header, OTP hoặc HTML email.

Hạn chế còn lại: refresh token chưa rotate, CSP vẫn cần phase riêng để không làm vỡ Swagger/Socket/Cloudinary/call, và production cần kiểm tra hạ tầng HTTPS/private network đầy đủ.

## 8. Hiệu năng

Các tối ưu hiệu năng đã thực hiện:

- Redis refresh session helper để giảm phụ thuộc MongoDB cho refresh/session path.
- Auth timing logs và pipeline timing cho signin.
- Mongo pool/command monitor và benchmark user lookup.
- Redis auth user lookup cache giúp cache hit giảm `userLookupAwaitMs` xuống khoảng 0.7-3ms.
- Maintenance L1 cache + single-flight giúp giảm spike `maintenanceReadMs` khi cache hit.
- Redis cache cho conversation list, friend list/request/suggestions và admin dashboard.
- MongoDB index/query/pagination audit, có script `scripts/audit-indexes.js`.
- Node cluster benchmark cho login.
- k6 load test cho các mode missing user, wrong password, valid login.

Số liệu tổng hợp đáng chú ý từ report cũ:

- Baseline 100 VUs từng có p95 gần 5s và request failed khoảng 4.55%-6.25%.
- Sau Redis auth user lookup cache, 25 VUs có p95 khoảng 146ms và failed 0%.
- Sau auth cache + maintenance L1, 40-50 VUs có p95 khoảng 256-275ms nhưng vẫn còn failed/timeout nhỏ, cần smoke và profiling tiếp.

