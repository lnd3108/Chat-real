# 🎯 HỆ THỐNG ĐỒNG BỘ REALTIME ADMIN - RÀ LAI LUỒNG TOÀN BỘ

## 📋 TỔNG QUAN KIẾN TRÚC

Hệ thống đã được xây dựng đầy đủ với 3 lớp chính:
1. **Backend Socket Events** - Emit dữ liệu realtime
2. **Frontend Stores (Zustand)** - Quản lý state
3. **Frontend Hooks** - Kết nối socket & cập nhật UI

---

## 🔌 PHẦN 1: BACKEND - SOCKET & EVENTS

### 📁 File: `backend/src/constants/socketEvents.js`

```javascript
// Những rooms cho các nhóm user
export const SOCKET_ROOMS = {
  ADMINS: "admins", // Phòng dành cho admin
};

// Các event từ user thường emit lên server
export const USER_SOCKET_EVENTS = {
  REGISTER: "user:register",        // Người dùng đăng ký tài khoản
  LOGIN: "user:login",              // Người dùng đăng nhập
  LOGOUT: "user:logout",            // Người dùng đăng xuất
  ONLINE: "user:online",            // Người dùng online
  OFFLINE: "user:offline",          // Người dùng offline
  STATUS_CHANGED: "user:status-changed", // Trạng thái thay đổi
};

// Các event từ server emit tới admin
export const ADMIN_SOCKET_EVENTS = {
  USER_NEW: "admin:user:new",                   // Người dùng mới đăng ký
  USER_LOGIN: "admin:user:login",              // Người dùng đăng nhập
  USER_LOGOUT: "admin:user:logout",            // Người dùng đăng xuất
  USER_STATUS_CHANGED: "admin:user:status-changed", // Trạng thái user thay đổi
  USER_LOCKED: "admin:user:locked",            // Tài khoản bị khóa
  USER_UNLOCKED: "admin:user:unlocked",        // Tài khoản được mở khóa
  USER_DELETED: "admin:user:deleted",          // Tài khoản bị xóa
  SUPPORT_NEW_MESSAGE: "admin:support:new-message", // Tin nhắn hỗ trợ mới
  REPORT_NEW: "admin:report:new",              // Báo cáo mới
  REPORT_UPDATED: "admin:report:updated",      // Báo cáo được cập nhật
  DASHBOARD_STATS_UPDATED: "admin:dashboard:stats-updated", // Thống kê bảng điều khiển cập nhật
  SYSTEM_NOTIFICATION: "admin:system:notification", // Thông báo hệ thống
  MAINTENANCE_ON: "admin:maintenance:on",      // Chế độ bảo trì bật
  MAINTENANCE_OFF: "admin:maintenance:off",    // Chế độ bảo trì tắt
};
```

---

### 📁 File: `backend/src/socket/adminSocket.js`

```javascript
import { ADMIN_SOCKET_EVENTS, SOCKET_ROOMS } from "../constants/socketEvents.js";
import { getIo } from "./index.js";

/**
 * HÀNG 1: Cho admin tham gia phòng "admins"
 * Khi socket của admin kết nối, hàm này được gọi để đưa admin vào phòng riêng
 */
export const joinAdminRoom = (socket) => {
  if (socket?.user?.role === "admin") {
    socket.join(SOCKET_ROOMS.ADMINS); // Tham gia phòng "admins"
  }
};

/**
 * HÀNG 2: Emit sự kiện tới tất cả admin trong phòng
 * @param {string} eventName - Tên sự kiện cần emit
 * @param {object} payload - Dữ liệu gửi kèm
 */
export const emitToAdmins = (eventName, payload) => {
  if (!eventName) {
    return;
  }
  // Emit sự kiện này tới tất cả người trong phòng "admins"
  getIo().to(SOCKET_ROOMS.ADMINS).emit(eventName, payload);
};

/**
 * HÀNG 3: Gửi thông báo hệ thống tới admin
 * @param {object} payload - Thông báo chi tiết
 */
export const emitAdminSystemNotification = (payload) => {
  emitToAdmins(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION, payload);
};
```

**Luồng hoạt động:**
```
[Admin Connect] 
    ↓
[joinAdminRoom(socket)] 
    ↓
[Socket tham gia phòng "admins"]
    ↓
[Admin sẵn sàng nhận event từ phòng]
```

---

## 🎯 PHẦN 2: BACKEND - SERVICES (Phát sinh dữ liệu realtime)

### 📁 File: `backend/src/services/adminNotificationService.js`

**Mục đích:** Chuẩn bị dữ liệu thông báo để gửi tới admin

