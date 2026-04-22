import {
  sendDirectMessageCommand,
  sendGroupMessageCommand,
} from "../../application/message.command-service.js";

export const sendDirectMessage = async (req, res) => {
  try {
    const result = await sendDirectMessageCommand({
      user: req.user,
      body: req.body,
      file: req.file,
    });

    if (result.error) {
      return res.status(result.error.status).json({
        ...(result.error.code ? { code: result.error.code } : {}),
        message: result.error.message,
      });
    }

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi xay ra khi gui tin nhan truc tiep", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const result = await sendGroupMessageCommand({
      user: req.user,
      conversation: req.conversation,
      body: req.body,
      file: req.file,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Loi xay ra khi gui tin nhan nhom", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const sendMessageWithImage = sendGroupMessage;
