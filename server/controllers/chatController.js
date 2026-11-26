
const Message = require("../models/Message");

// Get all conversations of the logged-in user
const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all messages sent or received by this user
    const messages = await Message.find({
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    })
      .sort({ createdAt: -1 })
      .populate("senderId", "username avatarUrl")
      .populate("receiverId", "username avatarUrl");

    const conversations = [];

    // Get the latest message for each conversation
    for (const message of messages) {
      let otherUser;

      if (message.senderId._id.toString() === userId.toString()) {
        otherUser = message.receiverId;
      } else {
        otherUser = message.senderId;
      }

      // Check if we already added this conversation
      const existing = conversations.find(
        (conversation) =>
          conversation.user._id.toString() === otherUser._id.toString()
      );

      if (!existing) {
        const unreadCount = messages.filter(
          (msg) =>
            msg.senderId._id.toString() === otherUser._id.toString() &&
            msg.receiverId._id.toString() === userId.toString() &&
            msg.isRead === false
        ).length;

        conversations.push({
          user: otherUser,
          lastMessage: message,
          unreadCount: unreadCount
        });
      }
    }

    res.status(200).json(conversations);

  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getConversations };
