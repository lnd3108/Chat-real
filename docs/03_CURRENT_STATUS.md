# Trạng thái hiện tại

## Review và hardening group voice call

Đã review backend/frontend liên quan đến group voice call sau khi backend Calls Module và frontend WebRTC mesh đã được implement. Phạm vi giữ đúng MVP: chỉ group voice call, không group video call, không SFU, không truyền audio qua backend.

### Files changed

- `backend/src/modules/calls/application/call.service.js`
- `backend/src/shared/domain/constants/socket-events.js`
- `backend/src/tests/calls/call.service.test.js`
- `frontend/src/features/chat/calls/group/group-call.constants.ts`
- `frontend/src/features/chat/calls/group/group-call.socket.ts`
- `frontend/src/features/chat/calls/group/group-call.store.ts`
- `frontend/src/features/chat/calls/group/group-webrtc-mesh.service.ts`
- `frontend/src/features/chat/components/sidebar/app-sidebar.tsx`
- `docs/03_CURRENT_STATUS.md`

### Verified cases

- Backend group call vẫn nằm trong Calls Module, không đưa audio/SDP/ICE candidate vào chat/message/socket core.
- `CallSession` hỗ trợ `callMode = group`, `callType = voice`, participant statuses, `hostId`, `initiatorId`, `acceptedAt`, `endedAt` và duration MM:SS cho call history.
- `group-call:start` validate group conversation, membership, busy state, active group call và reject group video call.
- `group-call:join` validate membership, live call state, participant limit `MAX_GROUP_CALL_PARTICIPANTS = 4` và busy state.
- `group-call:leave` và disconnect cleanup participant state, active user map, peer signaling permission và scheduled group end.
- Stale/ghost group call có 0 live participant được cleanup trước khi tạo call mới.
- Signaling group chỉ relay giữa participant đã `joined`; target chưa joined hoặc user ngoài call bị chặn.
- Frontend group call dùng `getUserMedia({ audio: true, video: false })`, mỗi remote user chỉ có một `RTCPeerConnection`, queue ICE candidate theo `fromUserId`, không render local stream thành remote audio.
- Frontend đã hardening để `handleJoinedState` idempotent và không tạo nhiều offer cho cùng peer khi socket event và ack đến trùng.
- Cleanup frontend dừng ringtone, clear interval, stop local tracks, close peer connection, xóa remote stream/audio element khi leave/end/error/unregister.
- Direct call socket/store vẫn dùng event `call:*`; group call dùng event `group-call:*`, không đổi event direct cũ.

### Failed/partial cases

- Chưa chạy manual E2E 3 tài khoản/3 browser thật để xác nhận nghe audio A/B/C, mic tắt thật qua browser UI, reload tab trong call và NAT/firewall thực tế.
- `npm run lint` toàn frontend chưa đạt do lint debt có sẵn ngoài phạm vi group call (`no-explicit-any`, hook deps, purity, unused vars trong admin/auth/chat/friend/notification). `npm run build` frontend đạt.
- Không start dev server trong phiên này vì verification cần thiết đã chạy bằng test/build; không có server process nào được spawn cần stop.

### Known limitations

- Active call registry vẫn là in-memory map, chưa phù hợp chạy nhiều backend instance nếu không có shared store.
- WebRTC mesh chỉ phù hợp nhóm nhỏ 3-4 người; số peer connection tăng theo `n * (n - 1) / 2`.
- MVP cần TURN server để ổn định hơn qua NAT/firewall khó.
- Khi scale production nên nghiên cứu SFU như LiveKit, mediasoup hoặc Janus.
- Group video call không nên làm bằng mesh nếu muốn scale tốt.

### Next recommended task

- Chạy manual QA E2E với 3 browser/account thật cho start/join/leave/decline/missed/busy/reload, đồng thời kiểm tra direct voice/video call và message realtime trong cùng phiên.

## Fix ghost/stale group voice call

Đã sửa lỗi group voice call bị kẹt trạng thái khi conversation hiển thị 0 người đang gọi nhưng backend vẫn chặn tạo cuộc gọi mới.

### Files changed

- `backend/src/modules/calls/application/call.service.js`
- `backend/src/shared/domain/constants/socket-events.js`
- `backend/src/tests/calls/call.service.test.js`
- `frontend/src/features/chat/calls/group/group-call.constants.ts`
- `frontend/src/features/chat/calls/group/group-call.socket.ts`
- `frontend/src/features/chat/calls/group/group-call.store.ts`
- `frontend/src/features/chat/components/sidebar/app-sidebar.tsx`
- `docs/03_CURRENT_STATUS.md`

### Verified cases

- Backend start group call không còn chỉ tin `activeGroupCallsByConversationId` hoặc status `ringing/active`.
- Nếu live group call có `participants` rỗng, hoặc không còn participant `joined/ringing`, backend coi là stale call, set `status = ended`, set `endedAt`, cleanup active maps/timers và emit `group-call-cleaned`.
- Nếu call còn participant live thật, backend vẫn chặn tạo call mới với message `Nhóm đang có cuộc gọi thoại.`
- Frontend nghe `group-call-cleaned` và cleanup `activeGroupCall`, participants, modal/panel, ringtone, peer connections và local tracks.
- Toast lỗi group call dùng toast id theo error code để giảm duplicate toast `Nhóm đang có cuộc gọi thoại.`
- Sidebar header không còn đặt Radix `Switch` bên trong `SidebarMenuButton` render ra `<button>`; chuyển row đó sang `<div>` đúng DOM.

### Test results

- `npm test -- src/tests/calls/call.service.test.js`: đạt, 12 tests.
- `npm test` trong `backend`: đạt, 9 suites / 41 tests.
- Scoped ESLint frontend cho group call/sidebar/integration files: đạt.
- `npm run build` trong `frontend`: đạt.
- `git diff --check`: đạt, chỉ có warning line ending LF -> CRLF.

### Failed/partial cases

- Chưa kiểm thử thủ công bằng DB thật cho case A start/end rồi gọi lại, reload tab khi đang gọi, B decline khi không còn participant, và console browser hết warning button-in-button.
- Không tìm thấy field `conversation.activeCallId` trong schema hiện tại; cleanup có guard nếu field này tồn tại nhưng không thêm field mới ngoài phạm vi fix.

### Known limitations

- Active group call state vẫn là in-memory, chưa phù hợp multi-instance nếu không có shared store.
- MVP WebRTC mesh chỉ phù hợp nhóm nhỏ 3-4 người; production cần TURN và nên nghiên cứu SFU nếu mở rộng.

### Next recommended task

- Chạy manual QA 2-3 browser với MongoDB thật để xác nhận DB `CallSession.status = ended`, không còn ghost busy sau reload/decline, và console không còn DOM nesting warning.

## Group voice call trong group conversation

Đã triển khai backend MVP cho gọi thoại nhóm trong group conversation bằng WebRTC mesh. Backend chỉ dùng Socket.IO để signaling và quản lý trạng thái; không truyền audio, không lưu SDP/ICE candidate, không triển khai group video call và không dùng SFU ở MVP.

