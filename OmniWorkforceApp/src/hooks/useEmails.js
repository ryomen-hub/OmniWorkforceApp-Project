import { useCallback, useEffect, useState } from "react";
import { roleToEmailHandle } from "../utils/formatters";
import { mapEmail } from "../utils/mapEmail";

const API_BASE = "http://localhost:4000/api";

export default function useEmails(token, authHeader, socket, role, showToast) {
  const [emailFolder, setEmailFolder] = useState("inbox");
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);

  const load = useCallback(
    async (folder) => {
      const res = await fetch(`${API_BASE}/emails?folder=${folder}`, { headers: { ...authHeader } });
      const data = await res.json();
      const rows = Array.isArray(data) ? data.map((email) => mapEmail(email, folder)) : [];
      (folder === "sent" ? setSent : setInbox)(rows);
    },
    [authHeader]
  );

  // The inbox is always loaded (the unread badge needs it even while
  // you're looking at Sent); Sent only when it's the folder on screen.
  useEffect(() => {
    if (!token) {
      setInbox([]);
      setSent([]);
      setEmailFolder("inbox");
      return;
    }
    load("inbox").catch(() => showToast("Could not load your inbox."));
    if (emailFolder === "sent") load("sent").catch(() => showToast("Could not load sent mail."));
  }, [token, emailFolder, load]);

  // A "New email" notification means mail just arrived for this user's
  // department — refresh the inbox so it appears without a page reload.
  useEffect(() => {
    if (!socket) return;
    const onNotification = (notification) => {
      if (notification.title === "New email") load("inbox").catch(() => {});
    };
    socket.on("notification:new", onNotification);
    return () => socket.off("notification:new", onNotification);
  }, [socket, load]);

  const openEmail = async (email) => {
    showToast(`Opened email from ${email.sender}`);
    if (emailFolder === "sent" || !email.unread) return;
    setInbox((items) => items.map((item) => (item.id === email.id ? { ...item, unread: false } : item)));
    try {
      await fetch(`${API_BASE}/emails/${email.id}/read`, { method: "PATCH", headers: { ...authHeader } });
    } catch {
      // Marked read locally already; the next reload reconciles it.
    }
  };

  // Returns true when the email was actually sent, so the caller knows
  // whether it's safe to close and clear the compose window.
  const sendEmail = async ({ recipientRole, subject, body }) => {
    if (!recipientRole || !subject || !body) {
      showToast("Choose a department and fill in the subject and message.");
      return false;
    }
    try {
      const res = await fetch(`${API_BASE}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          recipient: `${roleToEmailHandle(recipientRole)}@omniworkforce.ph`,
          recipient_role: recipientRole,
          subject,
          body,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        showToast(error || "Could not send the email.");
        return false;
      }
      showToast(`Email sent to ${recipientRole}.`);
      if (emailFolder === "sent") load("sent").catch(() => {});
      if (recipientRole === role) load("inbox").catch(() => {}); // wrote to your own department
      return true;
    } catch {
      showToast("Could not reach the server.");
      return false;
    }
  };

  const emails = emailFolder === "sent" ? sent : emailFolder === "starred" ? [] : inbox;

  return {
    emailFolder,
    setEmailFolder,
    emails,
    inboxUnreadCount: inbox.filter((email) => email.unread).length,
    emailHandleDisplay: role ? `${roleToEmailHandle(role)}@omniworkforce.ph` : "",
    openEmail,
    sendEmail,
  };
}
