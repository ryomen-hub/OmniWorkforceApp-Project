import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import usersRoutes from "./routes/users.routes.js";
import applicantsRoutes from "./routes/applicants.routes.js";
import payrollRoutes from "./routes/payroll.routes.js";
import postsRoutes from "./routes/posts.routes.js";
import emailsRoutes from "./routes/emails.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import jobPostingsRoutes from "./routes/jobPostings.routes.js";
import conversationsRoutes from "./routes/conversations.routes.js";
import payrollRunsRoutes from "./routes/payrollRuns.routes.js";
import { initSocket } from "./sockets/index.js";

const app = express();

// Sets a batch of protective HTTP response headers (blocks MIME-sniffing,
// disables framing to prevent clickjacking, etc.) — one line, no config
// needed for an API like this one
app.use(helmet());

app.use(cors());
app.use(express.json());

// Login is the one endpoint worth guessing passwords against, so it gets
// its own tighter limit than the rest of the API: 10 attempts per 15
// minutes, per IP. A real user mistyping a password a few times is fine;
// a script trying thousands of passwords is not.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/users/login", loginLimiter);

const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: "Too many password reset requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/users/password/forgot", passwordResetRequestLimiter);

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many password reset attempts. Please request a new link later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/users/password/reset", passwordResetLimiter);

// A looser limit across the whole API, mainly to blunt accidental infinite
// loops or scraping rather than to stop a determined attacker
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

// One line per entity — this is the only place the URL map is assembled
app.use("/api/users", usersRoutes);
app.use("/api/applicants", applicantsRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/emails", emailsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/job-postings", jobPostingsRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/payroll-runs", payrollRunsRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Catches anything passed to next(err) — which is how asyncHandler routes
// errors now that models are async. better-sqlite3 errors used to just
// throw synchronously and crash that one request; over a real network
// connection to Postgres, failures are more varied (bad constraint,
// connection drop, etc.) and deserve being translated into a real,
// specific response instead of a generic crash.
app.use((err, req, res, next) => {
  console.error(err);

  // Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
  if (err.code === "23505") return res.status(409).json({ error: "That value already exists." });
  if (err.code === "23503") return res.status(400).json({ error: "Referenced record does not exist." });
  if (err.code === "23514") return res.status(400).json({ error: "Invalid value for one of the fields." });
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;

// Express alone (app.listen) only speaks HTTP. Socket.io needs the raw
// HTTP server underneath it to also negotiate WebSocket connections — so
// the server is created explicitly here, Express is attached to it as its
// request handler, and Socket.io attaches to the same server object.
// One process, one port, two protocols.
const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => console.log(`OmniWorkforce API running on http://localhost:${PORT}`));
