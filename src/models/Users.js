const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: "" }, // Ảnh đại diện
    coverPhoto: { type: String, default: "" }, // Ảnh bìa
    bio: { type: String, default: "" },
    dateOfBirth: { type: Date, default: null },
    friends: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Tham chiếu đến chính bảng User để tạo danh sách bạn bè
    }],
    friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Lời mời kết bạn đang chờ
    sentFriendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],  // Danh sách đã gửi lời mời kết bạn
    gender: {
      type: String,
      default: "Other",
    }, // Giới tính
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    refreshToken: { type: String },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = User;
