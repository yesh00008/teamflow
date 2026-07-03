import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { HttpError } from "./lib/errors.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import projectRoutes from "./routes/projects.js";
import taskRoutes from "./routes/tasks.js";
import rcaRoutes from "./routes/rcas.js";
import attachmentRoutes from "./routes/attachments.js";
import notificationRoutes from "./routes/notifications.js";
import analyticsRoutes from "./routes/analytics.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.clientOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "teamflow", ts: new Date().toISOString() }));

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/projects", projectRoutes);
  // Task and RCA routers declare their own nested paths (projects/:id/... and /tasks/:id/...).
  app.use("/api", taskRoutes);
  app.use("/api", rcaRoutes);
  app.use("/api", analyticsRoutes);
  app.use("/api/attachments", attachmentRoutes);
  app.use("/api/notifications", notificationRoutes);

  // 404 for unknown API routes.
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // Central error handler.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    // eslint-disable-next-line no-console
    console.error("[unhandled]", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
