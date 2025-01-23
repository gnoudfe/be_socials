const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String, // Nội dung comment (ký tự, emoji, v.v.)
    },
    image: {
      type: String, // URL hình ảnh (nếu có)
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment", // Nếu là trả lời cho comment khác
    },
    replies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment", // Danh sách các comment trả lời
      },
    ],
  },
  { timestamps: true }
);

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;
