require("dotenv").config();

const { Server } = require("socket.io");
const initializeChatSocket = require("./socket/chatSocket");
const express = require("express");
const http = require("http");
const cors = require("cors");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const authRoutes = require("./routes/authRoutes");
const communityRoutes = require("./routes/communityRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const chatRoutes = require("./routes/chatRoutes"); 



const app = express();

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173"
}));

app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/communities", communityRoutes);
app.use("/api/users", userRoutes);
app.use("/api", postRoutes);
app.use("/api/chat", chatRoutes);

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app); 
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173"
    }
});
initializeChatSocket(io);
const PORT = process.env.PORT || 5000;

// Connect to database, then start server
const startServer = async () => {
    try {
        await connectDB();

        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();