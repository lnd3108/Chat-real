import {
  deleteSupportConversationForUser,
  getOrCreateSupportConversationForUser,
  getSupportConversationDetailForUser,
  getUserSupportConversationsQuery,
  sendSupportMessageCommand,
} from "../../application/support-user.service.js";
import {
  makeCommandHandler,
  makeQueryHandler,
} from "../../../../shared/api/http/controller-factory.js";
import { makeStatusMessageErrorHandler } from "../../../../shared/api/http/error-handlers.js";
import { presentMessageData } from "../../../../shared/api/http/presenters.js";

export const getOrCreateSupportConversation = makeQueryHandler({
  execute: (req) => getOrCreateSupportConversationForUser({ user: req.user }),
  present: (conversation) =>
    presentMessageData("Lấy cuộc trò chuyện hỗ trợ thành công", {
      conversation,
    }),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi lấy hoặc tạo cuộc trò chuyện hỗ trợ:",
    fallbackMessage: "Không thể lấy cuộc trò chuyện hỗ trợ",
  }),
});

export const getCurrentSupportConversation = getOrCreateSupportConversation;

export const getUserSupportConversations = makeQueryHandler({
  execute: (req) =>
    getUserSupportConversationsQuery({
      userId: req.user._id,
      page: req.query.page,
      limit: req.query.limit,
      sort: req.query.sort || "updatedAt-desc",
    }),
  present: (data) =>
    presentMessageData("Lấy danh sách cuộc trò chuyện hỗ trợ thành công", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi lấy danh sách cuộc trò chuyện hỗ trợ:",
    fallbackMessage: "Không thể lấy danh sách cuộc trò chuyện hỗ trợ",
  }),
});

export const sendSupportMessage = makeCommandHandler({
  execute: (req) =>
    sendSupportMessageCommand({
      user: req.user,
      conversationId: req.body.conversationId,
      content: req.body.content,
    }),
  present: (data) =>
    presentMessageData("Gửi tin nhắn hỗ trợ thành công", data, 201),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi gửi tin nhắn hỗ trợ:",
    fallbackMessage: "Không thể gửi tin nhắn",
  }),
});

export const getSupportConversationDetail = makeQueryHandler({
  execute: (req) =>
    getSupportConversationDetailForUser({
      userId: req.user._id,
      conversationId: req.params.id,
    }),
  present: (data) =>
    presentMessageData("Lấy chi tiết cuộc trò chuyện hỗ trợ thành công", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi lấy chi tiết cuộc trò chuyện hỗ trợ:",
    fallbackMessage: "Không thể lấy chi tiết cuộc trò chuyện hỗ trợ",
  }),
});

export const deleteSupportConversation = makeCommandHandler({
  execute: (req) =>
    deleteSupportConversationForUser({
      userId: req.user._id,
      conversationId: req.params.id,
    }),
  present: (data) =>
    presentMessageData("Xóa cuộc trò chuyện hỗ trợ thành công", data),
  onError: makeStatusMessageErrorHandler({
    logMessage: "Lỗi khi xóa cuộc trò chuyện hỗ trợ:",
    fallbackMessage: "Không thể xóa cuộc trò chuyện hỗ trợ",
  }),
});
