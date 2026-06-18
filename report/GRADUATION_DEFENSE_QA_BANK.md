# Bộ câu hỏi và trả lời bảo vệ đồ án ChatRealTime

## A. Câu hỏi tổng quan đề tài

### 1. Vì sao em chọn đề tài chat realtime?

Em chọn đề tài này vì chat realtime là bài toán gần với thực tế, có cả frontend, backend, database, realtime socket, bảo mật và hiệu năng. Nhờ đó em có thể thể hiện nhiều kiến thức trong một hệ thống hoàn chỉnh.

### 2. Điểm khác biệt của hệ thống so với app chat đơn giản là gì?

Ngoài gửi tin nhắn, hệ thống còn có quản lý bạn bè, chat nhóm, online/offline, notification, admin panel, report, maintenance mode, voice/video call signaling và phần tối ưu hiệu năng bằng Redis.

### 3. Phạm vi đồ án của em là gì?

Phạm vi chính là xây dựng ứng dụng chat realtime có xác thực người dùng, chat 1-1, chat nhóm, bạn bè, thông báo, admin và phân tích tối ưu hiệu năng backend.

### 4. Phần nào là trọng tâm kỹ thuật?

Trọng tâm kỹ thuật là realtime bằng Socket.IO, xác thực JWT/cookie, thiết kế dữ liệu MongoDB và đặc biệt là quá trình đo bottleneck login rồi tối ưu bằng Redis/cache.

### 5. Hệ thống đã hoàn thiện như sản phẩm thương mại chưa?

Chưa hoàn toàn. Hệ thống đã có nền tảng chức năng và kỹ thuật tốt cho đồ án, nhưng để production-ready cần thêm monitoring, hardening bảo mật, kiểm thử tải đầy đủ hơn và tối ưu timeout còn lại.

## B. Câu hỏi kiến trúc

### 1. Vì sao chọn Node.js/Express?

Node.js phù hợp với ứng dụng realtime vì mô hình event-driven và hệ sinh thái Socket.IO. Express giúp xây REST API nhanh, dễ tổ chức module và dễ tích hợp middleware.

### 2. Vì sao dùng MongoDB?

MongoDB phù hợp vì dữ liệu chat như conversation, participant, message, reaction có cấu trúc linh hoạt. Mongoose cũng hỗ trợ schema, index và quan hệ tham chiếu đủ tốt cho đồ án.

### 3. Vì sao dùng Socket.IO?

Socket.IO hỗ trợ realtime hai chiều, room, reconnect và fallback transport. Với chat app, room theo user hoặc conversation giúp gửi event đúng người và đúng hội thoại.

### 4. Redis được dùng để làm gì?

Redis được dùng cho cache, rate limit, helper refresh session, auth user lookup cache, maintenance cache và ở Phase 2A là Socket.IO adapter/presence.

### 5. Nếu tăng số người dùng thì hệ thống scale như thế nào?

Backend có thể chạy nhiều worker/process. Socket.IO cần Redis adapter để event đi xuyên worker. Các dữ liệu đọc nhiều có thể cache bằng Redis, còn MongoDB cần index và có thể nâng cấp hạ tầng khi tải tăng.

## C. Câu hỏi database

### 1. Conversation và Message liên hệ thế nào?

Một Conversation có nhiều Message. Message lưu `conversationId`, còn Conversation lưu thông tin tổng hợp như participant, lastMessage, lastMessageAt và unreadCounts.

### 2. Vì sao cần Participant?

Participant cho biết user nào thuộc conversation nào. Nhờ đó backend kiểm tra quyền đọc/gửi tin nhắn và socket biết cần join room conversation nào.

### 3. Làm sao lấy danh sách hội thoại nhanh?

Truy vấn Conversation theo `participants.userId` và sắp xếp theo `lastMessageAt`. Collection này đã có index `{ "participants.userId": 1, lastMessageAt: -1 }`.

### 4. Index nào quan trọng nhất?

Với login là index unique `userName`. Với chat là index participant trên Conversation và index `{ conversationId: 1, createdAt: -1 }` trên Message để phân trang tin nhắn.

### 5. Khi message tăng rất nhiều thì xử lý thế nào?

