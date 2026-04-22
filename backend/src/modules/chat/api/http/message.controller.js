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

const chatServerError = makeServerErrorHandler({
  message: "Lá»—i há»‡ thá»‘ng",
});

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

export const deleteMessageForMe = makeCommandHandler({
  execute: (req) =>
    deleteMessageForMeCommand({
      user: req.user,
      messageId: req.params.messageId,
    }),
  present: presentCommandResult,
  onError: chatServerError,
});

export const deleteMessageForEveryone = makeCommandHandler({
  execute: (req) =>
    deleteMessageForEveryoneCommand({
      user: req.user,
      messageId: req.params.messageId,
    }),
  present: presentCommandResult,
  onError: chatServerError,
});

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

export const sendMessageWithImage = sendGroupMessage;
