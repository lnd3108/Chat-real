# Trạng thái hiện tại

## Gọi thoại 1-1

Đã triển khai chức năng gọi thoại 1-1 cho direct conversation. WebRTC truyền âm thanh trực tiếp giữa hai client; Socket.IO chỉ dùng để điều phối trạng thái cuộc gọi và signaling. Không triển khai group call.

## File đã thay đổi

- `backend/src/models/CallSession.js`
- `backend/src/models/Message.js`
- `backend/src/modules/calls/domain/call.constants.js`
- `backend/src/modules/calls/application/call.service.js`
- `backend/src/modules/calls/api/socket/call.socket-handler.js`
- `backend/src/app/socket/initSocket.js`
- `backend/src/shared/domain/constants/socket-events.js`
- `backend/src/shared/infrastructure/realtime/user-presence.js`
- `frontend/src/features/chat/calls/call.constants.ts`
- `frontend/src/features/chat/calls/call.types.ts`
- `frontend/src/features/chat/calls/call.store.ts`
- `frontend/src/features/chat/calls/call.socket.ts`
- `frontend/src/features/chat/calls/webrtc.service.ts`
- `frontend/src/features/chat/calls/components/IncomingCallModal.tsx`
- `frontend/src/features/chat/calls/components/CallingModal.tsx`
- `frontend/src/features/chat/calls/components/ActiveCallPanel.tsx`
- `frontend/src/features/chat/calls/components/RemoteAudio.tsx`
- `frontend/src/features/chat/calls/components/CallLayer.tsx`
- `frontend/src/features/chat/components/ChatWindowHeader.tsx`
- `frontend/src/features/chat/pages/ChatAppPage.tsx`
- `frontend/src/shared/realtime/SocketLifecycleService.ts`
- `frontend/src/shared/realtime/useSocketStore.ts`
- `docs/03_CURRENT_STATUS.md`

## Module backend

- Module mới: `modules/calls`.
- Giữ state machine, active-call registry in-memory, timeout, cleanup khi disconnect, kiểm tra block, kiểm tra online, kiểm tra busy và WebRTC signaling relay bên trong module `calls`.
- Không truyền âm thanh qua backend.
- Không lưu SDP hoặc ICE candidate vào database.
- `CallSession` hỗ trợ: `ringing`, `accepted`, `rejected`, `missed`, `cancelled`, `ended`, `failed`.
- Call history được tạo bằng `system` message kèm `callMetadata`.

## UI frontend

- Thêm nút gọi thoại trong header của direct conversation.
- Không hiển thị chức năng group call.
- Nút gọi bị disable khi không có active conversation, conversation không phải direct, direct conversation bị block, hoặc client đang ở trong cuộc gọi khác.
- `IncomingCallModal`: hiển thị avatar/tên người gọi, nút “Chấp nhận”, nút “Từ chối”.
- `CallingModal`: hiển thị “Đang gọi...” và nút “Hủy”.
- `ActiveCallPanel`: hiển thị tên người đang gọi, thời lượng, mute/unmute và nút kết thúc.
- `RemoteAudio`: phát remote audio stream, không hiển thị UI phức tạp.

## Sự kiện Socket.IO

Client gửi lên server:

- `call:invite`
- `call:accept`
- `call:reject`
- `call:cancel`
- `call:end`
- `call:offer`
- `call:answer`
- `call:ice-candidate`

Server gửi xuống client:

- `call:incoming`
- `call:accepted`
- `call:rejected`
- `call:cancelled`
- `call:ended`
- `call:missed`
- `call:busy`
- `call:offer`
- `call:answer`
- `call:ice-candidate`
- `call:error`

## Payload chính

Payload lệnh gọi:

```json
{
  "conversationId": "conversationId",
  "receiverId": "receiverUserId",
  "callSessionId": "optionalForActiveCallCommands"
}
```

Payload phiên gọi:

```json
{
  "callSessionId": "callSessionId",
  "conversationId": "conversationId",
  "callerId": "callerUserId",
  "receiverId": "receiverUserId",
  "status": "ringing|accepted|rejected|missed|cancelled|ended|failed",
  "startedAt": "ISODate",
  "acceptedAt": "ISODate|null",
  "endedAt": "ISODate|null",
  "durationSeconds": 0,
  "endReason": "string|null"
}
```

Payload signaling:

```json
{
  "callSessionId": "callSessionId",
  "payload": "offer|answer|iceCandidate"
}
```

Metadata lịch sử cuộc gọi:

```json
{
  "callSessionId": "callSessionId",
  "callStatus": "rejected|missed|cancelled|ended|failed",
  "callDurationSeconds": 0,
  "callerId": "callerUserId",
  "receiverId": "receiverUserId"
}
```

## Luồng WebRTC

- Caller emit `call:invite` trước, chưa tạo offer ngay.
- Receiver emit `call:accept`.
- Caller nhận `call:accepted`, xin quyền microphone, tạo offer và emit `call:offer`.
- Receiver nhận `call:offer`, xin quyền microphone nếu cần, tạo answer và emit `call:answer`.
- Caller nhận `call:answer` và set remote description.
- Hai bên trao đổi ICE candidate qua Socket.IO.
- Khi cuộc gọi kết thúc, bị từ chối, bị hủy, bị missed, busy hoặc lỗi microphone, frontend cleanup peer connection, local tracks, remote stream, timer và call state.

## Trường hợp đã xác minh

- Backend syntax check cho call service/socket handler/init socket: đạt.
- Backend test suite hiện có: đạt.
- Frontend build: đạt.
- Lint scoped cho toàn bộ file voice call và các file tích hợp liên quan: đạt.
- Port hygiene: đã dừng dev server do Codex spawn ở port `5174` và xác nhận port sạch.
- Review text: toàn bộ user-facing text của voice call đã được chuẩn hóa sang tiếng Việt có dấu.

## Trường hợp chưa đạt hoặc mới xác minh một phần

- `npm run lint` toàn frontend vẫn fail do lint debt có sẵn ngoài phạm vi voice call trong admin/auth/chat/friend/notification/settings.
- Chưa thể xác nhận “hai bên nghe được audio” bằng kiểm thử thủ công hai browser trong phiên này.
- Chưa chạy đầy đủ manual checklist 2 tab cho reject, cancel, missed timeout, busy, reload tab, disconnect socket và microphone denied.

## Giới hạn đã biết

- MVP đang dùng STUN: `stun:stun.l.google.com:19302`.
- Production cần TURN server để hoạt động ổn định qua NAT/firewall khó.
- Active calls backend đang lưu in-memory, chưa phù hợp multi-instance nếu không có shared store.
- Call history đã có `callMetadata`, nhưng UI message item hiện vẫn render theo system message chung.

## Việc nên làm tiếp theo

- Tạo test harness hai socket client và manual QA script cho toàn bộ checklist gọi thoại.
- Bổ sung TURN configuration qua environment variable.
- Thêm rendering riêng cho call history message trong chat timeline.
