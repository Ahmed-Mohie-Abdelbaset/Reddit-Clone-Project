const mongoose = require("mongoose");
const Community = require("../models/Community");
const User = require("../models/User");

const normalizeName = (name) =>
  typeof name === "string" ? name.trim().toLowerCase() : "";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const RESERVED_NAMES = new Set([
  "search",
  "create",
  "new",
  "popular",
  "all",
  "api",
]);

const validateName = (name) => {
  if (!name) {
    return "Community name is required";
  }

  if (name.length < 2 || name.length > 50) {
    return "Community name must be between 2 and 50 characters";
  }

  if (!/^[a-z0-9][a-z0-9_]*$/.test(name)) {
    return "Community name must start with a letter or number and may only contain letters, numbers, and underscores";
  }

  if (RESERVED_NAMES.has(name)) {
    return "That community name is reserved";
  }

  return null;
};

const createCommunity = async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = normalizeName(body.name);
    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    const nameError = validateName(name);

    if (nameError) {
      res.status(400);
      throw new Error(nameError);
    }

    if (description.length > 500) {
      res.status(400);
      throw new Error("Description cannot exceed 500 characters");
    }

    const existing = await Community.findOne({ name });

    if (existing) {
      res.status(409);
      throw new Error("Community name is already taken");
    }

    let community;

    try {
      community = await Community.create({
        name,
        description,
        moderatorId: req.user._id,
      });
    } catch (error) {
      if (error.code === 11000) {
        res.status(409);
        throw new Error("Community name is already taken");
      }

      throw error;
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { joinedCommunities: community._id },
    });

    await community.populate("moderatorId", "username avatarUrl");

    res.status(201).json({ ...community.toObject(), isMember: true });
  } catch (error) {
    next(error);
  }
};

const getCommunity = async (req, res, next) => {
  try {
    const name = normalizeName(req.params.name);

    if (!name) {
      res.status(400);
      throw new Error("Community name is required");
    }

    const community = await Community.findOne({ name }).populate(
      "moderatorId",
      "username avatarUrl"
    );

    if (!community) {
      res.status(404);
      throw new Error("Community not found");
    }

    const isMember = req.user
      ? req.user.joinedCommunities.some((communityId) =>
          communityId.equals(community._id)
        )
      : false;

    res.json({ ...community.toObject(), isMember });
  } catch (error) {
    next(error);
  }
};

const searchCommunities = async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!query) {
      return res.json([]);
    }

    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isNaN(parsedLimit) ? 20 : parsedLimit, 1), 50);
    const regex = new RegExp(escapeRegex(query), "i");

    const communities = await Community.find({ name: regex })
      .select("name description memberCount createdAt")
      .sort({ memberCount: -1, name: 1 })
      .limit(limit);

    return res.json(communities);
  } catch (error) {
    return next(error);
  }
};

const joinCommunity = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      res.status(400);
      throw new Error("Invalid community id");
    }

    const community = await Community.findById(id);

    if (!community) {
      res.status(404);
      throw new Error("Community not found");
    }

    const result = await User.updateOne(
      { _id: req.user._id, joinedCommunities: { $ne: community._id } },
      { $addToSet: { joinedCommunities: community._id } }
    );

    if (result.modifiedCount > 0) {
      await Community.findByIdAndUpdate(community._id, {
        $inc: { memberCount: 1 },
      });
    }

    const updatedCommunity = await Community.findById(community._id).populate(
      "moderatorId",
      "username avatarUrl"
    );

    res.json({ ...updatedCommunity.toObject(), isMember: true });
  } catch (error) {
    next(error);
  }
};

const leaveCommunity = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      res.status(400);
      throw new Error("Invalid community id");
    }

    const community = await Community.findById(id);

    if (!community) {
      res.status(404);
      throw new Error("Community not found");
    }

    if (community.moderatorId.equals(req.user._id)) {
      res.status(400);
      throw new Error("Moderators cannot leave their own community");
    }

    const result = await User.updateOne(
      { _id: req.user._id, joinedCommunities: community._id },
      { $pull: { joinedCommunities: community._id } }
    );

    if (result.modifiedCount > 0) {
      await Community.findOneAndUpdate(
        { _id: community._id, memberCount: { $gt: 0 } },
        { $inc: { memberCount: -1 } }
      );
    }

    const updatedCommunity = await Community.findById(community._id).populate(
      "moderatorId",
      "username avatarUrl"
    );

    res.json({ ...updatedCommunity.toObject(), isMember: false });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCommunity,
  getCommunity,
  searchCommunities,
  joinCommunity,
  leaveCommunity,
};
