import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncHandler, badRequest, unauthorized } from "../lib/errors.js";
import { hashPassword, verifyPassword, signToken } from "../lib/auth.js";
import { parse } from "../lib/validate.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  theme: u.theme,
  emailOptOut: u.emailOptOut,
});

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, name } = parse(credentials, req.body);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw badRequest("Email already registered");

    const user = await prisma.user.create({
      data: { email, name: name || email.split("@")[0], passwordHash: await hashPassword(password) },
    });
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = parse(credentials.pick({ email: true, password: true }), req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ user: publicUser(user) });
  })
);

// Update own profile: theme + email opt-out.
router.patch(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const data = parse(
      z.object({ theme: z.enum(["LIGHT", "DARK"]).optional(), emailOptOut: z.boolean().optional() }),
      req.body
    );
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({ user: publicUser(user) });
  })
);

export default router;
