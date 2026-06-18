import dotenv from "dotenv";
import mongoose from "mongoose";

import "../src/models/User.js";
import "../src/models/Conversation.js";
import "../src/models/Message.js";
import "../src/models/Friend.js";
import "../src/models/FriendRequest.js";
import "../src/models/Report.js";
import "../src/models/Session.js";
import "../src/models/Blocking.js";

dotenv.config();

const COLLECTIONS = [
  "users",
  "conversations",
  "messages",
  "friends",
  "friendrequests",
  "reports",
  "sessions",
  "blockings",
];

const main = async () => {
  const uri = process.env.MONGODB_CONNECTIONSTRING;
  if (!uri) {
    console.error("[IndexAudit] Missing MONGODB_CONNECTIONSTRING");
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  for (const collectionName of COLLECTIONS) {
    const collection = mongoose.connection.db.collection(collectionName);
    const indexes = await collection.indexes();
    console.log(`[IndexAudit] ${collectionName}`);
    indexes.forEach((index) => {
      console.log(
        JSON.stringify({
          name: index.name,
          key: index.key,
          unique: index.unique === true,
          expireAfterSeconds: index.expireAfterSeconds,
        }),
      );
    });
  }
};

main()
  .catch((error) => {
    console.error("[IndexAudit] Failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
