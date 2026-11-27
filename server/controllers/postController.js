const mongoose = require("mongoose");
const Post = require("../models/Post");
const Community = require("../models/Community");

// Optional/guarded imports for models owned by Member B (Vote) and Subteam 3 (Comment)
// TODO: Once Member B merges server/models/Vote.js and Subteam 3 merges server/models/Comment.js,
// these guarded lookups will automatically query Vote.find and execute deleteMany({ postId }).
const getOptionalModel = (modelName, relativePath) => {
  if (mongoose.models[modelName]) {
    return mongoose.models[modelName];
  }
  try {
    const loaded = require(relativePath);
    return loaded && typeof loaded.find === "function" ? loaded : null;
  } catch {
    return null;
  }
};

// Helper to shape a populated post document to match the fixed Data Contract
const formatPost = (postDoc, myVote = null) => {
  const post = postDoc.toObject ? postDoc.toObject() : postDoc;

  return {
    _id: post._id,
    title: post.isRemoved ? "[removed]" : post.title,
    content: post.isRemoved ? "[removed]" : post.content,
    authorId: post.authorId
      ? {
          _id: post.authorId._id,
          username: post.authorId.username,
          avatarUrl: post.authorId.avatarUrl || "",
        }
      : null,
    communityId: post.communityId
      ? {
          _id: post.communityId._id,
          name: post.communityId.name,
        }
      : null,
    score: post.score,
    isRemoved: post.isRemoved,
    aiSummary: {
      text: post.aiSummary?.text ?? null,
      generatedAt: post.aiSummary?.generatedAt ?? null,
    },
    myVote,
    createdAt: post.createdAt,
    editedAt: post.editedAt,
  };
};

// Fetch user's votes for a list of post IDs in ONE query and return a Map<postIdString, 1 | -1>
const getMyVotesMap = async (userId, postIds) => {
  const voteMap = new Map();
  if (!userId || !postIds.length) {
    return voteMap;
  }

  const Vote = getOptionalModel("Vote", "../models/Vote");
  if (!Vote) {
    return voteMap;
  }

  const votes = await Vote.find({
    userId,
    postId: { $in: postIds },
  }).select("postId value");

  for (const vote of votes) {
    voteMap.set(vote.postId.toString(), vote.value);
  }

  return voteMap;
};

// Shared helper to validate sort & pagination query params
const parseFeedQuery = (query) => {
  const sortParam = query.sort ?? "new";
  if (sortParam !== "new" && sortParam !== "top") {
    const err = new Error("Invalid sort parameter. Allowed values: new, top");
    err.statusCode = 400;
    throw err;
  }

  const sortStage =
    sortParam === "top"
      ? { score: -1, createdAt: -1, _id: -1 }
      : { createdAt: -1, _id: -1 };

  const rawPage = query.page !== undefined ? Number(query.page) : 1;
  if (!Number.isInteger(rawPage) || rawPage < 1) {
    const err = new Error("Page must be an integer greater than or equal to 1");
    err.statusCode = 400;
    throw err;
  }

  const rawLimit = query.limit !== undefined ? Number(query.limit) : 10;
  if (!Number.isInteger(rawLimit) || rawLimit < 1) {
    const err = new Error("Limit must be an integer greater than or equal to 1");
    err.statusCode = 400;
    throw err;
  }

  const limit = Math.min(rawLimit, 50);
  const page = rawPage;
  const skip = (page - 1) * limit;

  return { sortStage, page, limit, skip };
};

