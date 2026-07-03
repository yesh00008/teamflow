import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncHandler, badRequest, notFound } from "../lib/errors.js";
import { parse } from "../lib/validate.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireProjectRole } from "../middleware/projectAccess.js";
import { logActivity } from "../services/activityService.js";

const router = Router();
router.use(authenticate);

// List projects the caller belongs to.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: { members: { some: { userId: req.user.id } } },
      include: {
        _count: { select: { tasks: true, rcas: true, members: true } },
        members: { where: { userId: req.user.id }, select: { role: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json({
      projects: projects.map((p) => ({ ...p, myRole: p.members[0]?.role, members: undefined })),
    });
  })
);

// Create a project. Creator becomes OWNER.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parse(
      z.object({
        key: z.string().min(1).max(10).regex(/^[A-Za-z0-9]+$/),
        name: z.string().min(1),
        description: z.string().optional(),
      }),
      req.body
    );
    const existing = await prisma.project.findUnique({ where: { key: data.key.toUpperCase() } });
    if (existing) throw badRequest("Project key already in use");

    const project = await prisma.project.create({
      data: {
        key: data.key.toUpperCase(),
        name: data.name,
        description: data.description,
        members: { create: { userId: req.user.id, role: "OWNER" } },
      },
    });
    await logActivity({
      actorId: req.user.id,
      projectId: project.id,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      metadata: { name: project.name },
    });
    res.status(201).json({ project });
  })
);

router.get(
  "/:projectId",
  requireProjectRole("VIEWER"),
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { tasks: true, rcas: true } },
      },
    });
    res.json({ project, myRole: req.membership.role });
  })
);

router.patch(
  "/:projectId",
  requireProjectRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = parse(
      z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        archived: z.boolean().optional(),
      }),
      req.body
    );
    const project = await prisma.project.update({ where: { id: req.params.projectId }, data });
    res.json({ project });
  })
);

// --- Members ---------------------------------------------------------------
router.post(
  "/:projectId/members",
  requireProjectRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { email, role } = parse(
      z.object({ email: z.string().email(), role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER") }),
      req.body
    );
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw notFound("No user with that email");

    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: req.params.projectId, userId: user.id } },
      update: { role },
      create: { projectId: req.params.projectId, userId: user.id, role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await logActivity({
      actorId: req.user.id,
      projectId: req.params.projectId,
      action: "project.member_added",
      entityType: "project",
      entityId: req.params.projectId,
      metadata: { userId: user.id, role },
    });
    res.status(201).json({ member });
  })
);

router.delete(
  "/:projectId/members/:userId",
  requireProjectRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.params.userId } },
    });
    res.status(204).end();
  })
);

// --- Per-user view preference ----------------------------------------------
router.get(
  "/:projectId/view-preference",
  requireProjectRole("VIEWER"),
  asyncHandler(async (req, res) => {
    const pref = await prisma.viewPreference.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId: req.params.projectId } },
    });
    res.json({ viewMode: pref?.viewMode || "KANBAN" });
  })
);

router.put(
  "/:projectId/view-preference",
  requireProjectRole("VIEWER"),
  asyncHandler(async (req, res) => {
    const { viewMode } = parse(z.object({ viewMode: z.enum(["KANBAN", "CALENDAR", "LIST"]) }), req.body);
    const pref = await prisma.viewPreference.upsert({
      where: { userId_projectId: { userId: req.user.id, projectId: req.params.projectId } },
      update: { viewMode },
      create: { userId: req.user.id, projectId: req.params.projectId, viewMode },
    });
    res.json({ viewMode: pref.viewMode });
  })
);

export default router;
