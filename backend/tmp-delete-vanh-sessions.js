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

const result = await db.collection("sessions").deleteMany({
  userId: user._id,
});

console.log({
  userName: user.userName,
  userId: user._id,
  deletedSessions: result.deletedCount,
});

await mongoose.disconnect();
