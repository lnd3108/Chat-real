import mongoose from "mongoose";
import "dotenv/config";

const uri = process.env.MONGODB_CONNECTIONSTRING || process.env.MONGODB_URI;

await mongoose.connect(uri);

const db = mongoose.connection.db;

const user = await db.collection("users").findOne({ userName: "vanh" });

if (!user) {
  console.log("User vanh not found");
  process.exit(0);
}

console.log("userId =", user._id);

const collections = await db.listCollections().toArray();
const names = collections.map(c => c.name).filter(name =>
  /session/i.test(name)
);

console.log("session-like collections =", names);

for (const name of names) {
  const total = await db.collection(name).countDocuments();

  const byUserObjectId = await db.collection(name).countDocuments({
    userId: user._id,
  });

  const byUserString = await db.collection(name).countDocuments({
    userId: String(user._id),
  });

  const indexes = await db.collection(name).indexes();

  console.log(JSON.stringify({
    collection: name,
    total,
    byUserObjectId,
    byUserString,
    indexes,
  }, null, 2));
}

await mongoose.disconnect();
