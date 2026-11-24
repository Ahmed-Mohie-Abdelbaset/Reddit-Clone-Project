require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const authRoutes = require("./routes/authRoutes");

const app = express();

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

// Connect to MongoDB Atlas
connectDB();

// Routes
app.use("/api/auth", authRoutes);

// Error Handling Middleware (must be after routes)
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));