// @desc    Create a new post in a community
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res, next) => {
  try {
    const { title, content, communityId } = req.body;

    // 1. Validate title
    if (typeof title !== "string" || title.trim().length === 0) {
      res.status(400);
      throw new Error("Post title is required");
    }
    if (title.trim().length > 300) {
      res.status(400);
      throw new Error("Title cannot exceed 300 characters");
    }

    // 2. Validate content (optional, defaults to "")
    if (content !== undefined && typeof content !== "string") {
      res.status(400);
      throw new Error("Content must be a string");
    }
    if (typeof content === "string" && content.length > 10000) {
      res.status(400);
      throw new Error("Content cannot exceed 10000 characters");
    }

    // 3. Validate communityId format before querying DB
    if (!communityId || !mongoose.isValidObjectId(communityId)) {
      res.status(400);
      throw new Error("Invalid community ID");
    }

    // 4. Verify community exists
    const community = await Community.findById(communityId);
    if (!community) {
      res.status(404);
      throw new Error("Community not found");
    }

    // 5. Verify user is a member of the community
    const isMember = req.user.joinedCommunities.some(
      (id) => id.toString() === communityId.toString()
    );
    if (!isMember) {
      res.status(403);
      throw new Error("You must join this community before posting");
    }

    // 6. Create post (only allowed fields; never accept score, authorId, or isRemoved from body)
    const post = await Post.create({
      title: title.trim(),
      content: content ?? "",
      authorId: req.user._id,
      communityId: community._id,
    });

    // 7. Populate authorId and communityId for the response contract
    await post.populate([
      { path: "authorId", select: "username avatarUrl" },
      { path: "communityId", select: "name" },
    ]);

    res.status(201).json(formatPost(post, 0));
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated global feed
// @route   GET /api/posts?sort=new|top&page=1&limit=10
// @access  Public (optionalProtect attaches req.user if logged in)
const getGlobalFeed = async (req, res, next) => {
  try {
    let parsed;
    try {
      parsed = parseFeedQuery(req.query);
    } catch (validationErr) {
      res.status(validationErr.statusCode || 400);
      throw validationErr;
    }

    const { sortStage, page, limit, skip } = parsed;
    const filter = { isRemoved: false };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort(sortStage)
        .skip(skip)
        .limit(limit)
        .populate("authorId", "username avatarUrl")
        .populate("communityId", "name"),
      Post.countDocuments(filter),
    ]);

    const userId = req.user?._id || null;
    const voteMap = await getMyVotesMap(
      userId,
      posts.map((p) => p._id)
    );

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    res.status(200).json({
      posts: posts.map((post) => {
        const myVote = userId ? (voteMap.get(post._id.toString()) ?? 0) : null;
        return formatPost(post, myVote);
      }),
      page,
      limit,
      total,
      totalPages,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated posts for a specific community
// @route   GET /api/communities/:name/posts?sort=new|top&page=1&limit=10
// @access  Public (optionalProtect attaches req.user if logged in)
const getCommunityFeed = async (req, res, next) => {
  try {
    let parsed;
    try {
      parsed = parseFeedQuery(req.query);
    } catch (validationErr) {
      res.status(validationErr.statusCode || 400);
      throw validationErr;
    }

    const communityName = req.params.name?.trim().toLowerCase();
    const community = await Community.findOne({ name: communityName });

    if (!community) {
      res.status(404);
      throw new Error("Community not found");
    }

    const { sortStage, page, limit, skip } = parsed;
    const filter = { communityId: community._id, isRemoved: false };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort(sortStage)
        .skip(skip)
        .limit(limit)
        .populate("authorId", "username avatarUrl")
        .populate("communityId", "name"),
      Post.countDocuments(filter),
    ]);

    const userId = req.user?._id || null;
    const voteMap = await getMyVotesMap(
      userId,
      posts.map((p) => p._id)
    );

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    res.status(200).json({
      posts: posts.map((post) => {
        const myVote = userId ? (voteMap.get(post._id.toString()) ?? 0) : null;
        return formatPost(post, myVote);
      }),
      page,
      limit,
      total,
      totalPages,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single post by ID
// @route   GET /api/posts/:id
// @access  Public (optionalProtect attaches req.user if logged in)
const getPost = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Always validate ObjectId first so invalid IDs return 400, never a 500 CastError
    if (!mongoose.isValidObjectId(id)) {
      res.status(400);
      throw new Error("Invalid post ID");
    }

    // 2. Fetch and populate authorId and communityId
    const post = await Post.findById(id)
      .populate("authorId", "username avatarUrl")
      .populate("communityId", "name");

    if (!post) {
      res.status(404);
      throw new Error("Post not found");
    }

    // 3. Merge myVote (1, -1, 0 if logged in; null if anonymous)
    const userId = req.user?._id || null;
    const voteMap = await getMyVotesMap(userId, [post._id]);
    const myVote = userId ? (voteMap.get(post._id.toString()) ?? 0) : null;

    res.status(200).json(formatPost(post, myVote));
  } catch (error) {
    next(error);
  }
};

// @desc    Update an existing post (author only)
// @route   PUT /api/posts/:id
// @access  Private
const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Validate ObjectId format first
    if (!mongoose.isValidObjectId(id)) {
      res.status(400);
      throw new Error("Invalid post ID");
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404);
      throw new Error("Post not found");
    }

    // 2. Author-only authorization check
    if (post.authorId.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("Not authorized to edit this post");
    }

    // 3. Disallow editing removed posts
    if (post.isRemoved) {
      res.status(400);
      throw new Error("Removed posts cannot be edited");
    }

    const { title, content } = req.body;

    if (title === undefined && content === undefined) {
      res.status(400);
      throw new Error("Provide title or content to update");
    }

    // 4. Validate and apply allowed fields only (never score, authorId, isRemoved)
    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        res.status(400);
        throw new Error("Post title cannot be empty");
      }
      if (title.trim().length > 300) {
        res.status(400);
        throw new Error("Title cannot exceed 300 characters");
      }
      post.title = title.trim();
    }

    if (content !== undefined) {
      if (typeof content !== "string") {
        res.status(400);
        throw new Error("Content must be a string");
      }
      if (content.length > 10000) {
        res.status(400);
        throw new Error("Content cannot exceed 10000 characters");
      }
      post.content = content;
    }

    // 5. Explicitly record edit timestamp
    post.editedAt = new Date();
    await post.save();

    await post.populate([
      { path: "authorId", select: "username avatarUrl" },
      { path: "communityId", select: "name" },
    ]);

    const voteMap = await getMyVotesMap(req.user._id, [post._id]);
    const myVote = voteMap.get(post._id.toString()) ?? 0;

    res.status(200).json(formatPost(post, myVote));
  } catch (error) {
    next(error);
  }
};

