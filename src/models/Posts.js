const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Tham chiếu đến model User
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    images: { type: [String], default: [] }, 
    visibility: {
      type: String,
      enum: ["private", "friends", "public"], // private, friends, or public
      default: "public",
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Danh sách người like
      },
    ],
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment", // Danh sách comment (nếu có comment riêng)
      },
    ],
  },
  { timestamps: true } // Thêm thời gian tạo và cập nhật
);

module.exports = mongoose.model("Post", postSchema);