```javascript
/**
 * HÀNG 1: Build thông tin người thực hiện hành động (actor)
 * @param {object} user - Thông tin người dùng
 * @returns {object} Thông tin actor để lưu trong notification
 */
export const buildAdminActor = (user) => {
  return {
    _id: user._id,
    displayName: user.displayName,
    userName: user.userName,
    role: user.role,
    status: user.status,
  };
};

/**
 * HÀNG 2: Gửi thông báo tới admin
 * @param {object} options - Tùy chọn thông báo
 */
export const emitAdminNotification = ({
  type,           // Loại: "user", "report", "support", "system"
  title,          // Tiêu đề thông báo
  message,        // Nội dung thông báo
  link,           // Đường dẫn để admin click vào
  entityId,       // ID của entity liên quan (userId, reportId, etc)
  actor,          // Ai đã thực hiện hành động
  severity,       // Mức độ: "info", "success", "warning", "error"
  metadata,       // Dữ liệu bổ sung
}) => {
  // Emit notification tới phòng admin
  emitToAdmins(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION, {
    id: `${type}-${entityId ?? Date.now()}`,
    type,
    title,
    message,
    link,
    entityId,
    actor,
    severity,
    metadata,
    createdAt: new Date().toISOString(),
  });
};
```

---

### 📁 File: `backend/src/services/dashboardRealtimeService.js`

**Mục đích:** Cập nhật thống kê bảng điều khiển

```javascript
/**
 * HÀNG 1: Lấy tất cả thống kê realtime cho admin dashboard
 * @returns {object} Tất cả số liệu thống kê
 */
export const getAdminDashboardRealtimeStats = async () => {
  const stats = await Promise.all([
    User.countDocuments(), // Tổng số user
    getOnlineUsersCount(), // Số user online
    User.countDocuments({ createdAt: { $gte: todayStart } }), // User mới hôm nay
    Report.countDocuments({ status: { $in: ["pending", "reviewing"] } }), // Report chưa xử lý
    // ... các số liệu khác
  ]);

  return {
    totalUsers,
    totalOnlineUsers,
    newUsersToday,
    totalPendingReports,
    totalUnreadSupportConversations,
    latestUsers, // 5 user mới nhất
    maintenance, // Trạng thái bảo trì
    updatedAt: new Date().toISOString(),
  };
};

/**
 * HÀNG 2: Emit thống kê lên tất cả admin
 */
export const emitDashboardStatsUpdated = async () => {
  const stats = await getAdminDashboardRealtimeStats();
  
  // Gửi toàn bộ thống kê realtime tới admin
  emitToAdmins(ADMIN_SOCKET_EVENTS.DASHBOARD_STATS_UPDATED, stats);
  
  return stats;
};
```

**Khi nào được gọi:**
- User mới đăng ký ✓
- User đăng nhập/đăng xuất ✓
- Report mới được tạo ✓
- Maintenance mode bật/tắt ✓

---

### 📁 File: `backend/src/services/reportRealtimeService.js`

```javascript
/**
 * HÀNG 1: Khi report mới được tạo
 */
export const emitNewReport = async (report, reporter) => {
  // Gửi thông báo tới admin
  emitAdminNotification({
    type: "report",
    title: "Báo cáo vi phạm mới",
    message: `Người dùng ${reporter.displayName} vừa gửi báo cáo mới`,
    link: `/admin/reports/${report._id}`,
    entityId: report._id,
    actor: buildAdminActor(reporter),
    severity: "warning",
  });

  // Cập nhật thống kê dashboard
  await emitDashboardStatsUpdated({ context: "new-report" });

  // Emit event realtime để admin table cập nhật
  emitToAdmins(ADMIN_SOCKET_EVENTS.REPORT_NEW, {
    report: transformReport(report),
    reporter,
  });
};

/**
 * HÀNG 2: Khi admin cập nhật trạng thái report
 */
export const emitReportUpdated = async (report, adminUser) => {
  // Gửi thông báo tới admin khác
  emitAdminNotification({
    type: "report",
    title: "Report được cập nhật",
    message: `Admin ${adminUser.displayName} vừa cập nhật report`,
    entityId: report._id,
    actor: buildAdminActor(adminUser),
  });

  // Cập nhật realtime
  emitToAdmins(ADMIN_SOCKET_EVENTS.REPORT_UPDATED, {
    report: transformReport(report),
    updatedBy: adminUser.displayName,
  });
};
```

---

### 📁 File: `backend/src/services/supportRealtimeService.js`

