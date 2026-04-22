import {
  assignSupportAdminCommand,
  getSupportConversationDetailQuery,
  getSupportConversationsQuery,
  sendSupportReplyCommand,
  updateSupportStatusCommand,
} from "../../application/support-admin.service.js";
import { makeCommandHandler, makeQueryHandler } from "../../../../shared/api/http/controller-factory.js";
import { makeStatusMessageErrorHandler } from "../../../../shared/api/http/error-handlers.js";
import { presentMessageData } from "../../../../shared/api/http/presenters.js";

export const getSupportConversations = makeQueryHandler({
  execute: (req) => getSupportConversationsQuery(req.query),
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

export const getSupportConversationDetail = makeQueryHandler({
  execute: (req) =>
    getSupportConversationDetailQuery({
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

export const sendSupportReply = makeCommandHandler({
  execute: (req) =>
    sendSupportReplyCommand({
      admin: req.user,
      conversationId: req.body.conversationId,
      content: req.body.content,
    }),
  present: (data) =>
    presentMessageData(
      "GÃƒÂ¡Ã‚Â»Ã‚Â­i phÃƒÂ¡Ã‚ÂºÃ‚Â£n hÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“i hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£ thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng",
      data,
      201,
    ),
  onError: makeStatusMessageErrorHandler({
    logMessage:
      "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi gÃƒÂ¡Ã‚Â»Ã‚Â­i phÃƒÂ¡Ã‚ÂºÃ‚Â£n hÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“i hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£:",
    fallbackMessage:
      "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ gÃƒÂ¡Ã‚Â»Ã‚Â­i phÃƒÂ¡Ã‚ÂºÃ‚Â£n hÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“i hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£",
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
    presentMessageData(
      "CÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£ thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng",
      { conversation },
    ),
  onError: makeStatusMessageErrorHandler({
    logMessage:
      "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£:",
    fallbackMessage:
      "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£",
  }),
});

export const assignSupportAdmin = makeCommandHandler({
  execute: (req) =>
    assignSupportAdminCommand({
      conversationId: req.params.id,
      adminId: req.body.adminId,
    }),
  present: (conversation) =>
    presentMessageData(
      "GÃƒÆ’Ã‚Â¡n quÃƒÂ¡Ã‚ÂºÃ‚Â£n trÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ viÃƒÆ’Ã‚Âªn thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng",
      { conversation },
    ),
  onError: makeStatusMessageErrorHandler({
    logMessage:
      "LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi gÃƒÆ’Ã‚Â¡n quÃƒÂ¡Ã‚ÂºÃ‚Â£n trÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ viÃƒÆ’Ã‚Âªn hÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ trÃƒÂ¡Ã‚Â»Ã‚Â£:",
    fallbackMessage: "KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ gÃƒÆ’Ã‚Â¡n quÃƒÂ¡Ã‚ÂºÃ‚Â£n trÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ viÃƒÆ’Ã‚Âªn",
  }),
});
