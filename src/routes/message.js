const express = require("express");
const authenticatedUser = require("../middlewares/authenticatedUser");
const {
  startOrSendMessage,
  getMessages,
  markAsSeen,
  getConversations,
} = require("../controllers/messageController");

const router = express.Router();

// start a conversation or send mesasge
router.post("/send-message", authenticatedUser, startOrSendMessage);

// get messages in a conversation
router.get("/get-messages/:conversationId", authenticatedUser, getMessages);

// mark a message as seen
router.patch("/mark-as-seen/:messageId", authenticatedUser, markAsSeen);

// get user conversation
router.get("/get-conversations", authenticatedUser, getConversations);

module.exports = router;
