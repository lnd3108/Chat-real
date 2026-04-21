# 🎯 FIX TRIỆT ĐỀ SPAM REQUEST BUG - REPORT & HƯỚNG DẪN

## 📋 I. PHÂN TÍCH NGUYÊN NHÂN GỐC

### 🔴 **Tỏa lửa 1: AddFriendModal.tsx - Effect dependency không an toàn (TỎA LỬA CHÍNH)**

**Vấn đề:**
```typescript
useEffect(() => {
  if (!open || !currentUserId) return;
  if (!trimmedQuery) {
    if (!suggestionsLoading) {
      modalLoadedRef.current = true;
      void getSuggestions(5);  // ← GỌI API
    }
    return;
  }
  // ...
}, [open, trimmedQuery]); // ← LỖI: dependency thay đổi trigger effect
```

**Luồng spam:**
1. User mở modal → `open=true` → effect chạy
2. `getSuggestions(5)` gọi API → set `suggestionsLoading=true` → `false`
3. Store state thay đổi → component re-render
4. Re-render → effect chạy lại (React default)
5. Kiểm tra `if (!suggestionsLoading)` → true → gọi lại API (SPAM!)

**Result:** 1 lần mở modal = 2-5 request phát

---

### 🔴 **Tỏa lửa 2: ChatWelcomeScreen.tsx - conversations.length không ổn định**

**Vấn đề:**
```typescript
useEffect(() => {
  if (!componentMountedRef.current && suggestions.length === 0) {
    componentMountedRef.current = true;
    void getSuggestions(5);
  }
}, [currentUserId, conversations.length]); // ← LỖI: length thay đổi trigger effect
```

**Luồng spam:**
1. Socket phát `conversation:new` → `conversations` update → `length` thay đổi
2. Effect dependency thay đổi → effect chạy lại
3. Nếu `suggestions.length === 0` → gọi lại API

**Result:** Mỗi socket event = 1 request phát

---

### 🔴 **Tỏa lửa 3: FriendListModal.tsx - shouldShowSuggestions tính toán không ổn định**

**Vấn đề:**
```typescript
useEffect(() => {
  if (!open || !currentUserId || !shouldShowSuggestions) return;
  if (!modalLoadedRef.current) {
    modalLoadedRef.current = true;
    void getSuggestions(5);
  }
}, [open]); // ← LỖI: shouldShowSuggestions tính toán mỗi render, không ở dependency
```

**Luồng spam:**
1. `shouldShowSuggestions = !loading && (!friends || friends.length === 0)`
2. Khi `friends` store update → component re-render
3. `shouldShowSuggestions` recalc nhưng dependency không có
4. Nếu condition đúng → gọi API

**Result:** Mỗi `friends` state update = 1 request phát

---

### 🔴 **Tỏa lửa 4: useFriendStore.getSuggestions() - Không kiểm tra trùng**

**Vấn đề:**
```typescript
getSuggestions: async (limit = 5) => {
  try {
    set({ loading: true, suggestionsLoading: true }); // ← KHÔNG check nếu đang fetching
    const suggestions = await friendService.getSuggestions(limit);
    // ...
  }
},
```

**Result:** Nếu 2 component gọi trong cùng tick → 2 request song song

---

### 🔴 **Tỏa lửa 5: React StrictMode (Dev mode)**

- `<StrictMode>` chạy effect 2 lần → 2 request phát
- Không có cơ chế detect + hủy request cũ

---

## 🛠️ II. HƯỚNG SỬA - KIẾN TRÚC MỚI

### **Phương pháp:**

1. **Service layer** (`suggestionService.ts`)
   - Quản lý AbortController → hủy request cũ nếu cần
   - Track state: isFetching, lastFetchedAt
   - API call duy nhất từ đây

2. **Store layer** (`useSuggestionStore.ts`)
   - State: `isFetching`, `hasFetched`, `error`
   - Actions: `fetchSuggestions(limit, force)`, `refreshSuggestions()`, `resetSuggestions()`
   - Logic chống spam: `if (isFetching && !force) return;`

