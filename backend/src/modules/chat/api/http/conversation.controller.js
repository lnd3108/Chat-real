import {
  addGroupMembersCommand,
  createConversationCommand,
  deleteOrLeaveConversationCommand,
  emitDirectBlockStatusChanged,
  markConversationSeenCommand,
  removeGroupMemberCommand,
  updateGroupNameCommand,
  uploadGroupAvatarCommand,
} from "../../application/conversation.command-service.js";
import {
  getConversationListForUser,
  getConversationMessagesForUser,
  getGroupDetailsForUser,
  getUserConversationIdsForRealtime,
} from "../../application/conversation.query-service.js";
import {
  makeCommandHandler,
  makeQueryHandler,
} from "../../../../shared/api/http/controller-factory.js";
import { makeServerErrorHandler } from "../../../../shared/api/http/error-handlers.js";
import {
  presentCommandResult,
  presentJson,
} from "../../../../shared/api/http/presenters.js";

// Hàm xử lý lỗi chung cho controller cuộc trò chuyện
const conversationServerError = makeServerErrorHandler({
  logMessage: "Conversation controller error",
  message: "Lỗi hệ thống khi xử lý cuộc trò chuyện. Vui lòng thử lại sau.",
});

// Controller để tạo cuộc trò chuyện mới
export const createConversation = makeCommandHandler({
  execute: (req) =>
    createConversationCommand({
      user: req.user,
      body: req.body,
    }),
  present: presentCommandResult,
  onError: conversationServerError,
});

// Controller để lấy danh sách cuộc trò chuyện của người dùng
export const getConversation = makeQueryHandler({
  execute: (req) => getConversationListForUser(req.user),
  present: (conversations) => presentJson({ body: { conversations } }),
  onError: conversationServerError,
});

// Controller để lấy tin nhắn của một cuộc trò chuyện cụ thể
export const getMessages = makeQueryHandler({
  execute: (req) =>
    getConversationMessagesForUser({
      user: req.user,
      conversationId: req.params.conversationId,
      limit: req.query.limit,
      cursor: req.query.cursor,
    }),
  present: (result) =>
    result?.error
      ? presentCommandResult(result)
      : presentJson({ body: result.payload }),
  onError: conversationServerError,
});

// Hàm lấy danh sách cuộc trò chuyện
export const getUserConversationsForSocketIO = async (userId) =>
  getUserConversationIdsForRealtime(userId);

// Controller để đánh dấu cuộc trò chuyện đã được xem
export const markasSeen = makeCommandHandler({
  execute: (req) =>
    markConversationSeenCommand({
      conversationId: req.params.conversationId,
      userId: req.user._id,
    }),
  present: presentCommandResult,
  onError: conversationServerError,
});

// Hàm xóa cuộc trò chuyện hoặc rời khỏi nhóm
export const deleteOrLeaveGroupConversation = makeCommandHandler({
  execute: (req) =>
    deleteOrLeaveConversationCommand({
      user: req.user,
      conversationId: req.params.conversationId,
    }),
  present: presentCommandResult,
  onError: conversationServerError,
});

// Controller để thêm thành viên vào nhóm
export const addGroupMembers = makeCommandHandler({
  execute: (req) =>
    addGroupMembersCommand({
      user: req.user,
      conversationId: req.params.conversationId,
      memberIds: req.body.memberIds,
    }),
  present: presentCommandResult,
  onError: conversationServerError,
});

// Controller để xóa thành viên khỏi nhóm
export const removeGroupMember = makeCommandHandler({
  execute: (req) =>
    removeGroupMemberCommand({
      user: req.user,
      conversationId: req.params.conversationId,
      memberId: req.body.memberId,
    }),
  present: presentCommandResult,
  onError: conversationServerError,
});

// Controller để tải lên avatar nhóm
export const uploadGroupAvatar = makeCommandHandler({
  execute: (req) =>
    uploadGroupAvatarCommand({
      user: req.user,
      conversationId: req.params.conversationId,
      file: req.file,
    }),
  present: presentCommandResult,
  onError: conversationServerError,
});

// Controller để cập nhật tên nhóm
export const updateGroupName = makeCommandHandler({
  execute: (req) =>
    updateGroupNameCommand({
      user: req.user,
      conversationId: req.params.conversationId,
      name: req.body.name,
    }),
  present: presentCommandResult,
  onError: conversationServerError,
});

// Hàm phát sự kiện thay đổi trạng thái chặn trực tiếp
export { emitDirectBlockStatusChanged };

// Controller để lấy chi tiết nhóm
export const getGroupDetails = makeQueryHandler({
  execute: (req) =>
    getGroupDetailsForUser({
      user: req.user,
      conversationId: req.params.conversationId,
    }),
  present: (result) =>
    result?.error
      ? presentCommandResult(result)
      : presentJson({ body: result.payload }),
  onError: conversationServerError,
});
