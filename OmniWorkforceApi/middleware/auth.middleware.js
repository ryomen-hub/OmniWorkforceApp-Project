import jwt from "jsonwebtoken";

// Reads "Authorization: Bearer <token>", verifies it, and attaches the
// decoded payload as req.user — { id, email, role }.
//
// Every controller that used to trust a client-supplied user_id/author_id
// now reads req.user instead. The client can no longer just claim to be
// someone else by changing a request body value.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    // Covers both an invalid signature and an expired token
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
