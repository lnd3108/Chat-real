# Reports Module - Implementation Documentation

## Overview

The Reports Module is a comprehensive system for users to report abuse and for admins to manage and moderate those reports. The system prioritizes privacy by ensuring admins can ONLY view content related to specific reports, not browse the entire message system.

## Architecture

### Data Flow Diagram

```
User submits report
    ↓
Validation + Snapshots captured
    ↓
Report stored in DB
    ↓
Admin notified via dashboard
    ↓
Admin reviews report details
    ↓
Admin takes action:
    ├─ Resolve with note
    ├─ Reject report
    └─ Moderation (ban/delete)
    ↓
Report status updated + action logged
```

## File Structure

```
backend/
├── src/
│   ├── models/
│   │   └── Report.js (NEW)
│   ├── controllers/
│   │   ├── reportController.js (NEW - user endpoints)
│   │   └── adminController.js (UPDATED - admin endpoints)
│   ├── routes/
│   │   ├── reportRoute.js (NEW)
│   │   └── adminRoute.js (UPDATED)
│   └── server.js (UPDATED - register reportRoute)
│
frontend/
├── src/
│   ├── pages/
│   │   └── admin/
│   │       ├── AdminReports.tsx (NEW - list view)
│   │       └── AdminReportDetail.tsx (NEW - detail view)
│   ├── components/
│   │   └── admin/
│   │       └── AdminSidebar.tsx (UPDATED - add Reports menu)
│   └── App.tsx (UPDATED - add routes)
```

## Database Schema

### Report Collection

```javascript
{
  _id: ObjectId,
  
  // Who reported
  reporterId: ObjectId (User reference),
  
  // What is being reported
  targetType: "user" | "message" | "conversation",
  targetUserId: ObjectId | null,
  targetMessageId: ObjectId | null,
  targetConversationId: ObjectId | null,
  
  // Report details
  reason: String (max 500),
  description: String (max 2000, nullable),
  
  // Status tracking
  status: "pending" | "reviewing" | "resolved" | "rejected",
  
  // Admin review
  reviewedByAdminId: ObjectId | null,
  reviewedAt: Date | null,
  resolutionNote: String (max 2000, nullable),
  
  // Data snapshots (preserve if original deleted)
  reporterSnapshot: {
    _id: ObjectId,
    displayName: String,
    userName: String,
    avatarUrl: String
  },
  targetUserSnapshot: {
    _id: ObjectId,
    displayName: String,
    userName: String,
    email: String,
    avatarUrl: String
  },
  targetMessagePreview: {
    _id: ObjectId,
    content: String,
    imgUrl: String,
    senderDisplayName: String,
    createdAt: Date
  },
  targetConversationSnapshot: {
    _id: ObjectId,
    type: String,
    groupName: String,
    membersCount: Number
  },
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

```javascript
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reporterId: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, status: 1 });
```

## API Design

### User-Side Endpoints

#### POST /api/reports
- **Purpose:** Create a new report
- **Auth:** Required (user)
- **Validation:**
  - targetType must be valid
  - reason required, max 500 chars
  - description optional, max 2000 chars
  - Cannot report self
  - Target must exist
- **Snapshots:** Auto-captured at creation
- **Response:** 201 with report object

#### GET /api/reports/me
- **Purpose:** View user's own reports
- **Auth:** Required (user)
- **Pagination:** Yes
- **Filters:** status, targetType
- **Response:** 200 with report array + pagination

### Admin-Side Endpoints

#### GET /admin/reports
- **Purpose:** List all reports with powerful filtering
- **Auth:** Required (admin)
- **Filters:**
  - `status`: Single status value
  - `targetType`: Single type value
  - `q`: Text search in reason, description, reporter info
  - `sort`: createdAt-desc (default), createdAt-asc, updated, status
- **Pagination:** 20 items default, max 100
- **Response:** 200 with reports array + pagination metadata

#### GET /admin/reports/:id
- **Purpose:** Get full report details
- **Auth:** Required (admin)
- **Population:** Full references populated
- **Response:** 200 with complete report object

#### PATCH /admin/reports/:id/status
- **Purpose:** Update report status
- **Auth:** Required (admin)
- **Body:** { status, resolutionNote? }
- **Actions:**
  - Sets `status` to new value
  - Records `reviewedByAdminId` and `reviewedAt`
  - Optionally adds `resolutionNote`
- **Response:** 200 with updated report

#### PATCH /admin/reports/:id/resolve-with-action
- **Purpose:** Take moderation action and resolve
- **Auth:** Required (admin)
- **Body:** { action, resolutionNote? }
- **Actions:**
  - ban-user: Set user status to "banned"
  - unban-user: Set user status to "active"
  - delete-account: Set user status to "inactive"
  - delete-message: Mark message as deleted for everyone
- **Response:** 200 with updated report + action result

## Frontend Components

### AdminReports.tsx (List View)

**Features:**
- Table with columns: Reporter, Type, Reason, Status, Created, Action
- Real-time search
- Multi-filter support
- Sort options
- Pagination
- Modal detail view
- Loading states

**Key State:**
- `reports`: Array of report objects
- `page`: Current page
- `statusFilter`: Active status filter
- `typeFilter`: Active type filter
- `searchQuery`: Current search term
- `sortBy`: Sort preference
- `detailOpen`: Modal visibility
- `selectedReport`: Currently viewed report

**Interactions:**
1. Click "View" button → Opens detail modal
2. Filter by status/type → Auto-fetches
3. Search → Auto-fetches with debounce
4. Pagination → Navigate reports

### AdminReportDetail.tsx (Detail & Action View)

**Features:**
- Full report information display
- Reporter details with avatar
- Target content display (user/message/conversation specific)
- Admin action panel on sidebar
- Status management
- Moderation action dialogs

**Key State:**
- `report`: Detailed report object
- `loading`: Data fetch state
- `updating`: Action processing state
- `resolutionNote`: Text input for notes
- `actionDialogOpen`: Moderation dialog visibility

**Admin Actions:**
1. Mark as "Reviewing" (from pending)
2. Add resolution note
3. Resolve report (with note)
4. Reject report
5. Take moderation action (for user reports)

**Moderation Actions Dialog:**
- Ban user
- Delete associated content
- (More can be added as needed)

## Key Design Decisions

### 1. Snapshots over Direct References
**Why:** If original data (user, message) is deleted, admin can still review the report
**How:** All relevant data is captured at report creation time
**Benefit:** Privacy-preserving, decoupled from content deletion

### 2. Status Workflow
```
pending → reviewing → resolved ✓
       ↘    rejected  ✓