## Frontend group voice call trong group conversation

Đã triển khai frontend MVP cho gọi thoại nhóm trong group conversation. UI chỉ hỗ trợ audio, dùng WebRTC mesh ở client và Socket.IO chỉ để signaling; không truyền audio qua backend và không thêm group video call.

### Files changed

- `frontend/src/features/chat/calls/group/group-call.types.ts`
- `frontend/src/features/chat/calls/group/group-call.constants.ts`
- `frontend/src/features/chat/calls/group/group-call.store.ts`
- `frontend/src/features/chat/calls/group/group-call.socket.ts`
- `frontend/src/features/chat/calls/group/group-webrtc-mesh.service.ts`
- `frontend/src/features/chat/calls/group/components/GroupIncomingCallModal.tsx`
- `frontend/src/features/chat/calls/group/components/GroupCallPanel.tsx`
- `frontend/src/features/chat/calls/group/components/GroupCallParticipantItem.tsx`
- `frontend/src/features/chat/calls/group/components/GroupCallAudioRenderer.tsx`
- `frontend/src/features/chat/calls/components/CallLayer.tsx`
- `frontend/src/features/chat/calls/call.socket.ts`
- `frontend/src/features/chat/calls/call-format.ts`
- `frontend/src/features/chat/components/ChatWindowHeader.tsx`
- `frontend/src/features/chat/components/MessageItem.tsx`
- `frontend/src/shared/realtime/SocketLifecycleService.ts`
- `frontend/src/shared/realtime/useSocketStore.ts`
- `frontend/src/shared/types/chat.ts`
- `docs/03_CURRENT_STATUS.md`

### Group call UI

- Group conversation header có nút gọi thoại nhóm, chỉ hiển thị trong group conversation.
- Nếu có incoming group call cùng group, nút header chuyển ngữ cảnh thành `Tham gia cuộc gọi`.
- `GroupIncomingCallModal` hiển thị:
  - `Cuộc gọi thoại nhóm đến`
  - `{Tên người gọi} đang bắt đầu cuộc gọi trong nhóm {Tên nhóm}`
  - `Tham gia`
  - `Từ chối`
- `GroupCallPanel` hiển thị tên nhóm, thời lượng MM:SS, số người đang tham gia, danh sách participant joined, avatar, trạng thái mic của bản thân, nút bật/tắt mic, rời cuộc gọi và nút kết thúc toàn call cho host.
- `GroupCallAudioRenderer` render audio element ẩn cho từng remote stream; không phát lại local stream để tránh echo.

### WebRTC mesh flow

- `group-webrtc-mesh.service.ts` quản lý `Map<userId, RTCPeerConnection>`, local audio stream, remote streams, queued ICE candidates và cleanup peer.
- `initLocalAudio()` dùng `getUserMedia({ audio: true, video: false })`.
- Mỗi remote participant có một `RTCPeerConnection` riêng, dùng STUN `stun:stun.l.google.com:19302`.
- Rule chống glare MVP: người mới join tạo offer tới các participant đã `joined` trước đó; participant có sẵn không tạo offer ngược.
- `group-call:offer`, `group-call:answer`, `group-call:ice-candidate` chỉ relay theo `targetUserId`.
- ICE candidate đến trước peer/remoteDescription được queue theo `fromUserId` rồi flush sau khi set remote description.

### Cleanup strategy

- `leaveGroupCall()` emit `group-call:leave`, cleanup toàn bộ peer, stop local audio tracks, clear streams, clear timer và reset state.
- `group-call:ended` dừng ringtone, cleanup all peers và đóng panel.
- `group-call:participant-left` cleanup peer connection và remote stream của participant đó.
- Socket unregister/disconnect cleanup group call state để không giữ micro chạy nền.
- Direct incoming call sẽ bị reject nếu frontend đang có active/incoming group call; group incoming call cũng decline nếu đang có direct call.
- Ringtone dùng service chung: phát khi `group-call:incoming`, dừng khi join/decline/ended/busy/error.

### Test results

- `npm run build` trong `frontend`: đạt.
- Scoped ESLint cho các file group call và integration vừa chỉnh: đạt.
- `npm run lint` toàn frontend: chưa đạt do lint debt có sẵn ngoài phạm vi group call (`no-explicit-any`, hook deps, purity, unused vars trong admin/auth/chat/friend/notification).
- Chưa chạy manual QA 3 tài khoản/browser thật cho A start, B/C join, A/B/C nghe nhau, B leave, C leave auto-end, host end/leave, mic toggle, ringtone và duplicate event.

### Limitation

- MVP dùng WebRTC mesh, chỉ phù hợp nhóm nhỏ 3-4 người joined.
- Production với nhóm lớn nên dùng SFU như LiveKit, mediasoup hoặc Janus.
- Frontend hiện chưa có cơ chế discover active group call sau khi user mở group muộn nếu client không nhận `group-call:incoming` trước đó; cần API/socket state discovery riêng nếu muốn hỗ trợ đầy đủ case này.

### Files changed

- `backend/src/models/CallSession.js`
- `backend/src/models/Message.js`
- `backend/src/modules/calls/domain/call.constants.js`
- `backend/src/modules/calls/application/call.service.js`
- `backend/src/modules/calls/api/socket/call.socket-handler.js`
- `backend/src/shared/domain/constants/socket-events.js`
- `backend/src/tests/calls/call.service.test.js`
- `docs/03_CURRENT_STATUS.md`

### Architecture

- Group call nằm trong `modules/calls`, không tạo module rời.
- `CallSession` hỗ trợ `callMode = direct|group`, `initiatorId`, `hostId`, `participants[]`, `status = ringing|active|ended|failed` cho group flow, đồng thời giữ nguyên direct call status cũ như `accepted/rejected/missed/cancelled`.
- Active state in-memory:
  - `activeGroupCallsByConversationId`: chặn một group có nhiều call đồng thời.
  - `activeCallsByUser`: chặn user tham gia nhiều call cùng lúc, dùng chung direct/group.
  - Timer riêng theo participant để mark `missed` sau `GROUP_CALL_INVITE_TIMEOUT_MS = 40_000`.
- `MAX_GROUP_CALL_PARTICIPANTS = 4` cho MVP mesh.
- Khi group call ended, backend tạo một system message trong group chat với `callMetadata`: `callSessionId`, `callType`, `callMode`, `durationSeconds`, `participantCount`, `initiatorId`.
- User-facing text tiếng Việt có dấu: `Cuộc gọi thoại nhóm đã kết thúc (MM:SS)`, `Cuộc gọi thoại nhóm đã hủy`, `Cuộc gọi thoại nhóm nhỡ`.

### Socket events mới

Client -> Server: `group-call:start`, `group-call:join`, `group-call:decline`, `group-call:leave`, `group-call:end`, `group-call:offer`, `group-call:answer`, `group-call:ice-candidate`, `group-call:sync-state`.

