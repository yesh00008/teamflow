import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../lib/errors.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireProjectRole } from "../middleware/projectAccess.js";
import { projectDashboard } from "../services/analyticsService.js";
import { buildTaskFilter } from "./tasks.js";
import { toCsv } from "../lib/csv.js";

const router = Router();
router.use(authenticate);

// Live dashboard aggregations for a project.
router.get(
  "/projects/:projectId/dashboard",
  requireProjectRole("VIEWER"),
  asyncHandler(async (req, res) => {
    res.json(await projectDashboard(req.params.projectId));
  })
);

// CSV export of the task list, scoped to the SAME filter state as the list view.
// The frontend passes through its active query params so the export matches
// exactly what the user is looking at.
router.get(
  "/projects/:projectId/tasks/export.csv",
  requireProjectRole("VIEWER"),
  asyncHandler(async (req, res) => {
    const where = buildTaskFilter(req.params.projectId, req.query);
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    const tasks = await prisma.task.findMany({
      where,
      include: { assignee: { select: { name: true, email: true } }, creator: { select: { name: true } } },
      orderBy: { number: "asc" },
    });

    const columns = [
      { header: "Key", value: (t) => `${project.key}-${t.number}` },
      { header: "Title", value: (t) => t.title },
      { header: "Status", value: (t) => t.status },
      { header: "Priority", value: (t) => t.priority },
      { header: "Assignee", value: (t) => t.assignee?.name || "" },
      { header: "Creator", value: (t) => t.creator?.name || "" },
      { header: "Due Date", value: (t) => (t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "") },
      { header: "Created", value: (t) => t.createdAt.toISOString().slice(0, 10) },
    ];

    const csv = toCsv(tasks, columns);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${project.key}-tasks.csv"`);
    res.send(csv);
  })
);

// Recent activity feed for a project.
router.get(
  "/projects/:projectId/activity",
  requireProjectRole("VIEWER"),
  asyncHandler(async (req, res) => {
    const logs = await prisma.activityLog.findMany({
      where: { projectId: req.params.projectId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ activity: logs });
  })
);

export default router;
