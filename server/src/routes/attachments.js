import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { asyncHandler, badRequest, forbidden, notFound } from "../lib/errors.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();
router.use(authenticate);

// Local disk acts as the object-storage abstraction in dev. In production this
// would be swapped for S3/GCS by changing only this storage adapter.
const uploadRoot = path.resolve(config.uploads.dir);
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const key = crypto.randomBytes(16).toString("hex") + path.extname(file.originalname);
    cb(null, key);
  },
});
const upload = multer({ storage, limits: { fileSize: config.uploads.maxBytes } });

async function assertProjectMemberForEntity({ taskId, rcaId }, userId) {
  let projectId;
  if (taskId) projectId = (await prisma.task.findUnique({ where: { id: taskId } }))?.projectId;
  else if (rcaId) projectId = (await prisma.rCA.findUnique({ where: { id: rcaId } }))?.projectId;
  if (!projectId) throw notFound("Parent entity not found");
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) throw forbidden("You are not a member of this project");
  return projectId;
}

// Upload a file and attach it to a task or an RCA.
router.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("No file uploaded (field name must be 'file')");
    const { taskId, rcaId } = req.body;
    if (!taskId && !rcaId) throw badRequest("Provide taskId or rcaId");

    await assertProjectMemberForEntity({ taskId, rcaId }, req.user.id);

    const attachment = await prisma.attachment.create({
      data: {
        filename: req.file.originalname,
        storageKey: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploaderId: req.user.id,
        taskId: taskId || null,
        rcaId: rcaId || null,
      },
    });
    res.status(201).json({ attachment });
  })
);

// Download / stream a stored file.
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!attachment) throw notFound("Attachment not found");
    await assertProjectMemberForEntity(
      { taskId: attachment.taskId, rcaId: attachment.rcaId },
      req.user.id
    );
    const filePath = path.join(uploadRoot, attachment.storageKey);
    if (!fs.existsSync(filePath)) throw notFound("File missing from storage");
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${attachment.filename}"`);
    fs.createReadStream(filePath).pipe(res);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!attachment) throw notFound("Attachment not found");
    await assertProjectMemberForEntity(
      { taskId: attachment.taskId, rcaId: attachment.rcaId },
      req.user.id
    );
    await prisma.attachment.delete({ where: { id: attachment.id } });
    fs.rm(path.join(uploadRoot, attachment.storageKey), () => {});
    res.status(204).end();
  })
);

export default router;
