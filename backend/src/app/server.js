import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import { v2 as cloudinary } from "cloudinary";

import { registerRoutes } from "./http/registerRoutes.js";
import { initSocket } from "./socket/initSocket.js";
import { maintenanceCheckMiddleware } from "../middlewares/maintenanceMiddleware.js";
import { connectDB } from "../shared/infrastructure/db/connect-db.js";
import { getMailConfigStatus } from "../utils/mail.js";

dotenv.config();

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
  app.use(maintenanceCheckMiddleware);

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  registerRoutes(app);

  return app;
};

export const startServer = async () => {
  const app = createApp();
  const server = http.createServer(app);
  const port = process.env.PORT || 5001;

  await connectDB();
  initSocket(server);

  const mailStatus = getMailConfigStatus();
  if (mailStatus.ok) {
    console.log(`[SMTP] ${mailStatus.message}`);
  } else {
    console.warn(`[SMTP] ${mailStatus.message}`);
  }

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Server bắt đầu chạy trên cổng ${port}`);
      resolve({ app, server });
    });
  });
};