Cần phân trang theo cursor, dùng index theo conversationId và createdAt, giới hạn số message mỗi lần tải, có thể archive dữ liệu cũ hoặc shard/partition nếu quy mô lớn.

### 6. Vì sao Message có sender snapshot?

Sender snapshot giúp hiển thị tên/avatar tại thời điểm gửi hoặc khi user bị xóa/đổi thông tin, tránh phải phụ thuộc hoàn toàn vào dữ liệu User hiện tại.

### 7. Report lưu snapshot để làm gì?

Snapshot giúp admin xem thông tin tại thời điểm report được tạo. Nếu user hoặc message thay đổi sau đó, report vẫn giữ được ngữ cảnh ban đầu.

## D. Câu hỏi realtime

### 1. Socket.IO hoạt động như thế nào trong hệ thống?

Sau khi đăng nhập, client kết nối Socket.IO với token. Server xác thực token, cho socket join user room và conversation room, sau đó dùng room để emit event realtime.

### 2. Làm sao gửi message realtime tới đúng người?

Backend lưu message rồi emit vào room conversation hoặc room user. Chỉ các socket đã join room đó mới nhận được event.

### 3. Online/offline được xử lý thế nào?

Khi socket connect, hệ thống đăng ký user là online. Khi disconnect, nếu user không còn socket nào thì chuyển offline. Phase 2A có Redis presence để hỗ trợ nhiều worker.

### 4. Nếu user mở nhiều tab thì sao?

Mỗi tab có thể là một socket riêng. User chỉ nên offline khi tất cả socket của user đã disconnect.

### 5. Nếu chạy nhiều worker thì có vấn đề gì?

Nếu chỉ dùng Map local, mỗi worker chỉ biết socket của mình. Vì vậy cần Redis Socket.IO adapter và Redis presence để đồng bộ event và trạng thái online giữa worker.

### 6. Redis Socket.IO Adapter giải quyết vấn đề gì?

Nó giúp event emit từ một worker có thể tới socket đang nằm ở worker khác. Đây là điều cần thiết khi backend chạy cluster hoặc nhiều instance.

### 7. Voice/video call trong hệ thống hoạt động ra sao?

Backend dùng Socket.IO để signaling: gửi invite, offer, answer và ICE candidate giữa các user. WebRTC chịu trách nhiệm media peer-to-peer, còn backend điều phối signaling và trạng thái.

## E. Câu hỏi bảo mật

### 1. JWT access token và refresh token khác nhau thế nào?

Access token có thời gian sống ngắn và dùng để xác thực request. Refresh token sống lâu hơn, dùng để xin access token mới khi access token hết hạn.

### 2. Vì sao dùng HttpOnly cookie?

HttpOnly cookie giúp JavaScript phía client không đọc trực tiếp token, giảm rủi ro token bị lấy qua XSS.

### 3. Làm sao chống CORS sai origin?

Backend dùng CORS whitelist cho Express và Socket.IO, chỉ cho các origin đã cấu hình được gửi credential. Không dùng wildcard `*` với cookie.

### 4. Helmet dùng để làm gì?

Helmet thêm các security header như HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy để giảm một số rủi ro bảo mật web phổ biến.

### 5. Nếu token bị lộ thì xử lý thế nào?

Có thể xóa session/refresh token, buộc đăng nhập lại, đổi mật khẩu và về lâu dài nên triển khai refresh token rotation để phát hiện reuse token.

### 6. Hạn chế bảo mật còn lại là gì?

Access token vẫn còn trong JSON response và Bearer flow, refresh token chưa rotate, CSP chưa bật. Đây là các hướng hardening tiếp theo.

### 7. Vì sao chưa bỏ Bearer flow?

Vì frontend và socket hiện đang phụ thuộc luồng này. Phase bảo mật ưu tiên không phá contract hiện có, sau đó mới có thể chuyển dần sang cookie-only nếu thiết kế lại frontend.

## F. Câu hỏi Redis/performance

### 1. Redis trong đồ án dùng để làm gì?

Redis được dùng cho cache, rate limit, maintenance cache, auth user lookup cache, helper refresh session và Phase 2A realtime adapter/presence.

### 2. Vì sao user lookup login bị chậm?

Trong valid login, backend phải tìm user thật, bcrypt compare, check maintenance và tạo session. Khi nhiều request đồng thời, phần user lookup/Mongo có lúc tăng mạnh trong timing log.

