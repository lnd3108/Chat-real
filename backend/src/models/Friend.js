import mongoose from "mongoose";

// Bản chất của mối quan hệ bạn bè là một tài liệu lưu trữ hai ObjectId của người dùng. 
// Để đảm bảo tính duy nhất của mối quan hệ bạn bè, 
// chúng ta sẽ sắp xếp các ObjectId theo thứ tự tăng dần trước khi lưu vào cơ sở dữ liệu. 
// Điều này giúp tránh việc lưu trữ hai tài liệu khác nhau cho cùng một cặp bạn bè (ví dụ: A-B và B-A).
const friendSchema = new mongoose.Schema(
  {
    userA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware để sắp xếp userA và userB trước khi lưu vào cơ sở dữ liệu
friendSchema.pre("save", function (next) {
  const a = this.userA.toString();
  const b = this.userB.toString();

  if (a > b) {
    this.userA = new mongoose.Types.ObjectId(b);
    this.userB = new mongoose.Types.ObjectId(a);
  }

  next();
});

// Tạo index duy nhất trên cặp userA và userB để đảm bảo không có mối quan hệ bạn bè nào bị trùng lặp
friendSchema.index({ userA: 1, userB: 1 }, { unique: true });
friendSchema.index({ userA: 1 });
friendSchema.index({ userB: 1 });
friendSchema.index({ createdAt: -1 });

// Tạo model Friend từ schema
const Friend = mongoose.model("Friend", friendSchema);

export default Friend;
