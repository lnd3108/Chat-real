import { startServer } from "./app/server.js";

startServer().catch((error) => {
  console.error("Connect DB failed:", error);
  process.exit(1);
});