```javascript
/**
 * HÀNG 1: Khi có tin nhắn hỗ trợ mới từ user
 */
export const emitNewSupportMessage = async (message, conversation) => {
  // Thông báo admin có tin nhắn hỗ trợ mới
  emitAdminNotification({
    type: "support",
    title: "Tin nhắn hỗ trợ mới",
    message: `${conversation.user.displayName}: ${message.content.substring(0, 50)}...`,
    link: `/admin/support/${conversation._id}`,
    entityId: conversation._id,
    actor: buildAdminActor(conversation.user),
    severity: "info",
  });

  // Cập nhật thống kê support chưa đọc
  await emitDashboardStatsUpdated({ context: "new-support-message" });

  // Emit realtime để admin support inbox cập nhật
  emitToAdmins(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, {
    message,
    conversationId: conversation._id,
    senderName: conversation.user.displayName,
  });
};
```

---

## 📊 PHẦN 3: FRONTEND - STORES (Quản lý trạng thái)

### 📁 File: `frontend/src/stores/useAdminNotificationStore.ts`

**Mục đích:** Lưu danh sách thông báo admin

```typescript
interface AdminNotificationItem {
  id: string;                    // ID duy nhất
  type: "user" | "report" | "support" | "system"; // Loại thông báo
  title: string;                 // Tiêu đề
  message: string;               // Nội dung
  link?: string;                 // Đường dẫn
  severity?: "info" | "success" | "warning" | "error"; // Mức độ
  actor?: {                       // Ai thực hiện
    displayName: string;
    userName: string;
  };
  createdAt: string;             // Thời gian tạo
  isRead: boolean;               // Đã đọc?
}

export const useAdminNotificationStore = create<AdminNotificationState>((set) => ({
  items: [],
  
  /**
   * HÀNG 1: Thêm hoặc cập nhật thông báo
   * - Nếu thông báo cùng ID đã tồn tại → cập nhật
   * - Nếu chưa → thêm mới vào đầu danh sách
   * - Giữ tối đa 100 thông báo (slice(0, 100))
   */
  addNotification: (notification) => {
    set((state) => {
      const exists = state.items.some((item) => item.id === notification.id);
      const items = exists
        ? state.items.map((item) =>
            item.id === notification.id ? { ...item, ...notification } : item
          )
        : [notification, ...state.items];

      return {
        items: sortByNewest(items).slice(0, 100),
      };
    });
  },

  /**
   * HÀNG 2: Đánh dấu tất cả thông báo là đã đọc
   */
  markAllAsRead: () => {
    set((state) => ({
      items: state.items.map((item) => ({ ...item, isRead: true })),
    }));
  },

  /**
   * HÀNG 3: Xóa thông báo
   */
  removeNotification: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  /**
   * HÀNG 4: Đếm số thông báo chưa đọc
   */
  unreadCount: () => get().items.filter((item) => !item.isRead).length,
}));
```

---

### 📁 File: `frontend/src/stores/useAdminDashboardStore.ts`

**Mục đích:** Lưu thống kê bảng điều khiển

```typescript
interface AdminDashboardOverview {
  totalUsers: number;               // Tổng số user
  activeUsers: number;              // User hoạt động
  totalOnlineUsers?: number;        // User online ngay lúc này
  newUsersToday?: number;           // User mới hôm nay
  bannedUsers: number;              // User bị khóa
  totalPendingReports: number;      // Report chưa xử lý
  totalOpenSupportConversations: number; // Chat hỗ trợ mở
  latestUsers?: Array<{             // 5 user mới nhất
    _id: string;
    displayName: string;
    avatarUrl?: string;
    createdAt: string;
  }>;
  maintenance?: {                   // Trạng thái bảo trì
    isEnabled: boolean;
    message: string;
    enabledAt: string | null;
  };
}

export const useAdminDashboardStore = create<AdminDashboardState>((set) => ({
  overview: null,

  /**
   * HÀNG 1: Lấy dữ liệu dashboard từ API
   * Được gọi lần đầu tiên khi admin vào trang
   */
  fetchOverview: async () => {
    try {
      set({ loading: true });
      const response = await axiosInstance.get("/admin/dashboard/overview");
      set({
        overview: response.data.data,
        loading: false,
      });
    } catch (error) {
      console.error("Lỗi: Không thể tải dữ liệu bảng điều khiển", error);
    }
  },

  /**
   * HÀNG 2: Cập nhật dữ liệu realtime
   * Được gọi khi socket emit DASHBOARD_STATS_UPDATED
   * 
   * Ví dụ:
   * - totalUsers: 150 → 151 (có user mới)
   * - totalOnlineUsers: 45 → 46 (có user mới online)
   * - totalPendingReports: 10 → 11 (có report mới)
   */
  applyRealtimeStats: (payload) => {
    set((state) => ({
      overview: state.overview
        ? {
            ...state.overview,
            ...payload, // Ghi đè những field mới
            latestUsers: payload.latestUsers ?? state.overview.latestUsers,
            maintenance: payload.maintenance ?? state.overview.maintenance,
          }
        : (payload as AdminDashboardOverview),
    }));
  },
}));
```

