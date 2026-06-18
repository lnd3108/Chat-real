# Transport Security Phase 1 Report

Ngày triển khai: 2026-06-15

## Tóm tắt

Đã triển khai Phase 1 tập trung vào nền tảng transport security: cookie helper dùng chung, CORS whitelist cho Express/Socket.IO, HTTPS enforcement có rollback flag, production env validation, Helmet/security headers, và frontend production URL validation. Không đổi response auth hiện tại, không bỏ Bearer flow, không rotate refresh token, không làm Redis.

## File đã sửa/tạo

### Backend

- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/app/server.js`
- `backend/src/app/socket/initSocket.js`
- `backend/src/config/auth-cookies.js`
- `backend/src/config/cors.js`
- `backend/src/config/origin-config.js`
- `backend/src/middlewares/httpsMiddleware.js`
- `backend/src/middlewares/securityHeaders.js`
- `backend/src/modules/auth/infrastructure/token.service.js`
- `backend/src/modules/auth/application/session.command-service.js`
- `backend/src/modules/auth/api/http/auth.controller.js`
- `backend/src/modules/auth/application/account-management.command-service.js`
- `backend/src/modules/user-profile/api/http/user.controller.js`

### Frontend

- `frontend/src/shared/config/transportSecurity.ts`
- `frontend/src/shared/api/axios.ts`
- `frontend/src/shared/realtime/SocketClient.ts`

## Dependency mới

- Thêm `helmet@^8.2.0` cho backend.
- `npm install helmet` đã cập nhật `backend/package-lock.json`.
- `npm audit` sau install báo còn 14 vulnerabilities hiện hữu trong dependency tree; chưa xử lý trong Phase 1 vì ngoài phạm vi transport security.

## Env mới/cần dùng

| Env | Mục đích |
|---|---|
| `CLIENT_URL` | Một frontend origin được phép. |
| `CLIENT_URLS` | Danh sách frontend origins, phân tách bằng dấu phẩy. |
| `CORS_ALLOWED_ORIGINS` | Danh sách origin bổ sung cho CORS whitelist. |
| `FORCE_HTTPS` | Production HTTPS enforcement, mặc định bật; set `false` hoặc `0` để rollback. |
| `HTTPS_ENFORCEMENT_MODE` | Set `block` để trả 403 thay vì redirect 308. |

Production validation:

- `NODE_ENV=production` yêu cầu ít nhất một HTTPS origin từ `CLIENT_URL`, `CLIENT_URLS`, hoặc `CORS_ALLOWED_ORIGINS`.
- Nếu backend process có `VITE_API_URL`, giá trị phải là HTTPS.
- Nếu backend process có `VITE_SOCKET_URL`, giá trị phải là HTTPS hoặc WSS.
- Frontend production build cũng validate `VITE_API_URL=https://...` và `VITE_SOCKET_URL=https://...` hoặc `wss://...`.

## Cookie options trước/sau

| Cookie | Trước | Sau |
|---|---|---|
| `accessToken` set | inline options, no explicit `path` | `getAuthCookieOptions({ maxAge: 30m })`, `path: "/"` |
| `refreshToken` set | inline options, no explicit `path` | `getAuthCookieOptions({ maxAge: 14d })`, `path: "/"` |
| Production | `httpOnly: true`, `secure: true`, `sameSite: "none"` | Giữ nguyên, tập trung trong helper |
| Development/test | `httpOnly: true`, `secure: false`, `sameSite: "lax"` | Giữ nguyên, tập trung trong helper |
| Clear cookie | nhiều nơi thiếu options | clear dùng cùng `httpOnly/secure/sameSite/path` với set |

Helper mới:

- `getAuthCookieOptions()`
- `setAccessTokenCookie(res, token)`
- `setRefreshTokenCookie(res, token)`
- `clearAuthCookies(res)`
- Có thêm `clearAccessTokenCookie` và `clearRefreshTokenCookie` để dùng ở nhánh chỉ cần clear một cookie.

## CORS behavior trước/sau

| Surface | Trước | Sau |
|---|---|---|
| Express API | `origin: process.env.CLIENT_URL`, `credentials: true` | whitelist từ `CLIENT_URL`, `CLIENT_URLS`, `CORS_ALLOWED_ORIGINS`, `credentials: true` |
| Socket.IO | `origin: process.env.CLIENT_URL`, `credentials: true` | dùng cùng whitelist logic với Express |
| Wildcard | Không thấy dùng | Vẫn không dùng `*` với credentials |
| Dev | phụ thuộc `CLIENT_URL` | thêm default localhost origins cho Vite/dev |
| Blocked origin | có thể cấu hình đơn origin | không set ACAO; dev/test log origin bị chặn, không log token/cookie |

## HTTPS/WSS

- `NODE_ENV=production` bật `app.set("trust proxy", 1)`.
- Middleware `enforceHttps` kiểm tra `req.secure` và `x-forwarded-proto`.
- Nếu production request không HTTPS:
  - Mặc định redirect `308` sang HTTPS.
  - Nếu `HTTPS_ENFORCEMENT_MODE=block`, trả `403`.
- `FORCE_HTTPS=false` hoặc `0` tắt enforcement để rollback.
- Development/test/local k6 không bị enforce.
- Socket.IO vẫn giữ `auth.token`, không chuyển token sang query string, và vẫn giữ fallback `["websocket", "polling"]`.

## Security headers đã bật

Sử dụng `helmet`:

