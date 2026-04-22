import {
  deleteMessageForEveryoneCommand,
  deleteMessageForMeCommand,
  editMessageCommand,
  sendDirectMessageCommand,
  sendGroupMessageCommand,
  toggleMessageReactionCommand,
} from "../../application/message.command-service.js";
import {
  handleController,
  respondCommandResult,
} from "../../../../utils/controllerResponses.js";

const sendChatServerError = (_error, _req, res) =>
  res.status(500).json({ message: "Lá»—i há»‡ thá»‘ng" });

export const sendDirectMessage = handleController(
  (req, res) =>
    respondCommandResult(
      res,
      sendDirectMessageCommand({
        user: req.user,
        body: req.body,
        file: req.file,
      }),
    ),
  sendChatServerError,
);

export const sendGroupMessage = handleController(
  (req, res) =>
    respondCommandResult(
      res,
      sendGroupMessageCommand({
        user: req.user,
        conversation: req.conversation,
        body: req.body,
        file: req.file,
      }),
    ),
  sendChatServerError,
);

export const editMessage = handleController(
  (req, res) =>
    respondCommandResult(
      res,
      editMessageCommand({
        user: req.user,
        messageId: req.params.messageId,
        content: req.body?.content,
      }),
    ),
  sendChatServerError,
);

export const deleteMessageForMe = handleController(
  (req, res) =>
    respondCommandResult(
      res,
      deleteMessageForMeCommand({
        user: req.user,
        messageId: req.params.messageId,
      }),
    ),
  sendChatServerError,
);

export const deleteMessageForEveryone = handleController(
  (req, res) =>
    respondCommandResult(
      res,
      deleteMessageForEveryoneCommand({
        user: req.user,
        messageId: req.params.messageId,
      }),
    ),
  sendChatServerError,
);

export const toggleReaction = handleController(
  (req, res) =>
    respondCommandResult(
      res,
      toggleMessageReactionCommand({
        user: req.user,
        messageId: req.params.messageId,
        emoji: req.body?.emoji,
      }),
    ),
  sendChatServerError,
);

export const sendMessageWithImage = sendGroupMessage;
