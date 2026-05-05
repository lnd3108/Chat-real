import bcrypt from "bcrypt";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import User from "../src/models/User.js";
import { APP_ROLES } from "../src/constants/rbac.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");

dotenv.config({ path: resolve(backendRoot, ".env.test") });

const DEFAULT_COUNT = 1000;
const DEFAULT_PASSWORD = "Test@123456";
const TEST_DB_NAME = process.env.TEST_DB_NAME || "chat-test";
const TEST_EMAIL_DOMAIN = process.env.TEST_EMAIL_DOMAIN || "example.com";
const TEST_USER_PREFIX = process.env.TEST_USER_PREFIX || "testuser";

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getMongoUri = () =>
  process.env.MONGO_URI || process.env.MONGODB_CONNECTIONSTRING;

const getDbNameFromUri = (uri) => {
  const parsed = new URL(uri);
  const dbName = parsed.pathname.replace(/^\//, "").trim();
  return dbName || null;
};

const assertSafeRuntime = (mongoUri) => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed test users with NODE_ENV=production.");
  }

  if (process.env.LOAD_TEST !== "true") {
    throw new Error("Refusing to seed test users unless LOAD_TEST=true.");
  }

  if (!mongoUri) {
    throw new Error("Missing MONGO_URI or MONGODB_CONNECTIONSTRING.");
  }

  const dbName = getDbNameFromUri(mongoUri);
  if (dbName !== TEST_DB_NAME) {
    throw new Error(
      `Refusing to seed database "${dbName || "(default)"}"; expected "${TEST_DB_NAME}".`,
    );
  }
};

const buildUser = ({ index, hashedPassword }) => {
  const userName = `${TEST_USER_PREFIX}${index}`;
  const email = `${userName}@${TEST_EMAIL_DOMAIN}`;

  return {
    userName,
    email,
    hashedPassword,
    authProvider: "local",
    emailVerified: true,
    displayName: `Test User ${index}`,
    role: APP_ROLES.USER,
    roles: [],
    permissions: [],
    status: "active",
    isSystemAccount: false,
    preferences: {
      theme: "system",
      showOnlineStatus: true,
    },
  };
};

const main = async () => {
  const mongoUri = getMongoUri();
  assertSafeRuntime(mongoUri);

  const count = parsePositiveInt(process.env.TEST_USER_COUNT, DEFAULT_COUNT);
  const password = process.env.TEST_USER_PASSWORD || DEFAULT_PASSWORD;
  const hashedPassword = await bcrypt.hash(password, 12);

  await mongoose.connect(mongoUri);

  const candidates = Array.from({ length: count }, (_, itemIndex) =>
    buildUser({ index: itemIndex + 1, hashedPassword }),
  );

  const userNames = candidates.map((user) => user.userName);
  const emails = candidates.map((user) => user.email);
  const existingUsers = await User.find({
    $or: [{ userName: { $in: userNames } }, { email: { $in: emails } }],
  })
    .select("userName email")
    .lean();

  const existingKeys = new Set(
    existingUsers.flatMap((user) => [user.userName, user.email]),
  );
  const usersToInsert = candidates.filter(
    (user) => !existingKeys.has(user.userName) && !existingKeys.has(user.email),
  );

  if (usersToInsert.length > 0) {
    await User.insertMany(usersToInsert, { ordered: false });
  }

  console.log(
    `Seed completed: requested=${count}, inserted=${usersToInsert.length}, existing=${existingUsers.length}, db=${TEST_DB_NAME}`,
  );
};

main()
  .catch((error) => {
    console.error(`Seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
