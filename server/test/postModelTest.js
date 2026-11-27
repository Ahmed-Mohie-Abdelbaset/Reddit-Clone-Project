const mongoose = require("mongoose");
const Post = require("../models/Post");

const runTests = async () => {
  console.log("Running Post model validation tests...\n");

  // 1. Valid post
  const validPost = new Post({
    title: "   How to structure a MERN project?   ",
    content: "Looking for best practices on folder layout.",
    authorId: new mongoose.Types.ObjectId(),
    communityId: new mongoose.Types.ObjectId(),
  });

  await validPost.validate();
  if (validPost.title !== "How to structure a MERN project?") {
    throw new Error("Expected title to be trimmed");
  }
  if (validPost.score !== 0 || validPost.isRemoved !== false || validPost.editedAt !== null) {
    throw new Error("Default values mismatch");
  }
  if (validPost.aiSummary.text !== null || validPost.aiSummary.generatedAt !== null) {
    throw new Error("aiSummary defaults mismatch");
  }
  console.log("PASS 1: Valid post passed validation & defaults.");

  // 2. Reject empty/whitespace-only title
  const emptyTitlePost = new Post({
    title: "    ",
    authorId: new mongoose.Types.ObjectId(),
    communityId: new mongoose.Types.ObjectId(),
  });
  try {
    await emptyTitlePost.validate();
    throw new Error("Should have rejected empty title");
  } catch (err) {
    if (err.name !== "ValidationError") throw err;
    console.log("PASS 2: Empty/whitespace title rejected.");
  }

  // 3. Reject title > 300 chars
  const longTitlePost = new Post({
    title: "a".repeat(301),
    authorId: new mongoose.Types.ObjectId(),
    communityId: new mongoose.Types.ObjectId(),
  });
  try {
    await longTitlePost.validate();
    throw new Error("Should have rejected >300 char title");
  } catch (err) {
    if (err.name !== "ValidationError") throw err;
    console.log("PASS 3: Title over 300 chars rejected.");
  }

  // 4. Reject content > 10000 chars
  const longContentPost = new Post({
    title: "Valid title",
    content: "b".repeat(10001),
    authorId: new mongoose.Types.ObjectId(),
    communityId: new mongoose.Types.ObjectId(),
  });
  try {
    await longContentPost.validate();
    throw new Error("Should have rejected >10000 char content");
  } catch (err) {
    if (err.name !== "ValidationError") throw err;
    console.log("PASS 4: Content over 10000 chars rejected.");
  }

  // 5. Reject missing authorId or communityId
  const missingRefsPost = new Post({ title: "No author or community" });
  try {
    await missingRefsPost.validate();
    throw new Error("Should have rejected missing authorId/communityId");
  } catch (err) {
    if (err.name !== "ValidationError") throw err;
    console.log("PASS 5: Missing authorId and communityId rejected.");
  }

  console.log("\nAll Post model tests passed!");
};

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});