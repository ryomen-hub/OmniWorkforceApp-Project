import jwt from "jsonwebtoken";

// Runs once, the moment a client tries to open a socket connection —
// mirrors middleware/auth.middleware.js for HTTP routes. A connection
// with no token, or a bad one, never gets in. Same JWT_SECRET, same
// verification, same payload shape as the HTTP side, so a socket
// connection can't be trusted with anything an HTTP request couldn't be.
export function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Missing authentication token"));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    next(new Error("Invalid or expired token"));
  }
}
