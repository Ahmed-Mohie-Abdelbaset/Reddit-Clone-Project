require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Community = require("../models/Community");
const Post = require("../models/Post");
const { getCommunityFeed } = require("../controllers/postController");

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

const runPaginationTest = async () => {
  await connectDB();

  const suffix = Date.now();
  let testUser;
  let testCommunity;

  try {
    // 1. Create isolated test user & community
    testUser = await User.create({
      username: `pagetest_${suffix}`,
      email: `pagetest_${suffix}@example.com`,
      passwordHash: "hashed_placeholder",
    });

    testCommunity = await Community.create({
      name: `pagecomm_${suffix}`,
      description: "Temporary pagination test community",
      moderatorId: testUser._id,
    });

    // 2. Seed 25 posts with distinct timestamps and scores
    const baseTime = Date.now();
    const docs = Array.from({ length: 25 }, (_, i) => ({
      title: `Seeded Post #${i + 1}`,
      content: `Body for seeded post ${i + 1}`,
      authorId: testUser._id,
      communityId: testCommunity._id,
      score: i % 5, // intentional score ties to verify _id tie-breaking
      createdAt: new Date(baseTime + i * 1000),
      updatedAt: new Date(baseTime + i * 1000),
    }));

    await Post.insertMany(docs);
    console.log("Seeded 25 posts successfully.");

    // 3. Fetch Page 1, Page 2, Page 3 with limit=10 on both "new" and "top"
    for (const sort of ["new", "top"]) {
      const seenIds = new Set();
      const pageCounts = [];

      for (const page of [1, 2, 3]) {
        const req = {
          params: { name: testCommunity.name },
          query: { sort, page: String(page), limit: "10" },
          user: undefined,
        };
        const res = mockRes();
        await getCommunityFeed(req, res, (err) => {
          throw err;
        });

        if (res.statusCode !== 200) {
          throw new Error(`Expected 200 on page ${page}, got ${res.statusCode}`);
        }

        const { posts, total, totalPages, hasMore } = res.body;
        if (total !== 25 || totalPages !== 3) {
          throw new Error(`Expected total=25, totalPages=3; got ${total}, ${totalPages}`);
        }

        const expectedHasMore = page < 3;
        if (hasMore !== expectedHasMore) {
          throw new Error(`Page ${page} hasMore expected ${expectedHasMore}, got ${hasMore}`);
        }

        pageCounts.push(posts.length);
        for (const p of posts) {
          const idStr = p._id.toString();
          if (seenIds.has(idStr)) {
            throw new Error(`Duplicate post ID found across pages: ${idStr}`);
          }
          seenIds.add(idStr);
        }
      }

      if (pageCounts.join(",") !== "10,10,5" || seenIds.size !== 25) {
        throw new Error(`Sort=${sort} failed: counts=${pageCounts.join(",")}, unique=${seenIds.size}`);
      }
      console.log(`PASS (${sort}): Pages returned 10, 10, 5 posts with 25 unique IDs (0 duplicates).`);
    }
  } finally {
    // 4. Clean up all seeded documents so Atlas stays clean
    if (testCommunity) {
      await Post.deleteMany({ communityId: testCommunity._id });
      await Community.deleteOne({ _id: testCommunity._id });
    }
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
    }
    await mongoose.connection.close();
    console.log("Cleaned up temporary test data and closed DB connection.");
  }
};

runPaginationTest().catch((err) => {
  console.error("Pagination test failed:", err);
  process.exit(1);
});