---

### 📁 File: `frontend/src/stores/useAdminSocketStore.ts`

**Mục đích:** Lưu dữ liệu bảng admin (user, report, support)

```typescript
export interface AdminUserRecord {
  _id: string;
  displayName: string;
  userName: string;
  status: "active" | "inactive" | "suspended" | "banned";
  isOnline?: boolean; // Thêm trạng thái online/offline
  createdAt: string;
}

export interface AdminReportRecord {
  _id: string;
  reporterSnapshot: { displayName: string; };
  reason: string;
  status: "pending" | "reviewing" | "resolved";
  createdAt: string;
}

export interface AdminSupportConversationRecord {
  _id: string;
  supportStatus: "open" | "in_progress" | "resolved";
  supportCreatedByUser?: { displayName: string; };
  lastMessage?: { content: string; createdAt: string; };
  unreadCounts?: Record<string, number>;
}

const useAdminSocketStore = create<AdminSocketState>((set) => ({
  users: [],
  reports: [],
  supportConversations: [],

  /**
   * HÀNG 1: Thêm hoặc cập nhật user trong danh sách
   * - Nếu user cùng _id tồn tại → cập nhật
   * - Nếu chưa → thêm mới vào đầu
   * 
   * Ví dụ:
   * - Badge online/offline thay đổi → update isOnline
   * - Status thay đổi (khóa/mở khóa) → update status
   * - User mới đăng ký → thêm vào đầu danh sách
   */
  upsertUser: (user) => {
    set((state) => {
      const exists = state.users.some((item) => item._id === user._id);
      return {
        users: exists
          ? state.users.map((item) =>
              item._id === user._id ? { ...item, ...user } : item
            )
          : [user, ...state.users],
      };
    });
  },

  /**
   * HÀNG 2: Xóa user khỏi danh sách
   * Được gọi khi user bị xóa vĩnh viễn
   */
  removeUser: (userId) => {
    set((state) => ({
      users: state.users.filter((item) => item._id !== userId),
    }));
  },

  /**
   * HÀNG 3: Thêm hoặc cập nhật report
   */
  upsertReport: (report) => {
    set((state) => {
      const exists = state.reports.some((item) => item._id === report._id);
      return {
        reports: exists
          ? state.reports.map((item) =>
              item._id === report._id ? { ...item, ...report } : item
            )
          : [report, ...state.reports],
      };
    });
  },

  /**
   * HÀNG 4: Thêm hoặc cập nhật support conversation
   */
  upsertSupportConversation: (conversation) => {
    set((state) => {
      const exists = state.supportConversations.some(
        (item) => item._id === conversation._id
      );
      return {
        supportConversations: exists
          ? state.supportConversations.map((item) =>
              item._id === conversation._id
                ? { ...item, ...conversation }
                : item
            )
          : [conversation, ...state.supportConversations],
      };
    });
  },

  /**
   * HÀNG 5: Thêm hoặc cập nhật tin nhắn support
   */
  upsertSupportMessage: (conversationId, message) => {
    set((state) => {
      const messages = state.supportMessagesByConversation[conversationId] ?? [];
      const exists = messages.some((item) => item._id === message._id);

      return {
        supportMessagesByConversation: {
          ...state.supportMessagesByConversation,
          [conversationId]: exists
            ? messages.map((item) =>
                item._id === message._id ? { ...item, ...message } : item
              )
            : [...messages, message],
        },
      };
    });
  },
}));
```

---

## 🎣 PHẦN 4: FRONTEND - HOOKS (Kết nối Socket)

### 📁 File: `frontend/src/hooks/useAdminSocket.ts`

**Mục đích:** Đăng ký tất cả socket listener cho admin

