# DFD ChatRealTime

Các biểu đồ dưới đây được viết bằng Mermaid, dựa trên backend Express, MongoDB và Socket.IO trong thư mục `backend/src`.

## 1. DFD mức ngữ cảnh

```mermaid
flowchart LR
  User["Người dùng"]
  Admin["Quản trị viên"]
  Google["Google OAuth"]
  SMTP["SMTP/Gmail"]
  Cloudinary["Cloudinary"]

  System(("Hệ thống ChatRealTime"))

  User -- "Đăng ký, đăng nhập, cập nhật hồ sơ" --> System
  User -- "Quản lý bạn bè, chặn/bỏ chặn" --> System
  User -- "Tạo hội thoại, gửi/nhận tin nhắn realtime" --> System
  User -- "Gửi báo cáo, yêu cầu hỗ trợ" --> System
  System -- "Token, dữ liệu hồ sơ, danh sách bạn bè" --> User
  System -- "Tin nhắn, trạng thái online, thông báo realtime" --> User

  Admin -- "Quản lý user, báo cáo, support, bảo trì, dashboard" --> System
  System -- "Thống kê, log, trạng thái hệ thống, thông báo realtime" --> Admin

  System -- "Yêu cầu xác thực OAuth" --> Google
  Google -- "Thông tin tài khoản Google" --> System

  System -- "Email OTP/xác minh/thông báo" --> SMTP
  SMTP -- "Trạng thái gửi email" --> System

  System -- "Upload/xóa ảnh avatar, ảnh nhóm, ảnh tin nhắn" --> Cloudinary
  Cloudinary -- "URL/publicId ảnh" --> System
```

## 2. DFD mức 1 của hệ thống

```mermaid
flowchart LR
  User["Người dùng"]
  Admin["Quản trị viên"]
  Google["Google OAuth"]
  SMTP["SMTP/Gmail"]
  Cloudinary["Cloudinary"]

  P1(("1.0 Xác thực và phiên đăng nhập"))
  P2(("2.0 Hồ sơ người dùng và thiết lập"))
  P3(("3.0 Bạn bè và quan hệ chặn"))
  P4(("4.0 Hội thoại và tin nhắn realtime"))
  P5(("5.0 Báo cáo vi phạm"))
  P6(("6.0 Hỗ trợ người dùng"))
  P7(("7.0 Quản trị, RBAC và bảo trì"))
  P8(("8.0 Realtime gateway và presence"))

  D1[("D1 Users")]
  D2[("D2 Sessions / OTP / EmailChange")]
  D3[("D3 Friends / FriendRequests")]
  D4[("D4 Conversations")]
  D5[("D5 Messages")]
  D6[("D6 Reports")]
  D7[("D7 Maintenance / Audit / AdminDeletion")]
  D8[("D8 Socket presence in-memory")]

  User -- "Thông tin đăng ký/đăng nhập, OTP, refresh token" --> P1
  P1 -- "Token, trạng thái đăng nhập" --> User
  P1 <--> D1
  P1 <--> D2
  P1 -- "OAuth code/token" --> Google
  Google -- "Google profile" --> P1
  P1 -- "Email xác minh, quên mật khẩu, xóa tài khoản" --> SMTP

  User -- "Cập nhật hồ sơ, avatar, preferences, tìm kiếm user" --> P2
  P2 -- "Hồ sơ, gợi ý user, danh sách block" --> User
  P2 <--> D1
  P2 -- "Upload/xóa avatar" --> Cloudinary

  User -- "Gửi/duyệt/từ chối/hủy yêu cầu kết bạn" --> P3
  P3 -- "Danh sách bạn bè, lời mời, trạng thái block" --> User
  P3 <--> D1
  P3 <--> D3
  P3 --> P8

  User -- "Tạo hội thoại, đọc lịch sử, gửi/sửa/xóa/react tin nhắn" --> P4
  P4 -- "Hội thoại, tin nhắn, unread/seen" --> User
  P4 <--> D1
  P4 <--> D3
  P4 <--> D4
  P4 <--> D5
  P4 -- "Upload/xóa ảnh tin nhắn hoặc ảnh nhóm" --> Cloudinary
  P4 --> P8

  User -- "Tạo báo cáo, xem báo cáo của mình" --> P5
  P5 -- "Trạng thái báo cáo" --> User
  P5 <--> D1
  P5 <--> D4
  P5 <--> D5
  P5 <--> D6
  P5 --> P8

  User -- "Tạo cuộc hỗ trợ, gửi tin nhắn support" --> P6
  Admin -- "Xem, trả lời, gán, cập nhật trạng thái support" --> P6
  P6 -- "Tin nhắn/trạng thái support" --> User
  P6 -- "Danh sách và chi tiết support" --> Admin
  P6 <--> D1
  P6 <--> D4
  P6 <--> D5
  P6 --> P8

  Admin -- "Quản lý user, role, report, dashboard, bảo trì" --> P7
  P7 -- "Dữ liệu quản trị, thống kê, trạng thái bảo trì" --> Admin
  P7 <--> D1
  P7 <--> D3
  P7 <--> D4
  P7 <--> D5
  P7 <--> D6
  P7 <--> D7
  P7 -- "Email mã xác nhận bảo trì/thông báo xóa tài khoản" --> SMTP
  P7 --> P8

  User -- "Socket auth, join/leave conversation, active conversation" --> P8
  Admin -- "Socket admin room, dashboard realtime" --> P8
  P8 -- "online-users, presence, new-message, admin notifications" --> User
  P8 -- "presence, dashboard/report/support realtime" --> Admin
  P8 <--> D8
  P8 --> D4
```

