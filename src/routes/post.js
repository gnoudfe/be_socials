const express = require("express");
const authenticatedUser = require("../middlewares/authenticatedUser");
const router = express.Router();
const {
  createPost,
  getUserPosts,
  getAllPosts,
  getOtherUserPosts,
  deletePost,
  updatePost,
  likePost
} = require("../controllers/postController");
const upload = require("../middlewares/multer");


// API tạo bài viết
router.post(
  "/create-post",
  authenticatedUser,
  upload.array("images", 10),
  createPost
); // Tối đa 10 ảnh

// API để lấy tất cả bài viết của mọi người (Trang Home)
router.get("/posts", authenticatedUser, getAllPosts);

// Xóa bài viết
router.delete("/posts/:postId", authenticatedUser, deletePost);

// Route cập nhật bài viết
router.put(
  "/posts/:postId",
  authenticatedUser,
  upload.array("images", 5), // Tối đa 5 file
  updatePost
);

// API để lấy bài viết của người khác (Trang Cá Nhân Của Người Khác)
router.get("/posts/user/:userId", authenticatedUser, getOtherUserPosts);

// API để lấy bài viết của chính người dùng (Trang Cá Nhân Của Bạn)
router.get("/posts/my-posts", authenticatedUser, getUserPosts);

// Like hoặc bỏ like bài viết
router.put("/posts/:postId/like", authenticatedUser, likePost);

module.exports = router;
