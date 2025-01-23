const express = require("express");
const {
  createStory,
  getStoriesByUser,
  viewStory,
  deleteStory,
  updateStory,
} = require("../controllers/storyController");
const authenticatedUser = require("../middlewares/authenticatedUser");
const upload = require("../middlewares/multer");
const router = express.Router();

router.post(
  "/create-story",
  authenticatedUser,
  upload.array("stories", 10),
  createStory
);
// api get stories
router.get("/get-stories", authenticatedUser, getStoriesByUser);

// api view story
router.get("/view-story/:storyId", authenticatedUser, viewStory);

// api delete story
router.delete("/delete-story/:storyId", authenticatedUser, deleteStory);

// api update story
router.patch("/update-story/:storyId", authenticatedUser, updateStory);

module.exports = router;
