import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncHandler, badRequest, forbidden, notFound } from "../lib/errors.js";
import { parse } from "../lib/validate.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireProjectRole } from "../middleware/projectAccess.js";
import { logActivity } from "../services/activityService.js";
import { notify, notifyMany } from "../services/notificationService.js";
import {
  assertValidTransition,
  createRelation,
  computeTaskWarnings,
  nextTaskNumber,
} from "../services/taskService.js";

const router = Router();
router.use(authenticate);

const taskInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  creator: { select: { id: true, name: true, email: true } },
  parent: { select: { id: true, number: true, title: true } },
  _count: { select: { comments: true, attachments: true, children: true } },
  outgoingRelations: { include: { target: { select: { id: true, number: true, title: true, status: true, projectId: true } } } },
  incomingRelations: { include: { source: { select: { id: true, number: true, title: true, status: true, projectId: true } } } },
};

// Verify caller can access the project a given task belongs to, with min role.
async function loadTaskWithAccess(taskId, userId, minimum = "VIEWER") {
  const RANK = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  if (!task) throw notFound("Task not found");
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: task.projectId, userId } },
  });
  if (!membership) throw forbidden("You are not a member of this project");
  if (RANK[membership.role] < RANK[minimum]) throw forbidden(`Requires ${minimum} role`);
  return { task, membership };
}

// --- List tasks in a project (supports filters used by CSV export too) ------
export function buildTaskFilter(projectId, query) {
  const where = { projectId };
  if (query.status) where.status = { in: String(query.status).split(",") };
  if (query.priority) where.priority = { in: String(query.priority).split(",") };
  if (query.assigneeId) where.assigneeId = query.assigneeId === "none" ? null : query.assigneeId;
  if (query.q) {
    where.OR = [
      { title: { contains: String(query.q), mode: "insensitive" } },
      { description: { contains: String(query.q), mode: "insensitive" } },
    ];
  }
  return where;
}

router.get(
  "/projects/:projectId/tasks",
  requireProjectRole("VIEWER"),
  asyncHandler(async (req, res) => {
    const where = buildTaskFilter(req.params.projectId, req.query);
    const sort = String(req.query.sort || "createdAt");
    const dir = String(req.query.dir || "desc") === "asc" ? "asc" : "desc";
    const allowedSort = ["createdAt", "updatedAt", "dueDate", "priority", "status", "number"];
    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: { [allowedSort.includes(sort) ? sort : "createdAt"]: dir },
    });
    res.json({ tasks });
  })
);

// --- Create a task ----------------------------------------------------------
router.post(
  "/projects/:projectId/tasks",
  requireProjectRole("MEMBER"),
  asyncHandler(async (req, res) => {
    const data = parse(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
        assigneeId: z.string().optional().nullable(),
        parentId: z.string().optional().nullable(),
        dueDate: z.string().datetime().optional().nullable(),
        startDate: z.string().datetime().optional().nullable(),
      }),
      req.body
    );
    const projectId = req.params.projectId;
    const number = await nextTaskNumber(projectId);

    const task = await prisma.task.create({
      data: {
        projectId,
        number,
        title: data.title,
        description: data.description,
        priority: data.priority,
        assigneeId: data.assigneeId || null,
        parentId: data.parentId || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        creatorId: req.user.id,
      },
      include: taskInclude,
    });

    await logActivity({
      actorId: req.user.id,
      projectId,
      action: "task.created",
      entityType: "task",
      entityId: task.id,
      metadata: { number: task.number, title: task.title },
    });

    if (task.assigneeId && task.assigneeId !== req.user.id) {
      await notify({
        recipientId: task.assigneeId,
        type: "TASK_ASSIGNED",
        title: `Assigned: ${req.project.key}-${task.number} ${task.title}`,
        body: `${req.user.name} assigned you a task.`,
        entityType: "task",
        entityId: task.id,
      });
    }

    const warnings = await computeTaskWarnings(task.id);
    res.status(201).json({ task, warnings });
  })
);

// --- Get one task -----------------------------------------------------------
router.get(
  "/tasks/:taskId",
  asyncHandler(async (req, res) => {
    const { task } = await loadTaskWithAccess(req.params.taskId, req.user.id);
    const warnings = await computeTaskWarnings(task.id);
    res.json({ task, warnings });
  })
);

// --- Update task fields (assignee change / due date / priority / title) -----
router.patch(
  "/tasks/:taskId",
  asyncHandler(async (req, res) => {
    const { task } = await loadTaskWithAccess(req.params.taskId, req.user.id, "MEMBER");
    const data = parse(
      z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
        assigneeId: z.string().optional().nullable(),
        parentId: z.string().optional().nullable(),
        dueDate: z.string().datetime().optional().nullable(),
        startDate: z.string().datetime().optional().nullable(),
      }),
      req.body
    );

    if (data.parentId && data.parentId === task.id) throw badRequest("A task cannot be its own parent");

    const patch = { ...data };
    if ("dueDate" in data) patch.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if ("startDate" in data) patch.startDate = data.startDate ? new Date(data.startDate) : null;

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: patch,
      include: taskInclude,
    });

    // Notify on assignee change.
    if ("assigneeId" in data && data.assigneeId && data.assigneeId !== task.assigneeId && data.assigneeId !== req.user.id) {
      await notify({
        recipientId: data.assigneeId,
        type: "TASK_ASSIGNED",
        title: `Assigned: ${task.number} ${updated.title}`,
        body: `${req.user.name} assigned you a task.`,
        entityType: "task",
        entityId: task.id,
      });
    }

    await logActivity({
      actorId: req.user.id,
      projectId: task.projectId,
      action: "task.updated",
      entityType: "task",
      entityId: task.id,
      metadata: { fields: Object.keys(data) },
    });

    const warnings = await computeTaskWarnings(task.id);
    res.json({ task: updated, warnings });
  })
);

