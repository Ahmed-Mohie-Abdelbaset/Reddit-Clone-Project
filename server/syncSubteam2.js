require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Post = require("./models/Post");

const syncSubteam2 = async () => {
  try {
    await connectDB();

    await Post.createCollection();
    await Post.syncIndexes();
    console.log(`Synced collection & indexes for: ${Post.modelName}`);

    console.log("Subteam 2 collection (posts) is live in Atlas!");
  } catch (err) {
    console.error("Sync error:", err);
  } finally {
    await mongoose.connection.close();
  }
};

syncSubteam2();