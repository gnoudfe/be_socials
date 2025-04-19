const User = require("../models/Users");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Pusher = require("../config/pusher");
const cloudinary = require("../config/cloudinary.config");

const Notification = require("../models/Notifications");
const {
  sendVerificationEmail,
  sendNewPasswordEmail,
} = require("../utils/email");
const Posts = require("../models/Posts");
const registerUser = async (req, res) => {
  try {
    const { username, email, password, dateOfBirth, gender } = req.body;
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Gửi email xác minh
    await sendVerificationEmail(email, verificationToken);

    // Tạo người dùng mới
    const user = new User({
      username,
      email,
      password: hashedPassword,
      dateOfBirth,
      gender,
      verificationToken,
    });

    await user.save();

    res.status(201).json({
      status: "success",
      message: "Registration successful. Please check your email to verify.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    const user = await User.findOne({ verificationToken: token });
    if (!user)
      return res.status(400).json({ message: "Invalid verification token." });

    user.isVerified = true;
    user.verificationToken = undefined; // Xóa mã xác minh
    await user.save();
    res
      .status(200)
      .json({ status: "success", message: "Email verified successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const LoginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Tìm người dùng
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(400)
        .json({ message: "Email or password is incorrect." });

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res
        .status(400)
        .json({ message: "Email or password is incorrect." });

    // Kiểm tra xác minh email
    if (!user.isVerified) {
      // Gửi lại email xác minh
      return res.status(400).json({
        message: "Email is not verified.",
      });
    }

    // Tạo access token
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_ACCESS_SECRET_KEY,
      { expiresIn: "15m" }
    );

    // Tạo refresh token
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET_KEY,
      { expiresIn: "7d" }
    );

    // Lưu refresh token vào cơ sở dữ liệu
    user.refreshToken = refreshToken;
    await user.save();

    // Set cookie cho accessToken và refreshToken
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      // sameSite: "none",
      // secure: true,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      // sameSite: "none",
      // secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Trả về thông tin đăng nhập
    res.status(200).json({
      status: "success",
      success: true,
      message: "Login successful",
      data: {
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        coverPhoto: user.coverPhoto,
        bio: user.bio,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const logoutUser = async (req, res) => {
  try {
    const userId = req.user.userId; // Lấy userId từ token đã xác thực

    // Tìm kiếm người dùng trong cơ sở dữ liệu
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Xóa refresh token khỏi cơ sở dữ liệu
    user.refreshToken = null;
    await user.save(); // Lưu thay đổi

    // Xoá cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res
      .status(200)
      .json({ status: "success", message: "Logged out successfully" });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        status: "error",
        message: "Old password or new password is required",
      });
    }
    const userId = req.user.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        status: "error",
        message: "Current password is incorrect",
      });
    }
    const hashNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashNewPassword;
    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const streamUpload = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "social-media/profile-pictures",
        resource_type: "image",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

const updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.userId;
    const file = req.file;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({ message: "Invalid file format." });
    }

    const maxSizeInBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      return res.status(400).json({ message: "File size exceeds 2MB." });
    }

    // XÓA ẢNH CŨ nếu có
    if (user.profilePictureId) {
      await cloudinary.uploader.destroy(user.profilePictureId);
    }

    const result = await streamUpload(file.buffer);

    user.profilePicture = result.secure_url;
    user.profilePictureId = result.public_id; // Lưu lại để lần sau xóa được
    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Profile picture updated successfully",
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const removeProfilePicture = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    // XÓA ẢNH Cloudinary nếu có
    if (user.profilePictureId) {
      await cloudinary.uploader.destroy(user.profilePictureId);
    }

    user.profilePicture = "";
    user.profilePictureId = ""; // Clear luôn id
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Profile picture removed successfully.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Cập nhật ảnh bìa
const updateCoverPhoto = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    const file = req.file;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!file) {
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

    // Upload ảnh từ bộ nhớ tạm lên Cloudinary
    const result = await cloudinary.uploader.upload_stream(
      {
        folder: "social-media/cover-photos",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          return res.status(500).json({ message: error.message });
        }

        // Cập nhật URL ảnh bìa trong cơ sở dữ liệu
        user.coverPhoto = result.secure_url;
        user.save();

        return res.status(200).json({
          status: "success",
          message: "Cover photo updated successfully",
          coverPhoto: user.coverPhoto,
        });
      }
    );

    result.end(file.buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật bio
const updateBio = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { bio } = req.body;

    if (!bio) {
      return res.status(400).json({ message: "Bio is required" });
    }

    user.bio = bio;
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Bio updated successfully",
      bio: user.bio,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Kiểm tra email có tồn tại
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "Email does not exist in the system." });
    }

    // Tạo mật khẩu mới ngẫu nhiên
    const randomPassword = crypto.randomBytes(8).toString("hex");

    // Mã hóa mật khẩu ngẫu nhiên và lưu vào database
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(randomPassword, salt);
    await user.save();

    // Gửi mật khẩu mới qua email
    await sendNewPasswordEmail(user.email, randomPassword);

    res.status(200).json({
      status: "success",
      message: "A new password has been sent to your email.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getUserInfo = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { userId: paramUserId } = req.params;
    const targetUserId = paramUserId || userId;

    // Lấy user
    const userDoc = await User.findById(targetUserId).select("-password");
    if (!userDoc) {
      return res.status(404).json({ message: "User not found." });
    }

    // Lấy số bài viết
    const totalPosts = await Posts.countDocuments({ user: targetUserId });

    // Chuyển sang plain object để thêm fields tùy chỉnh
    const user = userDoc.toObject();
    user.totalPosts = totalPosts;
    user.totalFriends = user.friends.length;

    res.status(200).json({
      status: "success",
      user,
      isCurrentUser: targetUserId === req.user.userId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const sendFriendRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const friendId = req.params.userId;

    const sender = await User.findById(userId); // Lấy User gửi
    const recipient = await User.findById(friendId); // Lấy User nhận

    if (!recipient || !sender) {
      return res.status(404).json({ message: "User not found." });
    }

    // Kiểm tra nếu đã gửi lời mời kết bạn
    if (recipient.friendRequests.includes(userId)) {
      return res
        .status(400)
        .json({ message: "Friend request already sent to this user." });
    }

    // Kiểm tra nếu User B đã trong danh sách bạn bè
    if (recipient.friends.includes(userId)) {
      return res
        .status(400)
        .json({ message: "This user is already your friend." });
    }

    // Thêm User A vào danh sách `friendRequests` của User B
    recipient.friendRequests.push(userId);

    // Thêm User B vào danh sách `sentFriendRequests` của User A
    sender.sentFriendRequests.push(friendId);

    await recipient.save();
    await sender.save();

    // Lưu thông báo cho người nhận lời mời kết bạn
    const notification = new Notification({
      type: "friend-request",
      message: `${sender.username} sent you a friend request!`,
      recipient: friendId,
      sender: userId,
    });
    await notification.save();

    // // Gửi thông báo qua Pusher
    // Pusher.trigger(`user-${friendId}`, "notification", {
    //   id: notification._id,
    //   type: notification.type,
    //   message: notification.message,
    //   sender: {
    //     id: senderId,
    //     username: req.user.username,
    //     avatar: req.user.avatar,
    //   },
    //   isRead: notification.isRead,
    //   createdAt: notification.createdAt,
    // });
    res
      .status(200)
      .json({ status: "success", message: "Friend request sent." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Chấp nhận lời mời kết bạn
const acceptFriendRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const friendId = req.params.userId;

    const user = await User.findById(userId); // Người nhận
    const friend = await User.findById(friendId); // Người gửi

    if (!user || !friend) {
      return res.status(404).json({ message: "User not found." });
    }

    // Kiểm tra xem có lời mời kết bạn hay không
    if (!user.friendRequests.includes(friendId)) {
      return res.status(400).json({ message: "No friend request found." });
    }

    // Cập nhật danh sách bạn bè
    user.friends.push(friendId);
    user.friendRequests = user.friendRequests.filter(
      (request) => request.toString() !== friendId.toString()
    );

    friend.friends.push(userId);
    friend.sentFriendRequests = friend.sentFriendRequests.filter(
      (request) => request.toString() !== userId.toString()
    );
    await user.save();
    await friend.save();

    // Lưu thông báo chấp nhận lời mời kết bạn
    const notification = new Notification({
      type: "friend-accepted",
      message: `${user.username} accepted your friend request!`,
      recipient: friendId,
      sender: userId,
    });
    await notification.save();

    // // Gửi thông báo qua Pusher
    // Pusher.trigger(`user-${friendId}`, "notification", {
    //   id: notification._id,
    //   type: notification.type,
    //   message: notification.message,
    //   sender: {
    //     id: senderId,
    //     username: req.user.username,
    //     avatar: req.user.avatar,
    //   },
    //   isRead: notification.isRead,
    //   createdAt: notification.createdAt,
    // });

    res.status(200).json({ message: "Friend request accepted." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Từ chối lời mời kết bạn
const rejectFriendRequest = async (req, res) => {
  try {
    const userId = req.user.userId; // User B (người nhận)
    const friendId = req.params.userId; // User A (người gửi)

    const user = await User.findById(userId); // Người nhận
    const friend = await User.findById(friendId); // Người gửi

    if (!user || !friend) {
      return res.status(404).json({ message: "User not found." });
    }
    // Kiểm tra xem lời mời kết bạn có tồn tại không
    if (!user.friendRequests.includes(friendId)) {
      return res.status(400).json({ message: "No friend request found." });
    }

    // Xóa User A khỏi danh sách friendRequests của User B
    user.friendRequests = user.friendRequests.filter(
      (request) => request.toString() !== friendId.toString()
    );
    // Xóa User B khỏi danh sách sentFriendRequests của User A
    friend.sentFriendRequests = friend.sentFriendRequests.filter(
      (request) => request.toString() !== userId.toString()
    );
    await user.save();
    await friend.save();
    // Lưu thông báo từ chối lời mời kết bạn
    const notification = new Notification({
      type: "friend-rejected",
      message: `${user.username} rejected your friend request.`,
      recipient: friendId,
      sender: userId,
    });
    await notification.save();

    // // Gửi thông báo qua Pusher
    // Pusher.trigger(`user-${friendId}`, "notification", {
    //   id: notification._id,
    //   type: notification.type,
    //   message: notification.message,
    //   sender: {
    //     id: senderId,
    //     username: req.user.username,
    //     avatar: req.user.avatar,
    //   },
    //   isRead: notification.isRead,
    //   createdAt: notification.createdAt,
    // });

    res.status(200).json({ message: "Friend request rejected." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const unfriendUser = async (req, res) => {
  try {
    const userId = req.user.userId; // ID của người dùng hiện tại
    const friendId = req.params.userId; // ID của người dùng muốn hủy kết bạn

    // Tìm người dùng hiện tại và người bạn muốn hủy kết bạn
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user || !friend) {
      return res.status(404).json({ message: "User not found." });
    }

    // Kiểm tra nếu cả hai đã là bạn bè
    if (!user.friends.includes(friendId)) {
      return res
        .status(400)
        .json({ message: "This user is not in your friend list." });
    }

    // Loại bỏ bạn khỏi danh sách bạn bè của nhau
    user.friends = user.friends.filter(
      (id) => id.toString() !== friendId.toString()
    );
    friend.friends = friend.friends.filter(
      (id) => id.toString() !== userId.toString()
    );

    await user.save();
    await friend.save();

    // Gửi phản hồi
    res.status(200).json({
      status: "success",
      message: `You have unfriended ${friend.username}.`,
      friendList: user.friends, // Trả về danh sách bạn bè mới
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Lấy tất cả thông báo của người dùng
    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 }) // Sắp xếp theo thời gian mới nhất
      .populate("sender", "username avatar");

    res.status(200).json({
      status: "success",
      notifications,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserFriends = async (req, res) => {
  try {
    const { userId } = req.params;

    // Tìm người dùng và lấy danh sách bạn bè
    const user = await User.findById(userId).populate({
      path: "friends",
      select: "username profilePicture bio",
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      status: "success",
      message: "Friends list fetched successfully",
      friends: user.friends,
    });
  } catch (error) {
    console.error("Error fetching friends list:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching friends list" });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { keyword } = req.query;

    // Nếu không có từ khóa, trả về lỗi
    if (!keyword || keyword.trim() === "") {
      return res.status(400).json({
        message: "Keyword is required for search.",
      });
    }

    // Tìm kiếm người dùng dựa trên username hoặc email (có thể thêm các trường khác nếu cần)
    const users = await User.find({
      $or: [
        { username: { $regex: keyword, $options: "i" } }, // Tìm kiếm không phân biệt chữ hoa/chữ thường
        { email: { $regex: keyword, $options: "i" } },
      ],
    }).select("username email profilePicture");

    // Nếu không tìm thấy người dùng nào
    if (users.length === 0) {
      return res.status(404).json({
        message: "No users found.",
      });
    }

    res.status(200).json({
      status: "success",
      users,
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while searching for users.",
      error: error.message,
    });
  }
};

module.exports = {
  registerUser,
  verifyEmail,
  LoginUser,
  logoutUser,
  getUserInfo,
  forgotPassword,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getNotifications,
  changePassword,
  updateProfilePicture,
  updateCoverPhoto,
  updateBio,
  unfriendUser,
  getUserFriends,
  searchUsers,
  removeProfilePicture,
};