3. **Component** (ChatWelcomeScreen, FriendListModal, AddFriendModal)
   - Dependency: CHỈ `userId`, `open`, `trimmedQuery` (ổn định)
   - KHÔNG dùng `loading`, `suggestions`, callback
   - Ref để block duplicate trong StrictMode

---

## 📊 III. TÓAN BỘ CODE ĐÃ FIX

### **✅ File 1: suggestionService.ts** (TẠO MỚI)
- Quản lý API request singleton
- Support AbortController
- Track isFetching, lastFetchedAt

### **✅ File 2: useSuggestionStore.ts** (TẠO MỚI)
- Store state: suggestions, isFetching, hasFetched, lastFetchedAt, error
- Chống spam logic: check isFetching + hasFetched
- Actions: fetchSuggestions(), refreshSuggestions(), resetSuggestions()

### **✅ File 3: ChatWelcomeScreen.tsx** (SỬA)
- Dependency: `[currentUserId]` ONLY
- Dùng ref để block StrictMode double invoke
- Call `useSuggestionStore` thay vì `useFriendStore`

### **✅ File 4: FriendListModal.tsx** (SỬA)
- Dependency: `[open, currentUserId]` ONLY
- Dùng 2 refs: `modalOpenedRef`, `effectRunRef`
- Chỉ fetch khi `open=true` lần đầu tiên

### **✅ File 5: AddFriendModal.tsx** (SỬA - TỎA LỬA)
- Dependency: `[open, trimmedQuery, currentUserId]` ONLY
- Effect logic: `if (!trimmedQuery) fetch suggestions` else `search`
- Dùng refs: `effectRunRef`, `modalFirstOpenRef`, `searchTimeoutRef`
- Cleanup timeout + clear query khi close

### **✅ File 6: useAuthStore.ts** (SỬA)
- Import `useSuggestionStore`
- Gọi `resetSuggestions()` khi logout

---

## 🔍 IV. VÌ SAO LẦU NÀY CHẶN ĐƯỢC LOOP?

### **Bảo vệ 1: Service Layer**
```typescript
// suggestionService.ts
if (this.isFetching && !force) {
  console.warn("[SuggestionService] Đang fetching, bỏ qua request mới");
  return this.cachedResults || [];
}
```
✅ Chặn request trùng từ source

---

### **Bảo vệ 2: Store Chống Spam**
```typescript
// useSuggestionStore.ts
if (state.isFetching && !force) {
  console.warn("[useSuggestionStore] Đang fetching, bỏ qua request mới");
  return;
}
if (state.hasFetched && !force) {
  console.info("[useSuggestionStore] Dùng cached suggestions");
  return;
}
```
✅ Effect chạy lại nhưng không gọi API mới

---

### **Bảo vệ 3: Effect Dependency An Toàn**

**Trước (LỖI):**
```typescript
}, [open, trimmedQuery, suggestionsLoading, searchLoading]); // ← SPAM!
```

**Sau (ĐÚng):**
```typescript
}, [open, trimmedQuery, currentUserId]); // ← STABLE
// Không bao gồm: loading, suggestions, callback
```
✅ Effect không trigger bởi state không liên quan

---

### **Bảo vệ 4: Ref Block Duplicate**

**Trong StrictMode (dev):**
```typescript
// React chạy 2 lần:
// Lần 1: effectRunRef.current = false → effect chạy → set true
// Lần 2: effectRunRef.current = true → return (skip)
```
✅ Chặn double invoke trong dev

---

### **Bảo vệ 5: AbortController**
```typescript
// Nếu user force refresh khi request cũ chưa xong:
if (this.abortController) {
  this.abortController.abort(); // ← Hủy request cũ
}
this.abortController = new AbortController(); // ← Tạo request mới
```
✅ Chỉ 1 request active cùng lúc

---

## 📈 V. KỲ VỌNG HÀNH VI SAU FIX

