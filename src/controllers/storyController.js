const Story = require("../models/Story");
const User = require("../models/Users");
const cloudinary = require("../config/cloudinary.config");
const createStory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const files = req.files;
    const { music, visibility } = req.body;
    const images = [];

    // Kiểm tra visibility hợp lệ
    const validVisibilities = ["private", "friends", "public"];
    if (!validVisibilities.includes(visibility)) {
      return res.status(400).json({ message: "Invalid visibility value." });
    }

    // Kiểm tra nếu không có file được tải lên
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    // Kiểm tra định dạng file và kích thước
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const maxSizeInBytes = 2 * 1024 * 1024; // 2MB
    for (let file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({
          message:
            "Invalid file format. Only jpg, png, gif, and webp are allowed.",
        });
      }
      if (file.size > maxSizeInBytes) {
        return res.status(400).json({ message: "File size exceeds 2MB." });
      }
    }

    // Upload ảnh lên Cloudinary
    const uploadPromises = files.map(
      (file) =>
        new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder: "social-media-story",
                resource_type: "auto",
              },
              (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
              }
            )
            .end(file.buffer);
        })
    );

    const uploadedImages = await Promise.all(uploadPromises);
    images.push(...uploadedImages);

    // Kiểm tra xem có story nào còn hiệu lực không
    const existingStory = await Story.findOne({
      user: userId,
      expiresAt: { $gt: new Date() }, // Story chưa hết hạn
    });

    if (existingStory) {
      // Nếu có story cũ, thêm ảnh mới vào story cũ
      existingStory.images.push(...images);

      // Nếu có nhạc mới, cập nhật nhạc
      if (music) {
        const musicUploadResult = await cloudinary.uploader.upload(music, {
          folder: "social-media-story",
          resource_type: "video",
        });
        existingStory.music = musicUploadResult.secure_url;
      }

      await existingStory.save();

      return res.status(200).json({
        status: "success",
        message: "Story updated successfully.",
        story: existingStory,
      });
    }

    // Nếu không có story cũ, tạo story mới
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const newStory = new Story({
      user: userId,
      images,
      music: music
        ? await cloudinary.uploader
            .upload(music, {
              folder: "social-media-story",
              resource_type: "video",
            })
            .then((res) => res.secure_url)
        : null,
      visibility,
      expiresAt,
      views: [],
    });

    await newStory.save();

    res.status(201).json({
      status: "success",
      message: "Story created successfully.",
      story: newStory,
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while creating the story.",
      error: error.message,
    });
  }
};

const getUserFriends = async (userId) => {
  if (!userId) {
    return [];
  }

  const user = await User.findById(userId).select("friends");
  return user ? user.friends : [];
};

const getStoriesByUser = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    // Lấy danh sách bạn bè của người dùng hiện tại
    const friends = await getUserFriends(currentUserId);

    // Tìm các câu chuyện thuộc về chính người dùng hoặc bạn bè của họ
    const stories = await Story.find({
      $or: [
        { user: currentUserId }, // Các story của chính người dùng
        { user: { $in: friends }, visibility: "friends" }, // Story của bạn bè (visibility là "friends")
      ],
      expiresAt: { $gt: new Date() }, // Chỉ lấy các story chưa hết hạn
    })
      .populate("user", "username profilePicture") // Thêm thông tin người dùng đăng story
      .sort({ createdAt: -1 });

    if (!stories.length) {
      return res.status(404).json({ message: "No stories found." });
    }

    res.status(200).json({
      status: "success",
      stories,
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while fetching stories.",
      error: error.message,
    });
  }
};
const viewStory = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const { storyId } = req.params;

    // Tìm câu chuyện
    const story = await Story.findById(storyId);

    if (!story) {
      return res.status(404).json({ message: "Story not found." });
    }

    // Kiểm tra xem story có hết hạn hay không
    if (story.expiresAt < new Date()) {
      return res.status(400).json({ message: "This story has expired." });
    }

    // Kiểm tra quyền truy cập
    if (story.visibility === "private") {
      return res
        .status(403)
        .json({ message: "You do not have permission to view this story." });
    }

    // Cập nhật danh sách người xem nếu chưa xem
    if (!story.views.includes(currentUserId)) {
      story.views.push(currentUserId);
      await story.save();
    }

    res.status(200).json({
      status: "success",
      message: "Story viewed successfully.",
      story,
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while viewing the story.",
      error: error.message,
    });
  }
};
const deleteStory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { storyId } = req.params;

    // Tìm câu chuyện
    const story = await Story.findOneAndDelete({ _id: storyId, user: userId });

    if (!story) {
      return res.status(404).json({ message: "Story not found." });
    }

    res.status(200).json({
      status: "success",
      message: "Story deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while deleting the story.",
      error: error.message,
    });
  }
};

const updateStory = async (req, res) => {
  try {
    const userId = req.user.userId; // Lấy ID của người dùng từ middleware xác thực
    const { storyId } = req.params; // Lấy storyId từ URL params
    const { imagesToRemove, visibility } = req.body; // Lấy dữ liệu từ request body

    // Kiểm tra visibility hợp lệ (nếu cần cập nhật)
    const validVisibilities = ["private", "friends", "public"];
    if (visibility && !validVisibilities.includes(visibility)) {
      return res.status(400).json({ message: "Invalid visibility value." });
    }

    // Tìm story theo ID và xác minh quyền sở hữu
    const story = await Story.findOne({ _id: storyId, user: userId });
    if (!story) {
      return res
        .status(404)
        .json({ message: "Story not found or access denied." });
    }

    // Xử lý xóa ảnh nếu có
    if (imagesToRemove) {
      story.images = story.images.filter(
        (image) => !imagesToRemove.includes(image)
      );
    }

    // Cập nhật visibility nếu có
    if (visibility) {
      story.visibility = visibility;
    }

    // Lưu story đã chỉnh sửa
    await story.save();

    res.status(200).json({
      status: "success",
      message: "Story updated successfully.",
      story,
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while updating the story.",
      error: error.message,
    });
  }
};

module.exports = {
  createStory,
  getStoriesByUser,
  viewStory,
  deleteStory,
  updateStory,
};