```
**Why:** Clear workflow ensures all reports are reviewed
**Benefit:** Admins must explicitly review before resolving

### 3. Privacy-First Admin Access
**Why:** Prevent admins from mass browsing user messages
**How:** Only show content attached to specific reports
**Benefit:** Protects user privacy, audit trail clear

### 4. Compound Indexes
**Why:** Optimize common query patterns
**Examples:** 
- `{ status: 1, createdAt: -1 }` - Filter by status
- `{ reporterId: 1, createdAt: -1 }` - User's own reports
- `{ targetType: 1, status: 1 }` - Filter by type and status

### 5. Moderation Actions as Separate Endpoint
**Why:** Clear separation of concerns
**How:** Dedicated `/resolve-with-action` endpoint
**Benefit:** Actions are intentional, logged separately

## Error Handling

### User-Side Errors
```
400: Invalid targetType, reason too long, etc.
401: Not authenticated
403: Forbidden (trying to report self)
404: Target not found
500: Server error
```

### Admin-Side Errors
```
400: Invalid status or parameters
401: Not authenticated
403: Not admin
404: Report not found
500: Server error
```

### Frontend Error Handling
- Toast notifications for errors
- Descriptive error messages
- Graceful fallbacks
- Loading state cleanup on error

## Security Considerations

### Authorization
- All user endpoints require authentication
- All admin endpoints require authentication + admin role
- User can only see their own reports (not explicitly enforced - could add)

### Input Validation
- Reason: 500 char limit
- Description: 2000 char limit
- Resolution note: 2000 char limit
- Regex escaping for search queries

### Data Privacy
- Admins cannot browse entire message system
- Only report-related content exposed
- Snapshots don't include sensitive data (passwords, etc.)
- Audit trail via reviewedByAdminId + reviewedAt

### Rate Limiting (Consider Adding)
- Prevent spam reports from single user
- Example: Max 5 reports per hour per user

## Performance Optimization

### Query Patterns
```javascript
// Efficient list query with pagination
db.reports.find(query)
  .sort(sortObj)
  .skip(skip)
  .limit(limitNum)
  .populate(...)

// Efficient detail query
db.reports.findById(id)
  .populate(["reporterId", "targetUserId", ...])
```

### Pagination Strategy
- Default 20 items, max 100
- Offset-based (could upgrade to cursor-based for large datasets)
- Prevents N+1 queries with populate

### Indexing
- Composite indexes for common filter combinations
- Sparse indexes for nullable fields

## Testing Recommendations

### Unit Tests
- Report creation validation
- Snapshot generation
- Status update logic
- Moderation action logic

### Integration Tests
- Full report creation flow
- Admin workflow (list → detail → action)
- Permission checks
- Snapshot preservation

### E2E Tests
- User creates report
- Admin receives and handles
- Status workflow
- Moderation actions

## Future Enhancements

### Phase 1 (Current)
✓ Core report creation and management
✓ Admin dashboard and detail view
✓ Basic moderation actions

### Phase 2 (Recommended)
- User-side UI for creating reports
- Email notifications to admins
- Report statistics/analytics
- Report appeal system
- Bulk report handling

### Phase 3 (Optional)
- Automated report detection (keywords, patterns)
- Machine learning for spam detection
- Report categorization
- Moderation queue system
- Admin dashboard with metrics

### Phase 4 (Long-term)
- Multi-admin assignment
- Report severity levels
- Escalation paths
- Integration with external moderation tools
- API for third-party moderation services

## Maintenance Notes

### Database Maintenance
- Monitor Report collection size
- Archive old resolved reports if needed
- Optimize indexes if query performance degrades

### Code Maintenance
- Keep snapshots up to date when User/Message schema changes
- Update validation rules if limits change
- Review moderation actions for new use cases

### Admin Training
- Document moderation process
- Establish guidelines for report handling
- Train admins on status workflow
- Clear consequences policy

## Configuration Options

### Environment Variables (if needed)
```env
REPORT_MAX_REASON_LENGTH=500
REPORT_MAX_DESC_LENGTH=2000
REPORT_MAX_NOTE_LENGTH=2000
REPORT_PAGE_LIMIT=20
REPORT_MAX_PAGE_LIMIT=100
```

### Feature Flags (if needed)
```javascript
const features = {
  enableUserReports: true,
  enableMessageReports: true,
  enableConversationReports: false, // Disabled initially
  enableModerationActions: true,
  requireAdminReview: true,
};
```

## Deployment Checklist

- [ ] Database indexes created
- [ ] Environment variables set
- [ ] Admin users assigned admin role
- [ ] Frontend build successful
- [ ] Backend tests passing
- [ ] Error logging configured
- [ ] Monitoring alerts set up
- [ ] Admin training completed
- [ ] Documentation updated
- [ ] Backup strategy in place
