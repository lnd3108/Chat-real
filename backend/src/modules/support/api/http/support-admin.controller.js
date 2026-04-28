import {
  assignSupportAdminCommand,
  getSupportConversationDetailQuery,
  getSupportConversationsQuery,
  sendSupportReplyCommand,
  updateSupportStatusCommand,
} from "../../application/support-admin.service.js";
import {
  makeCommandHandler,
  makeQueryHandler,
} from "../../../../shared/api/http/controller-factory.js";
import { makeStatusMessageErrorHandler } from "../../../../shared/api/http/error-handlers.js";
import { presentMessageData } from "../../../../shared/api/http/presenters.js";

export const getSupportConversations = makeQueryHandler({
  execute: (req) => getSupportConversationsQuery(req.query),
  present: (data) =>
    presentMessageData("Lấy danh sách cuộc trò chuyện hỗ trợ thành công", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi lấy danh sách cuộc trò chuyện hỗ trợ:",
    fallbackMessage: "Không thể lấy danh sách cuộc trò chuyện hỗ trợ",
  }),
});

export const getSupportConversationDetail = makeQueryHandler({
  execute: (req) =>
    getSupportConversationDetailQuery({
      conversationId: req.params.id,
    }),
  present: (data) =>
    presentMessageData("Lấy chi tiết cuộc trò chuyện hỗ trợ thành công", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi lấy chi tiết cuộc trò chuyện hỗ trợ:",
    fallbackMessage: "Không thể lấy chi tiết cuộc trò chuyện hỗ trợ",
  }),
});

export const sendSupportReply = makeCommandHandler({
  execute: (req) =>
    sendSupportReplyCommand({
      admin: req.user,
      conversationId: req.body.conversationId,
      content: req.body.content,
    }),
  present: (data) =>
    presentMessageData("Gửi phản hồi hỗ trợ thành công", data, 201),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi gửi phản hồi hỗ trợ:",
    fallbackMessage: "Không thể gửi phản hồi hỗ trợ",
  }),
});

export const updateSupportStatus = makeCommandHandler({
  execute: (req) =>
    updateSupportStatusCommand({
      admin: req.user,
      conversationId: req.params.id,
      status: req.body.status,
    }),
  present: (conversation) =>
    presentMessageData("Cập nhật trạng thái hỗ trợ thành công", {
      conversation,
    }),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi cập nhật trạng thái hỗ trợ:",
    fallbackMessage: "Không thể cập nhật trạng thái hỗ trợ",
  }),
});

export const assignSupportAdmin = makeCommandHandler({
  execute: (req) =>
    assignSupportAdminCommand({
      conversationId: req.params.id,
      adminId: req.body.adminId,
    }),
  present: (conversation) =>
    presentMessageData("Gán quản trị viên thành công", { conversation }),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi gán quản trị viên hỗ trợ:",
    fallbackMessage: "Không thể gán quản trị viên",
  }),
});
