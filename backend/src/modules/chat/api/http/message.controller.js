import {
  deleteMessageForEveryoneCommand,
  deleteMessageForMeCommand,
  editMessageCommand,
  sendDirectMessageCommand,
  sendGroupMessageCommand,
  toggleMessageReactionCommand,
} from "../../application/message.command-service.js";
import { makeCommandHandler } from "../../../../shared/api/http/controller-factory.js";
import { makeServerErrorHandler } from "../../../../shared/api/http/error-handlers.js";
import { presentCommandResult } from "../../../../shared/api/http/presenters.js";

// khai báo lỗi chung
const chatServerError = makeServerErrorHandler({
  message: "Lỗi hệ thống chat",
});

// các controller
export const sendDirectMessage = makeCommandHandler({
  execute: (req) =>
    sendDirectMessageCommand({
      user: req.user,
      body: req.body,
      file: req.file,
    }),
  present: presentCommandResult,
  onError: chatServerError,
});

// gửi tin nhắn trong nhóm (có thể kèm file)
export const sendGroupMessage = makeCommandHandler({
  execute: (req) =>
    sendGroupMessageCommand({
      user: req.user,
      conversation: req.conversation,
      body: req.body,
      file: req.file,
    }),
  present: presentCommandResult,
  onError: chatServerError,
});

// chỉnh sửa tin nhắn
export const editMessage = makeCommandHandler({
  execute: (req) =>
    editMessageCommand({
      user: req.user,
      messageId: req.params.messageId,
      content: req.body?.content,
    }),
  present: presentCommandResult,
  onError: chatServerError,
});

// xóa tin nhắn cho chính mình
export const deleteMessageForMe = makeCommandHandler({
  execute: (req) =>
    deleteMessageForMeCommand({
      user: req.user,
      messageId: req.params.messageId,
    }),
  present: presentCommandResult,
  onError: chatServerError,
});

// xóa tin nhắn cho tất cả mọi người (chỉ có thể thực hiện bởi người gửi)
export const deleteMessageForEveryone = makeCommandHandler({
  execute: (req) =>
    deleteMessageForEveryoneCommand({
      user: req.user,
      messageId: req.params.messageId,
    }),
  present: presentCommandResult,
  onError: chatServerError,
});

// thêm hoặc bỏ reaction cho tin nhắn
export const toggleReaction = makeCommandHandler({
  execute: (req) =>
    toggleMessageReactionCommand({
      user: req.user,
      messageId: req.params.messageId,
      emoji: req.body?.emoji,
    }),
  present: presentCommandResult,
  onError: chatServerError,
});

// gửi tin nhắn có kèm hình ảnh
export const sendMessageWithImage = sendGroupMessage;
