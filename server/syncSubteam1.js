require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Community = require("./models/Community");

const syncSubteam1 = async () => {
  try {
    await connectDB();

    for (const model of [User, Community]) {
      await model.createCollection();
      await model.syncIndexes();
      console.log(`Synced collection & indexes for: ${model.modelName}`);
    }

    console.log("Subteam 1 collections (users, communities) are live in Atlas!");
  } catch (err) {
    console.error("Sync error:", err);
  } finally {
    await mongoose.connection.close();
  }
};

syncSubteam1();