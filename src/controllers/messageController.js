const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const Notification = require("../models/Notifications");
const Pusher = require("../config/pusher");
const User = require("../models/Users");

const startOrSendMessage = async (req, res) => {
  try {
    const { recipientId, text } = req.body;
    const senderId = req.user.userId;

    const user = await User.findById(senderId);

    if (!recipientId || !text) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    });
    // Create a new conversation if it doesn't exist
    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId],
      });
      await conversation.save();
    }

    const message = new Message({
      conversationId: conversation._id,
      sender: senderId,
      recipient: recipientId,
      text,
    });
    await message.save();

    // update the last message in the comversation model
    conversation.lastMessage = text;
    await conversation.save();

    // notify to recipient
    if (recipientId !== senderId) {
      const notification = new Notification({
        type: "message",
        message: `${user.username} sent you a message.`,
        recipient: recipientId,
        sender: senderId,
        isRead: false,
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

      // Pusher.trigger(`user-${recipientId}`, "new-message", {

      // })
    }

    res.status(201).json({
      status: "success",
      message: "Message sent successfully.",
      data: message,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversationId })
      .sort({
        createdAt: -1,
      })
      .populate("sender", "username profilePicture")
      .populate("recipient", "username profilePicture");

    res.status(200).json({
      status: "success",
      message: "Messages fetched successfully.",
      data: messages,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const markAsSeen = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (message.recipient.toString() !== userId) {
      return res.status(403).json({
        message: "You are not authorized to mark this message as seen",
      });
    }

    message.isSeen = true;

    await message.save();

    // notifi realtime to sender

    res.status(200).json({
      status: "success",
      message: "Message marked as seen successfully.",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;

    const conversations = await Conversation.find({
      participants: userId,
    }).populate("participants", "username profilePicture");

    res.status(200).json({
      status: "success",
      message: "Conversations fetched successfully.",
      data: conversations,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  startOrSendMessage,
  getMessages,
  getConversations,
  markAsSeen,
};
