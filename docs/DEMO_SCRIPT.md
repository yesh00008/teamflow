# TeamFlow — Demo Video Script (~4 minutes)

A read-aloud script for the 3–5 minute walkthrough. Each step has **DO** (what to click) and **SAY** (read this aloud). Target length ≈ 4 min at a normal pace.

**Before you start recording:**
- Both servers running: API (`cd server && npm run dev`) and client (`cd client && npm run dev`).
- Browser open at **http://localhost:5173**, logged out.
- A second tab open at **http://localhost:8025** (MailHog) for the email demo.
- Demo login: **alice@teamflow.dev** / **password123**.
- Optional: reset to clean demo data first with `cd server && npm run db:reset`.

---

## 0 · Intro (0:00–0:20)

**SAY:**
> "This is TeamFlow — a unified platform for software engineering teams to plan, execute, and investigate work in one place. It replaces fragmented tools with one system for projects, tasks, root-cause analysis, notifications, and reporting. It's built with a React front end, an Express REST API, and PostgreSQL. Let me walk you through the key features."

---

## 1 · Login & projects (0:20–0:40)

**DO:** On the login page, sign in as `alice@teamflow.dev` / `password123`. Land on the Projects page.

**SAY:**
> "I'll sign in as Alice. Authentication is JWT-based. Here's the projects dashboard — each project shows its role, task count, RCAs, and members. Users can belong to many projects with different roles: owner, admin, member, or viewer. Let me open the TeamFlow project."

**DO:** Click the **TeamFlow Platform** project.

---

## 2 · Kanban board + status rules (0:40–1:15)

**DO:** You're on the **Board** tab. Drag a card from **To Do** to **In Progress**.

**SAY:**
> "This is the Kanban board, grouped by status. I can drag a task to move it — and that's not a free-for-all: status changes follow defined transition rules, and every change is written to an append-only activity log, so the project history stays trustworthy. If I tried an illegal jump, the server would reject it."

**DO:** Click a card to open the task detail. Point at the status pills, priority, assignee, dependencies.

**SAY:**
> "Opening a task, I get description, priority, assignee, due dates, dependencies, comments, and attachments — everything in one place."

---

## 3 · Dependencies + non-blocking warnings (1:15–1:50)

**DO:** In the open task, look at the **Dependencies** section (the seeded "Notification pipeline" task is blocked by "Build authentication"). If a warning banner shows, point to it.

**SAY:**
> "Tasks can depend on each other. This one is blocked by another task. Dependencies are first-class links — they even work across projects. If a dependency would create a cycle, the system rejects it outright, because a cycle can never be satisfied. But softer conflicts — like working a task that's still blocked, or an overloaded assignee — are shown as warnings that don't block you from saving. The system surfaces the conflict and lets the team use their judgement."

---

## 4 · Comments + @mention + notifications (1:50–2:25)

**DO:** In the task, type a comment mentioning a teammate: `Can you check this @Carol Reviewer`. Send it.

**SAY:**
> "Comments support @mentions. When I mention Carol and send, the system fires a notification through a single event pipeline — both an in-app alert and an email."

**DO:** Point at the **bell icon** (top right) — it shows an unread count. Click it to show the dropdown.

**SAY:**
> "In-app notifications appear on the bell. And here's the important part about reliability —"

**DO:** Switch to the **MailHog tab** (http://localhost:8025). Show the captured email.

**SAY:**
> "— every alert is logged before it's dispatched, and each has a unique dedupe key. So if the same event fires twice — say, from a processing lag — the duplicate is suppressed and the user only ever gets one alert. Email delivery is captured here in MailHog during development."

---

## 5 · Root Cause Analysis + review sign-off (2:25–3:20)

**DO:** Back in the app, click the **RCAs** tab. Open the seeded RCA ("Duplicate notifications during processing lag").

**SAY:**
> "TeamFlow also handles incident investigations. This is a Root Cause Analysis, with structured sections — timeline, contributing factors, corrective and preventive actions — a severity, and assigned reviewers."

**DO:** Point at the two reviewers, both showing a decision status.

**SAY:**
> "The key rule: an investigation cannot close until every assigned reviewer has decided, and each decision requires a mandatory comment — so nothing is signed off silently or undocumented. If one reviewer approves but another hasn't responded yet, the RCA stays open. If any reviewer rejects, it goes back to the author to fix and resubmit. This guarantees a documented sign-off every time."

*(Optional live proof: sign out, sign in as `carol@teamflow.dev`, open the RCA, approve with a comment — show it stays IN REVIEW because Alice hasn't decided. Then sign in as Alice and reject — show it flips to REJECTED.)*

---

## 6 · Dashboard + CSV export (3:20–3:50)

**DO:** Click the **Dashboard** tab.

**SAY:**
> "Reporting is built in, not bolted on. The dashboard reads live data: completion rate, workload per assignee, a velocity trend, RCA volume, and an overall project-health score."

**DO:** Go to the **List** tab. Set a filter (e.g. status = To Do). Click **Export CSV**.

**SAY:**
> "Every list view exports to CSV, and the export is scoped to exactly the filter you're looking at — so you get precisely the rows on screen, nothing extra."

---

## 7 · Theme + responsive + close (3:50–4:15)

**DO:** Click the **moon/sun** icon to toggle dark mode.

**SAY:**
> "Themes switch instantly across the whole app, with no page reload, and the layout is responsive from desktop down to mobile."

**SAY (closing):**
> "So that's TeamFlow: multi-view project planning, tasks with dependencies and enforced workflows, root-cause analysis with mandatory review sign-off, a reliable de-duplicated notification pipeline, and live reporting — all built on enforceable business rules and a clean, consistent data model. Thanks for watching."

---

## Quick reference — the four talking points that earn marks

1. **Trustworthy history** — constrained status transitions + append-only activity log.
2. **Dependency conflicts** — hard-reject cycles; surface everything else as non-blocking warnings.
3. **Review sign-off** — RCA can't close until *all* reviewers decide, each with a mandatory comment.
4. **No duplicate alerts** — log-before-dispatch + unique dedupe key = database-guaranteed suppression.

*Tip: if you're tight on time, steps 2, 4, and 5 are the highest-value; steps 6–7 can be shortened.*
