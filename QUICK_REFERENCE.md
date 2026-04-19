# Reports Module - Quick Reference

## 🎯 Module Overview

A privacy-first moderation system where:
- Users report abuse (user, message, conversation)
- Admins review only report-related content
- Admins take action and resolve reports

```
User Reports → Admin Reviews → Action Taken → Report Resolved
                 (privacy-safe)
```

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER SIDE                            │
├─────────────────────────────────────────────────────────────┤
│ POST /api/reports          → Create report                  │
│ GET  /api/reports/me       → View own reports               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE (MongoDB)                      │
├─────────────────────────────────────────────────────────────┤
│ Report Collection:                                           │
│ - Report metadata (reason, description)                      │
│ - Snapshots (preserved data)                                 │
│ - Status tracking (pending→reviewing→resolved)               │
│ - Admin review info (who, when, note)                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       ADMIN SIDE                             │
├─────────────────────────────────────────────────────────────┤
│ GET  /admin/reports              → List with filters        │
│ GET  /admin/reports/:id          → View details             │
│ PATCH /admin/reports/:id/status  → Update status            │
│ PATCH /admin/reports/:id/resolve-with-action → Take action  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN DASHBOARD UI                       │
├─────────────────────────────────────────────────────────────┤
│ /admin/reports         → List view with filters             │
│ /admin/reports/:id     → Detail view with actions           │
│ Sidebar: "Báo cáo"     → Navigation link                    │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Privacy Model

### ❌ What Admins CANNOT Do
```
Browse all messages in the system
Browse all users' conversations
Search entire chat history
Access private chats without cause
```

### ✅ What Admins CAN Do
```
View reports created by users
See ONLY the reported content (snapshot)
See reporter and target information
Take action specific to the report
View resolution history
```

### 🛡️ Data Protection
```
Snapshots preserve report context even if original deleted
No mass surveillance capability
Audit trail via admin ID + timestamp
Status workflow ensures review before action
```

## 📱 User Workflow

```
1. User encounters abuse
   ↓
2. Clicks "Report" button (to be implemented)
   ↓
3. Chooses report type (user/message/conversation)
   ↓
4. Fills reason + optional description
   ↓
5. Submits report
   ↓
6. Confirmation message
   ↓
7. Can check status later in settings (optional)
```

## 👨‍💼 Admin Workflow

```
1. Navigate to /admin/reports
   ↓
2. View pending reports in list
   ↓
3. Click "View" to see full details
   ↓
4. Review reported content
   ↓
5. Choose action:
   ├─ Resolve (mark handled)
   ├─ Reject (not valid)
   └─ Ban user / Delete content
   ↓
6. Add resolution note
   ↓
7. Submit
   ↓
8. Report marked as resolved
```

## 📋 Report Types

### User Report
```json
{
  "targetType": "user",
  "targetUserId": "user123",
  "reason": "spam",
  "description": "Sending unwanted messages"
}
```
Shows: User profile, contact info, email

### Message Report
```json
{
  "targetType": "message",
  "targetMessageId": "msg456",
  "targetConversationId": "conv789",
  "reason": "harassment",
  "description": "Offensive language"
}
```
Shows: Message content, sender info, timestamp

### Conversation Report
```json
{
  "targetType": "conversation",
  "targetConversationId": "conv789",
  "reason": "inappropriate_content",
  "description": "Group discussing illegal activity"
}
```
Shows: Conversation metadata, member count

## 🎛️ Admin Actions

| Action | Effect | Target |
|--------|--------|--------|
| Reviewing | Change status to reviewing | Report |
| Resolve | Mark as resolved + add note | Report |
| Reject | Mark as rejected (invalid) | Report |
| Ban User | Set user status to banned | User |
| Unban User | Set user status to active | User |
| Delete Message | Mark message as deleted | Message |

## 🗂️ Database Schema (Simplified)

```
Report
├── reporterId              → Who reported
├── targetType              → What (user|message|conversation)
├── targetUserId            → (nullable) Who/What reported
├── targetMessageId         → (nullable)
├── targetConversationId    → (nullable)
├── reason                  → Report reason (required)
├── description             → Extra details (optional)
├── status                  → pending|reviewing|resolved|rejected
├── reviewedByAdminId       → Which admin reviewed
├── reviewedAt              → When reviewed
├── resolutionNote          → Admin's resolution note
├── reporterSnapshot        → Snapshot of reporter data
├── targetUserSnapshot      → Snapshot of reported user
├── targetMessagePreview    → Snapshot of message
├── targetConversationSnapshot → Snapshot of conversation
├── createdAt               → When reported
└── updatedAt               → Last modified
```

## 🧪 Quick Test

### Test User Reporting User
```bash
curl -X POST http://localhost:5001/api/reports \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "targetType": "user",
    "targetUserId": "USER_ID",
    "reason": "spam"
  }'
```

### Test Admin Listing Reports
```bash
curl http://localhost:5001/admin/reports \
  -H "Authorization: Bearer ADMIN_JWT"
```

### Test Admin Resolving Report
```bash
curl -X PATCH http://localhost:5001/admin/reports/REPORT_ID/status \
  -H "Authorization: Bearer ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "resolutionNote": "User warned"
  }'
```

## 📈 Stats & Metrics

### Current Capabilities
- ✅ Report creation (user, message, conversation)
- ✅ Admin list view with filters/search
- ✅ Admin detail view
- ✅ Status workflow
- ✅ Moderation actions
- ✅ Snapshot preservation
- ✅ Audit trail

### Not Yet Implemented
- ❌ User-side report UI buttons
- ❌ Email notifications
- ❌ Report statistics dashboard
- ❌ Report appeal system
- ❌ Automated detection
- ❌ Bulk actions

## 🚀 Deployment Checklist

- [ ] Backend files deployed
- [ ] Frontend files deployed
- [ ] Database indexes created
- [ ] Admin user assigned admin role
- [ ] Testing completed
- [ ] Documentation reviewed
- [ ] Admin trained on workflow
- [ ] Monitoring alerts set up

## 🆘 Help

**For API details:** See `API_TESTING_GUIDE.md`
**For architecture:** See `REPORTS_MODULE_DOCUMENTATION.md`
**For status:** See `IMPLEMENTATION_CHECKLIST.md`

## 🎓 Key Concepts

### Snapshots
Data captured at report creation to preserve context even if original is deleted later.

### Status Workflow
Ensures every report goes through review:
- pending: Just created
- reviewing: Admin is examining
- resolved: Handled and closed
- rejected: Invalid or false report

### Privacy-Safe
Admins can ONLY see content from specific reports, not browse entire system.

### Audit Trail
Every action logged with admin ID and timestamp for accountability.

---

**Module Status:** ✅ Complete and Ready for Testing
**Last Updated:** April 19, 2026
