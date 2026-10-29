import Conversation from "../models/Conversation.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { emitToUser } from "../sockets/index.js";

export const getAll = asyncHandler(async (req, res) => {
  res.json(await Conversation.getAllForUser(req.user.id));
});

export const getColleagues = asyncHandler(async (req, res) => {
  res.json(await Conversation.getColleaguesForUser(req.user.id));
});

export const create = asyncHandler(async (req, res) => {
  const memberIds = req.body.member_ids;
  if (!Array.isArray(memberIds) || memberIds.length === 0 || memberIds.length > 50) {
    return res.status(400).json({ error: "member_ids must contain between 1 and 50 user IDs" });
  }
  if (memberIds.some((id) => !/^\d+$/.test(String(id)))) {
    return res.status(400).json({ error: "member_ids must contain valid user IDs" });
  }
  if (memberIds.every((id) => String(id) === String(req.user.id))) {
    return res.status(400).json({ error: "Select at least one other user." });
  }
  if (req.body.name !== undefined && typeof req.body.name !== "string") {
    return res.status(400).json({ error: "name must be a string" });
  }
  const conversation = await Conversation.create({
    userId: req.user.id,
    memberIds,
    name: req.body.name,
  });
  for (const member of conversation.members) {
    if (String(member.id) !== String(req.user.id)) {
      emitToUser(member.id, "conversation:new", { id: conversation.id });
    }
  }
  res.status(201).json(conversation);
});

export const getMessages = asyncHandler(async (req, res) => {
  const messages = await Conversation.getMessages(req.params.id, req.user.id);
  if (!messages) return res.status(404).json({ error: "Conversation not found" });
  res.json(messages);
});

export const createMessage = asyncHandler(async (req, res) => {
  const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
  if (!body) return res.status(400).json({ error: "body is required" });
  if (body.length > 5000) return res.status(400).json({ error: "message body must be 5000 characters or fewer" });
  const message = await Conversation.createMessage(req.params.id, req.user.id, body);
  if (!message) return res.status(404).json({ error: "Conversation not found" });
  for (const memberId of message.member_ids) {
    emitToUser(memberId, "message:new", message);
  }
  const { member_ids, ...response } = message;
  res.status(201).json(response);
});

export const markRead = asyncHandler(async (req, res) => {
  const membership = await Conversation.markRead(req.params.id, req.user.id);
  if (!membership) return res.status(404).json({ error: "Conversation not found" });
  res.json({ marked_read: true });
});
