# Chat-Real

Ứng dụng chat thời gian thực được xây dựng theo mô hình full stack, mô phỏng các chức năng cơ bản của một nền tảng nhắn tin hiện đại.  
Dự án tập trung vào việc xử lý giao tiếp real-time, xác thực người dùng, quản lý hội thoại và tổ chức luồng dữ liệu giữa frontend và backend.

## Giới thiệu

Chat-Real là dự án cá nhân được thực hiện nhằm rèn luyện tư duy xây dựng hệ thống chat thực tế với các thành phần chính:

- Giao tiếp giữa frontend và backend qua REST API
- Xác thực người dùng bằng JWT
- Kết nối real-time bằng Socket.IO
- Lưu trữ dữ liệu với MongoDB
- Quản lý người dùng, bạn bè, cuộc trò chuyện và tin nhắn

Hiện tại dự án đang được phát triển chủ yếu trên môi trường local và tiếp tục được mở rộng thêm các tính năng nâng cao.

## Mục tiêu dự án

- Xây dựng một ứng dụng chat real-time hoàn chỉnh theo hướng full stack
- Hiểu rõ luồng dữ liệu giữa client, server và database
- Thực hành thiết kế REST API kết hợp Socket.IO
- Nâng cao kỹ năng authentication, state management và xử lý dữ liệu real-time
- Làm nền tảng để mở rộng lên các tính năng như quản trị hệ thống, report người dùng và tối ưu hiệu năng

## Tính năng hiện có

- Đăng ký tài khoản
- Đăng nhập / đăng xuất
- Xác thực người dùng bằng JWT
- Gửi và nhận tin nhắn theo thời gian thực
- Hiển thị trạng thái online / offline
- Quản lý danh sách cuộc trò chuyện
- Lưu lịch sử tin nhắn
- Gửi lời mời kết bạn
- Chấp nhận / từ chối lời mời kết bạn

## Công nghệ sử dụng

### Frontend

- React
- JavaScript / TypeScript
- Axios
- Socket.IO Client
- Vite

### Backend

- Node.js
- Express.js
- Socket.IO
- JWT Authentication
- RESTful API

### Database

- MongoDB
- Mongoose

### Công cụ hỗ trợ

- Git
- Postman

## Kiến trúc tổng quan

Hệ thống được chia thành 3 phần chính:

### Frontend

Frontend chịu trách nhiệm:

- Hiển thị giao diện người dùng
- Gửi request tới backend qua REST API
- Kết nối socket để nhận và gửi dữ liệu real-time
- Quản lý trạng thái hội thoại, tin nhắn và người dùng online

### Backend

Backend chịu trách nhiệm:

- Xử lý authentication và authorization
- Cung cấp REST API cho các chức năng chính
- Xử lý sự kiện real-time thông qua Socket.IO
- Quản lý dữ liệu người dùng, cuộc trò chuyện và tin nhắn

### Database

MongoDB được sử dụng để lưu trữ:

- Thông tin người dùng
- Danh sách bạn bè / lời mời kết bạn
- Cuộc trò chuyện
- Tin nhắn
- Trạng thái liên quan đến hệ thống chat

## Luồng hoạt động chính

### REST API dùng cho

- Đăng ký / đăng nhập
- Lấy thông tin người dùng
- Lấy danh sách cuộc trò chuyện
- Quản lý lời mời kết bạn
- Lấy lịch sử tin nhắn

### Socket.IO dùng cho

- Gửi tin nhắn real-time
- Nhận tin nhắn real-time
- Đồng bộ trạng thái online / offline
- Cập nhật dữ liệu hội thoại ngay lập tức

### JWT dùng cho

- Xác thực request từ client đến server
- Bảo vệ các API cần đăng nhập
- Xác thực kết nối socket

## Cấu trúc dữ liệu chính

Dự án hiện xoay quanh các thực thể chính:

- **User**
- **Conversation**
- **Message**
- **Friend Request**

Từ các thực thể này, hệ thống xử lý được:

- Quan hệ giữa người dùng
- Tạo cuộc trò chuyện
- Lưu lịch sử chat
- Đồng bộ tin nhắn mới theo thời gian thực

## Cài đặt và chạy dự án trên local

### 1. Clone project

```bash
git clone <your-repository-url>
cd chat-real
```
