import { useEffect, useState } from "react";
import { API_BASE } from "../config/api";

// Backend fields (title, description, is_read) renamed to what
// TopNavbar.jsx actually renders (title, desc, unread) — same reasoning
// as mapPost in useMainBoard: the backend's field names don't have to
// match the component's, a small mapper keeps that decoupled.
function mapNotification(n) {
  return { id: String(n.id), title: n.title, desc: n.description, unread: !n.is_read };
}

export default function useNotifications(token, authHeader, socket, showToast) {
  const [notifications, setNotifications] = useState([]);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      return;
    }
    fetch(`${API_BASE}/notifications`, { headers: { ...authHeader } })
      .then((res) => res.json())
      .then((data) => setNotifications(Array.isArray(data) ? data.map(mapNotification) : []))
      .catch(() => {});
  }, [token, authHeader]);

  // A brand-new notification only ever gets sent to this one user's own
  // private room (see sockets/index.js emitToUser on the backend) — so
  // unlike posts, there's no "everyone including the sender" broadcast
  // pattern here to reuse; this is the only way a new one ever arrives.
  useEffect(() => {
    if (!socket) return;
    const onNew = (notification) => {
      setNotifications((items) => [mapNotification(notification), ...items]);
      showToast(notification.title);
    };
    socket.on("notification:new", onNew);
    return () => socket.off("notification:new", onNew);
  }, [socket]);

  const markNotifRead = async (id) => {
    setNotifications((items) => items.map((item) => (item.id === id ? { ...item, unread: false } : item)));
    try {
      await fetch(`${API_BASE}/notifications/${id}/read`, { method: "PATCH", headers: { ...authHeader } });
    } catch {
      // Local state already flipped; a failed sync here isn't worth
      // reverting the UI over — next full reload reconciles it either way.
    }
  };

  const markAllNotifsRead = async () => {
    setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
    try {
      await fetch(`${API_BASE}/notifications/read-all`, { method: "PATCH", headers: { ...authHeader } });
      showToast("All notifications marked as read.");
    } catch {
      showToast("Could not sync read status with the server.");
    }
  };

  return {
    notifications,
    setNotifications,
    notifDropdownOpen,
    setNotifDropdownOpen,
    unreadNotifCount: notifications.filter((item) => item.unread).length,
    markNotifRead,
    markAllNotifsRead,
  };
}
