import bcrypt from "bcrypt";
import User from "../../../models/User.js";
import { ADMIN_SOCKET_EVENTS } from "../../../constants/socketEvents.js";
import { sendEmailVerificationForUser } from "./verification.service.js";
import { emitAuthLifecycle } from "../infrastructure/auth-realtime.service.js";
import { ensureMaintenanceAccess } from "../infrastructure/maintenance-access.service.js";

export const signUpUser = async ({
  userName,
  password,
  email,
  firstName,
  lastName,
}) => {
  const maintenanceStatus = await ensureMaintenanceAccess(null);
  if (!maintenanceStatus.allowed) {
    return maintenanceStatus;
  }

  const normalizedUserName = userName.toLowerCase();
  const normalizedEmail = email.toLowerCase();

  const duplicate = await User.findOne({ userName: normalizedUserName });
  const duplicateEmail = await User.findOne({ email: normalizedEmail });

  const pendingUser =
    duplicate &&
    !duplicate.emailVerified &&
    duplicate.authProvider === "local" &&
    duplicate.email === normalizedEmail
      ? duplicate
      : duplicateEmail &&
          !duplicateEmail.emailVerified &&
          duplicateEmail.authProvider === "local"
        ? duplicateEmail
        : null;

  if (pendingUser) {
    const verification = await sendEmailVerificationForUser(pendingUser, "signup", {
      ignoreCooldown: false,
    });

    if (!verification.ok) {
      return {
        status: verification.status,
        body: {
          message: verification.message,
          resendAvailableAt: verification.resendAvailableAt,
        },
      };
    }

    return {
      status: 200,
      body: {
        ...verification.payload,
        message:
          "TÃƒÂ i khoÃ¡ÂºÂ£n cÃ¡Â»Â§a bÃ¡ÂºÂ¡n Ã„â€˜ang chÃ¡Â»Â xÃƒÂ¡c minh email. ChÃƒÂºng tÃƒÂ´i Ã„â€˜ÃƒÂ£ gÃ¡Â»Â­i lÃ¡ÂºÂ¡i mÃƒÂ£ xÃƒÂ¡c minh.",
      },
    };
  }

  if (duplicate) {
    return { status: 409, body: { message: "userName Ã„â€˜ÃƒÂ£ tÃ¡Â»â€œn tÃ¡ÂºÂ¡i" } };
  }

  if (duplicateEmail) {
    return { status: 409, body: { message: "Email Ã„â€˜ÃƒÂ£ tÃ¡Â»â€œn tÃ¡ÂºÂ¡i" } };
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    userName: normalizedUserName,
    hashedPassword,
    email: normalizedEmail,
    displayName: `${lastName} ${firstName}`,
    authProvider: "local",
    emailVerified: false,
  });

  emitAuthLifecycle(ADMIN_SOCKET_EVENTS.USER_NEW, user);

  const verification = await sendEmailVerificationForUser(user, "signup", {
    ignoreCooldown: true,
  });
  if (!verification.ok) {
    return {
      status: verification.status,
      body: {
        message: verification.message,
        resendAvailableAt: verification.resendAvailableAt,
      },
    };
  }

  return {
    status: 201,
    body: verification.payload,
  };
};
