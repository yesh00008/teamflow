import dotenv from "dotenv";
dotenv.config();

const required = ["DATABASE_URL", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    // eslint-disable-next-line no-console
    console.warn(`[config] Warning: ${key} is not set. See server/.env.example`);
  }
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  smtp: {
    host: process.env.SMTP_HOST || "localhost",
    port: Number(process.env.SMTP_PORT || 1025),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.EMAIL_FROM || "TeamFlow <no-reply@teamflow.local>",
  },
  uploads: {
    dir: process.env.UPLOAD_DIR || "uploads",
    maxBytes: Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024,
  },
};
