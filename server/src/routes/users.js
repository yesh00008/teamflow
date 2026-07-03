import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../lib/errors.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();
router.use(authenticate);

// Directory of users, used for assignee pickers and @mention lookup.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = (req.query.q || "").toString().trim();
    const users = await prisma.user.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
        : undefined,
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 50,
    });
    res.json({ users });
  })
);

export default router;
