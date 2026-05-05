import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import AuditLog from "../src/models/AuditLog.js";
import Blocking from "../src/models/Blocking.js";
import Conversation from "../src/models/Conversation.js";
import EmailChangeVerification from "../src/models/EmailChangeVerification.js";
import Friend from "../src/models/Friend.js";
import FriendRequest from "../src/models/FriendRequest.js";
import Message from "../src/models/Message.js";
import PasswordResetOtp from "../src/models/PasswordResetOtp.js";
import Report from "../src/models/Report.js";
import Session from "../src/models/Session.js";
import User from "../src/models/User.js";
import { APP_ROLES } from "../src/constants/rbac.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");

dotenv.config({ path: resolve(backendRoot, ".env.test") });

const TEST_DB_NAME = process.env.TEST_DB_NAME || "chat-test";
const TEST_EMAIL_DOMAIN = process.env.TEST_EMAIL_DOMAIN || "example.com";
const TEST_USER_PREFIX = process.env.TEST_USER_PREFIX || "testuser";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getMongoUri = () =>
  process.env.MONGO_URI || process.env.MONGODB_CONNECTIONSTRING;

const getDbNameFromUri = (uri) => {
  const parsed = new URL(uri);
  const dbName = parsed.pathname.replace(/^\//, "").trim();
  return dbName || null;
};

const assertSafeRuntime = (mongoUri) => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to cleanup test data with NODE_ENV=production.");
  }

  if (process.env.LOAD_TEST !== "true") {
    throw new Error("Refusing to cleanup test data unless LOAD_TEST=true.");
  }

  if (!mongoUri) {
    throw new Error("Missing MONGO_URI or MONGODB_CONNECTIONSTRING.");
  }

  const dbName = getDbNameFromUri(mongoUri);
  if (dbName !== TEST_DB_NAME) {
    throw new Error(
      `Refusing to cleanup database "${dbName || "(default)"}"; expected "${TEST_DB_NAME}".`,
    );
  }
};

const buildTestUserFilter = () => {
  const prefix = escapeRegExp(TEST_USER_PREFIX);
  const domain = escapeRegExp(TEST_EMAIL_DOMAIN);

  return {
    role: APP_ROLES.USER,
    userName: new RegExp(`^${prefix}\\d+$`),
    email: new RegExp(`^${prefix}\\d+@${domain}$`),
  };
};

const deleteAndCount = async (label, operation) => {
  const result = await operation();
  return [label, result.deletedCount ?? 0];
};

const main = async () => {
  const mongoUri = getMongoUri();
  assertSafeRuntime(mongoUri);

  await mongoose.connect(mongoUri);

  const testUsers = await User.find(buildTestUserFilter()).select("_id").lean();
  const userIds = testUsers.map((user) => user._id);

  if (userIds.length === 0) {
    console.log(`Cleanup completed: no test users found in db=${TEST_DB_NAME}`);
    return;
  }

  const testOnlyConversations = await Conversation.find({
    "participants.0": { $exists: true },
    "participants.userId": { $in: userIds },
    participants: { $not: { $elemMatch: { userId: { $nin: userIds } } } },
  })
    .select("_id")
    .lean();
  const testOnlyConversationIds = testOnlyConversations.map(
    (conversation) => conversation._id,
  );

  const cleanupResults = await Promise.all([
    deleteAndCount("sessions", () =>
      Session.deleteMany({ userId: { $in: userIds } }),
    ),
    deleteAndCount("passwordResetOtps", () =>
      PasswordResetOtp.deleteMany({ userId: { $in: userIds } }),
    ),
    deleteAndCount("emailChangeVerifications", () =>
      EmailChangeVerification.deleteMany({ userId: { $in: userIds } }),
    ),
    deleteAndCount("friendRequests", () =>
      FriendRequest.deleteMany({
        $or: [{ from: { $in: userIds } }, { to: { $in: userIds } }],
      }),
    ),
    deleteAndCount("friends", () =>
      Friend.deleteMany({
        $or: [{ userA: { $in: userIds } }, { userB: { $in: userIds } }],
      }),
    ),
    deleteAndCount("blocking", () =>
      Blocking.deleteMany({
        $or: [
          { userId: { $in: userIds } },
          { blockedUserId: { $in: userIds } },
        ],
      }),
    ),
    deleteAndCount("reports", () =>
      Report.deleteMany({
        $or: [
          { reporterId: { $in: userIds } },
          { targetUserId: { $in: userIds } },
          { reviewedByAdminId: { $in: userIds } },
        ],
      }),
    ),
    deleteAndCount("auditLogs", () =>
      AuditLog.deleteMany({
        $or: [
          { actorId: { $in: userIds } },
          { targetUserId: { $in: userIds } },
        ],
      }),
    ),
    deleteAndCount("messages", () =>
      Message.deleteMany({
        $or: [
          { senderId: { $in: userIds } },
          { conversationId: { $in: testOnlyConversationIds } },
        ],
      }),
    ),
    deleteAndCount("conversations", () =>
      Conversation.deleteMany({ _id: { $in: testOnlyConversationIds } }),
    ),
  ]);

  const userDeleteResult = await User.deleteMany({ _id: { $in: userIds } });
  cleanupResults.push(["users", userDeleteResult.deletedCount ?? 0]);

  const summary = Object.fromEntries(cleanupResults);
  console.log(
    `Cleanup completed: db=${TEST_DB_NAME}, matchedTestUsers=${userIds.length}, deleted=${JSON.stringify(summary)}`,
  );
};

main()
  .catch((error) => {
    console.error(`Cleanup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
