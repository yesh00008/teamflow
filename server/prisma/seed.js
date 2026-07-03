import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Deterministic demo dataset so reviewers can log in and explore immediately.
const PASSWORD = "password123";

async function main() {
  console.log("Seeding TeamFlow demo data...");
  const hash = await bcrypt.hash(PASSWORD, 10);

  // --- Users ---------------------------------------------------------------
  const users = {};
  const people = [
    ["alice@teamflow.dev", "Alice Owner"],
    ["bob@teamflow.dev", "Bob Builder"],
    ["carol@teamflow.dev", "Carol Reviewer"],
    ["dave@teamflow.dev", "Dave Contributor"],
  ];
  for (const [email, name] of people) {
    users[email] = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash: hash },
    });
  }

  // --- Project -------------------------------------------------------------
  const project = await prisma.project.upsert({
    where: { key: "TF" },
    update: {},
    create: {
      key: "TF",
      name: "TeamFlow Platform",
      description: "Building the unified planning + investigation platform.",
      members: {
        create: [
          { userId: users["alice@teamflow.dev"].id, role: "OWNER" },
          { userId: users["bob@teamflow.dev"].id, role: "MEMBER" },
          { userId: users["carol@teamflow.dev"].id, role: "ADMIN" },
          { userId: users["dave@teamflow.dev"].id, role: "MEMBER" },
        ],
      },
    },
  });

  // Avoid double-seeding tasks on re-run.
  const existingTasks = await prisma.task.count({ where: { projectId: project.id } });
  if (existingTasks > 0) {
    console.log("Project already has tasks; skipping task/RCA seed.");
    console.log("\nDemo login: alice@teamflow.dev / password123");
    return;
  }

  // --- Tasks ---------------------------------------------------------------
  const mk = (n, data) =>
    prisma.task.create({
      data: {
        projectId: project.id,
        number: n,
        creatorId: users["alice@teamflow.dev"].id,
        ...data,
      },
    });

  const t1 = await mk(1, {
    title: "Design data model",
    description: "Define entities and relationships.",
    status: "DONE",
    priority: "HIGH",
    assigneeId: users["alice@teamflow.dev"].id,
  });
  const t2 = await mk(2, {
    title: "Build authentication",
    description: "JWT login/register.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    assigneeId: users["bob@teamflow.dev"].id,
    dueDate: new Date(Date.now() + 3 * 864e5),
  });
  const t3 = await mk(3, {
    title: "Notification pipeline",
    description: "In-app + email with dedup.",
    status: "TODO",
    priority: "CRITICAL",
    assigneeId: users["bob@teamflow.dev"].id,
    dueDate: new Date(Date.now() + 5 * 864e5),
  });
  const t4 = await mk(4, {
    title: "Kanban board UI",
    description: "Drag between columns.",
    status: "TODO",
    priority: "MEDIUM",
    assigneeId: users["dave@teamflow.dev"].id,
  });
  await mk(5, {
    title: "Dashboard charts",
    description: "Completion, workload, velocity.",
    status: "BACKLOG",
    priority: "LOW",
    assigneeId: users["dave@teamflow.dev"].id,
  });

  // Dependency: notification pipeline (t3) is blocked by authentication (t2).
  await prisma.taskRelation.create({
    data: { sourceId: t2.id, targetId: t3.id, type: "BLOCKS" },
  });
  // Kanban UI (t4) relates to dashboard work via data model (t1 blocks t4).
  await prisma.taskRelation.create({
    data: { sourceId: t1.id, targetId: t4.id, type: "BLOCKS" },
  });

  // A comment with a mention.
  await prisma.comment.create({
    data: {
      body: "Can you confirm the dedup window is 60s? @Carol Reviewer",
      authorId: users["bob@teamflow.dev"].id,
      taskId: t3.id,
      mentions: { create: [{ mentionedId: users["carol@teamflow.dev"].id }] },
    },
  });

  // --- RCA with a mixed review outcome (one approve, one reject) ------------
  const rca = await prisma.rCA.create({
    data: {
      projectId: project.id,
      number: 1,
      title: "Duplicate notifications during processing lag",
      summary: "Users received the same alert twice under retry conditions.",
      severity: "SEV2",
      status: "IN_REVIEW",
      authorId: users["bob@teamflow.dev"].id,
      submittedAt: new Date(),
      sections: {
        create: [
          { type: "TIMELINE", order: 0, content: "09:12 alert fired; 09:12 retry re-fired duplicate." },
          { type: "CONTRIBUTING_FACTORS", order: 1, content: "No dedup key; dispatch not idempotent." },
          { type: "CORRECTIVE_ACTIONS", order: 2, content: "Add deterministic dedupe key + unique index." },
          { type: "PREVENTIVE_MEASURES", order: 3, content: "Log-before-dispatch for all channels." },
        ],
      },
      reviews: {
        create: [
          { reviewerId: users["carol@teamflow.dev"].id, decision: "PENDING" },
          { reviewerId: users["alice@teamflow.dev"].id, decision: "PENDING" },
        ],
      },
    },
  });

  console.log(`Seeded project ${project.key} with tasks and RCA #${rca.number}.`);
  console.log("\nDemo logins (all password: password123):");
  people.forEach(([email]) => console.log(`  ${email}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
