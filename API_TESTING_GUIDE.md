# Reports Module - API Testing Guide

## Setup & Configuration

1. **Start Backend Server**
   ```bash
   cd backend
   npm install  # if needed
   npm run dev
   ```

2. **Start Frontend Development**
   ```bash
   cd frontend
   npm install  # if needed
   npm run dev
   ```

## API Endpoints to Test

### 1. Create Report (User)

**Endpoint:** `POST /api/reports`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Example Body - Report User:**
```json
{
  "targetType": "user",
  "targetUserId": "USER_ID_HERE",
  "reason": "spam",
  "description": "Gửi tin nhắn làm phiền liên tục"
}
```

**Example Body - Report Message:**
```json
{
  "targetType": "message",
  "targetMessageId": "MESSAGE_ID_HERE",
  "targetConversationId": "CONVERSATION_ID_HERE",
  "reason": "harassment",
  "description": "Tin nhắn xúc phạm"
}
```

**Example Body - Report Conversation:**
```json
{
  "targetType": "conversation",
  "targetConversationId": "CONVERSATION_ID_HERE",
  "reason": "inappropriate_content",
  "description": "Nội dung không phù hợp"
}
```

**Response (201):**
```json
{
  "message": "Report created successfully",
  "data": {
    "report": {
      "_id": "REPORT_ID",
      "reporterId": "REPORTER_ID",
      "targetType": "user",
      "status": "pending",
      "reason": "spam",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### 2. Get User's Reports (Optional)

**Endpoint:** `GET /api/reports/me`

**Query Params:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `status`: Filter by status (pending|reviewing|resolved|rejected)
- `targetType`: Filter by type (user|message|conversation)

**Example:** `GET /api/reports/me?status=pending&page=1`

**Response (200):**
```json
{
  "message": "Reports retrieved successfully",
  "data": {
    "reports": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

### 3. Get All Reports (Admin)

**Endpoint:** `GET /admin/reports`

**Headers:** (Requires admin role)
```
Authorization: Bearer <admin_jwt_token>
```

**Query Params:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `status`: Filter (pending|reviewing|resolved|rejected)
- `targetType`: Filter (user|message|conversation)
- `q`: Search query (searches reason, description, reporter name)
- `sort`: Sort option (createdAt-desc|createdAt-asc|updated|status)

**Example:** `GET /admin/reports?status=pending&targetType=user&page=1&sort=createdAt-desc`

**Response (200):**
```json
{
  "message": "Reports retrieved successfully",
  "data": {
    "reports": [
      {
        "_id": "REPORT_ID",
        "reporterId": "USER_ID",
        "targetType": "user",
        "reason": "spam",
        "status": "pending",
        "createdAt": "2024-01-15T10:30:00Z",
        "reporterSnapshot": {...}
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "pages": 1
    }
  }
}
```

### 4. Get Report Detail (Admin)

**Endpoint:** `GET /admin/reports/:id`

**Example:** `GET /admin/reports/64f7a8b9c1d2e3f4g5h6i7j8`

**Response (200):**
```json
{
  "message": "Report retrieved successfully",
  "data": {
    "report": {
      "_id": "REPORT_ID",
      "reporterId": "REPORTER_ID",
      "targetType": "user",
      "targetUserId": "TARGET_USER_ID",
      "reason": "spam",
      "description": "Gửi tin nhắn làm phiền",
      "status": "pending",
      "reporterSnapshot": {
        "_id": "REPORTER_ID",
        "displayName": "Reporter Name",
        "userName": "reporter",
        "avatarUrl": "https://..."
      },
      "targetUserSnapshot": {
        "_id": "TARGET_USER_ID",
        "displayName": "Target Name",
        "userName": "target",
        "email": "target@example.com",
        "avatarUrl": "https://..."
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### 5. Update Report Status (Admin)

**Endpoint:** `PATCH /admin/reports/:id/status`

**Body:**
```json
{
  "status": "resolved",
  "resolutionNote": "Đã cảnh báo user vi phạm"
}
```

**Or for rejecting:**
```json
{
  "status": "rejected",
  "resolutionNote": "Report không hợp lệ"
}
```

**Or just reviewing:**
```json
{
  "status": "reviewing"
}
```

**Response (200):**
```json
{
  "message": "Report status updated successfully",
  "data": {
    "report": {
      "...": "...",
      "status": "resolved",
      "resolutionNote": "Đã cảnh báo user vi phạm",
      "reviewedByAdminId": "ADMIN_ID",
      "reviewedAt": "2024-01-15T11:00:00Z"
    }
  }
}
```

### 6. Resolve Report with Moderation Action (Admin)

**Endpoint:** `PATCH /admin/reports/:id/resolve-with-action`

**Body:**
```json
{
  "action": "ban-user",
  "resolutionNote": "User bị cấm do spam"
}
```

**Available Actions:**
- `ban-user`: Ban the reported user
- `unban-user`: Unban the reported user
- `delete-account`: Mark account for deletion
- `delete-message`: Delete the reported message

**Response (200):**
```json
{
  "message": "Report resolved with action successfully",
  "data": {
    "report": {
      "...": "...",
      "status": "resolved",
      "resolutionNote": "[ban-user] User bị cấm do spam"
    },
    "action": "User banned"
  }
}
```

## Frontend Usage

### 1. View Reports (Admin Dashboard)

Navigate to: `/admin/reports`

Features:
- Search by reporter name or reason
- Filter by status
- Filter by report type
- Sort by date or status
- Click "View" to see details

### 2. Handle Report Detail

Navigate to: `/admin/reports/:id`

Actions available:
- **Start Reviewing**: Change status to "reviewing"
- **Add Resolution Note**: Write detailed note about resolution
- **Resolve**: Finalize as resolved
- **Reject**: Mark report as not valid
- **Action on User**: (For user reports) Choose to ban/delete content

## Common Test Scenarios

### Scenario 1: Report Spam User
1. Get a valid user ID
2. POST to /api/reports with targetType: "user"
3. Admin navigates to /admin/reports
4. Click View on the report
5. Click "Start Reviewing"
6. Add note and click "Resolve"

### Scenario 2: Report Inappropriate Message
1. Get a valid message ID and conversation ID
2. POST to /api/reports with targetType: "message"
3. Message preview should appear in report detail
4. Admin can mark message for deletion using "Action on User"

### Scenario 3: Mass Report Testing
1. Create multiple reports with different types
2. Test filtering by status (none resolved yet)
3. Create several, resolve a few, reject others
4. Verify pagination works

## Validation Rules

### Report Creation
- targetType: Required, must be "user", "message", or "conversation"
- reason: Required, max 500 characters
- description: Optional, max 2000 characters
- targetUserId/targetMessageId/targetConversationId: Required based on targetType
- Cannot report yourself
- Target must exist

### Status Updates
- Status must be one of: pending, reviewing, resolved, rejected
- resolutionNote: Max 2000 characters

## Error Codes

- 400: Bad request (invalid params)
- 401: Unauthorized (not logged in)
- 403: Forbidden (not admin for admin endpoints)
- 404: Report/target not found
- 500: Server error

## Notes

- All timestamps are in UTC
- Admin actions are logged with admin ID and timestamp
- Snapshots are captured at report creation to preserve data
- If original data is deleted, snapshot is used for display
- Privacy first: Admins only see report-related content
