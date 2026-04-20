import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import { v2 as cloudinary } from "cloudinary";
import { connectDB } from "./libs/db.js";
import authRoute from "./routes/authRoute.js";
import userRoute from "./routes/userRoute.js";
import friendRoute from "./routes/friendRoute.js";
import messageRoute from "./routes/messageRoute.js";
import conversationRoute from "./routes/conversationRoute.js";
import reportRoute from "./routes/reportRoute.js";
import supportRoute from "./routes/supportRoute.js";
import supportAdminRoute from "./routes/supportAdminRoute.js";
import adminRoute from "./routes/adminRoute.js";
import { protectedRoute } from "./middlewares/authMiddleware.js";
import { initSocket } from "./socket/index.js";
import { getMailConfigStatus } from "./utils/mail.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use("/api/auth", authRoute);

app.use(protectedRoute);
app.use("/api/users", userRoute);
app.use("/api/friends", friendRoute);
app.use("/api/messages", messageRoute);
app.use("/api/conversations", conversationRoute);
app.use("/api/reports", reportRoute);
app.use("/api/support", supportRoute);
app.use("/api/admin/support", supportAdminRoute);
app.use("/api/admin", adminRoute);

connectDB()
  .then(() => {
    initSocket(server);

    const mailStatus = getMailConfigStatus();
    if (mailStatus.ok) {
      console.log(`[SMTP] ${mailStatus.message}`);
    } else {
      console.warn(`[SMTP] ${mailStatus.message}`);
    }

    server.listen(PORT, () => {
      console.log(`Server bắt đầu trên cổng ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Connect DB failed:", err);
    process.exit(1);
  });
