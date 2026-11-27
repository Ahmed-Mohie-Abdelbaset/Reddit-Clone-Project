const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const User = require("../models/User");
const mongoose = require("mongoose");

const initializeChatSocket = (io) => {

  // Authenticate users before connecting
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      socket.userId = decoded.id;

      next();

    } catch (error) {
      next(new Error("Invalid token"));
    }
  });


  // Handle successful connections
  io.on("connection", (socket) => {

    console.log("User connected:", socket.userId);

    // Put the user in their private room
    socket.join(socket.userId);


    // Handle sending messages
    socket.on("chat:send", async (data) => {
      try {
        const { receiverId, content } = data;

        // Check if receiver ID is valid
        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
          return;
        }

        // Check if message is empty
        if (!content || !content.trim()) {
          return;
        }

        // Find the receiver
        const receiver = await User.findById(receiverId);

        if (!receiver) {
          return;
        }

        // Save the message in MongoDB
        const message = await Message.create({
          senderId: socket.userId,
          receiverId: receiver._id,
          content: content
        });

        // Get sender and receiver information
        await message.populate("senderId", "username avatarUrl");
        await message.populate("receiverId", "username avatarUrl");

        // Send the message to the receiver's room
        io.to(receiver._id.toString()).emit("chat:message", message);

      } catch (error) {
        console.error("Socket send message error:", error);
      }
    });


        // Handle reading messages
    socket.on("chat:read", async (data) => {
    try {
        const { senderId } = data;

        // Check if the sender ID is valid
        if (!mongoose.Types.ObjectId.isValid(senderId)) {
        return;
        }

        // Mark messages from this user as read
        await Message.updateMany(
        {
            senderId: senderId,
            receiverId: socket.userId,
            isRead: false
        },
        {
            isRead: true
        }
        );

        // Notify the sender that their messages were read
        io.to(senderId).emit("chat:read", {
        readerId: socket.userId
        });

    } catch (error) {
        console.error("Socket mark as read error:", error);
    }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.userId);
    });

  });

};

module.exports = initializeChatSocket;