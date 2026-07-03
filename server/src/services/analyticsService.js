import { prisma } from "../prisma.js";

// All aggregations read live data at request time (spec's stated tradeoff:
// always current, potentially slower on very large projects).
export async function projectDashboard(projectId) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: {
      status: true,
      priority: true,
      assigneeId: true,
      dueDate: true,
      updatedAt: true,
      createdAt: true,
      assignee: { select: { id: true, name: true } },
    },
  });

  const total = tasks.length;
  const byStatus = countBy(tasks, (t) => t.status);
  const byPriority = countBy(tasks, (t) => t.priority);

  const done = byStatus.DONE || 0;
  const completionRate = total ? Math.round((done / total) * 100) : 0;

  // Workload per assignee: open tasks only.
  const openStatuses = new Set(["TODO", "IN_PROGRESS", "IN_REVIEW"]);
  const workloadMap = new Map();
  for (const t of tasks) {
    if (!openStatuses.has(t.status)) continue;
    const key = t.assignee ? t.assignee.id : "unassigned";
    const name = t.assignee ? t.assignee.name : "Unassigned";
    const entry = workloadMap.get(key) || { assigneeId: key, name, open: 0 };
    entry.open += 1;
    workloadMap.set(key, entry);
  }
  const workload = [...workloadMap.values()].sort((a, b) => b.open - a.open);

  // Velocity: tasks completed per ISO week over the last 8 weeks (approx via
  // updatedAt of DONE tasks — a pragmatic proxy without a separate event store).
  const now = new Date();
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - i * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const completed = tasks.filter(
      (t) => t.status === "DONE" && t.updatedAt >= start && t.updatedAt < end
    ).length;
    weeks.push({ weekStart: start.toISOString().slice(0, 10), completed });
  }

  // Overdue open tasks.
  const overdue = tasks.filter(
    (t) => t.dueDate && t.dueDate < now && t.status !== "DONE" && t.status !== "CANCELLED"
  ).length;

  // RCA volume by status.
  const rcas = await prisma.rCA.groupBy({
    by: ["status"],
    where: { projectId },
    _count: { _all: true },
  });
  const rcaByStatus = Object.fromEntries(rcas.map((r) => [r.status, r._count._all]));

  // Simple project-health heuristic (0-100).
  const health = computeHealth({ completionRate, overdue, total });

  return {
    totals: { tasks: total, done, overdue, completionRate },
    byStatus,
    byPriority,
    workload,
    velocity: weeks,
    rcaByStatus,
    health,
  };
}

function computeHealth({ completionRate, overdue, total }) {
  if (total === 0) return { score: 100, label: "No tasks yet" };
  const overdueRatio = overdue / total;
  let score = Math.round(completionRate * 0.6 + (1 - overdueRatio) * 40);
  score = Math.max(0, Math.min(100, score));
  const label = score >= 75 ? "Healthy" : score >= 50 ? "At risk" : "Needs attention";
  return { score, label };
}

function countBy(items, keyFn) {
  const out = {};
  for (const it of items) {
    const k = keyFn(it);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
