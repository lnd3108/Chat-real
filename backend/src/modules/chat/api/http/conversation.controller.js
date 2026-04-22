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
import { makeCommandHandler, makeQueryHandler } from "../../../../shared/api/http/controller-factory.js";
import { makeServerErrorHandler } from "../../../../shared/api/http/error-handlers.js";
import {
  presentCommandResult,
  presentJson,
} from "../../../../shared/api/http/presenters.js";

const conversationServerError = makeServerErrorHandler({
  logMessage: "Conversation controller error",
  message: "Loi he thong",
});

export const createConversation = makeCommandHandler({
  execute: (req) =>
    createConversationCommand({
      user: req.user,
      body: req.body,
    }),
  present: presentCommandResult,
  onError: conversationServerError,
});

export const getConversation = makeQueryHandler({
  execute: (req) => getConversationListForUser(req.user),
  present: (conversations) => presentJson({ body: { conversations } }),
  onError: conversationServerError,
});

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

export const getUserConversationsForSocketIO = async (userId) =>
  getUserConversationIdsForRealtime(userId);

export const markasSeen = makeCommandHandler({
  execute: (req) =>
    markConversationSeenCommand({
      conversationId: req.params.conversationId,
      userId: req.user._id,
    }),
  present: presentCommandResult,
  onError: conversationServerError,
});

export const deleteOrLeaveGroupConversation = makeCommandHandler({
  execute: (req) =>
    deleteOrLeaveConversationCommand({
      user: req.user,
      conversationId: req.params.conversationId,
    }),
  present: presentCommandResult,
  onError: conversationServerError,
});

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

export { emitDirectBlockStatusChanged };

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