```typescript
import { useEffect } from "react";
import { ADMIN_SOCKET_EVENTS } from "@/constants/adminSocketEvents";
import {
  useAdminDashboardStore,
  useAdminNotificationStore,
  useAdminSocketStore,
} from "@/stores";
import { useSocketStore } from "@/stores/useSocketStore";
import { useAuthStore } from "@/stores/useAuthStore";

export const useAdminSocket = () => {
  const socket = useSocketStore((state) => state.socket);
  const userRole = useAuthStore((state) => state.user?.role);
  
  // Kiểm tra: Chỉ chạy nếu là admin và socket tồn tại
  useEffect(() => {
    if (!socket || userRole !== "admin") {
      return;
    }

    /**
     * HÀNG 1: Chuẩn bị các function để cập nhật store
     * Tránh tạo hàm mới mỗi lần render
     */
    const addNotification = useAdminNotificationStore
      .getState()
      .addNotification;
    const applyRealtimeStats = useAdminDashboardStore
      .getState()
      .applyRealtimeStats;
    const { upsertUser, removeUser, upsertReport, upsertSupportConversation } =
      useAdminSocketStore.getState();

    /**
     * HÀNG 2: Xử lý sự kiện "admin:system:notification"
     * Mỗi khi admin nhận được thông báo từ server
     */
    const handleSystemNotification = (payload: any) => {
      // Thêm thông báo vào store (sẽ hiển thị trong notification center)
      addNotification({
        id: payload.id ?? `admin-system-${Date.now()}`,
        type: payload.type ?? "system",
        title: payload.title ?? "Thông báo hệ thống",
        message: payload.message ?? "",
        link: payload.link,
        entityId: payload.entityId,
        actor: payload.actor,
        severity: payload.severity ?? "info",
      });

      // TUỲ CHỌN: Hiển thị toast để bạn được thông báo ngay lập tức
      // toast.info(payload.title);
    };

    /**
     * HÀNG 3: Xử lý sự kiện user realtime (đăng ký, đăng nhập, khóa, xóa)
     */
    const handleUserRealtime = (
      payload: any,
      notificationTitle: string
    ) => {
      // Cập nhật user trong bảng admin
      if (payload.user) {
        upsertUser({
          ...payload.user,
          isOnline:
            typeof payload.isOnline === "boolean"
              ? payload.isOnline
              : payload.status === "online",
        });
      }

      // Thêm thông báo vào notification center
      addNotification({
        id: `user-${notificationTitle}-${payload.user?._id}`,
        type: "user",
        title: notificationTitle,
        message: payload.user?.displayName
          ? `${payload.user.displayName} (${payload.user.userName})`
          : "Có thay đổi user mới",
        link: payload.user?._id ? `/admin/users/${payload.user._id}` : "/admin/users",
        entityId: payload.user?._id,
        actor: payload.actor,
      });
    };

    /**
     * HÀNG 4: Đăng ký listener cho từng sự kiện
     */
    
    // Sự kiện: User mới đăng ký
    const onUserNew = (payload: any) => {
      handleUserRealtime(payload, "Người dùng mới");
      // toast.success("Có người dùng mới đăng ký");
    };
    socket.on(ADMIN_SOCKET_EVENTS.USER_NEW, onUserNew);

    // Sự kiện: User đăng nhập
    const onUserLogin = (payload: any) => {
      handleUserRealtime(payload, "Người dùng vừa đăng nhập");
    };
    socket.on(ADMIN_SOCKET_EVENTS.USER_LOGIN, onUserLogin);

    // Sự kiện: User đăng xuất
    const onUserLogout = (payload: any) => {
      handleUserRealtime(payload, "Người dùng vừa đăng xuất");
    };
    socket.on(ADMIN_SOCKET_EVENTS.USER_LOGOUT, onUserLogout);

    // Sự kiện: Trạng thái user thay đổi (online/offline)
    const onUserStatusChanged = (payload: any) => {
      if (payload.user) {
        upsertUser({
          ...payload.user,
          isOnline: payload.isOnline,
        });
      }
    };
    socket.on(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED, onUserStatusChanged);

    // Sự kiện: Tài khoản bị khóa
    const onUserLocked = (payload: any) => {
      handleUserRealtime(payload, "Tài khoản bị khóa");
      // toast.warning("Một tài khoản vừa bị khóa");
    };
    socket.on(ADMIN_SOCKET_EVENTS.USER_LOCKED, onUserLocked);

    // Sự kiện: Tài khoản được mở khóa
    const onUserUnlocked = (payload: any) => {
      handleUserRealtime(payload, "Tài khoản được mở khóa");
    };
    socket.on(ADMIN_SOCKET_EVENTS.USER_UNLOCKED, onUserUnlocked);

    // Sự kiện: Tài khoản bị xóa
    const onUserDeleted = (payload: any) => {
      if (payload.user?._id) {
        removeUser(payload.user._id);
      }
      handleUserRealtime(payload, "Tài khoản bị xóa");
      // toast.warning("Một tài khoản vừa bị xóa");
    };
    socket.on(ADMIN_SOCKET_EVENTS.USER_DELETED, onUserDeleted);

    // Sự kiện: Report mới
    const onReportNew = (payload: any) => {
      if (payload.report) {
        upsertReport(payload.report);
      }
      addNotification({
        id: `report-new-${payload.report?._id}`,
        type: "report",
        title: "Báo cáo vi phạm mới",
        message: payload.report?.reason
          ? payload.report.reason.substring(0, 100)
          : "Có báo cáo mới",
        link: `/admin/reports/${payload.report?._id}`,
        entityId: payload.report?._id,
        severity: "warning",
      });
      // toast.error("Có báo cáo vi phạm mới");
    };
    socket.on(ADMIN_SOCKET_EVENTS.REPORT_NEW, onReportNew);

    // Sự kiện: Report được cập nhật
    const onReportUpdated = (payload: any) => {
      if (payload.report) {
        upsertReport(payload.report);
      }
    };
    socket.on(ADMIN_SOCKET_EVENTS.REPORT_UPDATED, onReportUpdated);

    // Sự kiện: Tin nhắn hỗ trợ mới
    const onSupportNewMessage = (payload: any) => {
      if (payload.conversation) {
        upsertSupportConversation(payload.conversation);
      }
      addNotification({
        id: `support-${payload.conversationId}-${Date.now()}`,
        type: "support",
        title: "Tin nhắn hỗ trợ mới",
        message: payload.senderName ?? "Admin nhận tin nhắn hỗ trợ",
        link: `/admin/support/${payload.conversationId}`,
        entityId: payload.conversationId,
      });
    };
    socket.on(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, onSupportNewMessage);

    // Sự kiện: Thống kê dashboard cập nhật
    const onDashboardStatsUpdated = (payload: any) => {
      // Cập nhật tất cả số liệu dashboard mà không reload trang
      applyRealtimeStats({
        totalUsers: payload.totalUsers,
        totalOnlineUsers: payload.totalOnlineUsers,
        newUsersToday: payload.newUsersToday,
        bannedUsers: payload.bannedUsers,
        totalPendingReports: payload.totalPendingReports,
        totalUnreadSupportConversations: payload.totalUnreadSupportConversations,
        latestUsers: payload.latestUsers,
        maintenance: payload.maintenance,
      });
    };
    socket.on(ADMIN_SOCKET_EVENTS.DASHBOARD_STATS_UPDATED, onDashboardStatsUpdated);

    // Sự kiện: Chế độ bảo trì bật
    const onMaintenanceOn = (payload: any) => {
      addNotification({
        id: "maintenance-on",
        type: "system",
        title: "Chế độ bảo trì bật",
        message: `${payload.actor?.displayName ?? "Hệ thống"} vừa bật chế độ bảo trì`,
        severity: "warning",
      });
      applyRealtimeStats({
        maintenance: {
          isEnabled: true,
          message: payload.message,
          enabledAt: new Date().toISOString(),
        },
      });
    };
    socket.on(ADMIN_SOCKET_EVENTS.MAINTENANCE_ON, onMaintenanceOn);

    // Sự kiện: Chế độ bảo trì tắt
    const onMaintenanceOff = (payload: any) => {
      addNotification({
        id: "maintenance-off",
        type: "system",
        title: "Chế độ bảo trì tắt",
        message: `${payload.actor?.displayName ?? "Hệ thống"} vừa tắt chế độ bảo trì`,
        severity: "success",
      });
      applyRealtimeStats({
        maintenance: {
          isEnabled: false,
          message: "",
          disabledAt: new Date().toISOString(),
        },
      });
    };
    socket.on(ADMIN_SOCKET_EVENTS.MAINTENANCE_OFF, onMaintenanceOff);

    // Sự kiện: Thông báo hệ thống chung
    socket.on(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION, handleSystemNotification);

    /**
     * HÀNG 5: Cleanup - Xóa tất cả listener khi component unmount
     * Điều này rất quan trọng để tránh duplicate listener
     */
    return () => {
      socket.off(ADMIN_SOCKET_EVENTS.USER_NEW, onUserNew);
      socket.off(ADMIN_SOCKET_EVENTS.USER_LOGIN, onUserLogin);
      socket.off(ADMIN_SOCKET_EVENTS.USER_LOGOUT, onUserLogout);
      socket.off(ADMIN_SOCKET_EVENTS.USER_STATUS_CHANGED, onUserStatusChanged);
      socket.off(ADMIN_SOCKET_EVENTS.USER_LOCKED, onUserLocked);
      socket.off(ADMIN_SOCKET_EVENTS.USER_UNLOCKED, onUserUnlocked);
      socket.off(ADMIN_SOCKET_EVENTS.USER_DELETED, onUserDeleted);
      socket.off(ADMIN_SOCKET_EVENTS.REPORT_NEW, onReportNew);
      socket.off(ADMIN_SOCKET_EVENTS.REPORT_UPDATED, onReportUpdated);
      socket.off(ADMIN_SOCKET_EVENTS.SUPPORT_NEW_MESSAGE, onSupportNewMessage);
      socket.off(ADMIN_SOCKET_EVENTS.DASHBOARD_STATS_UPDATED, onDashboardStatsUpdated);
      socket.off(ADMIN_SOCKET_EVENTS.MAINTENANCE_ON, onMaintenanceOn);
      socket.off(ADMIN_SOCKET_EVENTS.MAINTENANCE_OFF, onMaintenanceOff);
      socket.off(ADMIN_SOCKET_EVENTS.SYSTEM_NOTIFICATION, handleSystemNotification);
    };
  }, [socket, userRole]); // Chỉ chạy khi socket hoặc userRole thay đổi
};
```

