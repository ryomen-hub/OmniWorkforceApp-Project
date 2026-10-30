import { useEffect, useRef, useState } from "react";
import { ROLES } from "../constants/roles";

const API_BASE = "http://localhost:4000/api";

const ROLE_META = {
  [ROLES.ADMIN]: { initials: "AO", author: "Admin Manager" },
  [ROLES.RECRUITERS_HR]: { initials: "HR", author: "HR Specialist" },
  [ROLES.RECRUITMENT]: { initials: "RC", author: "Recruitment Specialist" },
  [ROLES.PAYROLL]: { initials: "PO", author: "Payroll Officer" },
  [ROLES.EMPLOYEE]: { initials: "EM", author: "Team Member" },
};
const REACTION_META = {
  like: { emoji: "👍", label: "Like" },
  celebrate: { emoji: "🎉", label: "Celebrate" },
  insightful: { emoji: "💡", label: "Insightful" },
};

function formatTime(iso) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Reshapes one post from the backend's shape (author_id, author_email,
// author_role, reactions: {like: {count, reacted}}) into what MainBoard.jsx
// actually renders (initials, author, roleTag, time, reactions with
// emoji/label). The backend has no reason to know about emoji or display
// labels — that's presentation, so it's added here, not stored there.
function mapPost(post) {
  const meta = ROLE_META[post.author_role] || { initials: "??", author: "Team Member" };
  const reactions = {};
  for (const key of Object.keys(REACTION_META)) {
    const r = post.reactions?.[key] || { count: 0, reacted: false };
    reactions[key] = { ...REACTION_META[key], count: r.count, reacted: r.reacted };
  }
  return {
    id: String(post.id),
    initials: meta.initials,
    author: `${meta.author} (${post.author_email})`,
    roleTag: post.author_role,
    time: formatTime(post.created_at),
    body: post.body,
    image: post.image,
    reactions,
  };
}

export default function useMainBoard(token, authHeader, socket, showToast) {
  const [posts, setPosts] = useState([]);
  const [postContent, setPostContent] = useState("");
  const [postImageName, setPostImageName] = useState("");
  const fileInputRef = useRef(null);

  // Initial load — real data, replacing the old hardcoded seed array
  useEffect(() => {
    // No token means logged out — skip the request instead of firing it
    // and catching the inevitable 401. Also clears stale data from a
    // previous session so it doesn't linger on screen after logout.
    if (!token) {
      setPosts([]);
      return;
    }
    fetch(`${API_BASE}/posts`, { headers: { ...authHeader } })
      .then((res) => res.json())
      .then((data) => setPosts(Array.isArray(data) ? data.map(mapPost) : []))
      .catch(() => showToast("Could not load the Main Board feed."));
  }, [token, authHeader]);

  // Live updates — every connected user, including whoever performed the
  // action, receives these the same way (see server: broadcast() sends to
  // everyone). That's deliberate: it means the UI reacts to exactly one
  // code path whether the change came from this tab or someone else's.
  useEffect(() => {
    if (!socket) return;
    const onCreated = (post) => setPosts((items) => [mapPost(post), ...items]);
    const onDeleted = ({ id }) => setPosts((items) => items.filter((post) => post.id !== String(id)));
    const onReactions = ({ postId, counts }) =>
      setPosts((items) =>
        items.map((post) => {
          if (post.id !== String(postId)) return post;
          const reactions = { ...post.reactions };
          for (const key of Object.keys(counts)) {
            reactions[key] = { ...reactions[key], count: counts[key] };
          }
          return { ...post, reactions };
        })
      );

    socket.on("post:created", onCreated);
    socket.on("post:deleted", onDeleted);
    socket.on("post:reactions", onReactions);
    return () => {
      socket.off("post:created", onCreated);
      socket.off("post:deleted", onDeleted);
      socket.off("post:reactions", onReactions);
    };
  }, [socket]);

  const handleMainBoardPost = async () => {
    const content = postContent.trim();
    if (!content) return;
    const file = fileInputRef.current?.files?.[0];

    const send = async (image) => {
      const res = await fetch(`${API_BASE}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ body: content, image }),
      });
      // No local setPosts() call here on purpose — the new post arrives
      // via the post:created broadcast instead, same as it does for every
      // other connected user. One path, not two.
      if (res.ok) {
        setPostContent("");
        setPostImageName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        showToast("Announcement published successfully to Main Board!");
      } else {
        const { error } = await res.json().catch(() => ({}));
        showToast(error || "Could not publish the announcement.");
      }
    };

    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => send(event.target.result);
      reader.readAsDataURL(file);
    } else {
      send(null);
    }
  };

  const toggleReaction = async (postId, key) => {
    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ type: key }),
      });
      if (!res.ok) return;
      const { reacted } = await res.json();
      // Only this viewer's own reacted flag is updated directly — it's
      // per-person and the server doesn't broadcast it. The count itself
      // is left to the post:reactions broadcast, which arrives right after.
      setPosts((items) =>
        items.map((post) =>
          post.id !== String(postId)
            ? post
            : { ...post, reactions: { ...post.reactions, [key]: { ...post.reactions[key], reacted } } }
        )
      );
    } catch {
      showToast("Could not update your reaction.");
    }
  };

  return { posts, postContent, setPostContent, fileInputRef, postImageName, setPostImageName, handleMainBoardPost, toggleReaction };
}
