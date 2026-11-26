const express = require("express");
const router = express.Router();
const {
  createCommunity,
  getCommunity,
  searchCommunities,
  joinCommunity,
  leaveCommunity,
} = require("../controllers/communityController");
const { protect, optionalProtect } = require("../middleware/authMiddleware");

router.get("/search", searchCommunities);
router.post("/", protect, createCommunity);
router.get("/:name", optionalProtect, getCommunity);
router.post("/:id/join", protect, joinCommunity);
router.post("/:id/leave", protect, leaveCommunity);

module.exports = router;
