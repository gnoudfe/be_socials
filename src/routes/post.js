const express = require("express");
const router = express.Router();
const upload = require("../middlewares/multer");
const authenticatedUser = require("../middlewares/authenticatedUser");
const {
  createPost,
  getUserPosts,
  getAllPosts,
  getOtherUserPosts,
  deletePost,
  updatePost,
  likePost,
  getPostDetail,
} = require("../controllers/postController");

// ✅ API tạo bài viết (tối đa 5 ảnh)
router.post(
  "/create-post",
  authenticatedUser,
  upload.array("images", 5),
  createPost
);

// ✅ API lấy bài viết của chính người dùng (Trang Cá Nhân Của Bạn)
router.get("/posts/my-posts", authenticatedUser, getUserPosts);

// ✅ API lấy bài viết của người dùng khác (Trang Cá Nhân Người Khác)
router.get("/posts/user/:userId", authenticatedUser, getOtherUserPosts);

// ✅ API lấy tất cả bài viết của mọi người (Trang Home)
router.get("/posts-feed", authenticatedUser, getAllPosts);

// ✅ API lấy chi tiết bài viết
router.get("/posts/:postId", authenticatedUser, getPostDetail);

// ✅ API cập nhật bài viết (tối đa 5 ảnh)
router.put(
  "/posts/:postId",
  authenticatedUser,
  upload.array("images", 5),
  updatePost
);

// ✅ API xóa bài viết
router.delete("/posts/:postId", authenticatedUser, deletePost);

// ✅ API like hoặc bỏ like bài viết
router.put("/posts/:postId/like", authenticatedUser, likePost);

module.exports = router;
