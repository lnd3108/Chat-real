import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_CONNECTIONSTRING);
    console.log("Liên Kết Dữ Liệu Thành Công!");
  } catch (error) {
    console.error("Lỗi Khi Kết nối CSDL:", error);
    process.exit(1);
  }
};