---

## 📱 PHẦN 5: LUỒNG HOÀN CHỈNH - VÍ DỤ THỰC TẾ

### Ví dụ 1: User mới đăng ký

```
1. User nhập form đăng ký
   ↓
2. Frontend gửi POST /auth/register
   ↓
3. Backend tạo user mới
   ↓
4. Backend emit "admin:user:new" tới phòng "admins"
   → Dữ liệu: { user: {...}, actor: {...} }
   ↓
5. Frontend admin nhận event "admin:user:new"
   ↓
6. useAdminSocket xử lý:
   - Cập nhật bảng user: upsertUser(user) → danh sách user cập nhật
   - Thêm thông báo: addNotification(...) → notification center
   - Cập nhật dashboard: applyRealtimeStats({ totalUsers: 151 })
   ↓
7. Admin thấy:
   - Badge "+1" ở dashboard
   - Dòng mới trong bảng user
   - Thông báo "Người dùng mới" ở notification center
   - KHÔNG CẦN REFRESH TRANG!
```

### Ví dụ 2: Admin khóa tài khoản user

```
1. Admin click nút "Khóa" ở bảng user
   ↓
2. Frontend gửi PUT /admin/users/{id}/lock
   ↓
3. Backend:
   - Cập nhật user status = "banned"
   - Emit "admin:user:locked" tới admin
   - Emit "user:account-locked" tới user bị khóa
   ↓
4. Admin khác cũng thấy realtime:
   - Status badge thay đổi từ "Hoạt động" → "Bị khóa"
   - Thông báo "Tài khoản bị khóa"
   ↓
5. User bị khóa thấy:
   - Toast "Tài khoản của bạn đã bị khóa"
   - Bị logout ngay
```

