const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount
} = require("../controllers/chatController");

// Get unread messages count
router.get("/unread-count", protect, getUnreadCount);

// Get all conversations
router.get("/conversations", protect, getConversations);

// Get messages with a specific user
router.get("/:username/messages", protect, getMessages);

// Send a message to a specific user
router.post("/:username", protect, sendMessage);

// Mark messages as read
router.put("/:username/read", protect, markAsRead);

module.exports = router;