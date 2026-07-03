import { createApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./prisma.js";

const app = createApp();

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`TeamFlow API listening on http://localhost:${config.port} (${config.env})`);
});

// Graceful shutdown.
async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
