
const mongoose = require("mongoose");
const Post = require("../models/Post");

const summarizePost = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Validate post ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid post ID",
      });
    }

    // 2. Find the post
    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // 3. Don't summarize removed posts
    if (post.isRemoved) {
      return res.status(400).json({
        message: "Cannot summarize a removed post",
      });
    }

    // 4. Check if a cached summary already exists
    if (post.aiSummary?.text) {
      return res.status(200).json({
        summary: post.aiSummary.text,
        cached: true,
        generatedAt: post.aiSummary.generatedAt,
      });
    }

    // 5. Check if Hugging Face API key exists
    if (!process.env.AI_API_KEY) {
      return res.status(503).json({
        message: "AI service is not configured yet",
      });
    }

    // 6. Prepare the post content
    if (!post.content || !post.content.trim()) {
      return res.status(400).json({
        message: "This post has no content to summarize",
      });
    }

    const textToSummarize =
      `Title: ${post.title}\n\nContent: ${post.content}`;

    // 7. Connect to Hugging Face
    const { InferenceClient } = await import("@huggingface/inference");

    const hf = new InferenceClient(process.env.AI_API_KEY);

    // 8. Generate summary
    const result = await hf.summarization({
      model: "facebook/bart-large-cnn",
      inputs: textToSummarize,
      parameters: {
        max_length: 100,
      },
    });

    const summary = result.summary_text;

    if (!summary || !summary.trim()) {
      throw new Error("AI returned an empty summary");
    }

    // 9. Save summary in MongoDB
    post.aiSummary.text = summary;
    post.aiSummary.generatedAt = new Date();

    await post.save();

    // 10. Return generated summary
    res.status(200).json({
      summary: summary,
      cached: false,
      generatedAt: post.aiSummary.generatedAt,
    });

  } catch (error) {
    console.error("AI summarization error:", error.message);

    if (error.message === "AI returned an empty summary") {
      return res.status(502).json({
        message: "AI could not generate a summary",
      });
    }

    // Pass database and unexpected errors to existing error handler
    next(error);
  }
};

module.exports = { summarizePost };
