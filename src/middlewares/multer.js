const multer = require("multer");

// Lưu trữ file trong bộ nhớ để xử lý với Cloudinary
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
});

module.exports = upload;
