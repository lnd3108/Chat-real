# Transport Security Audit - ChatRealTime

Ngày audit: 2026-06-15  
Phạm vi: backend/frontend source/config/docker/env public config. Không sửa code, không cài package, không đổi env.

## Executive Summary

Project đã có một số nền tảng tốt: `refreshToken` và `accessToken` được set bằng `httpOnly` cookie; frontend production trỏ API/Socket tới `https://chat-real-back-end.onrender.com`; Socket.IO không truyền token qua query string mà dùng `auth.token`; Zustand không persist `accessToken` vào `localStorage`.

Rủi ro chính hiện tại là app chưa enforce HTTPS/HSTS/trust proxy/security headers, CORS chỉ nhận một `CLIENT_URL` đơn lẻ và chưa có whitelist/prod validation, access token vẫn được trả trong JSON response rồi gắn vào `Authorization: Bearer`, refresh token chưa rotate, và logout/clear cookie chưa dùng option đồng nhất với cookie lúc set. Docker hiện expose MongoDB `27017` ra host; Redis chưa có config nên cần thiết kế private/password/TLS trước khi lưu session.

## A. Kiến Trúc Truyền Tải Hiện Tại

### Frontend gọi backend qua URL nào?

- `frontend/src/shared/api/axios.ts`: `baseURL: import.meta.env.VITE_API_URL`, `withCredentials: true`.
- `frontend/.env.development`: `VITE_API_URL=http://localhost:5001/api`, `VITE_SOCKET_URL=http://localhost:5001/`.
- `frontend/.env.production`: `VITE_API_URL=https://chat-real-back-end.onrender.com/api`, `VITE_SOCKET_URL=https://chat-real-back-end.onrender.com/`.
- Socket client dùng `VITE_SOCKET_URL` hoặc fallback từ `VITE_API_URL` bỏ `/api`.

### Backend listen port nào?

- `backend/src/app/server.js`: `const port = process.env.PORT || 5001`.
- HTTP server tạo bằng `http.createServer(app)`.

### Reverse proxy/Nginx/Cloudflare/Docker?

- Không thấy Nginx config hoặc Dockerfile app trong repo.
- `frontend/vercel.json` chỉ rewrite SPA route về `/`.
- Production URL backend là Render (`onrender.com`), suy luận có edge proxy/TLS của Render ở phía ngoài, nhưng app code không tự enforce.
- `docker-compose.yml` hiện chỉ có MongoDB local.

### FE/BE cùng domain hay khác domain?

- Development: FE thường `localhost:5173`, BE `localhost:5001`, khác origin.
- Production theo config: FE nhiều khả năng deploy Vercel hoặc domain khác; BE là `chat-real-back-end.onrender.com`, khác origin.
- Vì khác origin, cookie auth cần `credentials: true`, CORS origin chính xác, và production cross-site cookie cần `SameSite=None; Secure`.

### Production đã có HTTPS chưa?

- Frontend production config gọi backend bằng HTTPS.
- Repo không có middleware ép HTTPS, không có HSTS, không có `app.set("trust proxy", 1)`.
- Nếu Render terminate TLS rồi forward HTTP nội bộ tới Node thì edge HTTPS có, nhưng app chưa tự từ chối HTTP request nếu endpoint bị truy cập trực tiếp qua HTTP.

### Socket.IO đang dùng ws hay wss?

- Frontend production dùng `https://chat-real-back-end.onrender.com/`; Socket.IO client sẽ handshake HTTPS và websocket upgrade thành WSS trên browser.
- Development dùng `http://localhost:5001/`, websocket là WS.
- Code không có check bắt buộc `wss` ở production; phụ thuộc URL env và reverse proxy.

## B. Auth Token Transport

### Access token được lưu ở đâu?

- Backend set `accessToken` vào httpOnly cookie.
- Backend đồng thời trả `accessToken` trong JSON response của signin/verify/refresh.
- Frontend giữ `accessToken` trong Zustand memory state (`useAuthStore.accessToken`).
- Zustand persist `auth-storage` không persist `accessToken`; chỉ persist `user` và pending verification fields.

