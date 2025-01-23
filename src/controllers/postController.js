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

      // Kiểm tra kích thước file (không quá 2MB)
      const maxSizeInBytes = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSizeInBytes) {
        return res.status(400).json({
          status: "false",
          message: "File size exceeds 2MB.",
        });
      }
    }

    if (!content) {
      return res.status(400).json({
        message: "Post content must not be empty.",
      });
    }
    if (!visibility || !["private", "friends", "public"].includes(visibility)) {
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

    // Lấy thông tin người dùng từ database (để lấy danh sách bạn bè)
    const user = await User.findById(userId); // Lấy thông tin người dùng hiện tại

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Truy vấn các bài viết
    const posts = await Post.find({
      $or: [
        { visibility: "public" },
        { visibility: "friends", user: { $in: [userId, ...user.friends] } }, // Lấy bài viết của bạn bè
        { visibility: "private", user: userId }, // Lấy bài viết của chính mình
      ],
    })
      // .populate("user", "username avatar") // Populate thông tin người dùng
      // .populate("likes", "username avatar")
      // .populate("comment")
      .sort([["createdAt", "desc"]]); // Sắp xếp theo thời gian đăng (mới nhất trước)

    // Sắp xếp bài viết theo visibility: private -> friends -> public
    const sortedPosts = posts.sort((a, b) => {
      const visibilityOrder = { private: 0, friends: 1, public: 2 };
      return visibilityOrder[a.visibility] - visibilityOrder[b.visibility];
    });

    res.status(200).json({
      status: "success",
      posts: sortedPosts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserPosts = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Lấy các bài viết của chính người dùng đó
    const posts = await Post.find({ user: userId })
      .populate("user", "username avatar") // Thông tin người đăng bài
      .populate("likes", "username avatar") // Thông tin người thích bài
      .populate("comments") // Thông tin bình luận
      .sort([["createdAt", "desc"]]); // Sắp xếp theo thời gian đăng mới nhất

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
    const userId = req.user.userId;
    const otherUserId = req.params.userId; // ID người mà bạn muốn xem trang cá nhân

    // Lấy thông tin người dùng hiện tại và bạn bè của người đó
    const user = await User.findById(userId);
    const otherUser = await User.findById(otherUserId);

    if (!user || !otherUser) {
      return res.status(404).json({ message: "User not found." });
    }
    console.log("Other User's friends:", otherUser.friends);
    console.log("Current User ID:", userId);

    // Kiểm tra nếu userId có trong danh sách bạn bè của otherUser
    const isFriend = otherUser.friends.includes(userId);

    // Lấy các bài viết công khai
    const publicPosts = await Post.find({
      visibility: "public",
      user: otherUserId,
    }).sort([["createdAt", "desc"]]); // Sắp xếp theo thời gian đăng mới nhất

    // Lấy các bài viết có visibility "friends" chỉ khi bạn là bạn bè
    const friendPosts = isFriend
      ? await Post.find({
          visibility: "friends",
          user: otherUserId,
        }).sort([["createdAt", "desc"]])
      : [];

    // Gộp các bài viết công khai và bài viết bạn bè
    const posts = [...publicPosts, ...friendPosts];

    // Kiểm tra nếu không có bài viết nào của người dùng này
    if (posts.length === 0) {
      return res.status(200).json({
        status: "success",
        message: "No posts found.",
        posts: [],
      });
    }

    res.status(200).json({
      status: "success",
      posts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const deletePost = async (req, res) => {
  try {
    const userId = req.user.userId; // Lấy ID người dùng từ token
    const { postId } = req.params; // Lấy ID bài viết từ URL

    // Tìm và xóa bài viết trong một bước
    const post = await Post.findOneAndDelete({ _id: postId, user: userId });

    if (!post) {
      return res
        .status(404)
        .json({ message: "Post not found or not authorized" });
    }

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
};
