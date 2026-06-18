import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import { v2 as cloudinary } from "cloudinary";
import swaggerUi from "swagger-ui-express";
import fs from "fs";

import { registerRoutes } from "./http/registerRoutes.js";
import { initSocket } from "./socket/initSocket.js";
import { maintenanceCheckMiddleware } from "../middlewares/maintenanceMiddleware.js";
import { enforceHttps } from "../middlewares/httpsMiddleware.js";
import { securityHeaders } from "../middlewares/securityHeaders.js";
import { buildCorsOptions } from "../config/cors.js";
import { validateProductionTransportConfig } from "../config/origin-config.js";
import { connectDB } from "../shared/infrastructure/db/connect-db.js";
import { connectRedis, disconnectRedis } from "../shared/infrastructure/redis/redis-client.js";
import { startPerfMonitor } from "../shared/infrastructure/perf/perf-monitor.js";
import { disconnectSocketRedisAdapter } from "../shared/infrastructure/realtime/socket-redis-adapter.js";
import { getMailConfigStatus } from "../utils/mail.js";
import { assertLoadTestIsNotProduction } from "../utils/loadTestGuard.js";

// lấy biến môi trường từ file .env
dotenv.config();
assertLoadTestIsNotProduction();
validateProductionTransportConfig();

export const createApp = () => {
  // tạo ứng dụng Express
  const app = express();

  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(enforceHttps);
  app.use(securityHeaders());

  // cấu hình middleware
  app.use(express.json());
  // cấu hình cookie parser và CORS
  app.use(cookieParser());
  // chỉ cho phép truy cập từ client URL được định nghĩa trong biến môi trường và cho phép gửi cookie
  app.use(cors(buildCorsOptions()));
  // Swagger
  const swaggerDocument = JSON.parse(
    fs.readFileSync(new URL("../swagger.json", import.meta.url), "utf8"),
  );
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use(maintenanceCheckMiddleware);

  // cấu hình Cloudinary với thông tin từ biến môi trường
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  // đăng ký các route
  registerRoutes(app);

  return app;
};

// hàm khởi động server
export const startServer = async () => {
  // tạo ứng dụng và server HTTP
  const app = createApp();
  // tạo server HTTP từ ứng dụng Express
  const server = http.createServer(app);
  // lấy cổng từ biến môi trường hoặc mặc định là 5001
  const port = process.env.PORT || 5001;

  // kết nối đến cơ sở dữ liệu
  await connectDB();
  await connectRedis();
  // khởi tạo Socket.IO
  await initSocket(server);

  // kiểm tra cấu hình email và in ra trạng thái
  const mailStatus = getMailConfigStatus();
  // nếu cấu hình email hợp lệ, in ra thông báo thành công, ngược lại in ra cảnh báo
  if (mailStatus.ok) {
    console.log(`[SMTP] ${mailStatus.message}`);
  } else {
    console.warn(`[SMTP] ${mailStatus.message}`);
  }

  // khởi động server và trả về app và server khi đã sẵn sàng
  let stopPerfMonitor = () => {};
  const shutdown = async (signal) => {
    console.log(`[Shutdown] Received ${signal}`);
    stopPerfMonitor();
    server.close(async () => {
      await Promise.allSettled([
        disconnectSocketRedisAdapter(),
        disconnectRedis(),
      ]);
      process.exit(0);
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Server bắt đầu chạy trên cổng ${port}`);
      stopPerfMonitor = startPerfMonitor();
      resolve({ app, server });
    });
  });
};
