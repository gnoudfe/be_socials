const express = require("express");
const upload = require("../middlewares/multer");
const router = express.Router();
const authenticatedUser = require("../middlewares/authenticatedUser");
const { createComment, getComments, deleteComment } = require("../controllers/commentController");

// Tạo comment
router.post("/comment", authenticatedUser, upload.single("image"), createComment);

// Lấy tất cả comment của bài viết
router.get("/comment/:postId", authenticatedUser, getComments);

// Xóa comment
router.delete("/comment/:commentId", authenticatedUser, deleteComment);

module.exports = router;
