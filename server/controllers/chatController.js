const Message = require("../models/Message");
const User = require("../models/User");

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


// Get messages between the logged-in user and another user
const getMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const username = req.params.username;

    // Find the other user
    const otherUser = await User.findOne({ username });

    if (!otherUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Get page and limit from query parameters
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 30;

    // Calculate how many messages to skip
    const skip = (page - 1) * limit;

    // Find messages exchanged between the two users
    const messages = await Message.find({
      $or: [
        {
          senderId: userId,
          receiverId: otherUser._id
        },
        {
          senderId: otherUser._id,
          receiverId: userId
        }
      ]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("senderId", "username avatarUrl")
      .populate("receiverId", "username avatarUrl");

    // Reverse messages to show oldest first
    messages.reverse();

    res.status(200).json({
      page,
      limit,
      messages
    });

  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      message: "Server error"
    });
  }
};

// Send a message to another user
const sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const username = req.params.username;
    const content = req.body.content;

    // Find the receiver
    const receiver = await User.findOne({ username });

    if (!receiver) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Check if the message is empty
    if (!content || !content.trim()) {
      return res.status(400).json({
        message: "Message cannot be empty"
      });
    }

    // Create a new message
    const message = await Message.create({
      senderId: senderId,
      receiverId: receiver._id,
      content: content
    });

    // Populate sender and receiver information
    await message.populate("senderId", "username avatarUrl");
    await message.populate("receiverId", "username avatarUrl");

    res.status(201).json(message);

  } catch (error) {
    console.error("Send message error:", error);

    res.status(500).json({
      message: "Server error"
    });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage
};