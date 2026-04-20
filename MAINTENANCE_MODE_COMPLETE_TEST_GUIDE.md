# Maintenance Mode - Frontend + Backend Complete Test Guide

## 🚀 Quick Start

### Backend Requirements
- Node.js with maintenance model, service, and routes implemented
- SMTP configured in .env for OTP emails
- MongoDB with Maintenance collection

### Frontend Requirements
- React with React Router
- TailwindCSS for styling
- Axios for API calls
- Lucide React for icons
- Sonner for toast notifications

## 📋 Complete Feature Flow Test

### Step 1: Admin Access Maintenance Page
```
1. Login as admin
2. Go to `/admin/maintenance`
3. See "Chế độ Bảo Trì" page
4. Current status displayed (🟢 HOẠT ĐỘNG or 🔴 ĐANG BẢO TRÌ)
```

### Step 2: Enable Maintenance Mode

**Phase 1: Password Verification**
```
1. Click "Bật Bảo Trì" button
2. Input field appears with "Bước 1: Xác Minh Mật Khẩu"
3. Enter admin password
4. See toggle icon to show/hide password
5. Click "Xác Minh" or press Enter
6. Wait for response...
```

**Phase 2: OTP Confirmation**
```
1. See new step: "Bước 2: Nhập Mã Xác Nhận"
2. Check admin email for 6-digit code
3. Code valid for 10 minutes
4. Enter 6-digit code (auto-formats)
5. Click "Xác Nhận & Bật Bảo Trì" or press Enter
6. Wait for response...
```

**Success**
```
✅ Toast: "Bảo trì hệ thống đã được bật"
✅ Status updates to "🔴 ĐANG BẢO TRÌ"
✅ Shows "enabledAt" timestamp
✅ All non-admin users are kicked out
```

### Step 3: Test User Blocking

While maintenance is ON:

**Regular Login - Should Show Maintenance Modal**
```
1. Open /signin (in incognito or different browser)
2. Try to login with regular user account
3. Should see: "🔧 Hệ Thống Đang Bảo Trì" modal
4. Shows maintenance message
5. Can close or reload
```

**Regular Registration - Should Show Maintenance Modal**
```
1. Open /signup
2. Fill registration form
3. Click signup
4. Should see maintenance modal
```

**Google OAuth - Should Show Maintenance Modal**
```
1. Click "Login with Google"
2. Authorize in Google popup
3. Should be redirected back with maintenance modal
```

**Socket Connections - Should Disconnect**
```
1. User tries to access chat (/) while logged in
2. Socket connection rejected with MAINTENANCE_MODE error
3. User sees disconnected state
```

**API Calls - Should Get 503**
```
1. Any API call should return:
   {
     "code": "MAINTENANCE_MODE",
     "message": "Hệ thống đang bảo trì..."
   }
   Status: 503
```

### Step 4: Update Maintenance Message

```
1. See "Tin Nhắn Bảo Trì" section
2. Click "Chỉnh Sửa"
3. Edit message in textarea
4. Click "Lưu Thay Đổi"
5. Message updated immediately
6. New message shown to users on next API call
```

### Step 5: Disable Maintenance Mode

**Phase 1: Password Verification (same as enable)**
```
1. Click "Tắt Bảo Trì" button
2. Enter admin password
3. Click "Xác Minh"
```

**Phase 2: OTP Confirmation (same as enable)**
```
1. Check email for new code
2. Enter 6-digit code
3. Click "Xác Nhận & Tắt Bảo Trì"
```

**Success**
```
✅ Toast: "Bảo trì hệ thống đã được tắt"
✅ Status updates to "🟢 HOẠT ĐỘNG"
✅ Shows "disabledAt" timestamp
✅ Users can now login/register
```

### Step 6: Verify Users Can Use App Again

After maintenance is disabled:

```
1. User tries login - ✅ Works
2. User tries register - ✅ Works  
3. User can access chat - ✅ Socket connects
4. All APIs work - ✅ No 503 errors
```

## 🧪 Error Scenarios Test

### Wrong Password
```
1. Click "Bật Bảo Trì"
2. Enter wrong password
3. ❌ See error: "Mật khẩu không chính xác"
4. Can retry
```

### Wrong OTP Code
```
1. Pass password verification
2. Enter wrong 6-digit code
3. ❌ See error: "Mã xác nhận không đúng."
4. Shows attempts: (1/5)
5. Can retry (up to 5 times)
```

### Max Attempts Exceeded
```
1. Enter wrong code 5 times
2. ❌ See lockout message
3. "Quá nhiều lần nhập sai. Vui lòng thử lại sau 30 phút."
4. Must wait 30 minutes to retry
```

### Code Expired
```
1. Pass password verification
2. Wait 10+ minutes
3. Enter code
4. ❌ See error: "Mã xác nhận đã hết hạn."
5. Must restart verification
```

