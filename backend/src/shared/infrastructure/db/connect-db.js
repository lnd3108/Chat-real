import mongoose from "mongoose";
import {
  attachMongoDriverMonitoring,
  isMongoCommandMonitorEnabled,
} from "../perf/mongo-driver-monitor.js";

const parseMongoOption = (name) => {
  const rawValue = process.env[name];
  if (!rawValue) {
    return undefined;
  }

  const value = Number(rawValue);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
};

const buildMongoOptions = () => {
  const options = {
    maxPoolSize: parseMongoOption("MONGO_MAX_POOL_SIZE"),
    minPoolSize: parseMongoOption("MONGO_MIN_POOL_SIZE"),
    serverSelectionTimeoutMS: parseMongoOption(
      "MONGO_SERVER_SELECTION_TIMEOUT_MS",
    ),
    socketTimeoutMS: parseMongoOption("MONGO_SOCKET_TIMEOUT_MS"),
    monitorCommands: isMongoCommandMonitorEnabled() ? true : undefined,
  };

  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  );
};

export const connectDB = async () => {
  try {
    const mongoOptions = buildMongoOptions();
    await mongoose.connect(process.env.MONGODB_CONNECTIONSTRING, mongoOptions);
    attachMongoDriverMonitoring(mongoose.connection.getClient());
    console.log("[MongoDB] Pool config:", {
      maxPoolSize: mongoOptions.maxPoolSize ?? "default",
      minPoolSize: mongoOptions.minPoolSize ?? "default",
      serverSelectionTimeoutMS:
        mongoOptions.serverSelectionTimeoutMS ?? "default",
      socketTimeoutMS: mongoOptions.socketTimeoutMS ?? "default",
      monitorCommands: mongoOptions.monitorCommands ?? false,
    });
    console.log("Liên kết dữ liệu thành công!");
  } catch (error) {
    console.error("Lỗi khi kết nối CSDL:", error);
    process.exit(1);
  }
};
