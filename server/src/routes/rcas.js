import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncHandler, badRequest, forbidden, notFound, conflict } from "../lib/errors.js";
import { parse } from "../lib/validate.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireProjectRole } from "../middleware/projectAccess.js";
import { logActivity } from "../services/activityService.js";
import { notify, notifyMany } from "../services/notificationService.js";
import { SECTION_TYPES, deriveReviewOutcome, nextRcaNumber } from "../services/rcaService.js";

const router = Router();
router.use(authenticate);

const rcaInclude = {
  author: { select: { id: true, name: true, email: true } },
  sections: { orderBy: { order: "asc" } },
  reviews: { include: { reviewer: { select: { id: true, name: true, email: true } } } },
  _count: { select: { comments: true, attachments: true } },
};

async function loadRcaWithAccess(rcaId, userId, minimum = "VIEWER") {
  const RANK = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };
  const rca = await prisma.rCA.findUnique({ where: { id: rcaId }, include: rcaInclude });
  if (!rca) throw notFound("RCA not found");
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: rca.projectId, userId } },
  });
  if (!membership) throw forbidden("You are not a member of this project");
  if (RANK[membership.role] < RANK[minimum]) throw forbidden(`Requires ${minimum} role`);
  return { rca, membership };
}

// --- List / create ----------------------------------------------------------
router.get(
  "/projects/:projectId/rcas",
  requireProjectRole("VIEWER"),
  asyncHandler(async (req, res) => {
    const where = { projectId: req.params.projectId };
    if (req.query.status) where.status = { in: String(req.query.status).split(",") };
    const rcas = await prisma.rCA.findMany({ where, include: rcaInclude, orderBy: { createdAt: "desc" } });
    res.json({ rcas });
  })
);

router.post(
  "/projects/:projectId/rcas",
  requireProjectRole("MEMBER"),
  asyncHandler(async (req, res) => {
    const data = parse(
      z.object({
        title: z.string().min(1),
        summary: z.string().optional(),
        severity: z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]).default("SEV3"),
      }),
      req.body
    );
    const number = await nextRcaNumber(req.params.projectId);
    const rca = await prisma.rCA.create({
      data: {
        projectId: req.params.projectId,
        number,
        title: data.title,
        summary: data.summary,
        severity: data.severity,
        authorId: req.user.id,
        // Pre-create the four structured sections.
        sections: { create: SECTION_TYPES.map((type, i) => ({ type, order: i })) },
      },
      include: rcaInclude,
    });
    await logActivity({
      actorId: req.user.id,
      projectId: req.params.projectId,
      action: "rca.created",
      entityType: "rca",
      entityId: rca.id,
      metadata: { number, title: rca.title },
    });
    res.status(201).json({ rca });
  })
);

router.get(
  "/rcas/:rcaId",
  asyncHandler(async (req, res) => {
    const { rca } = await loadRcaWithAccess(req.params.rcaId, req.user.id);
    res.json({ rca });
  })
);

// --- Edit sections / metadata (author only, while editable) -----------------
router.patch(
  "/rcas/:rcaId",
  asyncHandler(async (req, res) => {
    const { rca } = await loadRcaWithAccess(req.params.rcaId, req.user.id, "MEMBER");
    if (!["DRAFT", "REJECTED"].includes(rca.status)) {
      throw conflict("RCA can only be edited while in DRAFT or after REJECTED");
    }
    if (rca.authorId !== req.user.id) throw forbidden("Only the author can edit this RCA");

    const data = parse(
      z.object({
        title: z.string().min(1).optional(),
        summary: z.string().optional(),
        severity: z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]).optional(),
        sections: z
          .array(z.object({ type: z.enum(SECTION_TYPES), content: z.string() }))
          .optional(),
      }),
      req.body
    );

    const updated = await prisma.$transaction(async (tx) => {
      if (data.sections) {
        for (const s of data.sections) {
          await tx.rCASection.update({
            where: { rcaId_type: { rcaId: rca.id, type: s.type } },
            data: { content: s.content },
          });
        }
      }
      return tx.rCA.update({
        where: { id: rca.id },
        data: { title: data.title, summary: data.summary, severity: data.severity },
        include: rcaInclude,
      });
    });
    res.json({ rca: updated });
  })
);

