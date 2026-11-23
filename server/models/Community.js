const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Community name is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 50,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    moderatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Moderator ID is required"],
    },
    memberCount: {
      type: Number,
      default: 1,
      min: 0,
    },
  },
  { timestamps: true }
);

// Text index to support community search
communitySchema.index({ name: "text" });

module.exports = mongoose.model("Community", communitySchema);