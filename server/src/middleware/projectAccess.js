import { forbidden, notFound } from "../lib/errors.js";
import { prisma } from "../prisma.js";

// Role ranking for permission checks (higher = more privileged).
const RANK = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

export const hasRole = (role, minimum) => RANK[role] >= RANK[minimum];

// Loads the caller's membership for :projectId and enforces a minimum role.
// Attaches req.membership and req.project.
export function requireProjectRole(minimum = "VIEWER") {
  return async (req, _res, next) => {
    try {
      const projectId = req.params.projectId || req.body.projectId;
      if (!projectId) return next(notFound("Project not specified"));

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return next(notFound("Project not found"));

      const membership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: req.user.id } },
      });
      if (!membership) return next(forbidden("You are not a member of this project"));

      if (!hasRole(membership.role, minimum)) {
        return next(forbidden(`Requires ${minimum} role or higher`));
      }

      req.project = project;
      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}
