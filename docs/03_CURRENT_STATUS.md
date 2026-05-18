# Trạng thái hiện tại

## Gọi thoại và video call 1-1

Đã triển khai chức năng gọi thoại và video call 1-1 cho direct conversation. WebRTC truyền âm thanh/video trực tiếp giữa hai client; Socket.IO chỉ dùng để điều phối trạng thái cuộc gọi và signaling. Không triển khai group call.

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
- `frontend/src/features/chat/calls/components/RemoteVideo.tsx`
- `frontend/src/features/chat/calls/components/LocalVideoPreview.tsx`
- `frontend/src/features/chat/calls/components/VideoCallPanel.tsx`
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
- `CallSession` đã có `callType` với giá trị `voice` hoặc `video`; mặc định là `voice` để không phá dữ liệu cũ.
- Call history được tạo bằng `system` message kèm `callMetadata`.
- Backend dùng chung các event `call:*` cho cả voice call và video call; không tạo event riêng kiểu `video:*`.

## UI frontend

- Thêm nút gọi thoại trong header của direct conversation.
- Thêm nút gọi video trong header của direct conversation.
- Không hiển thị chức năng group call.
- Nút gọi bị disable khi không có active conversation, conversation không phải direct, direct conversation bị block, hoặc client đang ở trong cuộc gọi khác.
- `IncomingCallModal`: hiển thị avatar/tên người gọi, nút “Chấp nhận”, nút “Từ chối”.
- `IncomingCallModal` phân biệt “Cuộc gọi thoại đến” và “Cuộc gọi video đến”.
- `CallingModal`: hiển thị “Đang gọi thoại...” hoặc “Đang gọi video...” và nút “Hủy”.
- `ActiveCallPanel`: hiển thị tên người đang gọi, thời lượng, mute/unmute và nút kết thúc.
- `RemoteAudio`: phát remote audio stream, không hiển thị UI phức tạp.
- `VideoCallPanel`: hiển thị remote video lớn, local video nhỏ, thời lượng, bật/tắt mic, bật/tắt camera và kết thúc cuộc gọi.
- `RemoteVideo`: phát remote video stream.
- `LocalVideoPreview`: hiển thị local camera stream và luôn muted để tránh echo.

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
  "callType": "voice|video",
  "callSessionId": "optionalForActiveCallCommands"
}
```

`callType` là optional; nếu client không gửi thì backend fallback về `voice`. Nếu client gửi giá trị khác `voice` hoặc `video`, backend trả `call:error` với code `CALL_INVALID_TYPE`.

Payload phiên gọi:

```json
{
  "callSessionId": "callSessionId",
  "conversationId": "conversationId",
  "callerId": "callerUserId",
  "receiverId": "receiverUserId",
  "callType": "voice|video",
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
  "callType": "voice|video",
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

## Luồng WebRTC video

- Caller emit `call:invite` với `callType = video`, chưa tạo offer ngay.
- Receiver thấy modal “Cuộc gọi video đến”.
- Receiver emit `call:accept`.
- Caller nhận `call:accepted`, xin quyền camera/micro, tạo offer video và emit `call:offer`.
- Receiver nhận `call:offer`, xin quyền camera/micro, tạo answer video và emit `call:answer`.
- Hai bên trao đổi ICE candidate qua Socket.IO như voice call.
- Remote stream gắn vào `RemoteVideo`; local stream gắn vào `LocalVideoPreview`.
- Bật/tắt camera chỉ thay đổi `videoTrack.enabled`, không kết thúc cuộc gọi.
- Khi kết thúc cuộc gọi, frontend stop toàn bộ local tracks để tắt thật camera và micro.

## Trường hợp đã xác minh

- Backend syntax check cho call service/socket handler/init socket: đạt.
- Backend test suite: đạt, 9 suites / 32 tests.
- Đã thêm test service cho `callType = video`, `CALL_INVALID_TYPE` và `call:accepted` giữ đúng `callType`.
- Đã kiểm tra import runtime của Calls Module sau khi thêm `callType`: đạt.
- Voice call cũ vẫn dùng `callType = voice` mặc định khi client không gửi `callType`.
- Video call invite nhận `callType = video`, trả lại `callType` trong `call:incoming`, `call:accepted` và các payload phiên gọi.
- Call history metadata đã có `callType`.
- User-facing call history phân biệt “Cuộc gọi thoại” và “Cuộc gọi video” bằng tiếng Việt có dấu.
- Frontend build: đạt.
- Frontend build sau khi thêm video call: đạt.
- Lint scoped cho toàn bộ file voice call và các file tích hợp liên quan: đạt.
- Lint scoped cho toàn bộ file call/video và các file tích hợp liên quan: đạt.
- Review hardening video call: đạt với các điểm đã kiểm tra bằng code review.
- Voice call regression bằng code review: vẫn dùng `{ audio: true, video: false }`, không yêu cầu camera, không đổi event và không đổi flow offer sau `call:accepted`.
- Video call bằng code review: dùng `{ audio: true, video: true }`, caller không tạo offer trước khi receiver accept, local video muted, tắt camera chỉ đổi `videoTrack.enabled`, cleanup stop toàn bộ local tracks.
- Socket cleanup: `CallSocketHandler.unregister()` đã `socket.off` đầy đủ cho toàn bộ event `call:*`.
- Backend validation: direct-only, member validation, block, offline, busy, signaling forbidden và invalid `callType` vẫn nằm trong Calls Module.
- Backend không truyền audio/video, không lưu SDP/candidate và không log SDP/candidate dài.
- Frontend hardening: các lỗi invite như `CALL_INVALID_TYPE`, `CALL_FORBIDDEN`, `CALL_NOT_DIRECT_CONVERSATION`, offline, busy, block, invalid state sẽ cleanup call state để tránh stuck modal.
- Port hygiene: đã dừng dev server do Codex spawn ở port `5174` và xác nhận port sạch.
- Port hygiene sau video call review: đã dừng dev server ở port `5173`; không còn server project listen trên `5173`, `5174`, `3000`, `5000`. Port `8080` thuộc `AgentService`, không phải server dự án do Codex spawn.
- Review text: toàn bộ user-facing text của voice call đã được chuẩn hóa sang tiếng Việt có dấu.
- Review text video call: không còn text kiểu “Dang goi video”, “Cuoc goi video”, “Khong the truy cap camera” trong flow call/video.

## Trường hợp chưa đạt hoặc mới xác minh một phần

- `npm run lint` toàn frontend vẫn fail do lint debt có sẵn ngoài phạm vi voice call trong admin/auth/chat/friend/notification/settings.
- Chưa thể xác nhận “hai bên nghe được audio” bằng kiểm thử thủ công hai browser trong phiên này.
- Chưa thể xác nhận “hai bên thấy được video” bằng kiểm thử thủ công hai browser trong phiên này.
- Chưa thể xác nhận local video, remote video, nghe audio, toggle camera và toggle mic bằng kiểm thử thủ công hai browser trong phiên này.
- Chưa thể xác nhận browser camera indicator tắt sau khi end call bằng kiểm thử thủ công trên trình duyệt thật.
- Chưa thể xác nhận video call rejected/cancelled/missed/offline/busy/reload/disconnect/camera denied/microphone denied bằng kiểm thử thủ công hai browser trong phiên này.
- Chưa thể xác nhận call history video ended/missed/rejected/cancelled hiển thị trong chat timeline bằng UI thật; backend metadata và content đã được code/test review.
- Chưa thể xác nhận chat regression runtime bằng UI thật: send/receive message, unreadCounts, seenBy, online-users, group chat và direct chat.
- Chưa chạy đầy đủ manual checklist 2 tab cho reject, cancel, missed timeout, busy, reload tab, disconnect socket và microphone denied.

## Giới hạn đã biết

- MVP đang dùng STUN: `stun:stun.l.google.com:19302`.
- Production cần TURN server để hoạt động ổn định qua NAT/firewall khó.
- Video call dùng bandwidth cao hơn voice call; cần theo dõi chất lượng mạng, bitrate và UX khi mạng yếu.
- Nếu sau này làm group call, không nên dùng mesh quá lớn; nên nghiên cứu SFU như LiveKit, mediasoup hoặc Janus.
- Active calls backend đang lưu in-memory, chưa phù hợp multi-instance nếu không có shared store.
- Call history đã có `callMetadata`, nhưng UI message item hiện vẫn render theo system message chung.
- Frontend đã hỗ trợ media constraints/UI video preview cho video call, nhưng vẫn cần manual QA trên browser thật để xác nhận camera/audio qua NAT thực tế.

## Việc nên làm tiếp theo

- Tạo test harness hai socket client và manual QA script cho toàn bộ checklist gọi thoại.
- Tạo manual QA script cho video call hai browser: accept, reject, cancel, missed, busy, reload, disconnect, camera denied, microphone denied.
- Bổ sung TURN configuration qua environment variable.
- Thêm rendering riêng cho call history message trong chat timeline.

## Nhạc chuông cuộc gọi dùng chung

Đã thêm cơ chế phát nhạc chuông dùng chung cho voice call 1-1 hiện tại và video call 1-1 sau này.

### File âm thanh public đang dùng

- File gốc vẫn được giữ nguyên: `frontend/public/Nhoi Nhoi Donate - Độ Mixigaming_[cut_17sec].mp3`.
- File path an toàn đã được copy thêm: `frontend/public/sounds/call-ringtone.mp3`.
- Frontend sử dụng public URL: `/sounds/call-ringtone.mp3`.

### File đã thay đổi

- `frontend/public/sounds/call-ringtone.mp3`
- `frontend/src/features/chat/calls/call-ringtone.service.ts`
- `frontend/src/features/chat/calls/call.socket.ts`
- `frontend/src/features/chat/calls/call.store.ts`
- `frontend/src/features/chat/calls/components/CallLayer.tsx`
- `docs/03_CURRENT_STATUS.md`

### Service đã tạo

- `call-ringtone.service.ts` quản lý một `HTMLAudioElement` singleton, tránh tạo audio mới trong từng component.
- Hàm hỗ trợ:
  - `playIncomingRingtone()`
  - `playOutgoingRingtone()`
  - `stopRingtone()`
  - `setVolume(volume)`
  - `isRingtonePlaying()`
- Volume mặc định là `0.7`.
- Ringtone có `loop = true` khi đang ringing.
- Service tôn trọng setting âm thanh chung hiện có qua `enableAll` và `soundEnabled`.
- Lỗi autoplay của trình duyệt được bắt an toàn và log cảnh báo ngắn bằng tiếng Việt có dấu.

### Flow đã tích hợp

- Khi nhận `call:incoming`: phát nhạc chuông cuộc gọi đến.
- Khi nhận `call:accepted`, `call:rejected`, `call:cancelled`, `call:ended`, `call:missed`, `call:busy`, `call:error`: dừng nhạc chuông.
- Khi user bấm chấp nhận, từ chối, hủy hoặc kết thúc cuộc gọi: dừng nhạc chuông ngay.
- Khi `CallLayer` unmount hoặc socket unregister/reconnect: dừng nhạc chuông.
- `playOutgoingRingtone()` đã có sẵn để dùng chung sau này, nhưng hiện chưa tự phát cho caller để tránh dùng cùng file nhạc chuông như âm chờ.

### Kết quả kiểm tra

- Đã kiểm tra bằng code review rằng voice call và video call dùng chung service nhạc chuông, không tạo `new Audio()` trong UI component.
- Đã kiểm tra các terminal event đều gọi `stopRingtone()`.
- Đã kiểm tra service không phát chồng nhiều audio khi nhận duplicate ringing event vì dùng singleton và bỏ qua nếu audio đang phát.
- `npm run build` trong `frontend`: đạt.
- `npx eslint src/features/chat/calls src/features/chat/pages/ChatAppPage.tsx src/features/chat/components/ChatWindowHeader.tsx` trong `frontend`: đạt.
- `npm run lint` toàn frontend: chưa đạt do lint debt có sẵn ngoài phạm vi call/ringtone trong `admin`, `auth`, `ChatSocketHandler`, `FriendSocketHandler`, `notification`, `settings`.
- `git diff --check`: đạt, chỉ có cảnh báo line ending CRLF khi Git chạm file.

### Giới hạn đã biết

- Trình duyệt có thể chặn autoplay nếu user chưa từng tương tác với trang. Khi đó app không crash và service log cảnh báo: “Không thể phát nhạc chuông do trình duyệt chặn tự động phát âm thanh.”
