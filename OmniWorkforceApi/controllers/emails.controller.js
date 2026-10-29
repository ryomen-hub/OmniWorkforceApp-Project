import Email from "../models/Email.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { notifyRole } from "../services/notify.js";

// "inbox" is always the logged-in user's own department, "sent" is always
// their own sent mail — both taken from the verified token
export const getByFolder = asyncHandler(async (req, res) => {
  const folder = req.query.folder || "inbox";
  if (folder === "sent") {
    return res.json(await Email.getSent(req.user.id));
  }
  res.json(await Email.getInbox(req.user.role));
});

// recipient_role is who the message is going TO — separate from
// req.user.role, which is who's SENDING it. sender_id is always the
// logged-in user, never client input.
export const create = asyncHandler(async (req, res) => {
  const { recipient, recipient_role, subject, body } = req.body;
  if (!recipient || !recipient_role || !subject || !body) {
    return res.status(400).json({ error: "recipient, recipient_role, subject, and body are required" });
  }
  const email = await Email.create({ sender_id: req.user.id, recipient, recipient_role, subject, body, folder: "sent" });

  // Everyone in the receiving department gets notified — except the sender
  await notifyRole(recipient_role, "New email", subject, req.user.id);

  res.status(201).json(email);
});

export const markRead = asyncHandler(async (req, res) => {
  const updated = await Email.markRead(req.params.id, req.user.role);
  if (!updated) return res.status(404).json({ error: "Email not found" });
  res.json(updated);
});

export const remove = asyncHandler(async (req, res) => {
  const removed = await Email.remove(req.params.id, req.user.id, req.user.role);
  if (!removed) return res.status(404).json({ error: "Email not found" });
  res.status(204).end();
});
