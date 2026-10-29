import Notification from "../models/Notification.js";
import { emitToUser } from "../sockets/index.js";

// The notification is saved to the database first, then pushed live — so
// someone who's offline still finds it waiting when they next load the
// app, and someone who's online sees it arrive instantly.
//
// Errors are logged, not thrown: by the time these run, the action that
// triggered them (advancing a stage, sending an email) has already
// succeeded, and a failed notification shouldn't turn that into an error.
export async function notifyUser(userId, title, description) {
  try {
    const notification = await Notification.create({ user_id: userId, title, description });
    emitToUser(notification.user_id, "notification:new", notification);
    return notification;
  } catch (err) {
    console.error("notifyUser failed:", err);
    return null;
  }
}

export async function notifyRole(role, title, description, excludeUserId) {
  try {
    const rows = await Notification.createForRole(role, title, description, excludeUserId);
    for (const notification of rows) {
      emitToUser(notification.user_id, "notification:new", notification);
    }
    return rows;
  } catch (err) {
    console.error("notifyRole failed:", err);
    return [];
  }
}