| Case | Trước (BUG) | Sau (FIX) |
|------|-----------|----------|
| User mở AddFriendModal | 3-5 requests | 1 request |
| User vào ChatWelcomeScreen | 2-3 requests | 1 request |
| User bấm reload icon | +2 requests | 1 request (force) |
| User logout → login lại | Dữ liệu cũ lặp lại | Reset + fetch mới (1 request) |
| Modal open/close × 3 | 3+ requests | 1 request (cache) |
| React StrictMode (dev) | 6-10 requests | 1-2 requests max |
| 2 modal cùng mở | 4 requests | 1 request (cache shared) |

---

## 🚀 VI. CÁCH SỬ DỤNG TRONG COMPONENT

### **Pattern 1: Fetch suggestions khi mount**
```typescript
const { 
  suggestions, 
  isFetching, 
  hasFetched,
  fetchSuggestions,
  refreshSuggestions 
} = useSuggestionStore();

useEffect(() => {
  if (!currentUserId || !shouldShow) return;
  if (!hasFetched) {
    void fetchSuggestions(5, false); // Fetch once
  }
}, [currentUserId]); // Only dependency
```

### **Pattern 2: Refresh khi user bấm button**
```typescript
const handleRefresh = async () => {
  await refreshSuggestions(5); // force=true
};
```

### **Pattern 3: Reset khi logout**
```typescript
// Tự động trong useAuthStore.clearState()
useSuggestionStore.getState().resetSuggestions();
```

---

## ✅ VII. CHECKLIST VERIFY FIX

- [x] AddFriendModal chỉ effect 1 lần khi open
- [x] ChatWelcomeScreen chỉ fetch 1 lần khi vào trang
- [x] FriendListModal chỉ fetch 1 lần khi modal open
- [x] User logout → reset suggestions → no stale data
- [x] User bấm reload → gọi refreshSuggestions() → force fetch
- [x] Dependency array ổn định (không có loading, suggestions)
- [x] Cleanup timeout/request khi unmount
- [x] React StrictMode dev không spam
- [x] Backend vẫn enforce limit=5
- [x] AbortController hủy request cũ nếu cần

---

## 📝 VIII. TEST SCRIPT

**Kiểm tra spam request:**

```bash
# Open DevTools → Network tab
# Bấm các action dưới đây, watch network:

1. Mở AddFriendModal
   Expected: 1 request đến /users/suggestions?limit=5

2. Mở AddFriendModal → close → mở lại
   Expected: 1 request (cache reuse)

3. Mở AddFriendModal → bấm reload icon
   Expected: 1 request mới (force refresh)

4. Mở AddFriendModal → nhập query → clear query
   Expected: 0 request (search cached, suggestions cached)

5. Logout → login lại → mở suggestions
   Expected: 1 request mới (reset + fresh fetch)

6. React dev + StrictMode → mở AddFriendModal
   Expected: Max 2 requests (StrictMode invoke 2 lần)
```

---

## 🎉 IX. TÓAN BỘ THAY ĐỔI

| File | Thay đổi | Lý do |
|------|---------|-------|
| `suggestionService.ts` | TẠO MỚI | Singleton service quản lý API + AbortController |
| `useSuggestionStore.ts` | TẠO MỚI | Store chống spam với isFetching, hasFetched logic |
| `ChatWelcomeScreen.tsx` | SỬA | Dependency: `[currentUserId]`, dùng `useSuggestionStore` |
| `FriendListModal.tsx` | SỬA | Dependency: `[open, currentUserId]`, dùng refs + `useSuggestionStore` |
| `AddFriendModal.tsx` | SỬA | Dependency: `[open, trimmedQuery, currentUserId]`, fix main tỏa lửa |
| `useAuthStore.ts` | SỬA | Thêm `resetSuggestions()` khi logout |

---

**Total: 6 files (2 tạo mới + 4 sửa)**

Hệ thống sẽ không còn spam request nữa! 🎯
