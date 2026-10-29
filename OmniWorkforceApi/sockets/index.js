import { Server } from "socket.io";
import { socketAuth } from "./socketAuth.js";

let io;

// Called once from server.js, after the HTTP server is created. Socket.io
// attaches to the same underlying server Express uses — it isn't a
// second server on a second port, just a second protocol (WebSocket)
// layered onto the one already running.
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*" }, // dev-friendly for now; narrow this before any real deployment
  });

  io.use(socketAuth);

  io.on("connection", (socket) => {
    // Every user automatically joins a private room named after their own
    // id. This is what makes "send this update to exactly one person"
    // possible later (notifications) without broadcasting to everyone —
    // io.to(`user:${id}`).emit(...) only reaches that one room's members.
    socket.join(`user:${socket.user.id}`);

    // A small acknowledgment back to the client — confirms the connection
    // is genuinely authenticated (not just "the socket opened"), and gives
    // the frontend a reliable signal to know it's safe to start listening
    // for other events.
    socket.emit("connected", { user: socket.user });

    socket.on("disconnect", () => {
      // Socket.io removes the socket from its rooms automatically on
      // disconnect — nothing to clean up manually here.
    });
  });

  return io;
}

// Lets any controller reach the same io instance without importing
// server.js directly (which would create a circular import, since
// server.js is what imports the routes that use the controllers).
export function getIo() {
  if (!io) throw new Error("Socket.io not initialized yet — initSocket() must run first");
  return io;
}

// Sends an event to every connected (and already authenticated) socket.
// Deliberately does nothing if Socket.io isn't running: the database
// change has already succeeded by the time a controller calls this, and a
// missing live-update shouldn't turn a successful save into an error.
export function broadcast(event, payload) {
  if (io) io.emit(event, payload);
}

// Sends an event to exactly one user — their private room (user:<id>),
// which they joined automatically on connect. Nobody else receives it.
// Like broadcast(), does nothing if Socket.io isn't running.
export function emitToUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}
