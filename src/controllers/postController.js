const Post = require("../models/Posts");
const User = require("../models/Users");
const Pusher = require("../config/pusher");
const Notification = require("../models/Notifications");

const cloudinary = require("../config/cloudinary.config");
const createPost = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { content, visibility } = req.body;
    const files = req.files; // Handle multiple files from multer
    const images = [];

    // Kiểm tra nếu không có file được tải lên
    if (!files || files.length === 0) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    // Kiểm tra định dạng file (chỉ chấp nhận jpg, png, gif, webp)
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    for (let file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({
          status: "false",
          message:
            "Invalid file format. Only jpg, png, gif, and webp are allowed.",
        });
      }

      // Kiểm tra kích thước file (không quá 5MB)
      const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSizeInBytes) {
        return res.status(400).json({
          status: "false",
          message: "File size exceeds 5MB.",
        });
      }
    }

    if (!content) {
      return res.status(400).json({
        message: "Post content must not be empty.",
      });
    }
    if (!visibility) {
      return res.status(400).json({
        message: "Visibility must be 'private', 'friends', or 'public'.",
      });
    }

    // Sử dụng Promise.all để đợi tất cả ảnh tải lên Cloudinary hoàn tất
    const uploadPromises = files.map((file) => {
      return new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: "social-media-posts", // Thư mục lưu ảnh trên Cloudinary
              resource_type: "auto", // Tự động nhận dạng kiểu file
            },
            (error, result) => {
              if (error) {
                reject(error);
              }
              // Nếu upload thành công, thêm URL ảnh vào mảng images
              images.push(result.secure_url);
              resolve(result.secure_url);
            }
          )
          .end(file.buffer); // Đọc file ảnh từ bộ nhớ và upload lên Cloudinary
      });
    });

    // Đợi tất cả ảnh được upload xong
    await Promise.all(uploadPromises);

    // Tạo bài viết mới với thông tin ảnh và nội dung
    const post = new Post({
      user: userId,
      content,
      images, // Lưu URL ảnh vào cơ sở dữ liệu
      visibility,
    });

    await post.save();

    // Populate user info before sending back
    await post.populate("user", "_id username profilePicture"); // chỉ populate các field cần thiết

    res.status(201).json({
      status: "success",
      message: "Post created successfully.",
      post,
    });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ message: error.message });
  }
};

