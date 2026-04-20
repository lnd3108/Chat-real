# Maintenance Mode Implementation

## Overview

The Maintenance Mode feature allows admins to put the system into maintenance mode with two-layer security verification:
1. **Layer 1**: Admin password verification  
2. **Layer 2**: Email confirmation code verification

When maintenance mode is enabled:
- All regular users are **logged out and disconnected**
- Regular login/registration is **blocked**
- Google/Gmail login/registration is **blocked**
- Token refresh is **blocked**
- Socket connections are **blocked**
- API calls are **blocked with 503 status code**
- **Admin dashboard remains fully functional**

## Files Created/Modified

### New Files

1. **src/models/Maintenance.js** - Database model for storing maintenance state
2. **src/services/maintenanceService.js** - Business logic for maintenance mode
3. **src/middlewares/maintenanceMiddleware.js** - Middleware to block requests during maintenance

### Modified Files

1. **src/utils/mail.js** - Added `sendMaintenanceConfirmationCodeEmail()` function
2. **src/middlewares/authMiddleware.js** - Added maintenance check to `protectedRoute`
3. **src/middlewares/socketMiddleWare.js** - Added maintenance check for socket connections
4. **src/controllers/authControllers.js** - Added maintenance checks to:
   - `signUp()`
   - `signIn()`
   - `googleCallback()`
   - `refreshToken()`
   - `verifyEmailCode()` (after email verification, before session creation)
5. **src/controllers/adminController.js** - Added maintenance management functions
6. **src/routes/adminRoute.js** - Added maintenance routes
7. **src/socket/index.js** - Added `disconnectAllUserSockets()` function
8. **src/server.js** - Registered maintenance middleware

## Database Model

### Maintenance Collection

