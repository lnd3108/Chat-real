# Maintenance Mode - Quick API Reference

## Endpoints

All endpoints require admin authentication (Bearer token in Authorization header)

### Get Status
```
GET /api/admin/maintenance/status
Response:
{
  "isEnabled": boolean,
  "message": "string",
  "enabledAt": date|null,
  "enabledBy": adminId|null,
  "disabledAt": date|null,
  "disabledBy": adminId|null
}
```

### Enable/Disable Flow

**Step 1: Request Verification**
```
POST /api/admin/maintenance/request-verification
Response:
{
  "message": "Yêu cầu xác minh mật khẩu đã được tạo. Vui lòng kiểm tra email.",
  "email": "admin@example.com"
}
```

**Step 1.5: Verify Password (triggers email send)**
```
POST /api/admin/maintenance/verify-password
Body: { "password": "admin_password" }

Success (200):
{
  "message": "Mã xác nhận đã được gửi tới email của bạn",
  "expiresAt": timestamp
}

Error (401):
{
  "message": "Mật khẩu không chính xác"
}
```

**Step 2: Confirm with Code**
```
POST /api/admin/maintenance/confirm-toggle
Body: { "code": "123456", "enable": true }

Success (200):
{
  "message": "Bảo trì hệ thống đã được bật/tắt",
  "isEnabled": boolean,
  "enabledAt": date|null,
  "disabledAt": date|null
}

Wrong code (400):
{
  "message": "Mã xác nhận không đúng.",
  "attempts": 1,
  "maxAttempts": 5
}

Lockout (400):
{
  "message": "Quá nhiều lần nhập sai. Vui lòng thử lại sau 30 phút."
}
```

### Update Message
```
PATCH /api/admin/maintenance/message
Body: { "message": "Custom maintenance message" }

Response (200):
{
  "message": "Tin nhắn bảo trì đã được cập nhật",
  "maintenanceMessage": "Custom maintenance message"
}
```

## User Blocking

When maintenance is enabled (isEnabled: true):

- All regular users get **503 Service Unavailable** with response:
```json
{
  "code": "MAINTENANCE_MODE",
  "message": "Hệ thống đang bảo trì, hãy quay lại sau 1 tiếng nữa nhé, rất xin lỗi vì sự làm phiền này nhưng chúng tôi cần bảo trì để nâng cao trải nghiệm của bạn."
}
```

Blocked endpoints:
- POST /api/auth/signup
- POST /api/auth/signin
- POST /api/auth/google/callback
- POST /api/auth/refresh
- All /api/users/*
- All /api/messages/*
- All /api/conversations/*
- All /api/friends/*
- All /api/reports/*
- Socket connections

**Admin** continues working normally on /api/admin/*

## Socket Client Errors

When non-admin user tries to connect during maintenance:
```json
{
  "code": "MAINTENANCE_MODE",
  "message": "Hệ thống đang bảo trì..."
}
```

Connection is immediately rejected.

## Timings

- Password verification: 5 minutes
- Confirmation code: 10 minutes
- Max attempts: 5
- Lockout duration: 30 minutes

## Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid request/wrong code |
| 401 | Unauthorized (wrong password) |
| 404 | Not found |
| 500 | Server error |
| 503 | Maintenance mode active |

## Conditions

- Cannot enable maintenance if SMTP not configured
- Only admins can manage maintenance
- Maintenance state persists in database
- All non-admin users disconnected on enable
- Admin dashboard always functional