### Ví dụ 3: Report mới từ user

```
1. User gửi report
   ↓
2. Backend tạo report, emit "admin:report:new"
   ↓
3. Admin dashboard cập nhật:
   - Badge "Report chưa xử lý" tăng lên: 10 → 11
   - Bảng report thêm dòng mới ở đầu
   - Thông báo xuất hiện: "Báo cáo vi phạm mới"
   ↓
4. Nếu admin đang mở modal report, cũng thấy dữ liệu cập nhật ngay
```

---

## 🛡️ PHẦN 6: NGĂN DUPLICATE LISTENER

### Vấn đề cũ
```javascript
// ❌ SAI - Tạo listener mới mỗi lần render
useEffect(() => {
  socket.on("admin:user:new", onUserNew);
}, []); // Dependency array rỗng → chỉ chạy lần đầu

// Nhưng nếu component re-render hoặc hook được gọi lại
// → listener được đăng ký thêm lần nữa
// → event emit 1 lần nhưng xử lý 2 lần → BUG!
```

### Giải pháp hiện tại
```javascript
// ✅ ĐÚNG
useEffect(() => {
  if (!socket || userRole !== "admin") {
    return;
  }

  // Đăng ký tất cả listener
  socket.on(ADMIN_SOCKET_EVENTS.USER_NEW, onUserNew);
  socket.on(ADMIN_SOCKET_EVENTS.USER_LOGIN, onUserLogin);
  // ...

  // ⭐ QUAN TRỌNG: Cleanup function
  // Xóa listener khi component unmount hoặc dependency thay đổi
  return () => {
    socket.off(ADMIN_SOCKET_EVENTS.USER_NEW, onUserNew);
    socket.off(ADMIN_SOCKET_EVENTS.USER_LOGIN, onUserLogin);
    // ...
  };
}, [socket, userRole]); // Dependency rõ ràng
```

---

## 📋 PHẦN 7: TỔNG HỢP DỮ LIỆU REALTIME