Server -> Client: `group-call:incoming`, `group-call:started`, `group-call:participant-joined`, `group-call:participant-left`, `group-call:participant-declined`, `group-call:participant-missed`, `group-call:ended`, `group-call:offer`, `group-call:answer`, `group-call:ice-candidate`, `group-call:state`, `group-call:busy`, `group-call:error`.

### Payload chính

`group-call:start`:

```json
{
  "conversationId": "conversationId",
  "callType": "voice"
}
```

`group-call:incoming`:

```json
{
  "callId": "callSessionId",
  "conversationId": "conversationId",
  "groupName": "Tên nhóm",
  "caller": {
    "_id": "userId",
    "displayName": "Tên người gọi",
    "userName": "username",
    "avatarUrl": null
  },
  "callType": "voice",
  "callMode": "group"
}
```

`group-call:join`, `group-call:decline`, `group-call:leave`, `group-call:end`, `group-call:sync-state`:

```json
{
  "callId": "callSessionId"
}
```

Signaling dùng `callId`, `targetUserId` và một trong các field `offer`, `answer`, `candidate`.

### Validation rules

- Chỉ cho `callType = voice`; `video` trả `GROUP_CALL_VIDEO_NOT_SUPPORTED`.
- Chỉ cho conversation `type = group`; direct/support trả `GROUP_CALL_NOT_GROUP_CONVERSATION`.
- Caller/joiner/decliner/sender signaling phải thuộc group conversation.
- Một user chỉ được ở một call tại một thời điểm; vi phạm trả `GROUP_CALL_USER_BUSY`.
- Một group chỉ có một active group call; vi phạm trả `GROUP_CALL_ALREADY_ACTIVE`.
- Join bị chặn khi call không tồn tại, không phải group voice, đã ended, user ngoài group, hoặc vượt `MAX_GROUP_CALL_PARTICIPANTS`.
- Signaling chỉ relay giữa các participant đang `joined`; user ngoài call hoặc target chưa joined trả `GROUP_CALL_SIGNALING_FORBIDDEN`.
- `group-call:end` toàn cuộc gọi chỉ cho host; participant khác dùng `group-call:leave`.
- Disconnect khi user đang joined group call sẽ mark participant `left`, cleanup `activeCallsByUser`, notify `participant-left`, và end call sau grace nếu còn dưới 2 người joined.

### Test results

- `npm test -- src/tests/calls/call.service.test.js`: đạt, 9 tests.
- Đã test service cho start group voice call, chặn group video call, join chuyển status `active` khi có 2 joined, signaling relay đúng target, user ngoài group bị chặn, và regression direct call cũ.
- Chưa chạy manual QA nhiều socket client trong browser thật cho toàn bộ checklist start/join/decline/leave/host leave/disconnect/missed timeout/busy/signaling.

### Limitation

- MVP dùng WebRTC mesh, giới hạn 4 participant joined để tránh tải P2P quá cao.
- Production với nhóm lớn nên dùng SFU như LiveKit, mediasoup hoặc Janus.
- Active call registry đang in-memory, chưa phù hợp multi-instance nếu không có shared store.

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

## Hardening UI video call 1-1

Đã rà soát và sửa layout video call 1-1 để khung chính luôn là remote stream, khung preview luôn là local stream, đồng thời giảm tình trạng crop quá mạnh làm mất mặt người dùng.

### File đã thay đổi

- `frontend/src/features/chat/calls/components/VideoCallPanel.tsx`
- `frontend/src/features/chat/calls/components/RemoteVideo.tsx`
- `frontend/src/features/chat/calls/components/LocalVideoPreview.tsx`
- `frontend/src/features/chat/calls/webrtc.service.ts`
- `docs/03_CURRENT_STATUS.md`

### Nguyên nhân lỗi UI

- `RemoteVideo` trước đó dùng `object-cover` cho video chính nên dễ crop quá mạnh, làm người dùng bị cắt mặt hoặc chỉ thấy một phần khung hình.
- Preview và main video đã bind đúng stream, nhưng UI chưa có fallback rõ khi remote video track chưa sẵn sàng nên dễ gây nhầm lẫn.
- Video element chưa cleanup `srcObject = null` trong effect cleanup.

### Cách fix layout

- Khung chính vẫn nhận `remoteStream` và đã đổi sang `object-contain` trên nền đen để ưu tiên không cắt mặt người dùng.
- Khung preview vẫn nhận `localStream`, luôn `muted`, `playsInline`, `autoPlay` và mirror bằng CSS `scaleX(-1)`.
- Remote video không mirror và có `muted={false}`.
- Thêm fallback tiếng Việt có dấu: “Đang kết nối video...” khi remote stream chưa có video track.
- Local preview nằm góc phải trên, có `aspect-video`, kích thước responsive, border và z-index cao hơn main video.
- Control bar nằm bottom center, có tooltip/title và `sr-only` tiếng Việt có dấu: “Bật mic”, “Tắt mic”, “Bật camera”, “Tắt camera”, “Kết thúc”.
- Video elements cleanup `srcObject = null` khi stream đổi hoặc component unmount.
- Thêm log dev-only ngắn gọn trong `RemoteVideo`, `LocalVideoPreview` và `webrtc.service.ts` để kiểm tra số lượng audio/video track, trạng thái local video track và remote video track received. Không log SDP/candidate.

### Kết quả kiểm tra

- `npm run build` trong `frontend`: đạt.
- `npx eslint src/features/chat/calls` trong `frontend`: đạt.
- `npm run lint` toàn frontend: chưa đạt do lint debt có sẵn ngoài phạm vi video call UI trong `admin`, `auth`, `ChatSocketHandler`, `FriendSocketHandler`, `notification`, `settings`.

### Trường hợp chưa xác minh thủ công

- Chưa test end-to-end bằng hai browser hoặc hai account trong phiên này.
- Chưa xác nhận bằng mắt rằng bên A thấy camera của B ở khung lớn và camera của A ở preview, và ngược lại.
- Chưa xác nhận thủ công các case tắt camera, tắt mic, reload, end call, từ chối quyền camera và remote video qua NAT thực tế.

### Giới hạn còn lại

- `object-contain` tránh crop mặt nhưng có thể tạo viền đen nếu tỷ lệ camera không khớp container. Đây là lựa chọn có chủ đích để ưu tiên không cắt nội dung video chính.
- Production vẫn cần TURN server để video call ổn định qua NAT/firewall khó.

## Chuẩn hóa scrollbar và responsive chat sidebar

Đã chuẩn hóa scrollbar dùng chung theo light/dark theme và sửa layout sidebar chat để header, content scroll và footer không chen/lệch nhau trên desktop/mobile.

### Files changed