## 3. DFD mức 2: chức năng gửi tin nhắn realtime

```mermaid
flowchart LR
  Sender["Người gửi"]
  Recipient["Người nhận / thành viên nhóm"]
  Cloudinary["Cloudinary"]

  P41(("4.1 Nhận request gửi tin nhắn"))
  P42(("4.2 Xác thực token và kiểm tra middleware"))
  P43(("4.3 Kiểm tra quyền gửi"))
  P44(("4.4 Tìm hoặc tạo hội thoại"))
  P45(("4.5 Upload ảnh đính kèm nếu có"))
  P46(("4.6 Tạo Message và snapshot reply"))
  P47(("4.7 Cập nhật Conversation lastMessage, unreadCounts, seenBy"))
  P48(("4.8 Chuẩn hóa payload trả về"))
  P49(("4.9 Phát Socket.IO realtime"))

  D1[("D1 Users")]
  D3[("D3 Friends / BlockedUsers")]
  D4[("D4 Conversations")]
  D5[("D5 Messages")]
  D8[("D8 Socket rooms / presence")]

  Sender -- "POST /api/messages/direct hoặc /group\ncontent, recipientId/conversationId, file, replyToMessageId" --> P41
  P41 -- "Access token, body, file" --> P42
  P42 <--> D1
  P42 -- "req.user hợp lệ" --> P43
  P42 -- "401/403 nếu token không hợp lệ" --> Sender

  P43 <--> D1
  P43 <--> D3
  P43 <--> D4
  P43 -- "Direct: kiểm tra friendship/block/recipient\nGroup: kiểm tra membership" --> P44
  P43 -- "400/403/404 nếu không đủ điều kiện" --> Sender

  P44 <--> D4
  P44 -- "conversationId hợp lệ hoặc conversation mới" --> P45

  P45 -- "Buffer ảnh" --> Cloudinary
  Cloudinary -- "secure_url, public_id" --> P45
  P45 -- "imgUrl/imgPublicId hoặc null" --> P46

  P46 -- "Đọc tin nhắn gốc nếu replyToMessageId" --> D5
  P46 -- "Lưu message mới" --> D5
  P46 -- "message mới" --> P47

  P47 -- "Đọc trạng thái active conversation" --> D8
  P47 -- "Cập nhật lastMessageAt, lastMessage, unreadCounts, seenBy" --> D4
  P47 -- "conversation đã cập nhật" --> P48

  P48 -- "201, message, conversation payload" --> Sender
  P48 -- "Payload realtime" --> P49

  P49 -- "Lấy room/user socket đang online" --> D8
  P49 -- "emit new-message tới room conversation hoặc từng user" --> Recipient
  P49 -- "emit new-message tới chính người gửi nếu có socket khác" --> Sender
```

## Ghi chú ánh xạ backend

- Route gửi tin nhắn: `backend/src/modules/chat/api/http/message.route.js`.
- Controller gửi tin nhắn: `backend/src/modules/chat/api/http/message.controller.js`.
- Service nghiệp vụ gửi/lưu/phát tin: `backend/src/modules/chat/application/message.command-service.js`.
- Realtime emitter: `backend/src/modules/chat/infrastructure/realtime/message-realtime.js`.
- Socket.IO init, rooms, presence: `backend/src/app/socket/initSocket.js`.
- Kho dữ liệu chính: `User`, `Conversation`, `Message`, `Friend`, `FriendRequest`, `Report` trong `backend/src/models`.
