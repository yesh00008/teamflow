import crypto from "node:crypto";
import { prisma } from "../prisma.js";
import { sendEmail } from "../lib/mailer.js";

// --- Duplicate suppression ---------------------------------------------------
// A deterministic key over (recipient, type, entity, channel, time-bucket).
// The Notification.dedupeKey column has a UNIQUE constraint, so a concurrent or
// replayed event that computes the same key cannot create a second row: the
// database rejects it. Bucketing by a coarse window collapses rapid repeats of
// "the same" logical event (e.g. a double-fired processing job) into one alert.
const DEDUPE_WINDOW_MS = 60_000; // 1 minute

function dedupeKey({ recipientId, type, entityType, entityId, channel, at }) {
  const bucket = Math.floor(at.getTime() / DEDUPE_WINDOW_MS);
  const raw = [recipientId, type, entityType || "", entityId || "", channel, bucket].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// --- Core pipeline -----------------------------------------------------------
// One entry point for every alert. For each requested channel we:
//   1. LOG the notification row first (state = PENDING) using the dedupeKey.
//      If the key already exists we treat it as a suppressed duplicate.
//   2. DISPATCH (in-app is immediate; email is actually sent via SMTP).
//   3. Record the outcome (SENT / FAILED) so delivery state is auditable.
export async function notify({
  recipientId,
  type,
  title,
  body,
  entityType,
  entityId,
  channels = ["IN_APP", "EMAIL"],
  at = new Date(),
}) {
  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient) return [];

  const results = [];
  for (const channel of channels) {
    // Respect per-user email opt-out; in-app is always delivered.
    if (channel === "EMAIL" && recipient.emailOptOut) continue;

    const key = dedupeKey({ recipientId, type, entityType, entityId, channel, at });

    // Step 1: log-before-dispatch. Unique dedupeKey makes this the suppression point.
    let record;
    try {
      record = await prisma.notification.create({
        data: {
          recipientId,
          type,
          channel,
          state: "PENDING",
          title,
          body,
          entityType,
          entityId,
          dedupeKey: key,
        },
      });
    } catch (err) {
      // P2002 = unique constraint violation => duplicate within the window.
      if (err.code === "P2002") {
        results.push({ channel, state: "SUPPRESSED" });
        continue;
      }
      throw err;
    }

    // Step 2 + 3: dispatch and record the outcome.
    if (channel === "IN_APP") {
      await prisma.notification.update({
        where: { id: record.id },
        data: { state: "SENT", sentAt: new Date() },
      });
      results.push({ channel, state: "SENT", id: record.id });
    } else if (channel === "EMAIL") {
      try {
        await sendEmail({ to: recipient.email, subject: title, text: body });
        await prisma.notification.update({
          where: { id: record.id },
          data: { state: "SENT", sentAt: new Date() },
        });
        results.push({ channel, state: "SENT", id: record.id });
      } catch (err) {
        // Known limitation: email failures surface rather than retry silently.
        await prisma.notification.update({
          where: { id: record.id },
          data: { state: "FAILED", error: String(err.message || err) },
        });
        results.push({ channel, state: "FAILED", id: record.id, error: String(err.message || err) });
      }
    }
  }
  return results;
}

// Fan a single logical event out to many recipients (deduped per recipient).
export async function notifyMany(recipientIds, payload) {
  const unique = [...new Set(recipientIds)].filter(Boolean);
  const out = [];
  for (const recipientId of unique) {
    out.push(...(await notify({ ...payload, recipientId })));
  }
  return out;
}

// --- Query helpers used by the routes ---------------------------------------
export async function listNotifications(userId, { unreadOnly = false } = {}) {
  return prisma.notification.findMany({
    where: {
      recipientId: userId,
      channel: "IN_APP",
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function unreadCount(userId) {
  return prisma.notification.count({
    where: { recipientId: userId, channel: "IN_APP", readAt: null },
  });
}

export async function markRead(userId, ids) {
  return prisma.notification.updateMany({
    where: { recipientId: userId, id: { in: ids } },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId) {
  return prisma.notification.updateMany({
    where: { recipientId: userId, channel: "IN_APP", readAt: null },
    data: { readAt: new Date() },
  });
}