- `frontend/src/index.css`
- `frontend/src/shared/ui/sidebar.tsx`
- `frontend/src/shared/ui/dropdown-menu.tsx`
- `frontend/src/features/chat/pages/ChatAppPage.tsx`
- `frontend/src/features/chat/components/sidebar/app-sidebar.tsx`
- `frontend/src/features/chat/components/ChatWindowLayout.tsx`
- `frontend/src/features/chat/components/ChatWindowBody.tsx`
- `frontend/src/features/chat/components/DirrectMessageList.tsx`
- `frontend/src/features/chat/components/GroupChatList.tsx`
- `frontend/src/features/chat/components/AddFriendModal.tsx`
- `frontend/src/features/chat/components/FriendManagementDialog.tsx`
- `frontend/src/features/chat/components/DirectInfoDialog.tsx`
- `frontend/src/features/chat/components/GroupInfoDialog.tsx`
- `frontend/src/features/chat/components/GroupMemberManagerDialog.tsx`
- `frontend/src/features/chat/components/createNewChat/FriendListModal.tsx`
- `frontend/src/features/chat/components/newGroupChat/InviteSuggestionList.tsx`
- `frontend/src/features/admin/components/AdminLayout.tsx`
- `frontend/src/features/admin/components/AdminSidebar.tsx`
- `frontend/src/features/admin/components/AdminNotificationCenterDialog.tsx`
- `frontend/src/features/admin/pages/AdminConversations.tsx`
- `frontend/src/features/admin/pages/AdminSupportDetail.tsx`
- `frontend/src/features/notification/components/NotificationCenterDialog.tsx`
- `frontend/src/features/settings/components/profile/ProfileDialog.tsx`
- `frontend/src/features/settings/components/profile/BlockReportDialog.tsx`
- `frontend/src/features/settings/components/profile/BlockTab.tsx`
- `frontend/src/features/settings/components/profile/SuggestUserInput.tsx`
- `docs/03_CURRENT_STATUS.md`

### Scrollbar utility đã tạo

- Thêm CSS variables: `--app-scrollbar-track`, `--app-scrollbar-thumb`, `--app-scrollbar-thumb-hover`.
- Light theme dùng thumb xám nhẹ, hover rõ hơn vừa phải, track transparent.
- Dark theme dùng thumb xám sáng alpha thấp, hover sáng hơn nhẹ, track transparent.
- Thêm utilities: `app-scrollbar`, `app-scrollbar-thin`, `app-scrollbar-hidden`.
- Giữ alias cũ `beautiful-scrollbar`, `beautiful-scroll-bar`, `beautifull-scrollbar` trỏ về style mới để tránh scrollbar trắng nếu còn usage cũ.

### Khu vực đã áp dụng

- Chat sidebar content và message list.
- Modal/panel: profile/settings, notification center, add friend, friend management, direct info, group info, group member manager, create group friend list, invite suggestion list.
- Admin shell: main content, admin sidebar, notification dialog, conversation detail dialog, support message list.
- Shared dropdown menu content.

### Sidebar responsive đã sửa

- Chat page root chuyển sang `h-dvh`, `min-h-0`, `overflow-hidden`; main chat có `min-w-0`, `flex-1`, `overflow-hidden`.
- Shared sidebar width desktop dùng `clamp(18.75rem, 24vw, 23.75rem)` và mobile dùng `min(86vw, 22.5rem)`.
- Sidebar root/header/footer/content có flex shrink/min-height rõ ràng; content là vùng scroll duy nhất với `app-scrollbar-thin`.
- Header ChatRealTime dùng truncate, controls có `flex-shrink-0`, wrap khi thiếu chỗ, không còn ép tất cả vào một hàng `h-12`.
- Direct/group conversation lists bỏ scroll lồng nhau để không tạo double scrollbar và không đè footer.
- Message list giữ nguyên `scrollableDiv`, `InfiniteScroll inverse` và ref auto-scroll, chỉ đổi scrollbar class và thêm `min-h-0/flex-1`.

### Test results

- `npm run build` trong `frontend`: đạt.
- `npm run lint` toàn frontend: chưa đạt do lint debt có sẵn ngoài phạm vi thay đổi (`no-explicit-any`, hook deps, purity, unused vars).
- Scoped eslint trên các file đã sửa: không có error; còn 3 warning hook deps có sẵn trong `AdminConversations.tsx`, `AdminSupportDetail.tsx`, `NotificationCenterDialog.tsx`, và `index.css` bị eslint ignore.

### Remaining risks

- Chưa chạy manual UI trên trình duyệt thật cho toàn bộ checklist dark/light, drawer mobile, send/receive realtime, unreadCounts, seenBy và online-users.
- Full lint vẫn cần xử lý lint debt cũ nếu muốn pipeline `npm run lint` xanh toàn bộ.

## Redesign Hồ sơ và cài đặt thành Settings Center

Đã redesign modal "Hồ sơ và cài đặt" theo hướng Settings Center có sidebar bên trong, giảm khoảng trống thừa và hạn chế modal con chồng nhau cho các tác vụ bảo mật/thông báo.

### Files changed

- `frontend/src/features/settings/components/profile/ProfileDialog.tsx`
- `frontend/src/features/settings/components/profile/PersonalInForm.tsx`
- `frontend/src/features/settings/components/profile/ChangePasswordDialog.tsx`
- `frontend/src/features/settings/components/profile/BlockReportDialog.tsx`
- `frontend/src/features/settings/components/profile/BlockTab.tsx`
- `frontend/src/features/settings/components/profile/SuggestUserInput.tsx`
- `frontend/src/features/settings/components/profile/VerifyNewEmailSection.tsx`
- `frontend/src/features/settings/components/profile/DeleteAccountDialog.tsx`
- `frontend/src/features/notification/components/NotificationSettingsDialog.tsx`
- `docs/03_CURRENT_STATUS.md`

### Redesign summary

- Modal chính dùng kích thước `min(1120px, calc(100vw - 48px))`, `max-height: 86dvh`, header cố định và body `overflow-hidden`.
- Body chuyển sang layout desktop 2 cột: sidebar settings bên trái và content panel scroll riêng bên phải bằng `app-scrollbar-thin`.
- Sidebar có mini profile card gồm avatar, display name, username, email và trạng thái online/offline.
- Menu settings gồm: Tài khoản, Giao diện, Thông báo, Âm thanh, Quyền riêng tư, Bảo mật, Khu vực nguy hiểm.
- Mobile/tablet dùng menu ngang có scroll nhẹ, content full width, không tạo scrollbar ngang toàn modal.
- Bỏ profile banner gradient lớn trong modal chính, thay bằng mini profile card gọn.
- Đổi mật khẩu và Chặn/Báo cáo render inline trong content panel; modal con vẫn được giữ để các nơi khác có thể dùng lại.
- Xóa tài khoản vẫn dùng confirm dialog riêng vì đây là flow nguy hiểm cần xác nhận nhiều bước.

### Các mục settings mới