// @desc    Delete own post (hard delete + cascade) or remove post (community moderator soft remove)
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Validate ObjectId format first
    if (!mongoose.isValidObjectId(id)) {
      res.status(400);
      throw new Error("Invalid post ID");
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404);
      throw new Error("Post not found");
    }

    const isAuthor = post.authorId.toString() === req.user._id.toString();

    // 2. Author branch: HARD delete + cascade Vote & Comment cleanup
    if (isAuthor) {
      const Vote = getOptionalModel("Vote", "../models/Vote");
      const Comment = getOptionalModel("Comment", "../models/Comment");

      const cascadeTasks = [Post.deleteOne({ _id: post._id })];
      if (Vote) {
        cascadeTasks.push(Vote.deleteMany({ postId: post._id }));
      }
      if (Comment) {
        cascadeTasks.push(Comment.deleteMany({ postId: post._id }));
      }

      await Promise.all(cascadeTasks);

      return res.status(200).json({
        message: "Post deleted permanently",
        _id: post._id,
      });
    }

    // 3. Moderator branch: SOFT remove (isRemoved = true)
    const community = await Community.findById(post.communityId);
    const isModerator =
      community && community.moderatorId.toString() === req.user._id.toString();

    if (isModerator) {
      post.isRemoved = true;
      await post.save();

      return res.status(200).json({
        message: "Post removed by community moderator",
        _id: post._id,
        isRemoved: true,
      });
    }

    // 4. Anyone else: 403 Forbidden
    res.status(403);
    throw new Error("Not authorized to delete or remove this post");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  formatPost,
  parseFeedQuery,
  createPost,
  getGlobalFeed,
  getCommunityFeed,
  getPost,
  updatePost,
  deletePost,
};