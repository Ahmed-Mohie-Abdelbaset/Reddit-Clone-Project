const bcrypt = require("bcryptjs");
const User = require("../models/User");
require("../models/Community");
const generateToken = require("../utils/generateToken");

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400);
      throw new Error("Please provide username, email, and password");
    }

    if (password.length < 6) {
      res.status(400);
      throw new Error("Password must be at least 6 characters");
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existingUser) {
      res.status(409);
      throw new Error("Username or email already in use");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      joinedCommunities: user.joinedCommunities,
      createdAt: user.createdAt,
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error("Please provide email and password");
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      res.status(401);
      throw new Error("Invalid email or password");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      res.status(401);
      throw new Error("Invalid email or password");
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      joinedCommunities: user.joinedCommunities,
      createdAt: user.createdAt,
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get currently logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-passwordHash")
      .populate("joinedCommunities", "name description memberCount");

    res.json(user);
  } catch (error) {
    next(error);
  }
};

module.exports = { registerUser, loginUser, getMe };