const express = require("express");
const router = express.Router();
const {
  searchUsers,
  getUserProfile,
  updateProfile,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

router.get("/search", searchUsers);
router.put("/profile", protect, updateProfile);
router.get("/:username", getUserProfile);

module.exports = router;