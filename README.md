# Chat-real

# Real-time Chat Application (Full Stack)

## 📌 Giới thiệu

Real-time Chat Application là một dự án cá nhân được xây dựng nhằm mô phỏng hệ thống chat thời gian thực trong các ứng dụng mạng xã hội hiện nay.  
Dự án tập trung vào việc kết nối **frontend – backend**, xử lý **real-time communication**, **authentication**, và quản lý dữ liệu người dùng.

Hiện tại dự án đang trong quá trình hoàn thiện và được phát triển chủ yếu trên môi trường local.

---

## 🎯 Mục tiêu dự án

- Xây dựng ứng dụng chat real-time hoàn chỉnh
- Hiểu rõ luồng dữ liệu frontend ↔ backend
- Thực hành Socket.io, REST API và JWT Authentication
- Rèn luyện tư duy thiết kế hệ thống backend cho ứng dụng real-time

---

## 🧩 Chức năng chính

- Đăng ký / đăng nhập người dùng
- Xác thực người dùng bằng **JWT**
- Gửi và nhận tin nhắn **real-time**
- Quản lý danh sách cuộc trò chuyện
- Trạng thái người dùng online / offline
- Gửi, chấp nhận và từ chối **friend request**
- Lưu trữ lịch sử tin nhắn

---

## 🛠️ Công nghệ sử dụng

### Frontend

- React
- JavaScript / TypeScript
- Axios
- Socket.io Client

### Backend

- Node.js
- Express.js
- Socket.io
- JWT Authentication
- RESTful API

### Database

- MongoDB
- Mongoose

### Khác

- Git
- Postman (test API)

---

## 🧠 Kiến trúc tổng quan

- Frontend giao tiếp với backend thông qua REST API để:
  - Đăng nhập / đăng ký
  - Lấy danh sách cuộc trò chuyện
- Socket.io được sử dụng để:
  - Gửi / nhận tin nhắn real-time
  - Cập nhật trạng thái online
- JWT được dùng để xác thực người dùng cho cả API và socket connection
- MongoDB lưu trữ thông tin user, conversation và message

---

## ⚙️ Cài đặt & chạy dự án (Local)

### Backend

```bash
cd backend
npm install
npm start
```
