import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/errors.js";
import { parse } from "../lib/validate.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
} from "../services/notificationService.js";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const unreadOnly = String(req.query.unreadOnly || "false") === "true";
    const [items, unread] = await Promise.all([
      listNotifications(req.user.id, { unreadOnly }),
      unreadCount(req.user.id),
    ]);
    res.json({ notifications: items, unreadCount: unread });
  })
);

router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    res.json({ unreadCount: await unreadCount(req.user.id) });
  })
);

router.post(
  "/mark-read",
  asyncHandler(async (req, res) => {
    const { ids } = parse(z.object({ ids: z.array(z.string()).min(1) }), req.body);
    await markRead(req.user.id, ids);
    res.json({ unreadCount: await unreadCount(req.user.id) });
  })
);

router.post(
  "/mark-all-read",
  asyncHandler(async (req, res) => {
    await markAllRead(req.user.id);
    res.json({ unreadCount: 0 });
  })
);

export default router;
