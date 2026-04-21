import "dotenv/config";
import mongoose from "mongoose";

import { APP_ROLES } from "../src/constants/rbac.js";
import { connectDB } from "../src/libs/db.js";
import User from "../src/models/User.js";
import { normalizeRole } from "../src/services/rbacService.js";

const SYSTEM_ACCOUNT_USERNAMES = new Set([
  "admin",
  "super_admin",
  "superadmin",
  "system",
]);

const resolveCanonicalRole = (user) => {
  if (user?.isSuperAdmin === true) {
    return APP_ROLES.SUPER_ADMIN;
  }

  if (user?.isAdmin === true) {
    return APP_ROLES.ADMIN;
  }

  if (user?.isModerator === true) {
    return APP_ROLES.MODERATOR;
  }

  if (user?.isSupport === true) {
    return APP_ROLES.SUPPORT;
  }

  if (
    SYSTEM_ACCOUNT_USERNAMES.has(
      String(user?.userName ?? "")
        .trim()
        .toLowerCase(),
    )
  ) {
    return APP_ROLES.SUPER_ADMIN;
  }

  return normalizeRole(user);
};

const run = async () => {
  await connectDB();

  const users = await User.find({}).select(
    "_id userName email role roles isAdmin isSupport isModerator isSuperAdmin",
  );

  let updatedCount = 0;
  let invalidCount = 0;

  for (const user of users) {
    const nextRole = resolveCanonicalRole(user.toObject());
    const currentRole = String(user.role ?? "")
      .trim()
      .toUpperCase();
    const legacyRoles = Array.isArray(user.roles) ? user.roles : [];
    const needsUpdate =
      currentRole !== nextRole ||
      legacyRoles.length !== 1 ||
      legacyRoles[0] !== nextRole;

    if (!Object.values(APP_ROLES).includes(nextRole)) {
      invalidCount += 1;
      console.warn(
        `[SKIP] user=${user._id} userName=${user.userName} role không hợp lệ`,
      );
      continue;
    }

    if (!needsUpdate) {
      continue;
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          role: nextRole,
          roles: [nextRole],
        },
      },
    );

    updatedCount += 1;
    console.log(`[UPDATED] ${user.userName} -> ${nextRole}`);
  }

  console.log(
    `Hoàn tất migrate role. Updated=${updatedCount}, Invalid=${invalidCount}`,
  );
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Migrate role thất bại:", error);
  await mongoose.disconnect();
  process.exit(1);
});