### Refresh token được lưu ở đâu?

- Backend set `refreshToken` vào httpOnly cookie.
- Backend lưu raw `refreshToken` trong MongoDB collection `Session`.
- Frontend không đọc được refresh token vì httpOnly cookie.

### Token trong localStorage/sessionStorage?

- Không thấy `accessToken` hoặc `refreshToken` được ghi vào `localStorage`/`sessionStorage`.
- `auth-storage` persisted trong localStorage nhưng `partialize` loại `accessToken`; vẫn lưu `user` và pending verification token/email.
- LocalStorage khác đang dùng cho UI preferences/notification/chat settings, không phải auth token.

### Token qua query string?

- Không thấy access/refresh token qua query string.
- Google auth callback gửi `code` trong request body `/auth/google/callback`, không phải query tới backend trong service.
- User search dùng query string `q`, không liên quan token.

### Token qua Authorization header?

- Có. `frontend/src/shared/api/axios.ts` gắn `Authorization: Bearer ${accessToken}` cho mọi request nếu memory state có token.
- `backend/src/modules/identity/application/resolve-access-user-from-token.js` ưu tiên bearer token, fallback cookie `accessToken`.
- `signOutUser` cũng đọc Authorization header để emit logout user.

### Cookie config hiện tại

| Cookie | Nơi set | httpOnly | secure | sameSite | maxAge | domain | path |
|---|---|---:|---:|---|---:|---|---|
| `refreshToken` | `token.service.createSession` | true | `NODE_ENV === "production"` | production `none`, non-prod `lax` | 14 ngày | Không set | Không set |
| `accessToken` | `token.service.createSession` | true | `NODE_ENV === "production"` | production `none`, non-prod `lax` | 30 phút | Không set | Không set |
| `accessToken` refresh | `session.command-service.refreshAccessToken` | true | `NODE_ENV === "production"` | production `none`, non-prod `lax` | 30 phút | Không set | Không set |
| clear logout | `signOutUser` | N/A | Không truyền options | Không truyền options | N/A | Không set | Không set |
| clear reset password | `auth.controller.resetForgottenPassword` | N/A | Không truyền options | Không truyền options | N/A | Không set | Không set |
| clear change password | `account-management.command-service.changePasswordForUser` | true | true | none | N/A | Không set | Không set |

### Logout/refresh clear cookie đúng không?

- Logout xóa `Session` theo `refreshToken`, `res.clearCookie("refreshToken")`, `res.clearCookie("accessToken")`.
- Reset password clear cả hai cookie.
- Ban user trong refresh xóa refresh cookie nhưng không thấy clear access cookie trong nhánh đó.
- Rủi ro: `clearCookie` không dùng cùng `secure/sameSite/path/domain` với lúc set. Với cross-site production cookie `SameSite=None; Secure`, nên clear cũng cần cùng options để đảm bảo browser xóa đúng.

### Có rotate refresh token không?

- Chưa. Refresh chỉ verify `Session.findOne({ refreshToken })`, rồi cấp access token mới.
- Refresh token cũ vẫn giữ nguyên đến TTL 14 ngày hoặc logout/ban/delete/change password.

## C. CORS Audit

### Backend CORS config

- File: `backend/src/app/server.js`
- Config: `app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }))`

### Socket.IO CORS config

- File: `backend/src/app/socket/initSocket.js`
- Config: `new Server(server, { cors: { origin: process.env.CLIENT_URL, credentials: true } })`

### Bảng CORS hiện tại

| Surface | origin | credentials | wildcard | whitelist nhiều origin | dev/prod split |
|---|---|---:|---:|---:|---:|
| Express API | `process.env.CLIENT_URL` | true | Không thấy `*` | Không | Phụ thuộc env |
| Socket.IO | `process.env.CLIENT_URL` | true | Không thấy `*` | Không | Phụ thuộc env |

### Đánh giá