### Network Error
```
1. During any step, simulate network failure
2. ❌ See error toast notification
3. User can retry
```

## 📊 API Verification

### Check Backend Logs
```bash
# Watch server logs while testing
npm run dev

# Should see:
[dotenv] injecting env
Liên Kết Dữ Liệu Thành Công!
[SMTP] SMTP đã cấu hình...
```

### Check Database
```javascript
// In MongoDB, check Maintenance collection
db.maintenances.findOne()
// Should show isEnabled: true/false, 
// enabledBy, enabledAt, etc.
```

### Inspect Network Requests

**Enable Maintenance Request**
```
POST /api/admin/maintenance/verify-password
{
  "password": "admin_password"
}
Response:
{
  "message": "Mã xác nhận đã được gửi tới email của bạn",
  "expiresAt": 1713607200000
}

POST /api/admin/maintenance/confirm-toggle
{
  "code": "123456",
  "enable": true
}
Response:
{
  "message": "Bảo trì hệ thống đã được bật",
  "isEnabled": true,
  "enabledAt": "2024-01-15T10:30:00.000Z"
}
```

**User Login During Maintenance**
```
POST /api/auth/signin
Response: 503
{
  "code": "MAINTENANCE_MODE",
  "message": "Hệ thống đang bảo trì..."
}
```

## ✅ Complete Checklist

### Backend Implementation
- [ ] Maintenance model created
- [ ] maintenanceService.js implemented
- [ ] Admin controller functions added
- [ ] Admin routes added
- [ ] Auth controllers updated with maintenance checks
- [ ] Socket middleware updated
- [ ] Auth middleware updated
- [ ] Mail utility updated with sendMaintenanceConfirmationCodeEmail
- [ ] Server starts without errors
- [ ] SMTP configured

### Frontend Implementation
- [ ] maintenanceService.ts created
- [ ] AdminMaintenance.tsx page created
- [ ] MaintenanceModeModal.tsx created
- [ ] AdminSidebar updated with maintenance link
- [ ] App.tsx routes updated
- [ ] MaintenanceModeModal added to App
- [ ] Frontend builds without errors
- [ ] Sidebar shows "Bảo Trì" link

### Feature Testing
- [ ] Admin can access maintenance page
- [ ] Can enable maintenance with 2-step verification
- [ ] Users blocked from login during maintenance
- [ ] Users blocked from registration during maintenance
- [ ] Google OAuth blocked during maintenance
- [ ] Socket connections rejected during maintenance
- [ ] Maintenance modal shows for 503 responses
- [ ] Can update maintenance message
- [ ] Can disable maintenance with 2-step verification
- [ ] Users can login/register after maintenance disabled
- [ ] Error handling works for wrong password
- [ ] Error handling works for wrong OTP
- [ ] Lockout works after 5 failed attempts
- [ ] Database persists maintenance state

### User Experience
- [ ] All UI elements render correctly
- [ ] Buttons work and show loading states
- [ ] Error messages display properly
- [ ] Toast notifications appear
- [ ] Modal appears for maintenance
- [ ] Icons and colors look good
- [ ] Responsive on mobile

## 🔧 Debugging Tips

### Backend Issues
```bash
# Check if routes are registered
curl http://localhost:5001/api/admin/maintenance/status

# Check if SMTP is configured
echo $SMTP_HOST $SMTP_PORT $SMTP_USER

# Watch database
db.maintenances.watch()
```

### Frontend Issues
```javascript
// Check axios interceptor
console.log(axiosInstance.interceptors.response);

// Check maintenance service
import { maintenanceService } from '@/services/maintenanceService';
maintenanceService.getStatus().then(console.log);

// Check socket error handling
console.log('Socket error:', socketError);
```

### Email Issues
```
# Verify SMTP:
1. Check email provider settings
2. Check app password vs regular password
3. Check email is correct in User model
4. Check mailbox for code email
5. Check spam folder
```

## 📱 Testing on Different Devices

### Desktop
- [ ] Firefox
- [ ] Chrome  
- [ ] Safari
- [ ] Edge

### Mobile
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Mobile responsiveness

### Network Conditions
- [ ] Fast connection
- [ ] Slow connection
- [ ] Offline mode
- [ ] Connection timeout

## 📈 Performance

- [ ] Page loads in < 2 seconds
- [ ] No console errors
- [ ] No console warnings
- [ ] Bundle size reasonable
- [ ] API responses < 1 second

## 🎯 Final Verification

Before deployment:

1. ✅ Code review completed
2. ✅ All tests passing
3. ✅ No TypeScript errors
4. ✅ No ESLint warnings
5. ✅ Documentation complete
6. ✅ Error messages clear
7. ✅ UX is intuitive
8. ✅ Security measures in place
9. ✅ Database migration ready
10. ✅ Rollback plan documented

---

**Test Date:** ___________
**Tester:** ___________
**Status:** ___________
**Issues Found:** ___________
**Notes:** ___________