const getAllPosts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    // Lấy thông tin người dùng
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Điều kiện truy vấn
    const queryCondition = {
      $or: [
        { visibility: "Public" },
        { visibility: "Friends", user: { $in: [userId, ...user.friends] } },
        { visibility: "Private", user: userId },
      ],
    };

    // Tổng số bài viết phù hợp
    const totalPosts = await Post.countDocuments(queryCondition);

    // Truy vấn bài viết với phân trang
    const posts = await Post.find(queryCondition)
      .populate("user", "_id username profilePicture")
      .populate("likes", "_id username profilePicture")
      .populate("comments")
      .sort({ createdAt: -1 }) // mới nhất trước
      .skip(offset)
      .limit(limit);

    res.status(200).json({
      status: "success",
      currentUserId: userId,
      totals: totalPosts,
      posts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get posts of the logged-in user
const getUserPosts = async (req, res) => {
  try {
    const userId = req.user.userId;

    const posts = await Post.find({ user: userId })
      .populate("user", " username profilePicture")
      .populate("likes", " username profilePicture")
      .populate("comments")
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      posts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOtherUserPosts = async (req, res) => {
  try {
    const userId = req.user.userId; // Người đăng nhập hiện tại
    const otherUserId = req.params.userId; // Trang cá nhân đang xem

    const [user, otherUser] = await Promise.all([
      User.findById(userId),
      User.findById(otherUserId),
    ]);

    if (!user || !otherUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const isCurrentUser = userId === otherUserId;

    let posts;

    if (isCurrentUser) {
      // Trả tất cả post nếu là trang cá nhân của mình
      posts = await Post.find({ user: otherUserId })
        .populate("user", "_id username profilePicture")
        .populate("likes", "_id username profilePicture")
        .populate("comments")
        .sort({ createdAt: -1 });
    } else {
      const isFriend = otherUser.friends.includes(userId);

      const visibilityConditions = [{ visibility: "Public" }];
      if (isFriend) {
        visibilityConditions.push({ visibility: "Friends" });
      }

      posts = await Post.find({
        user: otherUserId,
        $or: visibilityConditions,
      })
        .populate("user", "_id username profilePicture")
        .populate("likes", "_id username profilePicture")
        .populate("comments")
        .sort({ createdAt: -1 });
    }

    return res.status(200).json({
      status: "success",
      isCurrentUser,
      posts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPostDetail = async (req, res) => {
  try {
    const userId = req.user.userId;
    const postId = req.params.postId;

    const post = await Post.findById(postId)
      .populate("user", "_id username profilePicture")
      .populate("likes", "_id username profilePicture")
      .populate("comments");

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json({
      status: "success",
      currentUserId: userId,
      post,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePost = async (req, res) => {
  try {
    const userId = req.user.userId; // Lấy ID người dùng từ token
    const { postId } = req.params; // Lấy ID bài viết từ URL

    // Tìm bài viết trước khi xóa để lấy thông tin ảnh
    const post = await Post.findOne({ _id: postId, user: userId });

    if (!post) {
      return res
        .status(404)
        .json({ message: "Post not found or not authorized" });
    }

    // Xóa các ảnh trên Cloudinary nếu có
    if (post.images && post.images.length > 0) {
      const deletePromises = post.images.map((imageUrl) => {
        if (imageUrl.includes("cloudinary")) {
          // Lấy public_id từ URL Cloudinary
          const publicId = imageUrl.split("/").pop().split(".")[0];
          return cloudinary.uploader.destroy("social-media-posts/" + publicId);
        }
        return Promise.resolve();
      });

      await Promise.all(deletePromises);
    }

    // Xóa bài viết
    await Post.findByIdAndDelete(postId);

    res.status(200).json({
      status: "success",
      message: "Post deleted successfully",
      postId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePost = async (req, res) => {
  try {
    const userId = req.user.userId; // ID của người dùng từ token
    const { postId } = req.params; // ID bài viết từ URL
    const { content, visibility } = req.body; // Dữ liệu text
    const files = req.files; // File upload (nếu có)

    const allowedVisibilities = ["private", "friends", "public"];
    if (visibility && !allowedVisibilities.includes(visibility)) {
      return res.status(400).json({ message: "Invalid visibility value" });
    }

    // Tìm bài viết
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Kiểm tra quyền sở hữu bài viết
    if (post.user.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "You are not allowed to update this post" });
    }

    // Cập nhật nội dung nếu có
    if (content) post.content = content;
    if (visibility) post.visibility = visibility;

    // Nếu có file upload, cập nhật ảnh
    if (files && files.length > 0) {
      // Xóa ảnh cũ trên Cloudinary trước khi cập nhật ảnh mới
      if (post.images && post.images.length > 0) {
        const deletePromises = post.images.map((imageUrl) => {
          if (imageUrl.includes("cloudinary")) {
            // Lấy public_id từ URL Cloudinary
            const publicId = imageUrl.split("/").pop().split(".")[0];
            return cloudinary.uploader.destroy(
              "social-media-posts/" + publicId
            );
          }
          return Promise.resolve();
        });

        await Promise.all(deletePromises);
      }

      const images = []; // Lưu URL ảnh mới
      const uploadPromises = files.map(
        (file) =>
          new Promise((resolve, reject) => {
            cloudinary.uploader
              .upload_stream(
                {
                  folder: "social-media-posts",
                  resource_type: "auto",
                },
                (error, result) => {
                  if (error) reject(error);
                  resolve(result.secure_url);
                }
              )
              .end(file.buffer); // Upload từ bộ nhớ
          })
      );

      // Đợi tất cả ảnh tải lên hoàn tất
      const uploadedImages = await Promise.all(uploadPromises);
      post.images = uploadedImages; // Cập nhật ảnh mới
    }

    await post.save();

    res.status(200).json({
      status: "success",
      message: "Post updated successfully",
      post,
    });
  } catch (error) {
    console.error("Error updating post:", error); // Log lỗi
    res.status(500).json({ message: error.message });
  }
};

const likePost = async (req, res) => {
  try {
    const userId = req.user.userId; // ID người thực hiện
    const { postId } = req.params;

    const user = await User.findById(userId);

    const post = await Post.findById(postId).populate(
      "user",
      "username avatar"
    );

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
    } else {
      post.likes.push(userId);

      // Tạo thông báo nếu bài viết không thuộc về chính người dùng
      if (post.user._id.toString() !== userId) {
        const notification = new Notification({
          type: "post-liked",
          message: `${user.username} liked your post.`,
          recipient: post.user._id, // Người nhận là chủ bài viết
          sender: userId, // Người gửi là người thực hiện
        });

        await notification.save();

        // // Gửi thông báo qua Pusher
        // Pusher.trigger(`user-${post.user._id}`, "notification", {
        //   id: notification._id,
        //   type: notification.type,
        //   message: notification.message,
        //   sender: {
        //     id: userId,
        //     username: req.user.username,
        //     avatar: req.user.avatar,
        //   },
        //   isRead: notification.isRead,
        //   createdAt: notification.createdAt,
        // });
      }
    }

    await post.save();

    res.status(200).json({
      status: "success",
      message: alreadyLiked ? "Unliked the post" : "Liked the post",
      likesCount: post.likes.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createPost,
  getAllPosts,
  getUserPosts,
  getOtherUserPosts,
  deletePost,
  updatePost,
  likePost,
  getPostDetail,
};