// --- Submit for review (assign reviewers) -----------------------------------
router.post(
  "/rcas/:rcaId/submit",
  asyncHandler(async (req, res) => {
    const { rca } = await loadRcaWithAccess(req.params.rcaId, req.user.id, "MEMBER");
    if (rca.authorId !== req.user.id) throw forbidden("Only the author can submit this RCA");
    if (!["DRAFT", "REJECTED"].includes(rca.status)) {
      throw conflict(`Cannot submit an RCA that is ${rca.status}`);
    }
    const { reviewerIds } = parse(
      z.object({ reviewerIds: z.array(z.string()).min(1) }),
      req.body
    );
    const reviewers = [...new Set(reviewerIds)].filter((id) => id !== rca.authorId);
    if (reviewers.length === 0) throw badRequest("Assign at least one reviewer other than the author");

    // Verify each reviewer is a project member.
    const members = await prisma.projectMember.findMany({
      where: { projectId: rca.projectId, userId: { in: reviewers } },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((m) => m.userId));
    const invalid = reviewers.filter((id) => !memberIds.has(id));
    if (invalid.length) throw badRequest("All reviewers must be project members", { invalid });

    const updated = await prisma.$transaction(async (tx) => {
      // Reset any previous review slots, then create fresh PENDING ones.
      await tx.review.deleteMany({ where: { rcaId: rca.id } });
      await tx.review.createMany({
        data: reviewers.map((reviewerId) => ({ rcaId: rca.id, reviewerId })),
      });
      return tx.rCA.update({
        where: { id: rca.id },
        data: { status: "IN_REVIEW", submittedAt: new Date() },
        include: rcaInclude,
      });
    });

    await logActivity({
      actorId: req.user.id,
      projectId: rca.projectId,
      action: "rca.submitted",
      entityType: "rca",
      entityId: rca.id,
      metadata: { reviewers },
    });

    await notifyMany(reviewers, {
      type: "RCA_SUBMITTED",
      title: `Review requested: ${rca.title}`,
      body: `${req.user.name} asked you to review an RCA.`,
      entityType: "rca",
      entityId: rca.id,
    });

    res.json({ rca: updated });
  })
);

// --- Record a review decision (mandatory comment) ---------------------------
router.post(
  "/rcas/:rcaId/reviews",
  asyncHandler(async (req, res) => {
    const { rca } = await loadRcaWithAccess(req.params.rcaId, req.user.id, "MEMBER");
    if (rca.status !== "IN_REVIEW") throw conflict("RCA is not currently in review");

    const { decision, comment } = parse(
      z.object({
        decision: z.enum(["APPROVED", "REJECTED"]),
        comment: z.string().min(1, "A comment is required with every decision"),
      }),
      req.body
    );

    const slot = rca.reviews.find((r) => r.reviewerId === req.user.id);
    if (!slot) throw forbidden("You are not an assigned reviewer for this RCA");
    if (slot.decision !== "PENDING") throw conflict("You have already submitted your review");

    // Record this reviewer's decision.
    await prisma.review.update({
      where: { id: slot.id },
      data: { decision, comment, decidedAt: new Date() },
    });

    // Re-evaluate the whole review set: only resolve once ALL have decided.
    const reviews = await prisma.review.findMany({ where: { rcaId: rca.id } });
    const outcome = deriveReviewOutcome(reviews);

    const updated = await prisma.rCA.update({
      where: { id: rca.id },
      data: {
        status: outcome.status,
        closedAt: outcome.resolved && outcome.status === "APPROVED" ? new Date() : rca.closedAt,
      },
      include: rcaInclude,
    });

    await logActivity({
      actorId: req.user.id,
      projectId: rca.projectId,
      action: "rca.review_recorded",
      entityType: "rca",
      entityId: rca.id,
      metadata: { decision, resolved: outcome.resolved, outcome: outcome.status },
    });

    // Always tell the author a decision landed.
    await notify({
      recipientId: rca.authorId,
      type: "RCA_REVIEW_DECISION",
      title: `Review ${decision.toLowerCase()}: ${rca.title}`,
      body: `${req.user.name} ${decision === "APPROVED" ? "approved" : "rejected"} — "${comment.slice(0, 120)}"`,
      entityType: "rca",
      entityId: rca.id,
    });

    // If fully resolved, notify author of the final outcome.
    if (outcome.resolved) {
      await notify({
        recipientId: rca.authorId,
        type: "RCA_CLOSED",
        title: `RCA ${outcome.status.toLowerCase()}: ${rca.title}`,
        body:
          outcome.status === "APPROVED"
            ? "All reviewers approved. The investigation is signed off."
            : "At least one reviewer rejected. Address the feedback and resubmit.",
        entityType: "rca",
        entityId: rca.id,
      });
    }

    res.json({ rca: updated, outcome });
  })
);

// --- Comments on an RCA -----------------------------------------------------
router.get(
  "/rcas/:rcaId/comments",
  asyncHandler(async (req, res) => {
    await loadRcaWithAccess(req.params.rcaId, req.user.id);
    const comments = await prisma.comment.findMany({
      where: { rcaId: req.params.rcaId },
      include: { author: { select: { id: true, name: true, email: true } }, mentions: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ comments });
  })
);

router.post(
  "/rcas/:rcaId/comments",
  asyncHandler(async (req, res) => {
    const { rca } = await loadRcaWithAccess(req.params.rcaId, req.user.id, "MEMBER");
    const { body, mentionIds } = parse(
      z.object({ body: z.string().min(1), mentionIds: z.array(z.string()).default([]) }),
      req.body
    );
    const comment = await prisma.comment.create({
      data: {
        body,
        authorId: req.user.id,
        rcaId: rca.id,
        mentions: { create: [...new Set(mentionIds)].map((mentionedId) => ({ mentionedId })) },
      },
      include: { author: { select: { id: true, name: true, email: true } }, mentions: true },
    });
    await notifyMany(
      mentionIds.filter((id) => id !== req.user.id),
      {
        type: "TASK_COMMENT_MENTION",
        title: `${req.user.name} mentioned you on an RCA`,
        body: body.slice(0, 140),
        entityType: "rca",
        entityId: rca.id,
      }
    );
    res.status(201).json({ comment });
  })
);

export default router;
