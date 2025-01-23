const Post = require("../models/Posts");
const Comment = require("../models/Comment");
const Notification = require("../models/Notifications");
const User = require("../models/Users");
const createComment = async (req, res) => {
  try {
    const userId = req.user.userId; // Lấy ID người dùng từ middleware xác thực
    const { postId, text, parentCommentId } = req.body; // Dữ liệu từ client
    const file = req.file; // Hình ảnh nếu có

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Tìm bài viết để thêm comment
    const post = await Post.findById(postId).populate("user");
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    // Nếu là trả lời comment, kiểm tra comment cha có tồn tại
    let parentComment = null;
    if (parentCommentId) {
      parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({ message: "Parent comment not found." });
      }
    }

    // Tải hình ảnh lên Cloudinary (nếu có)
    let imageUrl = null;
    if (file) {
      await cloudinary.uploader
        .upload_stream(
          {
            folder: "social-media-comments",
            resource_type: "auto",
          },
          (error, result) => {
            if (error) throw error;
            imageUrl = result.secure_url;
          }
        )
        .end(file.buffer);
    }

    // Tạo comment mới
    const newComment = new Comment({
      post: postId,
      user: userId,
      text,
      image: imageUrl,
      parentComment: parentCommentId || null,
    });

    // Lưu comment
    await newComment.save();

    // Nếu là trả lời, thêm vào danh sách replies của comment cha
    if (parentComment) {
      parentComment.replies.push(newComment._id);
      await parentComment.save();
    }

    // Thêm comment vào bài viết
    post.comments.push(newComment._id);
    await post.save();

    // Gửi thông báo cho chủ bài viết
    if (userId.toString() !== post.user._id.toString()) {
      const notification = new Notification({
        type: "commented",
        message: `${user.username} commented on your post.`,
        recipient: post.user._id,
        sender: userId,
      });
      await notification.save();

      //   // Gửi thông báo real-time qua Pusher
      //   const senderDetails = {
      //     username: req.user.username,
      //     avatar: req.user.avatar,
      //     isRead: false,
      //   };
      //   Pusher.trigger(`user-${post.user._id}`, "post-commented", {
      //     message: `${req.user.username} commented on your post.`,
      //     sender: senderDetails,
      //   });
    }

    res.status(201).json({
      status: "success",
      message: "Comment added successfully.",
      comment: newComment,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getComments = async (req, res) => {
  try {
    const { postId } = req.params;

    // Kiểm tra bài viết
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    // Lấy các comment cấp 1
    const comments = await Comment.find({ post: postId, parentComment: null })
      .populate({
        path: "user",
        select: "username avatar",
      })
      .populate({
        path: "replies",
        populate: [
          {
            path: "user",
            select: "username avatar",
          },
          {
            path: "replies", // Lấy replies cấp tiếp theo
            populate: { path: "user", select: "username avatar" },
          },
        ],
      })
      .sort([["createdAt", "desc"]]); // Sắp xếp comment mới nhất ở trên

    res.status(200).json({
      status: "success",
      comments,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found." });
    }

    // Kiểm tra quyền xóa (chỉ chủ sở hữu comment hoặc bài viết)
    const post = await Post.findById(comment.post);
    if (comment.user.toString() !== userId && post.user.toString() !== userId) {
      return res.status(403).json({
        message: "You do not have permission to delete this comment.",
      });
    }

    // Nếu là comment cha, xóa cả các reply liên quan
    if (comment.replies.length > 0) {
      await Comment.deleteMany({ _id: { $in: comment.replies } });
    }

    // Xóa comment và cập nhật bài viết
    await Comment.findByIdAndDelete(commentId);
    post.comments = post.comments.filter(
      (id) => id.toString() !== commentId.toString()
    );
    await post.save();

    res.status(200).json({ message: "Comment deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createComment,
  getComments,
  deleteComment,
};