- Tài khoản: form thông tin cá nhân trong card gọn, grid 2 cột trên màn rộng, nút lưu cuối form.
- Giao diện: setting rows cho Chế độ tối và Hiển thị trạng thái hoạt động.
- Thông báo: thêm category/sidebar nhỏ gồm Tổng quan, Tin nhắn, Cuộc gọi, Kết bạn, Báo cáo / Hỗ trợ, Hệ thống.
- Âm thanh: tách riêng mục âm thanh chung và hiển thị các dòng Âm thanh khi gõ, Âm thanh click, Âm thanh thông báo, Nhạc chuông cuộc gọi theo cài đặt chung.
- Quyền riêng tư: giữ setting hiện có cho Hiển thị trạng thái hoạt động.
- Bảo mật: action rows cho Đổi mật khẩu và Chặn/Báo cáo; form đổi mật khẩu render ngay trong panel.
- Khu vực nguy hiểm: card riêng cho Xóa tài khoản với nút danger gọn.

### Test results

- `npm run build` trong `frontend`: đạt.
- `npm run lint` toàn frontend: chưa đạt do lint debt có sẵn ngoài phạm vi thay đổi (`no-explicit-any`, hook deps, purity, unused vars trong admin/auth/chat/friend/notification realtime).
- Scoped eslint trên các file settings/notification đã sửa: đạt, không có error/warning.

### Remaining risks

- Chưa chạy manual UI trên trình duyệt thật cho mở/đóng modal, chuyển menu, responsive desktop/tablet/mobile, dark/light theme.
- Chưa kiểm thử thủ công các flow chỉnh sửa tài khoản, đổi mật khẩu, chặn/báo cáo, lưu thông báo/âm thanh và xóa tài khoản bằng tài khoản thật trong phiên này.

## Polish modal Hồ sơ và cài đặt với gradient glass

Đã nâng cấp visual modal "Hồ sơ và cài đặt" theo hướng modern gradient glass settings center, giữ nguyên layout sidebar trái + content phải và không đổi business logic.

### Files changed

- `frontend/src/features/settings/components/profile/ProfileDialog.tsx`
- `frontend/src/features/settings/components/profile/PersonalInForm.tsx`
- `frontend/src/features/notification/components/NotificationSettingsDialog.tsx`
- `docs/03_CURRENT_STATUS.md`

### Visual redesign summary

- Modal shell dùng background gradient theo theme, có radial highlight ở góc trên trái/phải và linear gradient nền tổng.
- Sidebar được làm mềm hơn bằng nền bán trong suốt, border sáng nhẹ, blur và menu item bo góc lớn hơn.
- Profile hero card trong sidebar chuyển sang card gradient nổi bật, avatar lớn hơn, text trắng đủ contrast và trạng thái online/offline dạng badge kính.
- Active menu item có nền sáng nhẹ, border/ring primary và icon well riêng; inactive item sạch hơn nhưng vẫn đọc rõ.
- Content header có eyebrow nhỏ, title rõ và mô tả section, đặt trong panel kính nhẹ để giảm cảm giác phẳng.
- Content card/panel dùng nền trắng mờ ở light theme và lớp kính tối nhẹ ở dark theme, border/shadow mềm hơn.
- Form tài khoản có input/textarea radius lớn hơn, nền tinted, border nhẹ, focus ring theo primary và textarea gọn hơn.
- CTA lưu profile và lưu notification dùng gradient primary cyan/purple/pink theo yêu cầu, không áp dụng gradient tràn lan cho input/card.
- Notification panel nhúng trong modal được polish đồng bộ: category tabs, setting rows và reset/save buttons mềm hơn.
- Scroll vẫn dùng `app-scrollbar-thin`; content chính là vùng scroll dọc, menu mobile/tablet scroll ngang riêng.

### Gradient strategy

- Gradient chỉ dùng ở modal shell, profile hero card và primary CTA button.
- Dark shell: radial violet/indigo + pink highlight trên nền slate/indigo đậm.
- Light shell: radial indigo/pink tint nhẹ trên nền off-white xanh/tím rất nhạt.
- Card, row và input không dùng gradient, chỉ dùng tint + glass + border/shadow để giữ readability.
- Không thay đổi palette/design token toàn cục; các gradient bổ sung nằm scoped trong component.

### Test results

- `npm run build` trong `frontend`: đạt.
- `npx eslint src/features/settings/components/profile/ProfileDialog.tsx src/features/settings/components/profile/PersonalInForm.tsx src/features/notification/components/NotificationSettingsDialog.tsx` trong `frontend`: đạt.
- `npm run lint` toàn frontend: chưa đạt do lint debt có sẵn ngoài phạm vi thay đổi (`no-explicit-any`, hook deps, purity, unused vars trong admin/auth/chat/friend/notification realtime).
- Dev server đã chạy tại `http://127.0.0.1:5174` vì port `5173` đang được dùng.
- Responsive desktop/tablet/mobile và dark/light đã được kiểm tra bằng code review trên class layout/theme; chưa có browser automation hoặc manual visual QA trong phiên này.

### Remaining risks

- Cần manual QA trên trình duyệt thật cho dark/light theme, desktop/tablet/mobile, close button, sidebar stacked/horizontal scroll và không có scrollbar ngang.
- Cần kiểm tra bằng mắt các trạng thái dài text/email/username để đảm bảo truncate và spacing ổn trên dữ liệu thật.
- Full lint vẫn cần xử lý lint debt cũ nếu muốn pipeline `npm run lint` xanh toàn bộ.

## Fix scroll modal Hồ sơ và cài đặt

Đã sửa lỗi modal "Hồ sơ và cài đặt" bị cắt phần cuối form và làm mất nút chức năng trong màn hình thấp.

### Files changed

- `frontend/src/features/settings/components/profile/ProfileDialog.tsx`
- `frontend/src/features/settings/components/profile/PersonalInForm.tsx`
- `frontend/src/features/notification/components/NotificationSettingsDialog.tsx`
- `docs/03_CURRENT_STATUS.md`

### Nguyên nhân lỗi scroll

- Modal shell dùng grid với `max-height` và `overflow-hidden`, nhưng body/sidebar/content chưa được khóa đầy đủ bằng `flex-1`, `min-height: 0` ở mọi breakpoint.
- Trên viewport thấp, content phải không co đúng vào chiều cao còn lại sau header/sidebar nên phần cuối form nằm ngoài vùng scroll thực tế.
- Nút cuối form nằm trong flow bình thường của card, không có sticky footer nên dễ bị cắt bởi lớp `overflow-hidden` phía trên.
- Sidebar mobile/tablet không có giới hạn chiều cao riêng, có thể ăn mất không gian của content scroll.

### Cách fix

