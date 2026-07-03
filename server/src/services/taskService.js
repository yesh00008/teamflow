import { prisma } from "../prisma.js";
import { badRequest, conflict } from "../lib/errors.js";

// --- Status workflow ---------------------------------------------------------
// Allowed transitions. Movement is constrained (not free-form) so project
// history stays trustworthy; every change is logged by the caller.
const TRANSITIONS = {
  BACKLOG: ["TODO", "CANCELLED"],
  TODO: ["IN_PROGRESS", "BACKLOG", "CANCELLED"],
  IN_PROGRESS: ["IN_REVIEW", "TODO", "CANCELLED"],
  IN_REVIEW: ["DONE", "IN_PROGRESS", "CANCELLED"],
  DONE: ["IN_PROGRESS"], // allow reopening
  CANCELLED: ["TODO"],
};

export function assertValidTransition(from, to) {
  if (from === to) return;
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw badRequest(`Invalid status transition: ${from} -> ${to}`, {
      from,
      to,
      allowed,
    });
  }
}

// --- Dependency graph helpers ------------------------------------------------
// A BLOCKS edge source -> target means target cannot start/complete until
// source is done. We detect cycles before creating an edge.

// Would adding source -> target create a cycle? (i.e. is source reachable from
// target following BLOCKS edges already in the graph?)
export async function wouldCreateCycle(sourceId, targetId) {
  if (sourceId === targetId) return true;
  const visited = new Set();
  const stack = [targetId];
  while (stack.length) {
    const current = stack.pop();
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const edges = await prisma.taskRelation.findMany({
      where: { sourceId: current, type: "BLOCKS" },
      select: { targetId: true },
    });
    for (const e of edges) stack.push(e.targetId);
  }
  return false;
}

export async function createRelation({ sourceId, targetId, type }) {
  if (sourceId === targetId) throw badRequest("A task cannot depend on itself");

  const [source, target] = await Promise.all([
    prisma.task.findUnique({ where: { id: sourceId } }),
    prisma.task.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target) throw badRequest("Both tasks must exist");

  if (type === "BLOCKS" && (await wouldCreateCycle(sourceId, targetId))) {
    throw conflict("This dependency would create a cycle", { sourceId, targetId });
  }

  try {
    return await prisma.taskRelation.create({ data: { sourceId, targetId, type } });
  } catch (err) {
    if (err.code === "P2002") throw conflict("That relation already exists");
    throw err;
  }
}

// --- Warnings (non-blocking) -------------------------------------------------
// Per the spec, dependency conflicts and assignee overload are surfaced as
// WARNINGS without blocking saves. This computes them for a task.
export async function computeTaskWarnings(taskId) {
  const warnings = [];
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      incomingRelations: { where: { type: "BLOCKS" }, include: { source: true } },
    },
  });
  if (!task) return warnings;

  // 1. Blocked by an unfinished dependency.
  const openBlockers = task.incomingRelations.filter(
    (r) => r.source.status !== "DONE" && r.source.status !== "CANCELLED"
  );
  if (openBlockers.length && (task.status === "IN_PROGRESS" || task.status === "DONE")) {
    warnings.push({
      code: "BLOCKED_BY_OPEN_DEPENDENCY",
      message: `Depends on ${openBlockers.length} task(s) that are not yet done`,
      taskIds: openBlockers.map((r) => r.source.id),
    });
  }

  // 2. Due date earlier than a blocker's due date (schedule conflict).
  for (const r of task.incomingRelations) {
    if (task.dueDate && r.source.dueDate && task.dueDate < r.source.dueDate) {
      warnings.push({
        code: "DUE_BEFORE_DEPENDENCY",
        message: `Due before its dependency "${r.source.title}"`,
        taskIds: [r.source.id],
      });
    }
  }

  // 3. Assignee overload: too many open tasks assigned to the same person.
  if (task.assigneeId) {
    const openForAssignee = await prisma.task.count({
      where: {
        assigneeId: task.assigneeId,
        status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
      },
    });
    const OVERLOAD_THRESHOLD = 10;
    if (openForAssignee > OVERLOAD_THRESHOLD) {
      warnings.push({
        code: "ASSIGNEE_OVERLOADED",
        message: `Assignee has ${openForAssignee} open tasks`,
        count: openForAssignee,
      });
    }
  }

  return warnings;
}

// Next per-project task number (simple sequential; unique index guards races).
export async function nextTaskNumber(projectId) {
  const last = await prisma.task.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number || 0) + 1;
}
