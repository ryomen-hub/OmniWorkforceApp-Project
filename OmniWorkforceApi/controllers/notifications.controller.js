import Notification from "../models/Notification.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

// Always the logged-in user, taken from the verified token — never from
// a client-supplied query string or body value
export const getByUser = asyncHandler(async (req, res) => {
  res.json(await Notification.getByUser(req.user.id));
});

export const markRead = asyncHandler(async (req, res) => {
  res.json(await Notification.markRead(req.params.id));
});

export const markAllRead = asyncHandler(async (req, res) => {
  res.json(await Notification.markAllRead(req.user.id));
});

export const remove = asyncHandler(async (req, res) => {
  await Notification.remove(req.params.id);
  res.status(204).end();
});