### 3. Redis auth user lookup cache hoạt động thế nào?

Khi login, backend đọc Redis theo normalized username. Nếu hit thì dùng user subset từ cache; nếu miss hoặc Redis lỗi thì fallback MongoDB và ghi cache nếu user đủ điều kiện.

### 4. Vì sao không cache user bị ban hoặc chưa verify?

Vì trạng thái này ảnh hưởng trực tiếp đến quyền đăng nhập. Cache nhầm hoặc stale có thể cho phép user không hợp lệ đăng nhập, nên chỉ cache user local, verified và active.

### 5. Invalidation cache làm thế nào?

Khi đổi password, verify email, đổi email/profile, admin lock/unlock, đổi role hoặc ban/unban, backend xóa key cache tương ứng để lần login sau đọc dữ liệu mới.

### 6. Maintenance L1 cache là gì?

Đó là cache in-memory rất ngắn trong từng worker để lưu public maintenance config. Nó giúp login không phải đọc Redis/Mongo cho mỗi request.

### 7. Single-flight là gì?

Single-flight nghĩa là khi nhiều request cùng miss cache, chỉ request đầu tiên thực sự đọc Redis/Mongo, các request còn lại chờ cùng promise đó. Cách này giảm cache stampede trong worker.

### 8. Vì sao vẫn còn timeout?

Vì cache không loại bỏ toàn bộ bottleneck. Khi L1 miss, Redis/Mongo chậm hoặc có đoạn khác như bcrypt/session write bị nghẽn, request vẫn có thể timeout. Đây là hạn chế còn lại.

### 9. Kết quả load test nói lên điều gì?

Kết quả cho thấy p95 login cải thiện rõ sau Redis auth user cache và maintenance L1 cache, nhưng failed/timeout nhỏ vẫn còn nên chưa thể kết luận hệ thống chịu tải hoàn hảo.

### 10. Có thể gọi hệ thống là production-ready chưa?

Chưa hoàn toàn. Hiện tại hệ thống phù hợp đồ án tốt nghiệp và có nền tảng tốt, nhưng production cần thêm observability, security hardening, queue, deployment chuẩn và load test đầy đủ hơn.

## G. Câu hỏi load test

### 1. VUs trong k6 là gì?

VUs là virtual users, tức số người dùng ảo chạy đồng thời trong bài load test.

### 2. p95 là gì?

p95 nghĩa là 95% request có thời gian phản hồi nhỏ hơn hoặc bằng giá trị đó. Nó giúp nhìn tail latency tốt hơn average.

### 3. Vì sao dùng p95 thay vì chỉ avg?

Average có thể che giấu các request rất chậm. p95 cho thấy trải nghiệm của nhóm request chậm hơn, quan trọng với hệ thống realtime.

### 4. Tại sao p95 pass nhưng vẫn có failed request?

p95 chỉ tính trên phân phối thời gian phản hồi, còn failed request là request lỗi hoặc timeout. Vì vậy p95 có thể tốt nhưng vẫn còn một tỷ lệ request bị lỗi.

### 5. Kết quả 50 VUs có ý nghĩa gì?

Nó cho biết hệ thống trong môi trường test có thể xử lý mức đồng thời đó với p95 nhất định, nhưng không đồng nghĩa production chịu tải y hệt vì môi trường local khác production.

### 6. Hạn chế của benchmark local là gì?

Benchmark local phụ thuộc máy chạy test, Windows, Docker/Redis/Mongo local, network local và cách seed dữ liệu. Production Linux và hạ tầng thật có thể khác.

### 7. Vì sao valid login chậm hơn invalid user?

Invalid user có thể dừng sớm sau lookup. Valid login phải bcrypt, check maintenance, tạo session, set cookie và emit event nên nhiều bước hơn.

### 8. `userLookupAwaitMs` giảm có đủ chưa?

Chưa đủ. Nó giải quyết một bottleneck, nhưng sau đó bottleneck có thể chuyển sang maintenance, bcrypt hoặc session create.

## H. Câu hỏi hướng phát triển

### 1. Nếu phát triển tiếp em sẽ làm gì?

