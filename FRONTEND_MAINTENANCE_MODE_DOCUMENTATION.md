# Frontend - Maintenance Mode Implementation

## Overview

The frontend includes a complete implementation for the Maintenance Mode feature with:
- Admin dashboard page to manage maintenance mode
- Two-layer security verification (password + OTP)
- Global error handling for 503 maintenance responses
- Sidebar navigation with maintenance link
- User-friendly modal for maintenance notifications

## Files Created/Modified

### New Files

1. **src/services/maintenanceService.ts** - API service for maintenance endpoints
   - `getStatus()` - Get current maintenance status
   - `requestPasswordVerification()` - Initiate password verification
   - `verifyPassword(password)` - Verify admin password and send OTP
   - `confirmToggle(code, enable)` - Confirm OTP and toggle maintenance
   - `updateMessage(message)` - Update maintenance message

2. **src/pages/admin/AdminMaintenance.tsx** - Main admin page
   - Status display with visual indicator (🔴/🟢)
   - Two-step verification flow with UI
   - Message editor
   - Copy to clipboard functionality
   - Help guide

3. **src/components/MaintenanceModeModal.tsx** - Global maintenance modal
   - Automatically shown when 503 response received
   - Displays maintenance message
   - Close and reload options

### Modified Files

1. **src/App.tsx**
   - Added `AdminMaintenance` import
   - Added `MaintenanceModeModal` component
   - Added route: `/admin/maintenance`

2. **src/components/admin/AdminSidebar.tsx**
   - Added `Zap` icon import
   - Added maintenance menu item to sidebar

## Features

### Status Display
- Real-time status showing if maintenance is enabled/disabled
- Visual indicators (🔴 for active, 🟢 for inactive)
- Shows when maintenance was enabled/disabled
- Shows who enabled/disabled it

### Two-Layer Security
**Step 1: Password Verification**
- Admin enters their password
- Show/hide password toggle
- Enter key submits
- Loading state feedback

**Step 2: OTP Confirmation**
- 6-digit code input with auto-format
- Displays remaining attempts
- Shows lockout message if exceeded
- Enter key submits

### Message Management
- Edit custom maintenance message
- View current message
- Copy to clipboard button
- Preview of message that will be shown to users

### Global Error Handling
- Axios interceptor catches 503 MAINTENANCE_MODE responses
- Modal automatically appears with maintenance message
- Users can reload page or close modal
- Does not interrupt other errors

## Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/maintenance` | AdminMaintenance | Main maintenance management page |

## UI Components Used

- `Button` - Actions (verify, confirm, toggle, etc.)
- `Input` - Text inputs (password, code)
- `Skeleton` - Loading placeholders
- `cn()` - Class name utility for conditional styling
- Lucide Icons - Eye, EyeOff, Lock, Zap, AlertTriangle, Copy

## State Management

### AdminMaintenance Component State
```typescript
// Status
const [status, setStatus] = useState<MaintenanceStatus | null>(null);
const [loading, setLoading] = useState(true);

// Flow Step
const [step, setStep] = useState<Step>("idle" | "password" | "code" | "message");

// Password Step
const [password, setPassword] = useState("");
const [showPassword, setShowPassword] = useState(false);
const [passwordLoading, setPasswordLoading] = useState(false);
const [passwordError, setPasswordError] = useState("");

// Code Step
const [code, setCode] = useState("");
const [codeLoading, setCodeLoading] = useState(false);
const [codeError, setCodeError] = useState("");
const [codeAttempts, setCodeAttempts] = useState(0);
const [maxAttempts, setMaxAttempts] = useState(5);

// Message
const [newMessage, setNewMessage] = useState("");
const [messageLoading, setMessageLoading] = useState(false);
const [showMessageForm, setShowMessageForm] = useState(false);

// Toggle Target
const [toggleTarget, setToggleTarget] = useState<boolean | null>(null);
```

## API Integration

### Service Methods

**Get Status**
```typescript
const status = await maintenanceService.getStatus();
// Returns: MaintenanceStatus
```

**Verify Password**
```typescript
const result = await maintenanceService.verifyPassword(password);
// Returns: { message, expiresAt }
// Sends OTP to admin email
```

**Confirm Toggle**
```typescript
const result = await maintenanceService.confirmToggle(code, enable);
// Returns: { message, isEnabled, enabledAt, disabledAt }
```

**Update Message**
```typescript
const result = await maintenanceService.updateMessage(message);
// Returns: { message, maintenanceMessage }
```

## User Flows

