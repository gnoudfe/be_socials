const mongoose = require("mongoose");

const storySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Tham chiếu đến bảng User (người đăng câu chuyện)
      required: true,
    },
    images: [
      {
        type: String, // URL của các hình ảnh
        required: true,
      },
    ],
    music: {
      type: String, // URL của nhạc (nếu có)
      default: null,
    },
    visibility: {
      type: String,
      enum: ["private", "friends", "public"], // Quyền truy cập: private, friends, hoặc public
      required: true,
    },
    expiresAt: {
      type: Date, // Thời gian hết hạn của câu chuyện
      required: true,
    },
    views: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Người đã xem câu chuyện
      },
    ],
  },
  { timestamps: true } // Tự động thêm các trường createdAt và updatedAt
);

const Story = mongoose.model("Story", storySchema);

module.exports = Story;