Em sẽ hoàn thiện test Phase 2A Redis Socket.IO adapter/presence, cache thêm các API đọc nhiều, thêm BullMQ cho job nền, triển khai monitoring và hardening bảo mật.

### 2. Vì sao cần Redis Socket.IO Adapter?

Khi backend chạy nhiều worker, socket của user có thể nằm ở worker khác. Redis adapter giúp event từ worker này broadcast tới worker khác.

### 3. BullMQ dùng để làm gì?

BullMQ dùng để đưa các tác vụ nền như gửi email, notification, cleanup Cloudinary hoặc tính lại dashboard ra khỏi request chính.

### 4. Làm sao deploy production?

Cần build frontend, deploy backend sau reverse proxy HTTPS, dùng MongoDB/Redis managed hoặc private network, cấu hình env production, monitoring, log, backup và security settings.

### 5. Làm sao monitor hệ thống?

Có thể dùng Prometheus/Grafana để theo dõi request latency, error rate, Redis latency, Mongo latency, event loop delay, CPU/memory và socket connection count.

### 6. Phase 2B nên cache gì trước?

Nên cache conversation list, friend list, friend requests, reports và admin dashboard vì đây là các API đọc nhiều và có thể invalidation theo event rõ ràng.

## 10 câu hỏi hội đồng dễ hỏi nhất và câu trả lời mẫu 30 giây

### 1. Vì sao em chọn đề tài này?

Em chọn ChatRealTime vì đây là bài toán thực tế, có đủ frontend, backend, database, realtime, bảo mật và hiệu năng. Qua đề tài này em không chỉ làm chức năng chat mà còn học cách thiết kế hệ thống và tối ưu backend bằng số liệu.

### 2. Kiến trúc tổng thể của hệ thống là gì?

Hệ thống gồm React frontend, Express backend, MongoDB làm database chính, Socket.IO cho realtime và Redis cho cache/rate limit/realtime scale. Frontend gọi REST API cho nghiệp vụ và kết nối socket để nhận sự kiện tức thời.

### 3. Socket.IO được dùng như thế nào?

Sau khi đăng nhập, client kết nối socket bằng token. Server xác thực socket, cho user join room riêng và các room conversation. Khi có tin nhắn hoặc notification, backend emit vào room tương ứng để client nhận realtime.

### 4. Vì sao dùng MongoDB?

MongoDB phù hợp với dữ liệu chat vì conversation, message, reaction, reply và metadata có cấu trúc linh hoạt. Mongoose hỗ trợ schema và index nên vẫn kiểm soát được dữ liệu.

### 5. Redis giúp cải thiện gì?

Redis giúp giảm truy vấn MongoDB ở các đường nóng như auth user lookup và maintenance config. Ngoài ra Redis còn dùng cho rate limit và Phase 2A hỗ trợ Socket.IO adapter/presence khi chạy nhiều worker.

### 6. Bottleneck login ban đầu là gì?

Valid login chậm vì phải đi qua user lookup, bcrypt, maintenance check và tạo session. Qua SigninPipelineTiming và Mongo monitor, em thấy user lookup/Mongo là bottleneck quan trọng, sau đó bottleneck chuyển sang maintenance read.

### 7. Kết quả tối ưu có tốt không?

Kết quả p95 cải thiện rõ. Ví dụ sau Phase 1I, 25 VUs đạt khoảng 146ms và failed 0%. Sau Phase 1J, 40/50 VUs có p95 khoảng 256-275ms, nhưng vẫn còn timeout nhỏ nên em không kết luận là hoàn hảo.

### 8. Hệ thống đã production-ready chưa?

Chưa hoàn toàn. Hệ thống đã có nền tảng tốt cho đồ án, nhưng production cần thêm monitoring, hardening bảo mật, kiểm thử tải toàn diện hơn, queue background jobs và xử lý triệt để timeout còn lại.

### 9. Hạn chế lớn nhất hiện tại là gì?

Hạn chế lớn nhất là benchmark chủ yếu local, 40/50 VUs vẫn còn timeout nhỏ và Phase 2A realtime scale cần manual smoke đầy đủ hơn. Ngoài ra security vẫn còn các hướng như refresh token rotation và CSP.

### 10. Nếu có thêm thời gian em sẽ làm gì?

