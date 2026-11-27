const jwt = require("jsonwebtoken");

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

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.userId);
    });

  });

};

module.exports = initializeChatSocket;