- Không dùng origin `"*"`, tốt cho credentials.
- Chỉ hỗ trợ một `CLIENT_URL`; nếu production có nhiều frontend domain/preview/staging sẽ dễ bị cấu hình sai hoặc phải đổi env.
- Không thấy validation fail-fast nếu `CLIENT_URL` thiếu trong production.
- `CLIENT_URL` dùng trực tiếp cho cả API và Socket.IO.

## D. HTTPS/WSS Audit

| Hạng mục | Hiện trạng | Rủi ro |
|---|---|---|
| Ép HTTPS production | Chưa thấy middleware redirect/block HTTP | HTTP trực tiếp có thể nhận token/cookie nếu endpoint public qua HTTP |
| `trust proxy` | Chưa thấy `app.set("trust proxy", 1)` | Khi sau Render/Nginx, Express không biết `req.secure`; khó enforce HTTPS/rate limit IP chuẩn |
| HSTS | Chưa có | Browser không được ép quay lại HTTPS |
| Socket WSS | Phụ thuộc `VITE_SOCKET_URL=https://...` | Sai env sang `http://` ở prod sẽ dùng WS/insecure |
| Cross-site cookie | Production set `SameSite=None; Secure` | Đúng hướng, nhưng cần HTTPS thật và clear cookie đồng nhất |

## E. Security Headers

### Helmet

- `backend/package.json` không có `helmet`.
- Không thấy `app.use(helmet(...))`.

### Header nên thêm

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` khi chắc chắn toàn bộ domain/subdomain dùng HTTPS.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY` hoặc `SAMEORIGIN`.
- `Referrer-Policy: no-referrer` hoặc `strict-origin-when-cross-origin`.
- `Permissions-Policy` hạn chế camera/microphone/geolocation, cân nhắc vì app có voice/video call.
- `Content-Security-Policy` nếu phù hợp.

### Rủi ro ảnh hưởng

- Swagger `/api-docs`: CSP quá chặt có thể làm Swagger UI lỗi vì inline script/style. Nên cấu hình CSP riêng hoặc nới `style-src/script-src` cho `/api-docs`.
- Socket.IO: CSP cần `connect-src` gồm backend HTTPS/WSS URL.
- Upload/image: CSP `img-src` cần cho Cloudinary domain và `data:` nếu app preview ảnh local/base64.
- Voice/video call: `Permissions-Policy` không được khóa `microphone` nếu call dùng getUserMedia; nên allow self.

## F. Redis/Mongo Transport Security

### MongoDB

- Code dùng `process.env.MONGODB_CONNECTIONSTRING`.
- `docker-compose.yml` chạy `mongo:7` và expose `"27017:27017"` ra host.
- `backend/.env.test` dùng local `mongodb://localhost:27017/chat-test`.
- Không đọc giá trị secret trong `backend/.env`, nên không kết luận chắc local hay cloud cho runtime hiện tại.
- Nếu dùng MongoDB Atlas/cloud, cần connection string `mongodb+srv://...` hoặc TLS enabled mặc định/explicit `tls=true`.

### Redis dự kiến

- Hiện chưa có Redis config/package/docker service.
- Nếu thêm Redis để lưu refresh session/rate-limit/presence:
  - Không expose public port.
  - Chạy private Docker network hoặc managed Redis private endpoint.
  - Bật password/ACL.
  - Dùng TLS nếu Redis đi qua network không tin cậy.
  - Hash refresh token trước khi lưu: key/value không chứa raw token.

### Redis session token

- Hiện Mongo `Session` lưu raw refresh token.
- Khi chuyển Redis, đề xuất key `session:refresh:{sha256(refreshToken)}`, value chỉ chứa `userId`, metadata và TTL.
- Revoke/logout bằng `DEL` hash key; ban/delete user xóa qua set phụ `user:{userId}:sessions`.

## G. Rủi Ro Hiện Tại

