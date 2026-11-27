const express = require("express");
const router = express.Router();
const { protect, optionalProtect } = require("../middleware/authMiddleware");
const {
  createPost,
  getGlobalFeed,
  getCommunityFeed,
  getPost,
  updatePost,
  deletePost,
} = require("../controllers/postController");

router.get("/posts", optionalProtect, getGlobalFeed);
router.post("/posts", protect, createPost);
router.get("/posts/:id", optionalProtect, getPost);
router.put("/posts/:id", protect, updatePost);
router.delete("/posts/:id", protect, deletePost);
router.get("/communities/:name/posts", optionalProtect, getCommunityFeed);

module.exports = router;