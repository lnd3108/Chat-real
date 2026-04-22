import {
  deleteSupportConversationForUser,
  getOrCreateSupportConversationForUser,
  getSupportConversationDetailForUser,
  getUserSupportConversationsQuery,
  sendSupportMessageCommand,
} from "../../application/support-user.service.js";
import { makeCommandHandler, makeQueryHandler } from "../../../../shared/api/http/controller-factory.js";
import { makeStatusMessageErrorHandler } from "../../../../shared/api/http/error-handlers.js";
import { presentMessageData } from "../../../../shared/api/http/presenters.js";

export const getOrCreateSupportConversation = makeQueryHandler({
  execute: (req) => getOrCreateSupportConversationForUser({ user: req.user }),
  present: (conversation) =>
    presentMessageData(
      "LÃƒÂ¡Ã‚ÂºÃ‚Â¥y cuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c trÃƒÆ’Ã‚Â² chuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£ thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng",
      { conversation },
    ),
  onError: makeStatusMessageErrorHandler({
    logMessage:
      "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi lÃƒÂ¡Ã‚ÂºÃ‚Â¥y hoÃƒÂ¡Ã‚ÂºÃ‚Â·c tÃƒÂ¡Ã‚ÂºÃ‚Â¡o cuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c trÃƒÆ’Ã‚Â² chuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£:",
    fallbackMessage:
      "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ lÃƒÂ¡Ã‚ÂºÃ‚Â¥y cuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c trÃƒÆ’Ã‚Â² chuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£",
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
    presentMessageData(
      "LÃƒÂ¡Ã‚ÂºÃ‚Â¥y danh sÃƒÆ’Ã‚Â¡ch cuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c trÃƒÆ’Ã‚Â² chuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£ thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng",
      data,
    ),
  onError: makeStatusMessageErrorHandler({
    logMessage:
      "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi lÃƒÂ¡Ã‚ÂºÃ‚Â¥y danh sÃƒÆ’Ã‚Â¡ch cuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c trÃƒÆ’Ã‚Â² chuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£:",
    fallbackMessage:
      "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ lÃƒÂ¡Ã‚ÂºÃ‚Â¥y danh sÃƒÆ’Ã‚Â¡ch cuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c trÃƒÆ’Ã‚Â² chuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£",
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
    presentMessageData(
      "GÃƒÂ¡Ã‚Â»Ã‚Â­i tin nhÃƒÂ¡Ã‚ÂºÃ‚Â¯n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£ thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng",
      data,
      201,
    ),
  onError: makeStatusMessageErrorHandler({
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi gÃƒÂ¡Ã‚Â»Ã‚Â­i tin nhÃƒÂ¡Ã‚ÂºÃ‚Â¯n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£:",
    fallbackMessage: "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ gÃƒÂ¡Ã‚Â»Ã‚Â­i tin nhÃƒÂ¡Ã‚ÂºÃ‚Â¯n",
  }),
});

export const getSupportConversationDetail = makeQueryHandler({
  execute: (req) =>
    getSupportConversationDetailForUser({
      userId: req.user._id,
      conversationId: req.params.id,
    }),
  present: (data) =>
    presentMessageData(
      "LÃƒÂ¡Ã‚ÂºÃ‚Â¥y chi tiÃƒÂ¡Ã‚ÂºÃ‚Â¿t cuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c trÃƒÆ’Ã‚Â² chuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£ thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng",
      data,
    ),
  onError: makeStatusMessageErrorHandler({
    logMessage:
      "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi lÃƒÂ¡Ã‚ÂºÃ‚Â¥y chi tiÃƒÂ¡Ã‚ÂºÃ‚Â¿t cuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c trÃƒÆ’Ã‚Â² chuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£:",
    fallbackMessage:
      "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ lÃƒÂ¡Ã‚ÂºÃ‚Â¥y chi tiÃƒÂ¡Ã‚ÂºÃ‚Â¿t cuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c trÃƒÆ’Ã‚Â² chuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£",
  }),
});

export const deleteSupportConversation = makeCommandHandler({
  execute: (req) =>
    deleteSupportConversationForUser({
      userId: req.user._id,
      conversationId: req.params.id,
    }),
  present: (data) =>
    presentMessageData(
      "XÃƒÆ’Ã‚Â³a cuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c trÃƒÆ’Ã‚Â² chuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£ thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng",
      data,
    ),
  onError: makeStatusMessageErrorHandler({
    logMessage: "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi xÃƒÆ’Ã‚Â³a cuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c trÃƒÆ’Ã‚Â² chuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£:",
    fallbackMessage: "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ xÃƒÆ’Ã‚Â³a cuÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢c trÃƒÆ’Ã‚Â² chuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£",
  }),
});
