import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./libs/db.js";
import authRoute from "./routes/authRoute.js";
import userRoute from "./routes/userRoute.js";
import friendRoute from "./routes/friendRoute.js";
import messageRoute from "./routes/messageRoute.js";
import conversationRoute from "./routes/conversationRoute.js";
import cookieParser from "cookie-parser";
import { protectedRoute } from "./middlewares/authMiddleware.js";
import cors from "cors";
import http from "http";
import { initSocket } from "./socket/index.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

// Public routes
app.use(`/api/auth`, authRoute);

// Private routes
app.use(protectedRoute);
app.use("/api/users", userRoute);
app.use("/api/friends", friendRoute);
app.use("/api/messages", messageRoute);
app.use("/api/conversations", conversationRoute);

// Start
connectDB()
  .then(() => {
    initSocket(server); //attach socket.io vào HTTP server

    server.listen(PORT, () => {
      console.log(`Server bắt đầu trên cổng ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Connect DB failed:", err);
    process.exit(1);
  });