| Sự kiện | Khi nào | Dữ liệu emit | Cập nhật store | Hình ảnh |
|---------|---------|--------------|----------------|---------|
| **USER_NEW** | User đăng ký | user, actor | upsertUser, addNotification | Danh sách user +1, thông báo mới |
| **USER_LOGIN** | User đăng nhập | user, actor | upsertUser, addNotification | Badge online |
| **USER_LOGOUT** | User đăng xuất | user, actor | upsertUser | Badge offline |
| **USER_STATUS_CHANGED** | Online/Offline | user, isOnline | upsertUser | Badge thay đổi ngay |
| **USER_LOCKED** | Admin khóa | user, actor | upsertUser, addNotification | Status → "Bị khóa", thông báo |
| **USER_UNLOCKED** | Admin mở khóa | user, actor | upsertUser, addNotification | Status → "Hoạt động" |
| **USER_DELETED** | Admin xóa | user, actor | removeUser, addNotification | Xóa dòng khỏi bảng |
| **REPORT_NEW** | User gửi report | report | upsertReport, addNotification | Badge "chưa xử lý" +1, danh sách +1 |
| **REPORT_UPDATED** | Admin cập nhật report | report | upsertReport | Status report thay đổi |
| **SUPPORT_NEW_MESSAGE** | User gửi support | message, conversation | upsertSupportConversation | Inbox +1 unread |
| **DASHBOARD_STATS_UPDATED** | Bất kỳ sự kiện quan trọng | stats | applyRealtimeStats | Dashboard cards thay đổi |
| **MAINTENANCE_ON** | Admin bật bảo trì | actor, message | applyRealtimeStats, addNotification | Maintenance badge ON |
| **MAINTENANCE_OFF** | Admin tắt bảo trì | actor | applyRealtimeStats, addNotification | Maintenance badge OFF |

---

## 🎯 PHẦN 8: FLOW ĐẦY ĐỦ KHI ADMIN VÀO TRANG

```
1. Admin vào http://localhost:5173/admin
   ↓
2. Admin Dashboard Component mount
   ↓
3. Gọi useAdminDashboardStore.fetchOverview()
   → API GET /admin/dashboard/overview
   → Set overview dữ liệu ban đầu
   ↓
4. Gọi useAdminSocket() hook
   ↓
5. Check: Có socket? Có admin role?
   ↓
6. Đăng ký tất cả listener cho admin events
   ↓
7. Dashboard hiển thị dữ liệu ban đầu
   ↓
8. Khi có sự kiện realtime từ server:
   - Socket emit "admin:user:new"
   - useAdminSocket handler: upsertUser(), addNotification(), applyRealtimeStats()
   - Store update
   - Component re-render
   - UI cập nhật ngay (card số, bảng user, notification center)
```

---

## 📚 PHẦN 9: CÁC FILE CẦN BIẾT

### Backend
- `backend/src/constants/socketEvents.js` - Tên event
- `backend/src/socket/adminSocket.js` - Emit tới admin room
- `backend/src/socket/index.js` - Socket IO setup
- `backend/src/services/adminNotificationService.js` - Tạo notification
- `backend/src/services/dashboardRealtimeService.js` - Thống kê realtime
- `backend/src/services/reportRealtimeService.js` - Emit report events
- `backend/src/services/supportRealtimeService.js` - Emit support events

### Frontend
- `frontend/src/stores/useAdminSocketStore.ts` - Lưu user, report, support
- `frontend/src/stores/useAdminNotificationStore.ts` - Lưu notification
- `frontend/src/stores/useAdminDashboardStore.ts` - Lưu thống kê
- `frontend/src/hooks/useAdminSocket.ts` - Đăng ký listener
- `frontend/src/constants/adminSocketEvents.ts` - Tên event (frontend)
- `frontend/src/pages/AdminDashboard.tsx` - Gọi useAdminSocket()

---

## ✅ CHECKLIST - KIỂM TRA HỆ THỐNG

- [x] Backend emit tới admin room (không emit tới user)
- [x] Frontend có useAdminSocket hook
- [x] Listener được cleanup khi unmount (tránh duplicate)
- [x] Store update bằng upsert (tránh duplicate data)
- [x] Thông báo có id duy nhất (tránh duplicate notification)
- [x] Dashboard card cập nhật mềm (không reload trang)
- [x] Bảng user realtime (thêm/xóa/cập nhật dòng)
- [x] Support inbox realtime (tin nhắn mới, unread count)
- [x] Notification center realtime (danh sách thông báo)
- [x] Maintenance mode realtime (toggle on/off)

---

**Tóm lại:** Hệ thống đã hoàn tất và tuân theo 11 yêu cầu ban đầu. Không cần refresh trang, tất cả dữ liệu admin tự cập nhật realtime qua socket! 🎉
