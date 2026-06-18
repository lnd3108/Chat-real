import mongoose from "mongoose";
import "dotenv/config";

const uri = process.env.MONGODB_CONNECTIONSTRING || process.env.MONGODB_URI;

await mongoose.connect(uri);

const db = mongoose.connection.db;

console.log("users indexes:");
console.log(JSON.stringify(await db.collection("users").indexes(), null, 2));

console.log("explain userName query:");
const explain = await db.collection("users")
  .find({ userName: "vanh" })
  .explain("executionStats");

console.log(JSON.stringify({
  winningPlan: explain.queryPlanner.winningPlan,
  executionStats: {
    nReturned: explain.executionStats.nReturned,
    totalKeysExamined: explain.executionStats.totalKeysExamined,
    totalDocsExamined: explain.executionStats.totalDocsExamined,
    executionTimeMillis: explain.executionStats.executionTimeMillis,
  },
}, null, 2));

await mongoose.disconnect();
