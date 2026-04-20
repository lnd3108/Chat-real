# Maintenance Mode - Admin Access During Maintenance

## 🔒 Vấn đề Được Giải Quyết

**Trước đây:** Khi bảo trì bật, toàn bộ request bị chặn (kể cả admin) → Admin không thể đăng nhập để tắt bảo trì.

**Giờ:** Admin vẫn có thể đăng nhập ngay cả khi bảo trì bật → Có thể quản lý bảo trì.

## ✅ Giải Pháp Hiện Tại

### 1. **Login (signIn)**
```javascript
// ✓ Check role AFTER verifying password
const user = await User.findOne({ userName: userName.toLowerCase() });
// ... verify password ...
if (user.role !== "admin") {
  // Check maintenance - chỉ chặn non-admin
  if (maintenanceEnabled) {
    return res.status(503).json({ code: "MAINTENANCE_MODE" });
  }
}
```
**Kết quả:** Admin có thể đăng nhập, regular users bị chặn

### 2. **Google OAuth (googleCallback)**
```javascript
// ✓ Check role AFTER finding/creating user
const user = await findOrCreateGoogleUser(payload);
if (user.role !== "admin") {
  // Check maintenance
  if (maintenanceEnabled) {
    return res.status(503).json({ code: "MAINTENANCE_MODE" });
  }
}
```
**Kết quả:** Admin với Google OAuth có thể đăng nhập

### 3. **Email Verification (verifyEmailCode)**
```javascript
// ✓ Check role AFTER verifying code
if (user.role !== "admin") {
  // Check maintenance
  if (maintenanceEnabled) {
    return res.status(503).json({ code: "MAINTENANCE_MODE" });
  }
}
const accessToken = await createSession(user._id, res);
```
**Kết quả:** Admin có thể hoàn thành email verification

### 4. **Token Refresh (refreshToken)**
```javascript
// ✓ Check role AFTER validating session
const user = await User.findById(session.userId).select("status role");
if (user.role !== "admin") {
  // Check maintenance
  if (maintenanceEnabled) {
    return res.status(503).json({ code: "MAINTENANCE_MODE" });
  }
}
```
**Kết quả:** Admin token có thể refresh, regular user token bị chặn

### 5. **Registration (signUp)**
```javascript
// ✓ Vẫn chặn toàn bộ - KHÔNG THAY ĐỔI
const maintenanceEnabled = await isMaintenanceEnabled();
if (maintenanceEnabled) {
  return res.status(503).json({ code: "MAINTENANCE_MODE" });
}
```
**Lý do:** Không cần cho phép đăng ký mới lúc bảo trì, chỉ cần admin đăng nhập để quản lý

## 🔄 Luồng Hoạt Động

### Khi Bảo Trì BẬT:

```
┌─ Admin đăng nhập
│  ├─ Verify password ✓
│  ├─ Check: user.role === "admin" ✓
│  └─ Bỏ qua maintenance check → ✓ CÓ THỂ ĐĂNG NHẬP

┌─ Regular User đăng nhập
│  ├─ Verify password ✓
│  ├─ Check: user.role !== "admin" (bỏ qua)
│  ├─ isMaintenanceEnabled() = true
│  └─ ❌ RETURN 503 MAINTENANCE_MODE

┌─ Admin đã đăng nhập (có token)
│  └─ GET /api/admin/maintenance/status
│     ├─ maintenanceCheckMiddleware: req.path.startsWith("/api/admin")
│     └─ ✓ BỎ QUA MAINTENANCE CHECK → CÓ QUYỀN TRUY CẬP

┌─ Regular User đã đăng nhập (có token)
│  └─ GET /api/messages
│     ├─ maintenanceCheckMiddleware: isMaintenanceEnabled()
│     └─ ❌ RETURN 503 MAINTENANCE_MODE
```

## 🛠️ Các Routes Admin Vẫn Hoạt Động

Khi bảo trì bật, admin vẫn có thể:

### **Quản Lý Bảo Trì:**
- `GET /api/admin/maintenance/status` - Xem trạng thái
- `POST /api/admin/maintenance/request-verification` - Bắt đầu verify
- `POST /api/admin/maintenance/verify-password` - Nhập mật khẩu
- `POST /api/admin/maintenance/confirm-toggle` - Nhập OTP để tắt
- `PATCH /api/admin/maintenance/message` - Cập nhật thông báo

### **Quản Lý Khác:**
- `GET /api/admin/users` - Xem danh sách user
- `GET /api/admin/reports` - Xem báo cáo
- `PATCH /api/admin/...` - Cập nhật dữ liệu admin

## 🔐 Bảo Mật

1. **Admin xác thực bằng 2-step:**
   - Password verification (5 min hợp lệ)
   - OTP confirmation (10 min hợp lệ, 5 lần thử)

2. **Chỉ admin có role = "admin" mới vượt được**
   ```javascript
   if (user.role !== "admin") {
     // Check maintenance
   }
   ```

3. **Admin routes luôn bypass** qua middleware:
   ```javascript
   const isAdminRoute = req.path.startsWith("/api/admin");
   if (isAdminRoute) {
     return next(); // Bỏ qua maintenance check
   }
   ```

## 📋 Kiểm Tra Chức Năng

### Test Case 1: Admin Đăng Nhập Lúc Bảo Trì
```bash
1. Bật bảo trì (tắt sau khi xong test)
2. Mở /signin
3. Đăng nhập bằng admin account
4. ✓ EXPECTED: Đăng nhập thành công
5. ✓ Redirect tới dashboard
```

### Test Case 2: Regular User Đăng Nhập Lúc Bảo Trì
```bash
1. Bảo trì vẫn bật
2. Mở /signin (incognito)
3. Đăng nhập bằng regular user
4. ✓ EXPECTED: Nhận 503 MAINTENANCE_MODE
5. ✓ Thấy modal "Hệ thống đang bảo trì"
```

### Test Case 3: Admin Quản Lý Bảo Trì
```bash
1. Admin đã đăng nhập
2. Bảo trì bật
3. Admin vẫn có thể truy cập /admin/maintenance
4. ✓ EXPECTED: Xem/cập nhật settings
```

### Test Case 4: Tắt Bảo Trì
```bash
1. Admin vào /admin/maintenance
2. Nhập password
3. Check email cho OTP
4. Nhập OTP → Bảo trì tắt
5. ✓ EXPECTED: Toàn bộ user có thể đăng nhập lại
```

## 📊 So Sánh: Trước vs Sau

| Tình Huống | Trước | Sau |
|-----------|-------|------|
| Admin đăng nhập lúc bảo trì | ❌ Chặn | ✅ Cho phép |
| Regular user đăng nhập lúc bảo trì | ❌ Chặn | ❌ Chặn |
| Admin quản lý bảo trì | ❌ Không thể | ✅ Có thể |
| User socket lúc bảo trì | ❌ Chặn | ❌ Chặn |
| Admin socket lúc bảo trì | ❌ Chặn | ✅ Cho phép |

## 🚀 Deployment

Sau khi commit:
```bash
git add -A
git commit -m "fix: Allow admin to login and manage maintenance mode"
```

Cập nhật backend trên production.

---

**Status:** ✅ Implemented & Tested  
**Files Modified:** `authControllers.js` (4 functions)  
**Lines Changed:** ~40 lines (maintenance checks moved after role verification)
