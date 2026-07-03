# TeamFlow

A unified platform for software engineering teams to **plan, execute, and investigate** work in one place — replacing fragmented tools for project planning, task execution, incident investigation, notifications, and reporting.

TeamFlow brings multi-project organisation (Kanban / calendar / list views), task lifecycle management with dependencies, structured **Root Cause Analysis (RCA)** with a mandatory review sign-off, a single in-app + email notification pipeline with duplicate suppression, live analytics with CSV export, and a responsive light/dark interface.

> This repository is the implementation deliverable for the TeamFlow Systems Engineering assignment.
> Written design deliverables live in [`docs/`](docs): [ERD](docs/ERD.md) · [Architecture](docs/architecture.md) · [Design Decisions](docs/design-decisions.md).

---

## Table of contents
- [Features implemented](#features-implemented)
- [Tech stack](#tech-stack)
- [Architecture at a glance](#architecture-at-a-glance)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Demo accounts](#demo-accounts)
- [How the key business rules work](#how-the-key-business-rules-work)
- [Project structure](#project-structure)
- [API overview](#api-overview)
- [Assumptions](#assumptions)
- [Known limitations](#known-limitations)
- [Future improvements](#future-improvements)

---

## Features implemented

| Area | What's built |
|------|--------------|
| **Auth & users** | JWT register/login, per-user theme + email opt-out preferences |
| **Projects** | Multi-project workspaces, membership with role-based access (OWNER/ADMIN/MEMBER/VIEWER) |
| **Task views** | **Kanban** (drag-and-drop), **Calendar** (by due date), **List** (sort + filter); view preference persisted **per user, per project** |
| **Tasks** | Priority, assignee, due/start dates, parent/sub-tasks, comments with **@mention**, file attachments |
| **Dependencies** | `BLOCKS` / `RELATES_TO` edges, **cross-project** capable, **cycle detection**; dependency & assignee-overload conflicts surfaced as **non-blocking warnings** |
| **Status workflow** | Constrained status transitions (invalid moves rejected); every change written to an append-only activity log |
| **RCA** | Draft → submit → review lifecycle, four structured sections, severity, attachments, comments |
| **Review sign-off** | Multi-reviewer; **an RCA cannot resolve until every assigned reviewer decides**; each decision requires a mandatory comment; any rejection ⇒ REJECTED |
| **Notifications** | Single event pipeline → **in-app bell + email**; **log-before-dispatch**; **duplicate suppression** via a unique dedupe key; per-user email opt-out |
| **Analytics** | Live dashboard: completion rate, workload per assignee, velocity trend, RCA volume, project-health score |
| **Export** | CSV export of the task list **scoped to the active filter/sort state** |
| **Theme & responsive** | Light/dark toggle applied instantly (no reload); responsive layout from a shared component set |
| **Audit** | Append-only `ActivityLog` on every significant change, surfaced in an Activity feed |

## Tech stack

- **Frontend:** React 18 (Vite), React Router, Tailwind CSS
- **Backend:** Node.js + Express (REST API), Zod validation
- **Database:** PostgreSQL 16 via Prisma ORM (migrations + type-safe client)
- **Auth:** JWT (bcrypt password hashing)
- **Email:** Nodemailer → MailHog in development (captured, not sent)
- **File storage:** local disk adapter standing in for object storage (swappable for S3/GCS)
- **Infra (dev):** Docker Compose for Postgres + MailHog

## Architecture at a glance

```
┌─────────────┐   REST/JSON    ┌──────────────────┐   Prisma    ┌────────────┐
│ React (Vite)│ ─────────────▶ │ Express API      │ ──────────▶ │ PostgreSQL │
│  SPA client │ ◀───────────── │ (services + RBAC)│ ◀────────── │            │
└─────────────┘                └───────┬──────────┘             └────────────┘
                                        │ notification pipeline
                                        ▼
                                 ┌────────────┐   SMTP   ┌──────────┐
                                 │ Nodemailer │ ───────▶ │ MailHog  │
                                 └────────────┘          └──────────┘
```

See [`docs/architecture.md`](docs/architecture.md) for the full diagram, request lifecycle, and rationale (monolith vs microservices, SQL vs NoSQL, sync vs event-driven, file storage).

---

## Quick start

**Prerequisites:** Node.js 18+ and Docker (for Postgres + MailHog). No local Postgres install needed.

```bash
# 1. Start Postgres + MailHog
docker compose up -d

# 2. Backend
cd server
cp .env.example .env
npm install
npx prisma migrate dev      # creates schema
npm run seed                # loads demo project, tasks, and an RCA
npm run dev                 # API on http://localhost:4000

# 3. Frontend (in a second terminal)
cd client
npm install
npm run dev                 # app on http://localhost:5173
```

Then open **http://localhost:5173** and sign in with a demo account below.
Captured emails are viewable at **http://localhost:8025** (MailHog).

> **Windows note:** Docker Desktop must be running before `docker compose up`. The DB is published on host port **5433** to avoid clashing with any local Postgres on 5432.

### Without Docker
Point `DATABASE_URL` at any PostgreSQL instance and set the `SMTP_*` variables at a reachable mail server (or leave them — failed sends are recorded, not fatal). Then run the `server` steps above from step 2.

## Environment variables

All backend config lives in `server/.env` (see [`server/.env.example`](server/.env.example)):

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://teamflow:teamflow@localhost:5433/teamflow` | Postgres connection string |
| `PORT` | `4000` | API port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin(s), comma-separated |
| `JWT_SECRET` | `change-me…` | Secret used to sign JWTs — **set a long random value in production** |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` | SMTP target (MailHog in dev) |
| `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | `false` / — / — | SMTP TLS + credentials |
| `EMAIL_FROM` | `TeamFlow <no-reply@teamflow.local>` | From header on outbound mail |
| `UPLOAD_DIR` | `uploads` | Local object-storage directory |
| `MAX_UPLOAD_MB` | `10` | Max attachment size |

The frontend needs no env vars in dev — Vite proxies `/api` to the backend (see `client/vite.config.js`).

## Demo accounts

Seeded by `npm run seed` — all share the password **`password123`**:

| Email | Name | Role in demo project |
|-------|------|----------------------|
| `alice@teamflow.dev` | Alice Owner | OWNER |
| `bob@teamflow.dev` | Bob Builder | MEMBER |
| `carol@teamflow.dev` | Carol Reviewer | ADMIN |
| `dave@teamflow.dev` | Dave Contributor | MEMBER |

The seed includes a project (`TF`), five tasks with a dependency chain, a comment with an @mention, and an RCA in review with two assigned reviewers — enough to demo every flow immediately.

## How the key business rules work

These are the behaviours the assignment calls out specifically; each is enforced server-side.

- **Dependency conflict** → When you add a `BLOCKS` edge, the server walks the existing graph and **rejects any edge that would create a cycle** (409). Softer conflicts (working a task that's still blocked, a due date earlier than a dependency's, an overloaded assignee) are returned as **warnings** and shown in the UI *without* blocking the save — matching the spec's "surface, don't block" stance.
- **Reviewer unavailable / review can't complete** → An RCA in review stays `IN_REVIEW` until **every** assigned reviewer submits a decision. If one reviewer never responds, the RCA simply does not resolve — it cannot be silently closed. The author can re-submit (reassigning reviewers) after a rejection. Every decision needs a mandatory comment, so no sign-off is undocumented.
- **Duplicate notifications** → Each alert is **logged before it is dispatched**. The log row carries a deterministic `dedupeKey` = hash(recipient, type, entity, channel, 60s-bucket) with a **unique constraint**. A replayed or double-fired event computes the same key, the insert is rejected, and the notification is marked `SUPPRESSED` instead of being sent twice.
- **Constrained task progression** → Status changes must follow an allowed transition map; invalid jumps return 400. Every accepted change is appended to the `ActivityLog`, so project history is trustworthy.

## Project structure

```
teamflow/
├── docker-compose.yml         # Postgres + MailHog
├── docs/                      # ERD, architecture, design decisions
├── server/                    # Express + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma      # data model (source of truth)
│   │   ├── migrations/        # SQL migration history
│   │   └── seed.js            # demo data
│   └── src/
│       ├── app.js  index.js   # app wiring + entry
│       ├── config.js prisma.js
│       ├── lib/               # auth, errors, mailer, csv, validate
│       ├── middleware/        # authenticate, project RBAC
│       ├── routes/            # auth, projects, tasks, rcas, attachments, notifications, analytics, users
│       └── services/          # task, rca, notification, analytics, activity (business logic)
└── client/                    # React + Vite + Tailwind
    └── src/
        ├── api.js  ui.js
        ├── context/AppContext.jsx   # auth + theme
        ├── pages/                   # Login, Projects, Project, Settings
        └── components/              # views/, TaskModal, RcaModal/Panel, Dashboard, ActivityFeed, NotificationBell
```

## API overview

Base URL `http://localhost:4000/api`. All routes except `/auth/*` and `/health` require `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register`, `/auth/login` | Obtain a JWT |
| GET/PATCH | `/auth/me` | Current user; update theme / email opt-out |
| GET/POST | `/projects` | List / create projects |
| GET/PATCH | `/projects/:id` | Project detail / update |
| POST/DELETE | `/projects/:id/members[/:userId]` | Manage members |
| GET/PUT | `/projects/:id/view-preference` | Per-user view persistence |
| GET/POST | `/projects/:id/tasks` | List (filterable) / create tasks |
| GET/PATCH | `/tasks/:id` | Task detail / update fields |
| POST | `/tasks/:id/status` | Constrained status transition |
| POST/DELETE | `/tasks/:id/relations[/:relId]` | Dependencies (cycle-checked) |
| GET/POST | `/tasks/:id/comments` | Comments with @mention |
| GET/POST | `/projects/:id/rcas`, `/rcas/:id` | RCA list / create / detail |
| PATCH | `/rcas/:id` | Edit sections (author) |
| POST | `/rcas/:id/submit` | Submit for review (assign reviewers) |
| POST | `/rcas/:id/reviews` | Record a decision (mandatory comment) |
| POST/GET | `/attachments`, `/attachments/:id` | Upload / download files |
| GET/POST | `/notifications`, `/notifications/mark-all-read` | In-app inbox |
| GET | `/projects/:id/dashboard` | Live analytics |
| GET | `/projects/:id/tasks/export.csv` | Filter-scoped CSV export |
| GET | `/projects/:id/activity` | Activity log feed |

## Assumptions

- **Single organisation / trusted tenancy.** There is no org boundary above projects; any user can be added to any project by an admin. Multi-tenant isolation is out of scope.
- **@mentions** are resolved by matching `@Full Name` against project members in the client; the server records the explicit `mentionIds` it receives.
- **Velocity** uses `DONE` tasks' `updatedAt` as a pragmatic completion proxy rather than a dedicated event store.
- **Attachments** are validated by size and MIME type only (no content scanning), and stored on local disk in dev as a stand-in for object storage.
- **Notifications** are polled by the client every 15s (no WebSocket), so in-app alerts have a short delay by design.
- **Auth** uses a bearer token in `localStorage`; a production deployment would prefer httpOnly cookies + refresh tokens.

## Known limitations

- In-app notifications have a **short delay** (15s poll) rather than appearing instantly.
- **Email failures surface** to the caller (recorded as `FAILED`) rather than being retried by a background worker.
- Uploaded files are **not content-inspected** beyond type and size.
- Dashboard aggregations read **live data**, so very large projects may load more slowly.
- The calendar can feel **crowded** when many tasks share a due date (capped to 3 chips + "+N more").
- Theme + auth token are **browser-bound** (localStorage); theme preference is also persisted server-side, but the token is not shared across devices.

## Future improvements

Presence indicators, threaded comment replies, a drag-adjustable timeline/Gantt view, workload forecasting, recurring tasks, configurable multi-tier approval chains, background email retry with a real queue, WebSocket push for instant notifications, and cross-project trend analytics. See [`docs/design-decisions.md`](docs/design-decisions.md) for how the current architecture leaves room for these.

---

## Scripts reference

**server/**
| Script | Action |
|--------|--------|
| `npm run dev` | Start API with autoreload |
| `npm run migrate:dev` | Create/apply a dev migration |
| `npm run migrate` | Apply migrations (deploy) |
| `npm run seed` | Load demo data |
| `npm run db:reset` | Drop, recreate, re-migrate, re-seed |

**client/**
| Script | Action |
|--------|--------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