- Đổi `DialogContent` sang `flex flex-col`, giữ `max-h-[90dvh]` và `overflow-hidden`; desktop giữ `lg:max-h-[88dvh]`.
- Header modal thêm `shrink-0` để không scroll theo content.
- Body modal đổi thành `flex min-h-0 flex-1 flex-col overflow-hidden`, desktop dùng `lg:grid lg:grid-cols-[292px_minmax(0,1fr)]`.
- Sidebar thêm `app-scrollbar-thin`, `shrink-0`, `overflow-y-auto`, `overflow-x-hidden`; mobile/tablet giới hạn `max-h-[34dvh]`, desktop bỏ giới hạn bằng `lg:max-h-none lg:min-h-0`.
- Content phải thêm `min-w-0`, `min-h-0`, `flex-1`, `overflow-y-auto`, `overflow-x-hidden`, `app-scrollbar-thin` và padding bottom lớn hơn.
- Footer form tài khoản đổi thành `position: sticky; bottom: 0` với nền kính theo theme, border top và backdrop blur để nút "Lưu thay đổi" luôn nằm trong vùng scroll.
- Footer lưu notification cũng được sticky nhẹ để không mất nút reset/lưu khi category dài.
- Không đổi logic update profile, notification, theme, sound, privacy, security hoặc delete account.

### Test results

- `npm run build` trong `frontend`: đạt.
- `npx eslint src/features/settings/components/profile/ProfileDialog.tsx src/features/settings/components/profile/PersonalInForm.tsx src/features/notification/components/NotificationSettingsDialog.tsx` trong `frontend`: đạt.
- `npm run lint` toàn frontend: chưa đạt do lint debt có sẵn ngoài phạm vi thay đổi (`no-explicit-any`, hook deps, purity, unused vars trong admin/auth/chat/friend/notification realtime).
- Kiểm tra bằng code review các mục Tài khoản, Giao diện, Thông báo, Âm thanh, Quyền riêng tư, Bảo mật, Khu vực nguy hiểm: mỗi mục nằm trong content panel scroll riêng, không tạo scrollbar ngang chủ ý và không để action cuối nằm ngoài modal.

### Remaining risks

- Chưa chạy manual visual QA trên browser thật ở laptop 1366x768 cho cả dark/light theme trong phiên này.
- Cần xác nhận bằng mắt rằng footer sticky không che nội dung cuối khi dữ liệu thật làm form dài hơn, đặc biệt ở mode xác minh email.

## Fix action footer form Tài khoản

Đã sửa lỗi nút "Lưu thay đổi" trong tab Tài khoản của modal "Hồ sơ và cài đặt" bị lệch và chen vào vùng input/textarea.

### Files changed

- `frontend/src/features/settings/components/profile/PersonalInForm.tsx`
- `docs/03_CURRENT_STATUS.md`

### Nguyên nhân lỗi button lệch

- Footer action của form tài khoản đang dùng `position: sticky` ngay bên trong `CardContent`.
- Khi content panel của modal là scroll container riêng, sticky footer bên trong card có thể bám theo viewport của panel và xuất hiện giữa form thay vì nằm sau textarea.
- `-mx-6`, nền sticky và z-index làm nút có cảm giác đè lên textarea "Giới thiệu" trên màn hình thấp.

### Cách fix

- Bỏ sticky footer trong `PersonalInForm`.
- Đưa action footer về flow bình thường sau textarea, Verify OTP section và message success/error.
- Gom 4 field ngắn và textarea vào cùng grid: desktop 2 cột, mobile 1 cột.
- Textarea "Giới thiệu" dùng `md:col-span-2` để full width.
- Action footer dùng `flex`, `justify-end`, `gap`, `border-top` nhẹ và không absolute/sticky.
- Thêm nút "Hủy" dạng outline để reset form về dữ liệu người dùng hiện tại thông qua `initialize(userInfo)`, không gọi backend và không đổi flow save profile.
- Nút "Lưu thay đổi" giữ gradient primary hiện tại và nằm cuối card.

### Test results

- `npm run build` trong `frontend`: đạt.
- `npx eslint src/features/settings/components/profile/PersonalInForm.tsx src/features/settings/components/profile/ProfileDialog.tsx` trong `frontend`: đạt.
- `npm run lint` toàn frontend: chưa đạt do lint debt có sẵn ngoài phạm vi thay đổi (`no-explicit-any`, hook deps, purity, unused vars trong admin/auth/chat/friend/notification realtime).
- Kiểm tra bằng code review tab Tài khoản: thứ tự DOM là field ngắn, textarea Giới thiệu full width, Verify section/message nếu có, action footer Hủy/Lưu cuối card.

### Remaining risks

- Chưa chạy manual browser QA ở 1366x768 cho cả dark/light theme trong phiên này.
- Cần kiểm tra trực tiếp thao tác nhập tên, email, giới thiệu và scroll đến cuối modal bằng dữ liệu thật.

## Fix avatar gợi ý Chặn và báo cáo

Đã sửa danh sách gợi ý username trong mục "Chặn và báo cáo" của modal "Hồ sơ và cài đặt" để hiển thị ảnh đại diện thật nếu user có `avatarUrl`.

### Files changed

- `frontend/src/features/friend/services/friendService.ts`
- `frontend/src/features/settings/components/profile/BlockReportDialog.tsx`
- `frontend/src/features/settings/components/profile/SuggestUserInput.tsx`
- `docs/03_CURRENT_STATUS.md`

### Nguyên nhân avatar không hiển thị

- Dữ liệu gợi ý trong "Chặn và báo cáo" lấy từ friend store qua API `/friends`.
- Backend `getAllFriendsQuery` đã populate trường `avatarUrl` với projection `_id displayName avatarUrl userName`, không trả dữ liệu nhạy cảm.
- Frontend `SuggestUserInput` vẫn tự render avatar fallback bằng chữ cái đầu, không dùng `friend.avatarUrl` và không reuse avatar component chung.
- API client chưa normalize các alias avatar khác như `avatar`, `profilePicture`, `photoURL`, nên nếu response khác tên field thì suggestion vẫn mất ảnh.

### Cách fix backend/frontend

- Backend: đã kiểm tra `backend/src/modules/friendship/application/friendship.service.js`; endpoint `/friends` đã trả `_id`, `displayName`, `userName`, `avatarUrl`. Không cần đổi backend/schema.
- Frontend service: normalize friend list trong `friendService.getFriendList()` để map avatar về `avatarUrl` từ `avatarUrl || avatar || profilePicture || photoURL`.
- Frontend panel: `BlockReportDialog.normalizeFriend()` cũng nhận thêm alias avatar khi dữ liệu friend có nested `userId` hoặc `friendId`.
- Frontend UI: `SuggestUserInput` dùng lại `UserAvatar` với `avatarUrl={friend.avatarUrl}`; nếu ảnh lỗi hoặc không có ảnh, `AvatarFallback` của component chung tự fallback chữ cái.
- Selected state của suggestion item đổi sang `bg-primary/10`, `border-primary/30`, text foreground để dịu hơn và dễ đọc hơn dark/light theme.
- Logic search local, click chọn username, block và report không đổi.

### Test results