```javascript
{
  _id: ObjectId,
  isEnabled: Boolean,           // true = maintenance on, false = maintenance off
  message: String,              // Maintenance message to show users
  
  // Two-factor confirmation state
  confirmationCodeHash: String, // SHA-256 hash of 6-digit code
  confirmationExpiresAt: Date,  // Code expiration time (10 minutes)
  confirmationAttempts: Number, // Number of incorrect attempts
  lastConfirmationAttemptAt: Date,
  
  // Password verification state
  passwordVerificationHash: String,
  passwordVerificationExpiresAt: Date,
  
  // Audit log
  enabledBy: ObjectId,          // Admin who enabled maintenance
  enabledAt: Date,
  disabledBy: ObjectId,         // Admin who disabled maintenance
  disabledAt: Date,
  
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

All endpoints are under `/api/admin/maintenance/` and require admin authentication.

### 1. GET /status
Get current maintenance mode status

**Response:**
```json
{
  "isEnabled": false,
  "message": "Hệ thống đang bảo trì...",
  "enabledAt": null,
  "enabledBy": null,
  "disabledAt": null,
  "disabledBy": null
}
```

### 2. POST /request-verification
Request password verification (admin initiates the process)

**Response:**
```json
{
  "message": "Yêu cầu xác minh mật khẩu đã được tạo. Vui lòng kiểm tra email.",
  "email": "admin@example.com"
}
```

### 3. POST /verify-password
**Step 1**: Admin submits their password

**Body:**
```json
{
  "password": "admin_password"
}
```

**Response (Success):**
```json
{
  "message": "Mã xác nhận đã được gửi tới email của bạn",
  "expiresAt": 1700000000000
}
```

**Response (Error):**
```json
{
  "message": "Mật khẩu không chính xác"
}
```

### 4. POST /confirm-toggle
**Step 2**: Admin submits confirmation code to toggle maintenance

**Body:**
```json
{
  "code": "123456",
  "enable": true
}
```

**Response (Success):**
```json
{
  "message": "Bảo trì hệ thống đã được bật",
  "isEnabled": true,
  "enabledAt": "2024-01-15T10:30:00.000Z",
  "disabledAt": null
}
```

**Response (Error - Wrong Code):**
```json
{
  "message": "Mã xác nhận không đúng.",
  "attempts": 2,
  "maxAttempts": 5
}
```

**Response (Error - Lockout):**
```json
{
  "message": "Quá nhiều lần nhập sai. Vui lòng thử lại sau 30 phút."
}
```

### 5. PATCH /message
Update the maintenance message

**Body:**
```json
{
  "message": "Hệ thống sẽ bảo trì trong 2 tiếng. Rất xin lỗi vì sự bất tiện này!"
}
```

**Response:**
```json
{
  "message": "Tin nhắn bảo trì đã được cập nhật",
  "maintenanceMessage": "Hệ thống sẽ bảo trì trong 2 tiếng..."
}
```

## User Experience

### When Maintenance is Disabled
- Users can register, login, and use the app normally
- All API endpoints work as expected
- Socket connections work as expected

### When Maintenance is Enabled

#### API Responses
All blocked endpoints return **503 Service Unavailable**:
```json
{
  "code": "MAINTENANCE_MODE",
  "message": "Hệ thống đang bảo trì, hãy quay lại sau 1 tiếng nữa nhé, rất xin lỗi vì sự làm phiền này nhưng chúng tôi cần bảo trì để nâng cao trải nghiệm của bạn."
}
```

#### Blocked Operations
1. **Registration** (`POST /api/auth/signup`) - 503 MAINTENANCE_MODE
2. **Login** (`POST /api/auth/signin`) - 503 MAINTENANCE_MODE
3. **Google OAuth** (`POST /api/auth/google/callback`) - 503 MAINTENANCE_MODE
4. **Token Refresh** (`POST /api/auth/refresh`) - 503 MAINTENANCE_MODE
5. **All user APIs** (messages, conversations, friends, etc.) - 503 MAINTENANCE_MODE
6. **Socket connections** - Rejected with MAINTENANCE_MODE error code

#### User Session Disconnection
When maintenance is enabled:
- All online non-admin users receive a `maintenance-mode` socket event
- All non-admin socket connections are forcefully disconnected
- All user data is cleared from the socketsByUser map
- Admin dashboard connections remain active

## Security Features

### Two-Layer Security

**Layer 1: Password Verification**
- Admin enters their account password
- Password is verified using bcrypt
- Valid for 5 minutes
- Used to prove admin identity

**Layer 2: Email Confirmation Code**
- 6-digit random code generated
- Sent to admin's registered email via SMTP
- Valid for 10 minutes
- Maximum 5 incorrect attempts
- 30-minute lockout after exceeding max attempts

### Prevention of Bypass

1. **Regular Login/Registration** - Maintenance check at controller level
2. **Google OAuth** - Maintenance check at callback function
3. **Token Refresh** - Maintenance check at controller level
4. **Socket Connections** - Maintenance check at socket middleware level
5. **Protected Routes** - Maintenance check at auth middleware level for all APIs

## Implementation Details

### Maintenance Check Flow

```
Request comes in
    ↓
