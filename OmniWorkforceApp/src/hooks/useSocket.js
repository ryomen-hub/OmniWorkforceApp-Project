import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:4000";

// Connects once a real JWT exists (after login), disconnects on logout —
// same token used for every REST call also authenticates the socket, via
// the "auth" option Socket.io sends during its handshake (this is what
// sockets/socketAuth.js on the backend verifies before allowing the
// connection at all).
export default function useSocket(token) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(SOCKET_URL, { auth: { token }, reconnection: true });
    socketRef.current = socket;

    socket.on("connected", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return { socket: socketRef.current, connected };
}