| Level | Vấn đề | Bằng chứng | Khuyến nghị |
|---|---|---|---|
| Critical | Không xác nhận token chỉ đi qua HTTPS ở app layer | Không có HTTPS enforce/HSTS/trust proxy; dev dùng HTTP | Enforce HTTPS production, HSTS, kiểm tra env production |
| High | Access token trả trong JSON và gửi bằng Authorization header | `buildAuthResponse` trả accessToken; axios gắn Bearer | Ưu tiên cookie-only access token hoặc giảm exposure; không log header |
| High | Refresh token không rotate | `refreshAccessToken` cấp access token mới nhưng giữ session cũ | Rotate refresh token mỗi lần refresh, phát hiện reuse |
| High | Cookie clear không đồng nhất options | `clearCookie("refreshToken")` không truyền sameSite/secure trong nhiều nhánh | Tạo helper set/clear cookie dùng chung options |
| High | Thiếu security headers/Helmet/HSTS | Không có helmet dependency/config | Thêm helmet có cấu hình CSP phù hợp |
| Medium | CORS chỉ single origin, không validate prod | `origin: process.env.CLIENT_URL` | Dùng whitelist theo env, fail-fast nếu thiếu/sai |
| Medium | Socket WSS phụ thuộc env | Client dùng `VITE_SOCKET_URL`; server không enforce | Validate production URL `https/wss`, test socket over WSS |
| Medium | Mongo Docker expose public host port | `ports: "27017:27017"` | Chỉ expose local/dev, production dùng private network |
| Medium | Redis chưa có security design | Chưa có Redis config | Private network/password/TLS trước khi lưu session |
| Medium | Thiếu auth rate limit | Không thấy rate limit middleware | Thêm Redis rate limit cho auth endpoints |
| Low | Pending verification token persisted localStorage | `auth-storage` lưu `pendingGoogleVerificationToken` | TTL ngắn, hoặc sessionStorage/memory nếu nhạy cảm |
| Low | UI preferences/local reports trong localStorage | chat prefs/reports/notifications | Không chứa auth token; vẫn cần tránh PII nhạy cảm |

## H. Kế Hoạch Triển Khai Theo Phase

### Phase 1

- Chuẩn hóa env production:
  - `NODE_ENV=production`
  - `CLIENT_URL=https://<frontend-domain>`
  - `VITE_API_URL=https://<backend-domain>/api`
  - `VITE_SOCKET_URL=https://<backend-domain>`
- Bật secure cookie bằng cookie helper chung.
- CORS strict whitelist cho FE production/staging/dev.
- Thêm `trust proxy` khi chạy sau Render/Nginx/Cloudflare.
- Thêm Helmet/HSTS.
- Validate Socket.IO production URL dùng HTTPS/WSS.

### Phase 2

- Làm sạch token transport:
  - Không persist token trong localStorage/sessionStorage.
  - Không truyền token qua query string.
  - Cân nhắc bỏ `accessToken` khỏi JSON response và dùng cookie-only auth nếu frontend không cần Bearer.
- Refresh token rotation và reuse detection.
- Chuẩn hóa logout/clear cookie bằng cùng `httpOnly/secure/sameSite/path/domain`.
- Rà soát logger để không log Authorization/cookie.

### Phase 3

- Redis transport security:
  - Redis private network.
  - Password/ACL.
  - TLS nếu Redis không cùng private network.
  - Không expose public port.
  - Hash refresh token trước khi lưu Redis.
- Session migration: dual-write/dual-read Mongo + Redis trước khi cutover.

### Phase 4

- Security regression tests:
  - FE/BE cross-domain cookies.
  - Socket.IO connect WSS.
  - Swagger `/api-docs` sau Helmet/CSP.
  - Upload/image preview/Cloudinary CSP.
  - k6 login/socket sau khi bật HTTPS/CORS/rate limit.

## I. Output Tổng Hợp

### Danh sách file đã đọc

