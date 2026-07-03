import { prisma } from "../prisma.js";

// Append-only audit trail. Accepts an optional transaction client so a log
// entry can be written atomically with the state change it describes.
export async function logActivity(
  { actorId, projectId, action, entityType, entityId, metadata },
  client = prisma
) {
  return client.activityLog.create({
    data: { actorId, projectId, action, entityType, entityId, metadata },
  });
}
