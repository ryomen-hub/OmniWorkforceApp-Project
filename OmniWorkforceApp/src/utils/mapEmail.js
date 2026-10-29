// Pure functions (no React) so they can be tested on their own.

export function formatEmailTime(iso) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Backend row: { id, sender_email, recipient_role, subject, body, is_read, created_at }
// GmailPanel row: { id, sender, subject, snippet, time, unread, starred }
// In the Sent folder the useful "who" is the recipient department, not
// yourself; in the Inbox it's the sender's address.
export function mapEmail(email, folder) {
  const sent = folder === "sent";
  const body = email.body || "";
  return {
    id: String(email.id),
    sender: sent ? `To: ${email.recipient_role}` : email.sender_email || "Unknown sender",
    subject: email.subject,
    snippet: body.length > 90 ? `${body.slice(0, 90)}…` : body,
    time: formatEmailTime(email.created_at),
    unread: !sent && !email.is_read,
    starred: false, // the backend has no per-user starring yet (Phase 3)
  };
}