// --- Change status (constrained transition) ---------------------------------
router.post(
  "/tasks/:taskId/status",
  asyncHandler(async (req, res) => {
    const { task } = await loadTaskWithAccess(req.params.taskId, req.user.id, "MEMBER");
    const { status } = parse(
      z.object({ status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"]) }),
      req.body
    );

    assertValidTransition(task.status, status);

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: { status },
      include: taskInclude,
    });

    await logActivity({
      actorId: req.user.id,
      projectId: task.projectId,
      action: "task.status_changed",
      entityType: "task",
      entityId: task.id,
      metadata: { from: task.status, to: status },
    });

    // Notify assignee + creator (excluding the actor) of the status change.
    const recipients = [task.assigneeId, task.creatorId].filter((id) => id && id !== req.user.id);
    await notifyMany(recipients, {
      type: "TASK_STATUS_CHANGED",
      title: `Status: ${updated.title} → ${status}`,
      body: `${req.user.name} moved the task from ${task.status} to ${status}.`,
      entityType: "task",
      entityId: task.id,
    });

    const warnings = await computeTaskWarnings(task.id);
    res.json({ task: updated, warnings });
  })
);

// --- Dependencies -----------------------------------------------------------
router.post(
  "/tasks/:taskId/relations",
  asyncHandler(async (req, res) => {
    const { task } = await loadTaskWithAccess(req.params.taskId, req.user.id, "MEMBER");
    const { targetId, type, direction } = parse(
      z.object({
        targetId: z.string(),
        type: z.enum(["BLOCKS", "RELATES_TO"]).default("BLOCKS"),
        // direction "blocks": this task blocks target; "blocked_by": target blocks this task
        direction: z.enum(["blocks", "blocked_by"]).default("blocks"),
      }),
      req.body
    );
    // Confirm caller can access the target task's project too.
    await loadTaskWithAccess(targetId, req.user.id);

    const [sourceId, tId] = direction === "blocked_by" ? [targetId, task.id] : [task.id, targetId];
    const relation = await createRelation({ sourceId, targetId: tId, type });

    await logActivity({
      actorId: req.user.id,
      projectId: task.projectId,
      action: "task.relation_added",
      entityType: "task",
      entityId: task.id,
      metadata: { relationId: relation.id, type, sourceId, targetId: tId },
    });

    const warnings = await computeTaskWarnings(task.id);
    res.status(201).json({ relation, warnings });
  })
);

router.delete(
  "/tasks/:taskId/relations/:relationId",
  asyncHandler(async (req, res) => {
    await loadTaskWithAccess(req.params.taskId, req.user.id, "MEMBER");
    await prisma.taskRelation.delete({ where: { id: req.params.relationId } });
    res.status(204).end();
  })
);

// --- Comments (with @mention) -----------------------------------------------
router.get(
  "/tasks/:taskId/comments",
  asyncHandler(async (req, res) => {
    await loadTaskWithAccess(req.params.taskId, req.user.id);
    const comments = await prisma.comment.findMany({
      where: { taskId: req.params.taskId },
      include: { author: { select: { id: true, name: true, email: true } }, mentions: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ comments });
  })
);

router.post(
  "/tasks/:taskId/comments",
  asyncHandler(async (req, res) => {
    const { task } = await loadTaskWithAccess(req.params.taskId, req.user.id, "MEMBER");
    const { body, mentionIds } = parse(
      z.object({ body: z.string().min(1), mentionIds: z.array(z.string()).default([]) }),
      req.body
    );

    const comment = await prisma.comment.create({
      data: {
        body,
        authorId: req.user.id,
        taskId: task.id,
        mentions: { create: [...new Set(mentionIds)].map((mentionedId) => ({ mentionedId })) },
      },
      include: { author: { select: { id: true, name: true, email: true } }, mentions: true },
    });

    // Notify mentioned users (excluding self).
    await notifyMany(
      mentionIds.filter((id) => id !== req.user.id),
      {
        type: "TASK_COMMENT_MENTION",
        title: `${req.user.name} mentioned you`,
        body: body.slice(0, 140),
        entityType: "task",
        entityId: task.id,
      }
    );

    await logActivity({
      actorId: req.user.id,
      projectId: task.projectId,
      action: "task.commented",
      entityType: "task",
      entityId: task.id,
      metadata: { commentId: comment.id },
    });

    res.status(201).json({ comment });
  })
);

export default router;
