const express = require("express");
const upload = require("../middlewares/multer");
const {
  registerUser,
  verifyEmail,
  LoginUser,
  logoutUser,
  getUserInfo,
  changePassword,
  forgotPassword,
  getNotifications,
  updateProfilePicture,
  updateCoverPhoto,
  updateBio,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriendUser,
  getUserFriends,
  searchUsers,
} = require("../controllers/userControllers");
const authenticatedUser = require("../middlewares/authenticatedUser");

const router = express.Router();

// Đăng ký tài khoản người dùng mới
router.post("/register", registerUser);

// Đăng nhập người dùng
router.post("/login", LoginUser);

// Xác minh email (thông qua mã xác minh)
router.get("/verify-email", verifyEmail);

// Lấy thông tin chi tiết của một người dùng cụ thể (dựa trên userId)
router.get("/user/:userId", authenticatedUser, getUserInfo);

// Lấy thông tin chi tiết của chính người dùng đã đăng nhập
router.get("/user-me", authenticatedUser, getUserInfo);

// Đăng xuất người dùng
router.post("/logout", authenticatedUser, logoutUser);

// Yêu cầu reset mật khẩu (quên mật khẩu)
router.post("/forgot-password", forgotPassword);

// Đổi mật khẩu (yêu cầu người dùng phải đăng nhập)
router.post("/change-password", authenticatedUser, changePassword);

// Cập nhật ảnh đại diện (profile picture)
router.put(
  "/profile-picture",
  authenticatedUser, // Middleware kiểm tra xem người dùng đã đăng nhập chưa
  upload.single("profilePicture"), // Middleware xử lý upload file
  updateProfilePicture
);

// Cập nhật ảnh bìa (cover photo)
router.put(
  "/cover-photo",
  authenticatedUser, // Middleware kiểm tra xem người dùng đã đăng nhập chưa
  upload.single("coverPhoto"), // Middleware xử lý upload file
  updateCoverPhoto
);

// Cập nhật thông tin giới thiệu (bio)
router.put("/bio", authenticatedUser, updateBio);

// Gửi lời mời kết bạn tới một người dùng khác
router.post(
  "/send-friend-request/:userId",
  authenticatedUser,
  sendFriendRequest
);

// Chấp nhận lời mời kết bạn từ một người dùng khác
router.post(
  "/accept-friend-request/:userId",
  authenticatedUser,
  acceptFriendRequest
);

// Từ chối lời mời kết bạn từ một người dùng khác
router.post(
  "/reject-friend-request/:userId",
  authenticatedUser,
  rejectFriendRequest
);

router.delete("/unfriend/:userId", authenticatedUser, unfriendUser);

// Lấy danh sách thông báo của người dùng đã đăng nhập
router.get("/get-notifications", authenticatedUser, getNotifications);

// Lấy danh sách bạn bè của user
router.get("/get-friends", authenticatedUser, getUserFriends);

// Tìm kiếm người dùng
router.get("/search-users", authenticatedUser, searchUsers);

module.exports = router;