- `Strict-Transport-Security` bật ở production: `max-age=31536000; includeSubDomains`.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`.

CSP:

- `Content-Security-Policy` đang tắt trong Phase 1 để tránh làm vỡ Swagger `/api-docs`, Socket.IO connect, Cloudinary image/upload preview và voice/video call.
- Có thể thêm CSP ở Phase sau với route-specific config cho `/api-docs` và `connect-src`/`img-src` phù hợp.

Swagger:

- `/api-docs` được mount trước `maintenanceCheckMiddleware` để không bị truy vấn maintenance DB trước khi mở docs.

## Những gì chưa làm ở Phase 1

- Chưa bỏ `accessToken` khỏi JSON response.
- Chưa bỏ Authorization Bearer flow.
- Chưa rotate refresh token.
- Chưa hash refresh token trong Mongo/Redis.
- Chưa thêm Redis/rate limit.
- Chưa sửa `docker-compose.yml`; Mongo `27017:27017` chỉ nên dùng local dev, production phải dùng private network và không expose public.
- Chưa bật CSP.

## Rủi ro còn lại

| Level | Rủi ro |
|---|---|
| High | Access token vẫn đi trong JSON response và Bearer header. |
| High | Refresh token chưa rotate và hiện còn lưu raw trong Mongo `Session`. |
| Medium | CSP chưa bật. |
| Medium | Chưa có Redis/rate limit auth. |
| Medium | Docker Mongo expose host port nếu dùng nhầm cho production. |
| Low | Pending verification token vẫn được persist trong frontend `auth-storage`. |

## Test đã chạy

Backend tests:

```bash
cd backend
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --runInBand
```

Kết quả: 9 test suites passed, 44 tests passed.

Frontend build:

```bash
cd frontend
npm run build
```

Kết quả: build thành công. Có warning chunk size > 500 kB, không liên quan Phase 1.

Production-like smoke bằng `supertest`:

- HTTP request production không có `x-forwarded-proto=https` trả `308`.
- CORS origin hợp lệ trả `Access-Control-Allow-Origin` đúng origin và `Access-Control-Allow-Credentials: true`.
- CORS origin lạ không có `Access-Control-Allow-Origin`.
- `/api-docs` qua HTTPS trả `301` sang trailing slash bình thường.
- Có HSTS, `X-Frame-Options: DENY`, `Permissions-Policy`.

Cookie helper smoke:

- Development: `httpOnly=true`, `secure=false`, `sameSite=lax`, `path=/`.
- Production: `httpOnly=true`, `secure=true`, `sameSite=none`, `path=/`.
- Clear cookie dùng cùng options.

Security regression grep:

- Không thấy `accessToken`/`refreshToken` được ghi vào `localStorage` hoặc `sessionStorage`.
- Không thấy token qua query string.
- Không thấy log trực tiếp Authorization/Cookie; code vẫn đọc `req.headers.authorization` theo flow hiện tại.

## Test chưa chạy

- Chưa chạy k6 `tests/load/login-test.js` vì trong turn này chưa khởi động backend/Mongo/test user dataset. `k6` có sẵn trên máy.
- Chưa test login/refresh/logout/socket thủ công qua trình duyệt thật.

## Cách test thủ công

Development:

1. `cd backend && npm run dev`
2. `cd frontend && npm run dev`
3. Login bằng trình duyệt.
4. Kiểm tra cookies:
   - `accessToken`, `refreshToken`
   - `HttpOnly`
   - dev: `SameSite=Lax`, `Secure=false`
   - `Path=/`
5. Refresh trang để kiểm tra refresh token.
6. Logout và kiểm tra cookies bị xóa.
7. Mở `/api-docs`.
8. Mở app chat và xác nhận Socket.IO connect.

Production-like local:

1. Set:
   - `NODE_ENV=production`
   - `CLIENT_URL=https://client.example.com`
   - `FORCE_HTTPS=true`
2. Gửi request HTTP không có `x-forwarded-proto=https`, kỳ vọng `308` hoặc `403` nếu `HTTPS_ENFORCEMENT_MODE=block`.
3. Gửi preflight với origin hợp lệ, kỳ vọng ACAO đúng origin.
4. Gửi preflight với origin lạ, kỳ vọng không có ACAO.

k6:

```bash
cd .
$env:LOAD_TEST="true"
$env:NODE_ENV="development"
k6 run tests/load/login-test.js
```

Socket load test:

```bash
cd tests/load
npm install -D artillery socket.io-client
$env:LOAD_TEST="true"
$env:NODE_ENV="development"
npx artillery run socket-test.yml
```

## Rollback plan

- Nếu secure cookie làm frontend mất login:
  - Kiểm tra FE chạy HTTPS, BE `CLIENT_URL` đúng origin.
  - Tạm set `FORCE_HTTPS=false` nếu lỗi do proxy HTTPS.
  - Nếu cần rollback cookie behavior, revert usage của `auth-cookies.js` trong auth service/controller.
- Nếu CORS strict chặn frontend:
  - Thêm origin vào `CLIENT_URLS` hoặc `CORS_ALLOWED_ORIGINS`.
  - Không dùng wildcard `*` khi `credentials=true`.
- Nếu Helmet làm lỗi Swagger/Socket:
  - CSP hiện đang tắt, nên rủi ro thấp.
  - Có thể tạm remove `securityHeaders()` trong `app/server.js` nếu cần khẩn cấp.
- Nếu WSS lỗi sau proxy:
  - Kiểm tra `VITE_SOCKET_URL`.
  - Giữ polling fallback hiện có.
  - Set `FORCE_HTTPS=false` tạm thời nếu lỗi do proxy header trong khi cấu hình lại reverse proxy.