- `npm run build` trong `frontend`: đạt.
- `npx eslint src/features/friend/services/friendService.ts src/features/settings/components/profile/SuggestUserInput.tsx src/features/settings/components/profile/BlockReportDialog.tsx src/features/settings/components/profile/BlockTab.tsx src/features/settings/components/profile/ReportTab.tsx` trong `frontend`: đạt.
- `npm run lint` toàn frontend: chưa đạt do lint debt có sẵn ngoài phạm vi thay đổi (`no-explicit-any`, hook deps, purity, unused vars trong admin/auth/chat/friend/notification realtime).
- Kiểm tra bằng code review: suggestion item hiển thị avatar thật qua `UserAvatar`, fallback chữ cái khi không có ảnh hoặc ảnh lỗi, click chọn vẫn gọi `setValue(friend.userName)`.
- API `/friends` không trả `email`, `hashedPassword`, token hoặc field nhạy cảm trong projection gợi ý này.

### Remaining risks

- Chưa chạy manual browser QA với tài khoản thật có avatar/không avatar trong phiên này.
- Cần kiểm tra trực tiếp hai tab Chặn/Báo cáo ở dark/light theme để xác nhận ảnh remote load thành công trong môi trường runtime.

## Fix duration voice/video call 1-1

Đã sửa cách tính và hiển thị thời lượng cuộc gọi 1-1 để chỉ tính từ thời điểm receiver accept, không tính từ lúc ringing.

### Files changed

- `backend/src/modules/calls/application/call.service.js`
- `backend/src/tests/calls/call.service.test.js`
- `frontend/src/features/chat/calls/call-format.ts`
- `frontend/src/features/chat/calls/call.store.ts`
- `frontend/src/features/chat/calls/call.socket.ts`
- `frontend/src/features/chat/calls/call.types.ts`
- `frontend/src/features/chat/calls/components/ActiveCallPanel.tsx`
- `frontend/src/features/chat/calls/components/VideoCallPanel.tsx`
- `frontend/src/features/chat/components/MessageItem.tsx`
- `frontend/src/shared/types/chat.ts`
- `docs/03_CURRENT_STATUS.md`

### Nguyên nhân lỗi duration

- Backend đã có `acceptedAt`, nhưng text lịch sử cuộc gọi vẫn format duration theo giây thô như `(18s)`.
- Frontend timer live chỉ bắt đầu khi WebRTC chuyển sang `ACTIVE`; mốc này có thể lệch so với thời điểm call được accept.
- Message system render trực tiếp `message.content`, nên nếu content có dạng cũ `(18s)` thì UI vẫn hiện dạng cũ dù metadata có duration.

### Cách fix acceptedAt/endedAt

- Backend giữ mốc duration chuẩn: `durationSeconds = floor((endedAt - acceptedAt) / 1000)` chỉ khi status là `ended`.
- Backend ép duration của `rejected`, `cancelled`, `missed`, `failed` về `0`.
- Backend call history content dùng formatter MM:SS, ví dụ `Cuộc gọi thoại đã kết thúc (01:05)`.
- Frontend thêm `startAcceptedCallTimer(call)` trong call store.
- Caller bắt đầu timer khi nhận `call:accepted`; receiver bắt đầu timer khi ack của `call:accept` trả payload.
- Timer dùng `acceptedAt` từ backend nếu có, fallback `Date.now()`; mỗi lần start đều clear interval cũ trước để tránh nhiều interval song song.
- Các terminal path hiện có vẫn gọi `clearCall()`, trong đó clear interval và cleanup WebRTC/ringtone.

### Format duration mới MM:SS

- Thêm helper `formatCallDuration(seconds)`:
  - `0` -> `00:00`
  - `4` -> `00:04`
  - `18` -> `00:18`
  - `65` -> `01:05`
  - `125` -> `02:05`
- `ActiveCallPanel` và `VideoCallPanel` dùng helper chung.
- `MessageItem` ưu tiên render call history từ `callMetadata` bằng `getCallHistoryLabel()`, nên ended dùng `MM:SS`, còn rejected/cancelled/missed không hiển thị duration.

### Test results

- Backend `npm test -- --runInBand src/tests/calls/call.service.test.js`: đạt, 5 tests.
- Đã thêm test duration từ `acceptedAt`: accepted at `00:00:10`, ended at `00:01:15` -> `durationSeconds = 65`.
- Đã thêm test rejected call luôn `durationSeconds = 0`.
- Frontend scoped ESLint cho call store/socket/format/panels/message type: đạt.
- Frontend `npm run build`: đạt.
- Frontend `npm run lint` toàn repo: chưa đạt do lint debt có sẵn ngoài phạm vi thay đổi (`no-explicit-any`, hook deps, purity, unused vars trong admin/auth/chat/friend/notification realtime).
- Backend không có script lint/build riêng trong `backend/package.json`.

### Remaining risks

- Chưa chạy manual QA hai browser cho voice/video call trong phiên này.
- Cần kiểm tra trực tiếp các case accept sau 10 giây ringing, end ở 4/18/65 giây, reject, cancel, missed và disconnect/reload trên browser thật.

## Polish Admin Dashboard scrollbar và chart

Đã cải thiện phần scrollbar và biểu đồ trong Admin Dashboard theo hướng mềm hơn, dễ đọc hơn và không còn phụ thuộc vào native horizontal scrollbar trong chart.

### Files changed

- `frontend/src/features/admin/components/AdminLayout.tsx`
- `frontend/src/features/admin/pages/AdminDashboard.tsx`
- `docs/03_CURRENT_STATUS.md`

### Lỗi UI ban đầu

- Admin main content chưa khóa `overflow-x`, nên chart/card rộng có thể làm page xuất hiện scrollbar ngang.
- Stacked bar chart dùng `overflow-x-auto`, khi xem 30 ngày dễ hiện thanh scrollbar ngang mặc định màu trắng, đặc biệt xấu ở dark theme.
- Trục ngày render toàn bộ label, làm các label ngày bị chồng khi chọn range 30 ngày.
- Chart card và vùng chart hơi phẳng/cứng, spacing chưa tách lớp rõ giữa card, header và chart body.
- Tooltip của chart chưa được polish theo dark/light theme.

### Cách fix scrollbar

- Giữ `app-scrollbar` cho admin main content và thêm `min-w-0`, `overflow-x-hidden` để tránh horizontal scrollbar toàn page.
- Loại bỏ native horizontal scroll trong stacked bar chart; chart chuyển sang CSS grid responsive với `minmax(0, 1fr)` để fit đủ 7/30 ngày trong container.
- Không thêm scrollbar custom mới vì project đã có utility `app-scrollbar`/`app-scrollbar-thin` dùng chung theo theme.

### Cách fix chart tick/tooltip/responsive

