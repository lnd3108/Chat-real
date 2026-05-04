# Báo cáo tổng quan dự án ChatRealTime

## 1. Thông tin cơ bản

**Tên dự án:** ChatRealTime / Chat-Real
**Loại dự án:** Ứng dụng web chat thời gian thực
**Mô hình phát triển:** Full-stack Web Application
**Mục đích:** Xây dựng hệ thống nhắn tin trực tuyến có xác thực người dùng, quản lý hội thoại, gửi nhận tin nhắn realtime, quản trị hệ thống và hỗ trợ người dùng.

Dự án được tổ chức thành hai phần chính:

- **Frontend:** xây dựng giao diện người dùng bằng React, TypeScript và Vite.
- **Backend:** xây dựng REST API và Socket.IO server bằng Node.js, Express.js và MongoDB.

## 2. Mục tiêu dự án

Dự án hướng đến việc mô phỏng một nền tảng chat hiện đại với các nghiệp vụ thường gặp trong thực tế:

- Cho phép người dùng đăng ký, đăng nhập và xác thực phiên làm việc.
- Cho phép người dùng gửi, nhận, chỉnh sửa, xóa và phản ứng với tin nhắn.
- Hỗ trợ chat trực tiếp, chat nhóm và hội thoại hỗ trợ.
- Đồng bộ trạng thái online/offline theo thời gian thực.
- Quản lý bạn bè, lời mời kết bạn, chặn người dùng và báo cáo vi phạm.
- Cung cấp trang quản trị cho admin để theo dõi người dùng, hội thoại, báo cáo, hỗ trợ và trạng thái hệ thống.
- Thực hành tổ chức source code theo module, tách lớp API, service, model, realtime và giao diện.

## 3. Công nghệ sử dụng

### 3.1. Frontend

- **React 18:** xây dựng giao diện người dùng dạng component.
- **TypeScript:** tăng tính an toàn kiểu dữ liệu khi phát triển frontend.
- **Vite:** công cụ build và dev server cho frontend.
- **React Router:** quản lý định tuyến trang đăng nhập, đăng ký, chat và admin.
- **Axios:** gọi REST API từ frontend đến backend.
- **Socket.IO Client:** kết nối realtime với backend.
- **Zustand:** quản lý trạng thái ứng dụng như auth, socket, chat, user, admin.
- **Tailwind CSS:** xây dựng giao diện và responsive UI.
- **Radix UI, lucide-react, sonner:** hỗ trợ component giao diện, icon và thông báo.

### 3.2. Backend

- **Node.js:** môi trường chạy phía server.
- **Express.js:** xây dựng REST API.
- **Socket.IO:** xử lý giao tiếp thời gian thực.
- **MongoDB:** cơ sở dữ liệu NoSQL để lưu người dùng, hội thoại, tin nhắn và dữ liệu quản trị.
- **Mongoose:** định nghĩa schema/model và thao tác với MongoDB.
- **JWT:** xác thực access token cho REST API và Socket.IO.
- **bcrypt:** mã hóa mật khẩu.
- **cookie-parser:** xử lý cookie, phục vụ refresh token và phiên đăng nhập.
- **Cloudinary, multer:** hỗ trợ upload ảnh đại diện, ảnh nhóm và ảnh trong tin nhắn.
- **Nodemailer:** gửi email xác thực, OTP và các luồng liên quan đến tài khoản.
- **Zod:** validate dữ liệu đầu vào.
- **Jest, Supertest:** kiểm thử backend.

## 4. Cấu trúc thư mục tổng quan

```text
ChatRealTime/
├── backend/
│   ├── src/
│   │   ├── app/                 # Khởi tạo Express app, route và Socket.IO
│   │   ├── models/              # Mongoose models
│   │   ├── modules/             # Các module nghiệp vụ chính
│   │   ├── middlewares/         # Middleware xác thực, upload, bảo trì
│   │   ├── services/            # Service nghiệp vụ dùng chung
│   │   ├── shared/              # Hạ tầng, constants, adapters dùng chung
│   │   ├── tests/               # Unit/integration tests backend
│   │   └── server.js            # Entry point backend
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/                 # App root, route chính
│   │   ├── features/            # Các feature: auth, chat, admin, friend, settings
│   │   ├── shared/              # API client, UI components, hooks, realtime
│   │   └── main.tsx             # Entry point frontend
│   └── package.json
│
├── README.md
├── package.json
└── package-lock.json
```

## 5. Kiến trúc hệ thống

Hệ thống hoạt động theo mô hình client-server:

