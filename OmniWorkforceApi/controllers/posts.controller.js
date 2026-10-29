import Post from "../models/Post.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { broadcast } from "../sockets/index.js";

export const getAll = asyncHandler(async (req, res) => {
  res.json(await Post.getAll(req.user.id));
});

// author_id is always the logged-in user, from the verified token.
// The live broadcast only happens after requireAuth + requireRole have
// already allowed this request through, so a role that isn't allowed to
// post (Recruitment, Agent/Employee) never triggers one.
export const create = asyncHandler(async (req, res) => {
  const { body, image } = req.body;
  if (!body) return res.status(400).json({ error: "body is required" });
  await Post.create({ author_id: req.user.id, body, image });
  const posts = await Post.getAll(req.user.id);
  const newPost = posts[0];
  broadcast("post:created", newPost);
  res.status(201).json(newPost);
});

export const remove = asyncHandler(async (req, res) => {
  await Post.remove(req.params.id);
  broadcast("post:deleted", { id: String(req.params.id) });
  res.status(204).end();
});

// user_id is always the logged-in user reacting, from the verified token
export const toggleReaction = asyncHandler(async (req, res) => {
  const { type } = req.body;
  if (!type) return res.status(400).json({ error: "type is required" });
  const result = await Post.toggleReaction(req.params.id, req.user.id, type);
  const counts = await Post.getReactionCounts(req.params.id);
  broadcast("post:reactions", { postId: String(req.params.id), counts });
  res.json(result);
});