- Thêm `formatShortDate()` để label ngày hiển thị dạng ngắn `dd/mm`.
- Thêm `shouldShowChartTick()` để giữ đủ data nhưng chỉ giảm số label trục X; range 7 ngày hiển thị đầy đủ, range 30 ngày còn khoảng 6-8 mốc chính.
- Line chart được polish bằng grid line mờ hơn, stroke rõ hơn, dot/active dot nổi bật hơn và chart height ổn định `280px`.
- Stacked bar chart bỏ scroll ngang, dùng bar radius nhẹ, gap responsive, label tổng chỉ hiện khi đủ chỗ và legend Direct/Group/Support gọn hơn.
- Tooltip custom cho cả hai chart dùng `bg-popover`, border/shadow/backdrop blur theo theme; tooltip line chart hiển thị ngày và số người dùng mới, tooltip message chart hiển thị Direct, Group, Support và tổng số tin.
- Chart card dùng background khác page một tầng, border subtle, shadow nhẹ, chart body có padding/card nội bộ và empty state cao ổn định.
- Title chart đổi sang tiếng Việt có dấu: `Người dùng mới theo ngày`, `Tin nhắn theo ngày`.

### Test results

- `npx eslint src/features/admin/pages/AdminDashboard.tsx src/features/admin/components/AdminLayout.tsx` trong `frontend`: đạt.
- `npm run build` trong `frontend`: đạt.
- `npm run lint` toàn frontend: chưa đạt do lint debt có sẵn ngoài phạm vi thay đổi (`no-explicit-any`, hook deps, purity, unused vars trong admin/auth/chat/friend/notification realtime).
- Chưa chạy manual browser QA dark/light theme, filter 7/30 ngày và responsive desktop/tablet/mobile trong phiên này; đã kiểm tra bằng code review rằng chart không còn dùng native horizontal scrollbar và tick label 30 ngày được giảm số lượng.

### Remaining risks

- Cần kiểm tra trực tiếp dashboard với dữ liệu thật ở dark/light theme để tinh chỉnh cảm giác spacing, tooltip hover và mật độ bar khi dữ liệu 30 ngày có giá trị rất lớn hoặc rất lệch.

## Chuẩn hóa gradient system toàn app

Đã gom gradient/surface chính về token global để auth, chat, profile/settings modal và admin dashboard dùng cùng một visual language ở cả dark theme và light theme.

### Files changed

- `frontend/src/index.css`
- `frontend/src/features/auth/pages/SignInPage.tsx`
- `frontend/src/features/auth/pages/SignUpPasge.tsx`
- `frontend/src/features/auth/pages/ForgotPasswordPage.tsx`
- `frontend/src/features/auth/components/signin-form.tsx`
- `frontend/src/features/auth/components/signup-form.tsx`
- `frontend/src/features/auth/components/ProtectedRoute.tsx`
- `frontend/src/features/auth/components/AdminProtectedRoute.tsx`
- `frontend/src/features/chat/pages/ChatAppPage.tsx`
- `frontend/src/features/chat/components/ChatWindowLayout.tsx`
- `frontend/src/features/chat/components/ChatWelcomeScreen.tsx`
- `frontend/src/features/chat/components/MessageInput.tsx`
- `frontend/src/features/chat/components/sidebar/app-sidebar.tsx`
- `frontend/src/features/settings/components/profile/ProfileDialog.tsx`
- `frontend/src/features/settings/components/profile/PersonalInForm.tsx`
- `frontend/src/features/settings/components/profile/VerifyNewEmailSection.tsx`
- `frontend/src/features/settings/components/profile/ChangePasswordDialog.tsx`
- `frontend/src/features/settings/components/profile/ReportTab.tsx`
- `frontend/src/features/notification/components/NotificationSettingsDialog.tsx`
- `frontend/src/features/admin/components/AdminLayout.tsx`
- `frontend/src/features/admin/components/AdminSidebar.tsx`
- `frontend/src/features/admin/components/AdminTopbar.tsx`
- `frontend/src/features/admin/pages/AdminDashboard.tsx`
- `docs/03_CURRENT_STATUS.md`

### Gradient tokens đã tạo

- `--app-shell-bg`: nền shell lớn dùng radial highlight cyan/purple/pink nhẹ + linear gradient tổng; light theme không còn trắng bệch, dark theme không còn đen phẳng.
- `--app-surface-bg`: nền glass/tinted surface theo theme.
- `--app-surface-border`: border subtle cho surface/card theo theme.
- `--app-hero-gradient`: gradient hero/profile/brand panel.
- `--app-primary-gradient`: gradient CTA primary.
- `--app-surface-shadow`: shadow mềm dùng chung cho glass surface.

### Class dùng chung

- `.app-shell-bg`
- `.app-surface`
- `.app-glass-card`
- `.app-hero-gradient`
- `.app-primary-gradient`

Các class legacy `bg-gradient-primary`, `bg-gradient-chat`, `bg-gradient-purple` được map về token mới để giảm lệch visual ở các component cũ chưa thay hết.

### Các màn đã áp dụng

- Login/register/forgot password: shell dùng `app-shell-bg`, auth card dùng `app-glass-card`, illustration panel dùng `app-surface` + highlight `app-hero-gradient`, CTA chính dùng `app-primary-gradient`.
- Protected route/admin protected route loading state: nền dùng shell token, card dùng surface token, logo/progress dùng hero/primary gradient chung.
- Chat page: app shell dùng `app-shell-bg`; chat sidebar, welcome screen, chat window và composer dùng surface token; send button dùng `app-primary-gradient`.
- Profile/settings modal: modal shell bỏ inline gradient riêng và dùng `app-shell-bg`; sidebar/header/settings card dùng `app-surface`; profile hero card dùng `app-hero-gradient`; các CTA trong profile/security/notification dùng `app-primary-gradient`.
- Admin dashboard: admin layout dùng `app-shell-bg`; sidebar/topbar dùng `app-surface`; dashboard overview/chart/quick action cards dùng surface token; admin brand mark dùng `app-hero-gradient`.

### Test results

- `npx eslint` scoped trên các file auth/chat/settings/notification/admin vừa chỉnh: đạt.
- `npm run build` trong `frontend`: đạt.
- `npm run lint` toàn frontend: chưa đạt do lint debt có sẵn ngoài phạm vi thay đổi (`no-explicit-any`, hook deps, purity, unused vars trong admin/auth/chat/friend/notification realtime).
- `src/index.css` không được ESLint xử lý vì cấu hình hiện tại không lint CSS; CSS đã được kiểm tra gián tiếp qua `npm run build`.
- Chưa chạy manual browser QA dark/light cho login, chat, profile modal và admin dashboard trong phiên này.

### Remaining risks

- Cần kiểm tra trực tiếp bằng mắt ở dark/light theme để tinh chỉnh độ đậm surface trên dữ liệu thật, đặc biệt các màn admin nhiều bảng và chat sidebar nhiều conversation.
- Một số component nhỏ ngoài các shell chính vẫn có thể còn dùng `bg-card`/`bg-background` theo design token cũ; các gradient legacy đã được map về token mới để tránh lệch lớn, nhưng có thể tiếp tục polish sâu hơn nếu muốn đồng bộ tuyệt đối từng dialog nhỏ.