maintenanceCheckMiddleware checks if:
  - Route is /api/admin/* → skip (admin routes bypass)
  - Maintenance enabled → return 503 MAINTENANCE_MODE
  - Otherwise → proceed to next middleware
    ↓
Auth controller/handler checks again:
  - For signup, signin, google callback, refresh token
  - Maintenance enabled → return 503 MAINTENANCE_MODE
    ↓
Socket middleware checks:
  - User is non-admin AND maintenance enabled
  - Reject connection with MAINTENANCE_MODE code
```

### Codes and Status

| Code | Status | Description |
|------|--------|-------------|
| MAINTENANCE_MODE | 503 | System is in maintenance mode |
| TOKEN_EXPIRED | 401/Socket Error | Access token expired |
| TOKEN_INVALID | 401/Socket Error | Token is invalid |
| ACCOUNT_BANNED | 403 | User account is banned |

## Testing Guide

### Manual Testing

1. **Start in maintenance mode disabled:**
   - Check `GET /api/admin/maintenance/status` → `isEnabled: false`

2. **Attempt to enable maintenance:**
   ```bash
   # Step 1: Verify password
   POST /api/admin/maintenance/verify-password
   { "password": "admin_password" }
   
   # Step 2: Submit confirmation code (from admin email)
   POST /api/admin/maintenance/confirm-toggle
   { "code": "123456", "enable": true }
   ```

3. **Verify maintenance is active:**
   - Check `GET /api/admin/maintenance/status` → `isEnabled: true`
   - Try `POST /api/auth/signup` → 503 MAINTENANCE_MODE
   - Try `POST /api/auth/signin` → 503 MAINTENANCE_MODE
   - Try socket connection as regular user → MAINTENANCE_MODE error
   - Admin dashboard should work normally

4. **Disable maintenance:**
   ```bash
   POST /api/admin/maintenance/verify-password
   { "password": "admin_password" }
   
   POST /api/admin/maintenance/confirm-toggle
   { "code": "654321", "enable": false }
   ```

5. **Verify maintenance is disabled:**
   - Check `GET /api/admin/maintenance/status` → `isEnabled: false`
   - Users can signup, signin, connect sockets normally

### Frontend Implementation Notes

The frontend should handle 503 responses with `code: "MAINTENANCE_MODE"`:

```typescript
// Check response
if (response.status === 503 && response.data?.code === "MAINTENANCE_MODE") {
  // Show maintenance mode modal/message
  showMaintenanceModal(response.data.message);
}
```

## Default Message

```
Hệ thống đang bảo trì, hãy quay lại sau 1 tiếng nữa nhé, rất xin lỗi vì sự làm phiền này nhưng chúng tôi cần bảo trì để nâng cao trải nghiệm của bạn.
```

(Translation: System is under maintenance. Please come back in 1 hour. We're sorry for the inconvenience, but we need to maintain the system to improve your experience.)

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Mật khẩu không chính xác" | Wrong admin password | Re-enter correct password |
| "Mã xác nhận không đúng" | Wrong confirmation code | Check email for correct code |
| "Quá nhiều lần nhập sai" | 5+ wrong attempts | Wait 30 minutes for lockout to expire |
| "Mã xác nhận đã hết hạn" | Code expired (10 min) | Request new verification |
| "SMTP chưa được cấu hình" | Email not configured | Configure SMTP in environment |

## Environment Variables

```env
# SMTP Configuration (required for confirmation codes)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@chatrealtime.com
SMTP_SECURE=false
```

## Audit Log

When an admin toggles maintenance mode:
- `enabledBy` / `disabledBy` - Admin ObjectId
- `enabledAt` / `disabledAt` - Timestamp of toggle
- Admin can check the status to see who enabled/disabled maintenance and when

## Future Enhancements

1. Add scheduling - Allow admins to schedule maintenance for future times
2. Countdown timer - Show users when maintenance will end
3. Notification system - Alert admins when maintenance starts/ends
4. Partial maintenance - Block only certain features instead of entire system
5. Maintenance reason - Let admins provide detailed reason for maintenance
6. Automatic recovery - Auto-disable maintenance after specified duration
7. Rate limiting - Limit confirmation code attempts per IP
8. Webhook notifications - Notify external services when maintenance toggles

## Troubleshooting

### Maintenance won't enable
- Check admin password is correct
- Verify SMTP is configured for confirmation code
- Check admin email is valid in User collection

### Users still able to login during maintenance
- Verify `isEnabled: true` in Maintenance collection
- Check if frontend is properly handling 503 responses
- Ensure socket middleware has been deployed

### Confirmation code not received
- Check SMTP configuration in environment variables
- Verify admin email in User collection
- Check spam/junk folder
- Resend verification (code valid for 10 minutes)

### Admin dashboard not working during maintenance
- Verify user has `role: "admin"`
- Check maintenanceCheckMiddleware skips `/api/admin/*` routes
- Verify admin token is valid
