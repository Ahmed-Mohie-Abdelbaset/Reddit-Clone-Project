const User = require("../models/User");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// @desc    Search users by username
// @route   GET /api/users/search?q=&limit=
// @access  Public
const searchUsers = async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      return res.json([]);
    }

    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(parsedLimit)
      ? 20
      : Math.min(Math.max(parsedLimit, 1), 50);

    const regex = new RegExp(escapeRegex(q), "i");

    const users = await User.find({ username: regex })
      .select("username bio avatarUrl createdAt")
      .limit(limit);

    res.json(users);
  } catch (error) {
    next(error);
  }
};

// @desc    Get public user profile by username
// @route   GET /api/users/:username
// @access  Public
const getUserProfile = async (req, res, next) => {
  try {
    const username = req.params.username.trim().toLowerCase();

    const user = await User.findOne({ username })
      .select("-passwordHash -email")
      .populate("joinedCommunities", "name description memberCount");

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    res.json({
      ...user.toObject(),
      posts: [],
      comments: [],
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update logged-in user's bio and/or avatarUrl
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { bio, avatarUrl } = req.body;
    const updates = {};

    if (bio !== undefined) {
      if (typeof bio !== "string") {
        res.status(400);
        throw new Error("Bio must be a string");
      }
      const trimmedBio = bio.trim();
      if (trimmedBio.length > 500) {
        res.status(400);
        throw new Error("Bio must be 500 characters or fewer");
      }
      updates.bio = trimmedBio;
    }

    if (avatarUrl !== undefined) {
      if (typeof avatarUrl !== "string") {
        res.status(400);
        throw new Error("avatarUrl must be a string");
      }
      const trimmedUrl = avatarUrl.trim();
      if (trimmedUrl !== "") {
        try {
          const parsed = new URL(trimmedUrl);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error();
          }
        } catch {
          res.status(400);
          throw new Error("avatarUrl must be a valid http or https URL");
        }
      }
      updates.avatarUrl = trimmedUrl;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .select("-passwordHash")
      .populate("joinedCommunities", "name description memberCount");

    if (!updatedUser) {
      res.status(404);
      throw new Error("User not found");
    }

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};

module.exports = { searchUsers, getUserProfile, updateProfile };