### Enable Maintenance
1. Admin clicks "Bật Bảo Trì" button
2. Enter admin password (Step 1: password)
3. Check email for OTP code
4. Enter 6-digit code (Step 2: code)
5. Maintenance enabled successfully
6. Status updates to 🔴 ĐANG BẢO TRÌ
7. All non-admin users are disconnected

### Disable Maintenance
1. Admin clicks "Tắt Bảo Trì" button
2. Enter admin password (Step 1: password)
3. Check email for OTP code
4. Enter 6-digit code (Step 2: code)
5. Maintenance disabled successfully
6. Status updates to 🟢 HOẠT ĐỘNG
7. Users can login/register again

### Update Message
1. Click "Chỉnh Sửa" on message card
2. Edit message in textarea
3. Click "Lưu Thay Đổi"
4. Message updated immediately
5. Or click "Hủy" to revert to original

### User Experience During Maintenance

When maintenance is enabled:
1. User tries to login/register/perform action
2. Gets 503 response with MAINTENANCE_MODE code
3. MaintenanceModeModal appears automatically
4. Shows maintenance message
5. User can reload page or close modal
6. Should see "Hệ thống đang bảo trì..." message

## Error Handling

### Password Verification Errors
- Empty password: "Vui lòng nhập mật khẩu"
- Wrong password: "Mật khẩu không chính xác"
- Shows in red text below input
- Clearing input clears error

### Code Confirmation Errors
- Empty code: "Vui lòng nhập mã xác nhận"
- Wrong code: "Mã xác nhận không đúng." (attempts shown)
- Code expired: "Mã xác nhận đã hết hạn."
- Lockout: "Quá nhiều lần nhập sai. Vui lòng thử lại sau XX phút."
- Shows in red with icon
- Displays attempts remaining

### API Errors
- Network error: Toast notification
- Server error: Toast notification with error message
- All caught by axios interceptor
- User notified via toast and modal

## Styling

- Uses Tailwind CSS for responsive design
- Supports dark/light theme
- Color coding:
  - Amber/Yellow: Active maintenance (warning)
  - Emerald/Green: Inactive maintenance (normal)
  - Blue: Password verification step
  - Purple: Code confirmation step
  - Red: Errors
- Smooth transitions and hover effects

## Loading States

- Skeleton loaders while fetching status
- Button loading indicators during API calls
- Disabled inputs during loading
- Prevents multiple submissions

## Security Features

- Passwords hidden by default (Eye icon toggle)
- OTP auto-formats to 6 digits
- No sensitive data in URLs
- HTTPS required for production
- Axios credentials: true for cookie-based auth
- Admin role check on backend

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive
- Touch-friendly button sizes
- Works on tablets and phones

## Testing Guide

1. **Test Status Display**
   - Navigate to `/admin/maintenance`
   - Should see current status
   - Status should load without errors

2. **Test Enable Maintenance**
   - Click "Bật Bảo Trì"
   - Enter admin password
   - Check email for OTP
   - Enter OTP
   - Verify status changes to 🔴

3. **Test Error Handling**
   - Enter wrong password → See error message
   - Enter wrong OTP → See error and attempts
   - Leave fields empty → See validation messages

4. **Test Message Update**
   - Click "Chỉnh Sửa"
   - Change message
   - Click "Lưu Thay Đổi"
   - Verify message updates
   - Click "Sao chép tin nhắn"
   - Verify copy works

5. **Test User Blocking**
   - With maintenance ON:
     - Try to login → Should see maintenance modal
     - Try to register → Should see maintenance modal
     - Try any API call → Should see maintenance modal

6. **Test Disable Maintenance**
   - Click "Tắt Bảo Trì"
   - Enter admin password and OTP
   - Verify status changes to 🟢
   - Try login/register → Should work normally

## Troubleshooting

### Modal Doesn't Appear
- Check browser console for errors
- Verify axios interceptor is registered
- Check if error code is MAINTENANCE_MODE

### Code Field Not Working
- Verify MaxLength is set to 6
- Check if auto-formatting is working
- Test on different browser

### Status Not Loading
- Check admin authentication
- Verify API endpoint is accessible
- Check network tab in dev tools

### Message Not Updating
- Verify message is not empty
- Check network request in dev tools
- Verify admin has proper permissions

## Future Enhancements

1. Add countdown timer showing time until maintenance ends
2. Add notification system for when maintenance is enabled/disabled
3. Add maintenance history/logs
4. Add scheduled maintenance option
5. Add partial maintenance (only block certain features)
6. Add webhook notifications
7. Add two-factor authentication
8. Add rate limiting on attempts