Em sẽ hoàn thiện Redis Socket.IO adapter/presence bằng test nhiều tab/nhiều worker, cache thêm các API đọc nhiều, thêm BullMQ cho email/notification, triển khai Prometheus/Grafana và hardening bảo mật auth.

## Cách nói khi bị hỏi về timeout còn lại

Câu trả lời mẫu:

Hiện tại em không xem timeout còn lại là đã giải quyết xong. Sau Phase 1I và 1J, p95 đã giảm rõ, nhưng vẫn còn một tỷ lệ timeout nhỏ ở 40/50 VUs. Điều này cho thấy cache đã cải thiện request phổ biến, nhưng hệ thống vẫn còn tail latency khi L1 miss hoặc khi source rơi xuống Redis/Mongo. Hướng tiếp theo của em là stale-while-revalidate, Redis pub/sub invalidation cho L1, tiếp tục đo session write/bcrypt và chạy benchmark trong môi trường gần production hơn.

## Cách nói khi bị hỏi vì sao chưa làm Redis Socket.IO Adapter

Nếu hội đồng hỏi theo giả định chưa làm:

Trong kế hoạch ban đầu, Redis Socket.IO Adapter là Phase 2 vì trước đó em ưu tiên ổn định chức năng, bảo mật và bottleneck login. Tuy nhiên trong code/report hiện tại, Phase 2A đã bổ sung Redis Socket.IO adapter và Redis-backed presence bằng flag. Điểm em cần nói trung thực là manual smoke nhiều worker/nhiều tab chưa được xác nhận đầy đủ, nên em chưa gọi phần này là hoàn thiện production.

## Cách nói khi bị hỏi hệ thống có chịu tải thật không

Câu trả lời mẫu:

Em có thể nói hệ thống đã được load test ở phạm vi login và có cải thiện rõ sau tối ưu Redis/cache. Tuy nhiên em không khẳng định hệ thống chịu tải production thật, vì benchmark hiện chủ yếu local/dev và vẫn còn timeout nhỏ ở 40/50 VUs. Kết quả có ý nghĩa là chứng minh được quy trình đo, tìm bottleneck và tối ưu; để kết luận chịu tải production cần test trên hạ tầng production-like và mở rộng benchmark sang message/socket.

## Cách nói khi bị hỏi vì sao cache chứa hashedPassword

Câu trả lời mẫu:

Do login vẫn cần `bcrypt.compare`, cache user lookup cần có `hashedPassword` để tránh truy vấn MongoDB lại. Em nhận thức đây là dữ liệu nhạy cảm, nên cache mặc định tắt, chỉ bật bằng env, TTL ngắn, Redis phải private/password/TLS nếu remote và tuyệt đối không log payload/key nhạy cảm.

## Cách nói khi bị hỏi vì sao không cache negative result

Câu trả lời mẫu:

Em không cache negative result vì user có thể vừa đăng ký, verify hoặc thay đổi trạng thái. Nếu cache kết quả không tồn tại hoặc không hợp lệ, hệ thống dễ trả sai trong một khoảng TTL. Với auth, em ưu tiên an toàn và tính đúng hơn là cache mọi thứ.

## Cách nói khi bị hỏi vì sao chưa bật CSP

Câu trả lời mẫu:

Transport Security Phase 1 đã bật Helmet và các security headers chính, nhưng CSP chưa bật vì cần tránh làm vỡ Swagger, Socket.IO connect, Cloudinary image preview và voice/video call. CSP nên làm ở phase sau với cấu hình route-specific và `connect-src`, `img-src` phù hợp.

## Cách nói khi bị hỏi về refresh token rotation

Câu trả lời mẫu:

Hiện tại refresh token chưa rotate, đây là hạn chế bảo mật còn lại. Trong phạm vi phase vừa rồi em ưu tiên không phá contract auth và tối ưu performance. Hướng tiếp theo là rotate refresh token mỗi lần refresh, lưu hash token và phát hiện reuse.

## Cách nói khi bị hỏi phần nào em tự tin nhất

Câu trả lời mẫu:

Em tự tin nhất ở quá trình phân tích hiệu năng login. Em đã tách pipeline, đo từng đoạn, kiểm tra Mongo/user lookup/bcrypt/maintenance và tối ưu bằng Redis cache theo số liệu, đồng thời ghi nhận trung thực các timeout còn lại.