- `backend/package.json`
- `backend/.env` key names only
- `backend/.env.test` key names only
- `backend/src/app/server.js`
- `backend/src/app/socket/initSocket.js`
- `backend/src/modules/auth/infrastructure/token.service.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/modules/auth/application/account-management.command-service.js`
- `backend/src/modules/identity/application/resolve-access-user-from-token.js`
- `backend/src/modules/identity/api/socket/socket-auth.middleware.js`
- `docker-compose.yml`
- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/vercel.json`
- `frontend/.env.development`
- `frontend/.env.production`
- `frontend/src/shared/api/axios.ts`
- `frontend/src/features/auth/stores/useAuthStore.ts`
- `frontend/src/features/auth/services/authService.ts`
- `frontend/src/shared/realtime/SocketClient.ts`
- `frontend/src/shared/realtime/useSocketStore.ts`
- `frontend/src/features/auth/components/ProtectedRoute.tsx`
- `frontend/src/features/auth/components/AdminProtectedRoute.tsx`
- `frontend/src/app/App.tsx`
- `tests/load/login-test.js`
- `tests/load/socket-processor.cjs`

### Bảng socket transport hiện tại

| Env | Client URL | Token transport | Transport setting | Kết quả dự kiến |
|---|---|---|---|---|
| Development | `http://localhost:5001/` | Socket.IO `auth: { token }` | `["websocket", "polling"]` | WS/HTTP |
| Production | `https://chat-real-back-end.onrender.com/` | Socket.IO `auth: { token }` | `["websocket", "polling"]` | WSS/HTTPS nếu env đúng |
| Load test | `BASE_URL` default `http://127.0.0.1:5001` | Socket.IO `auth: { token }` | websocket only | WS local only, guarded non-prod |

### Chỗ có thể leak token

- JSON response signin/verify/refresh chứa `accessToken`.
- Axios `Authorization` header chứa bearer access token.
- Socket.IO handshake auth payload chứa access token.
- MongoDB `Session.refreshToken` lưu raw refresh token.
- `auth-storage` localStorage không chứa access token nhưng chứa pending verification token/email.
- Logger hiện log URL/status/message; chưa thấy log headers, nhưng cần đảm bảo không log Authorization/cookie ở middleware/proxy.

### Checklist việc cần sửa

- [ ] Thêm cookie helper dùng chung set/clear options.
- [ ] Enforce HTTPS production và cấu hình `trust proxy`.
- [ ] Thêm Helmet với HSTS và CSP phù hợp Swagger/Socket/Cloudinary.
- [ ] CORS whitelist nhiều origin theo env.
- [ ] Validate fail-fast nếu production thiếu HTTPS URL.
- [ ] Quyết định cookie-only access token hoặc tiếp tục Bearer với threat model rõ.
- [ ] Refresh token rotation.
- [ ] Hash refresh token trong Mongo/Redis session store.
- [ ] Redis private/password/TLS plan trước khi triển khai.
- [ ] Không expose Mongo/Redis port public ở production.
- [ ] Auth rate limit bằng Redis.
- [ ] Security regression test cho CORS/cookie/WSS/Swagger.

### Rollback plan

- Nếu secure cookie làm frontend mất login:
  - Kiểm tra FE đang chạy HTTPS, BE `CLIENT_URL` đúng origin, cookie `SameSite=None; Secure`.
  - Tạm rollback cookie helper bằng env flag `COOKIE_SECURE_OVERRIDE=false` chỉ ở staging/dev, không dùng production lâu dài.
- Nếu CORS strict chặn frontend:
  - Log origin bị chặn.
  - Thêm origin vào whitelist env và redeploy.
  - Giữ danh sách staging/preview riêng, không bật `"*"`.
- Nếu Helmet/CSP làm Swagger hoặc Socket lỗi:
  - Tạm disable CSP bằng env flag hoặc route-specific CSP cho `/api-docs`.
  - Thêm `connect-src` backend/WSS và `img-src` Cloudinary.
- Nếu WSS lỗi sau proxy:
  - Kiểm tra Render/proxy websocket support.
  - Cho phép polling fallback tạm thời.
  - Rollback enforcement WSS trong client cho staging trong lúc sửa proxy.
