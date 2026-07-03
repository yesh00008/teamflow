import { prisma } from "../prisma.js";

export const SECTION_TYPES = [
  "TIMELINE",
  "CONTRIBUTING_FACTORS",
  "CORRECTIVE_ACTIONS",
  "PREVENTIVE_MEASURES",
];

// Derive the RCA lifecycle status from its review decisions.
// Rule: an RCA in review cannot be resolved until EVERY assigned reviewer has
// decided. If any reviewer rejected -> REJECTED. If all approved -> APPROVED.
// Otherwise it stays IN_REVIEW (pending reviewers outstanding).
export function deriveReviewOutcome(reviews) {
  if (reviews.length === 0) return { resolved: false, status: "IN_REVIEW", reason: "no_reviewers" };
  const anyPending = reviews.some((r) => r.decision === "PENDING");
  if (anyPending) {
    return { resolved: false, status: "IN_REVIEW", reason: "reviewers_outstanding" };
  }
  const anyRejected = reviews.some((r) => r.decision === "REJECTED");
  return {
    resolved: true,
    status: anyRejected ? "REJECTED" : "APPROVED",
    reason: anyRejected ? "at_least_one_rejection" : "all_approved",
  };
}

export async function nextRcaNumber(projectId) {
  const last = await prisma.rCA.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number || 0) + 1;
}
