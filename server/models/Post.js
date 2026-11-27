const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Post title is required"],
      trim: true,
      minlength: [1, "Title must be at least 1 character"],
      maxlength: [300, "Title cannot exceed 300 characters"],
    },
    content: {
      type: String,
      default: "",
      maxlength: [10000, "Content cannot exceed 10000 characters"],
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author ID is required"],
    },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: [true, "Community ID is required"],
    },
    score: {
      type: Number,
      default: 0,
    },
    isRemoved: {
      type: Boolean,
      default: false,
    },
    aiSummary: {
      text: {
        type: String,
        default: null,
      },
      generatedAt: {
        type: Date,
        default: null,
      },
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Feed sorting and filtering indexes
postSchema.index({ communityId: 1, createdAt: -1 });
postSchema.index({ communityId: 1, score: -1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ score: -1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);