1. Người dùng thao tác trên giao diện React.
2. Frontend gửi request đến backend thông qua REST API để xử lý các nghiệp vụ như đăng nhập, lấy danh sách hội thoại, tạo hội thoại, gửi lời mời kết bạn.
3. Sau khi đăng nhập, frontend kết nối Socket.IO đến backend để nhận dữ liệu realtime.
4. Backend xác thực request bằng JWT, xử lý nghiệp vụ qua các module service/controller và lưu dữ liệu vào MongoDB.
5. Khi có sự kiện realtime như tin nhắn mới, user online/offline, report mới hoặc hỗ trợ mới, backend phát sự kiện Socket.IO đến các client liên quan.

Backend được tổ chức theo hướng module hóa. Các module chính gồm:

- **auth:** đăng ký, đăng nhập, Google OAuth, xác minh email, quên mật khẩu, đổi mật khẩu, xóa tài khoản.
- **identity:** middleware xác thực HTTP và Socket.IO.
- **chat:** hội thoại, tin nhắn, chat trực tiếp, chat nhóm.
- **friendship:** bạn bè và lời mời kết bạn.
- **user-profile:** hồ sơ cá nhân, avatar, tùy chọn, chặn người dùng.
- **moderation:** báo cáo vi phạm.
- **support:** hội thoại hỗ trợ giữa người dùng và nhân sự hỗ trợ/admin.
- **admin-panel:** dashboard, quản lý người dùng, vai trò, báo cáo, hội thoại, bảo trì hệ thống.
- **system:** trạng thái bảo trì và quyền truy cập khi bảo trì.

## 6. Các chức năng chính

### 6.1. Chức năng người dùng

- Đăng ký tài khoản.
- Đăng nhập, đăng xuất.
- Đăng nhập bằng Google.
- Xác minh email.
- Quên mật khẩu, xác thực OTP và đặt lại mật khẩu.
- Đổi mật khẩu.
- Cập nhật hồ sơ cá nhân.
- Cập nhật ảnh đại diện.
- Đổi email có xác thực OTP.
- Cấu hình tùy chọn như giao diện và hiển thị trạng thái online.
- Yêu cầu và xác nhận xóa tài khoản.

### 6.2. Chức năng chat

- Tạo hội thoại trực tiếp.
- Tạo hội thoại nhóm.
- Lấy danh sách hội thoại.
- Lấy lịch sử tin nhắn theo hội thoại.
- Gửi tin nhắn văn bản.
- Gửi tin nhắn kèm hình ảnh.
- Chỉnh sửa tin nhắn.
- Xóa tin nhắn phía cá nhân hoặc xóa với tất cả mọi người.
- Trả lời tin nhắn.
- Thả reaction bằng emoji.
- Đánh dấu đã xem.
- Cập nhật tên nhóm, ảnh nhóm, thành viên nhóm.
- Rời hoặc xóa hội thoại nhóm.

### 6.3. Chức năng realtime

- Xác thực kết nối Socket.IO bằng token.
- Theo dõi trạng thái online/offline của người dùng.
- Tự động join phòng socket theo user ID và conversation ID.
- Gửi thông báo realtime khi có tin nhắn mới.
- Cập nhật dashboard admin khi người dùng online/offline.
- Gửi sự kiện realtime cho admin khi có user mới, report mới, support message mới hoặc thay đổi bảo trì.

### 6.4. Chức năng bạn bè

- Gửi lời mời kết bạn.
- Chấp nhận hoặc từ chối lời mời.
- Hủy lời mời đã gửi.
- Xem danh sách bạn bè.
- Xóa bạn bè.
- Tìm kiếm và gợi ý người dùng.

### 6.5. Chức năng chặn và báo cáo

- Chặn người dùng.
- Bỏ chặn người dùng.
- Xem danh sách người dùng đã chặn.
- Báo cáo người dùng, tin nhắn hoặc hội thoại.
- Xem danh sách báo cáo của bản thân.
- Admin/moderator xử lý trạng thái báo cáo.
- Lưu snapshot dữ liệu tại thời điểm báo cáo để phục vụ kiểm duyệt.

### 6.6. Chức năng hỗ trợ

- Người dùng tạo hoặc mở hội thoại hỗ trợ.
- Người dùng gửi tin nhắn đến bộ phận hỗ trợ.
- Admin/support xem danh sách hội thoại hỗ trợ.
- Admin/support phản hồi, cập nhật trạng thái và phân công người xử lý.

### 6.7. Chức năng quản trị

