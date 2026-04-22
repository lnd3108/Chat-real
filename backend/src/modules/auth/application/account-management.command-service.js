import bcrypt from "bcrypt";
import User from "../../../models/User.js";
import Session from "../../../models/Session.js";
import { deleteMyAccount } from "../../../controllers/userController.js";
import { sendAccountDeletionCodeForUser } from "./verification.service.js";

export const changePasswordForUser = async ({
  userId,
  currentPassword,
  newPassword,
  confirmPassword,
  res,
}) => {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return {
      status: 400,
      body: {
        message: "ThiÃ¡ÂºÂ¿u currentPassword, newPassword hoÃ¡ÂºÂ·c confirmPassword",
      },
    };
  }

  if (newPassword.length < 6) {
    return {
      status: 400,
      body: {
        message: "MÃ¡ÂºÂ­t khÃ¡ÂºÂ©u mÃ¡Â»â€ºi phÃ¡ÂºÂ£i cÃƒÂ³ ÃƒÂ­t nhÃ¡ÂºÂ¥t 6 kÃƒÂ½ tÃ¡Â»Â±",
      },
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      status: 400,
      body: { message: "confirmPassword khÃƒÂ´ng khÃ¡Â»â€ºp vÃ¡Â»â€ºi newPassword" },
    };
  }

  const user = await User.findById(userId);
  if (!user) {
    return {
      status: 404,
      body: { message: "NgÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i" },
    };
  }

  const isCorrect = await bcrypt.compare(currentPassword, user.hashedPassword);
  if (!isCorrect) {
    return {
      status: 401,
      body: { message: "MÃ¡ÂºÂ­t khÃ¡ÂºÂ©u hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i khÃƒÂ´ng Ã„â€˜ÃƒÂºng" },
    };
  }

  const isSameAsOld = await bcrypt.compare(newPassword, user.hashedPassword);
  if (isSameAsOld) {
    return {
      status: 400,
      body: {
        message: "MÃ¡ÂºÂ­t khÃ¡ÂºÂ©u mÃ¡Â»â€ºi khÃƒÂ´ng Ã„â€˜Ã†Â°Ã¡Â»Â£c trÃƒÂ¹ng mÃ¡ÂºÂ­t khÃ¡ÂºÂ©u cÃ…Â©",
      },
    };
  }

  user.hashedPassword = await bcrypt.hash(newPassword, 10);
  await user.save();
  await Session.deleteMany({ userId: user._id });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });

  return {
    status: 200,
    body: {
      message:
        "Ã„ÂÃ¡Â»â€¢i mÃ¡ÂºÂ­t khÃ¡ÂºÂ©u thÃƒÂ nh cÃƒÂ´ng! Vui lÃƒÂ²ng Ã„â€˜Ã„Æ’ng nhÃ¡ÂºÂ­p lÃ¡ÂºÂ¡i.",
    },
  };
};

export const requestAuthenticatedAccountDeletion = async ({ userId }) => {
  const user = await User.findById(userId);
  if (!user) {
    return { status: 404, body: { message: "KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng." } };
  }

  const deletion = await sendAccountDeletionCodeForUser(user, {
    ignoreCooldown: false,
  });

  if (!deletion.ok) {
    return {
      status: deletion.status,
      body: {
        message: deletion.message,
        resendAvailableAt: deletion.resendAvailableAt,
      },
    };
  }

  return { status: 200, body: deletion.payload };
};

export const confirmAuthenticatedAccountDeletion = ({ req, res }) =>
  deleteMyAccount(req, res);