Trang quản trị được bảo vệ bằng phân quyền, gồm các màn hình:

- Dashboard tổng quan.
- Quản lý người dùng.
- Chi tiết người dùng.
- Quản lý vai trò và quyền.
- Nhật ký audit log.
- Quản lý quan hệ bạn bè.
- Quản lý lời mời kết bạn.
- Quản lý hội thoại.
- Quản lý chặn người dùng.
- Quản lý report.
- Chi tiết report.
- Quản lý hội thoại hỗ trợ.
- Chế độ bảo trì hệ thống.

Các vai trò chính:

- **USER:** người dùng thông thường.
- **SUPPORT:** nhân sự hỗ trợ.
- **MODERATOR:** kiểm duyệt báo cáo và người dùng.
- **ADMIN:** quản trị hệ thống.
- **SUPER_ADMIN:** toàn quyền.

## 7. Cơ sở dữ liệu

Dự án sử dụng MongoDB với Mongoose. Các collection/model chính gồm:

- **User:** thông tin tài khoản, email, mật khẩu đã mã hóa, vai trò, quyền, trạng thái, avatar, hồ sơ cá nhân, tùy chọn và danh sách chặn.
- **Session:** quản lý phiên đăng nhập/refresh token.
- **Conversation:** lưu hội thoại direct, group hoặc support; danh sách thành viên; thông tin nhóm; tin nhắn cuối; unread count; trạng thái hỗ trợ.
- **Message:** nội dung tin nhắn, người gửi, ảnh, reply, reaction, trạng thái đã xóa và thời gian chỉnh sửa.
- **Friend:** quan hệ bạn bè giữa hai người dùng.
- **FriendRequest:** lời mời kết bạn và trạng thái xử lý.
- **Blocking:** quan hệ chặn giữa người dùng.
- **Report:** báo cáo vi phạm, đối tượng bị báo cáo, lý do, trạng thái xử lý và snapshot dữ liệu.
- **Maintenance:** trạng thái bảo trì, thông báo bảo trì và thông tin xác nhận bật/tắt.
- **AuditLog:** nhật ký hành động quản trị.
- **AdminDeletionLog:** lịch sử admin xóa tài khoản người dùng.
- **PasswordResetOtp:** mã OTP đặt lại mật khẩu.
- **EmailChangeVerification:** mã xác minh đổi email.

Một số index được thiết kế để tối ưu truy vấn:

- Tin nhắn theo `conversationId` và `createdAt`.
- Hội thoại theo thành viên và `lastMessageAt`.
- Report theo `status`, `reporterId`, `targetType`.
- Hội thoại support theo trạng thái, người tạo và admin được phân công.

## 8. API chính

Backend gom route dưới prefix `/api`.

### 8.1. Auth API

- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/signout`
- `POST /api/auth/refresh`
- `GET /api/auth/oauth2/google`
- `POST /api/auth/google/callback`
- `POST /api/auth/verify-email`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-forgot-password-otp`
- `POST /api/auth/reset-password`
- `PATCH /api/auth/change-password`
- `POST /api/auth/delete-account/request`
- `POST /api/auth/delete-account/confirm`

### 8.2. User API

- `GET /api/users/me`
- `PATCH /api/users/me`
- `POST /api/users/uploadAvatar`
- `GET /api/users/search`
- `GET /api/users/suggestions`
- `GET /api/users/blocks`
- `POST /api/users/blocks/:targetUserId`
- `DELETE /api/users/blocks/:targetUserId`
- `PATCH /api/users/me/preferences`

### 8.3. Chat API

- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:conversationId/messages`
- `GET /api/conversations/:conversationId/details`
- `PATCH /api/conversations/:conversationId/name`
- `PATCH /api/conversations/:conversationId/seen`
- `PATCH /api/conversations/:conversationId/members/add`
- `PATCH /api/conversations/:conversationId/members/remove`
- `DELETE /api/conversations/:conversationId`
- `POST /api/messages/direct`
- `POST /api/messages/group`
- `POST /api/messages/direct/with-image`
- `POST /api/messages/group/with-image`
- `PATCH /api/messages/:messageId`
- `DELETE /api/messages/:messageId/me`
- `DELETE /api/messages/:messageId/everyone`
- `POST /api/messages/:messageId/reactions`

### 8.4. Friend, Report, Support và Admin API

- Friend API: `/api/friends`
- Report API: `/api/reports`
- Support API: `/api/support`
- Admin support API: `/api/admin/support`
- Admin panel API: `/api/admin`

## 9. Bảo mật và phân quyền

Dự án có các cơ chế bảo vệ chính:

- Mật khẩu được mã hóa bằng bcrypt.
- REST API được bảo vệ bằng JWT access token.
- Refresh token được xử lý qua cookie.
- Socket.IO được xác thực bằng middleware riêng.
- Các API quan trọng dùng middleware `protectedRoute`.
- Trang admin dùng `AdminProtectedRoute`.
- Phân quyền dựa trên role và permission.
- Tài khoản có trạng thái `active`, `inactive`, `suspended`, `banned`.
- Admin có thể khóa/mở khóa/xóa người dùng tùy theo quyền.
- Hệ thống có audit log để ghi nhận hành động quản trị.
- Chế độ bảo trì có bước xác nhận bằng mật khẩu/mã xác nhận.

## 10. Cách chạy dự án

### 10.1. Backend

```bash
cd backend
npm install
npm run dev
```

Backend mặc định chạy ở port `5001` nếu không cấu hình biến môi trường `PORT`.

### 10.2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy bằng Vite. Biến môi trường quan trọng là `VITE_API_URL`, dùng để trỏ đến backend API.

### 10.3. Biến môi trường cần có

Một số biến môi trường backend thường cần cấu hình:

- `PORT`
- `CLIENT_URL`
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- Cấu hình SMTP cho chức năng gửi email.
- Cấu hình Google OAuth nếu dùng đăng nhập Google.

## 11. Kiểm thử

Backend có cấu hình Jest và Supertest. Các nhóm test trong dự án bao gồm:

- Auth.
- User profile.
- Friend.
- Chat conversation.
- Moderation/report.
- Support.
- Admin panel.

Lệnh chạy test backend:

```bash
cd backend
npm test
```

Frontend có script kiểm tra lint:

```bash
cd frontend
npm run lint
```

## 12. Đánh giá ưu điểm

- Dự án có đầy đủ frontend, backend và database.
- Có realtime bằng Socket.IO, phù hợp với bài toán chat.
- Source code được tách theo module nghiệp vụ, dễ mở rộng.
- Có phân quyền nhiều cấp cho admin, support, moderator và user.
- Có nhiều chức năng ngoài chat cơ bản như report, support, maintenance, audit log.
- Có xử lý upload ảnh, xác minh email, quên mật khẩu và Google OAuth.
- Có test backend cho nhiều module quan trọng.

## 13. Hạn chế hiện tại

- README hiện tại còn mô tả ở mức cơ bản, chưa phản ánh đầy đủ các chức năng admin, support, moderation và maintenance.
- Một số comment tiếng Việt trong source bị lỗi mã hóa khi đọc bằng terminal.
- Chưa thấy tài liệu thiết kế cơ sở dữ liệu dạng ERD/collection diagram.
- Chưa có tài liệu API chi tiết theo chuẩn Swagger/OpenAPI.
- Frontend có lint script nhưng cần chạy kiểm tra thực tế để xác nhận tình trạng hiện tại.
- Cần bổ sung hướng dẫn cấu hình `.env` mẫu để triển khai thuận tiện hơn.

## 14. Hướng phát triển

- Bổ sung tài liệu API bằng Swagger/OpenAPI.
- Bổ sung sơ đồ kiến trúc hệ thống và sơ đồ cơ sở dữ liệu.
- Hoàn thiện test frontend và kiểm thử end-to-end.
- Tối ưu hiệu năng tải lịch sử tin nhắn bằng pagination/infinite scroll.
- Bổ sung thông báo push hoặc service worker.
- Bổ sung quản lý file/media nâng cao.
- Tối ưu bảo mật token, rate limit và chống spam.
- Triển khai production bằng Docker hoặc nền tảng cloud.

## 15. Kết luận

ChatRealTime là một ứng dụng chat realtime full-stack có phạm vi chức năng tương đối đầy đủ cho một đồ án tốt nghiệp. Dự án không chỉ xử lý nghiệp vụ chat cơ bản mà còn mở rộng sang quản trị hệ thống, phân quyền, hỗ trợ người dùng, kiểm duyệt nội dung, báo cáo vi phạm và chế độ bảo trì. Kiến trúc module hóa giúp hệ thống dễ bảo trì, dễ mở rộng và phù hợp để trình bày trong báo cáo tốt nghiệp theo các nội dung: phân tích yêu cầu, thiết kế hệ thống, thiết kế cơ sở dữ liệu, cài đặt chức năng, kiểm thử và hướng phát triển.
