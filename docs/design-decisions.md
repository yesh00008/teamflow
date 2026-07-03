# TeamFlow — Design Decisions Log

Each decision records the **context**, the **alternatives considered**, the **trade-off**, and the **rationale**. They map to the product decisions and tradeoffs called out in the brief.

---

### DD-1 · Modular monolith over microservices
- **Context:** One team-scale platform spanning planning, tasks, RCAs, notifications, reporting.
- **Alternatives:** (a) Microservices per aggregate; (b) serverless functions; (c) modular monolith.
- **Decision:** Modular monolith — one Express deployable, domain-split `services/`.
- **Trade-off:** Less independent scaling/deployment per module; but far simpler transactions, one migration path, and trivial local setup. The service boundaries make later extraction cheap.
- **Rationale:** Aggregates are tightly coupled through shared users/projects; premature service boundaries would add distributed-transaction pain with no scale need yet.

### DD-2 · PostgreSQL over a document store
- **Context:** Constraint-heavy, relational domain (dependency edges, sign-off completeness, unique keys).
- **Alternatives:** MongoDB / DynamoDB; Postgres; Postgres + JSON hybrid.
- **Decision:** Postgres via Prisma, using JSON columns only where schemaless genuinely helps (`ActivityLog.metadata`).
- **Trade-off:** Rigid schema + migrations vs document flexibility; but we gain referential integrity and transactional guarantees for free.
- **Rationale:** The hardest rules ("resolve only when all reviewers decided", cycle-free dependencies, per-project numbering) are relational integrity problems. Keeping them in the DB beats re-implementing them in app code.

### DD-3 · Dependencies as a directional edge entity
- **Context:** Tasks depend on one another and must be trackable across projects.
- **Alternatives:** (a) `blockedById` FK column; (b) array column of ids; (c) `TaskRelation` edge table.
- **Decision:** Edge table with `type` (`BLOCKS`/`RELATES_TO`) and a uniqueness constraint.
- **Trade-off:** An extra join to read dependencies; but supports many-to-many, cross-project links, typed relations, and metadata.
- **Rationale:** A single FK can't express many blockers/dependents, and an array can't be validated or joined cleanly. The edge table also makes cycle detection a straightforward graph walk. **See DD-4.**

### DD-4 · Reject dependency cycles, warn on softer conflicts
- **Context:** "How should the system behave when a dependency conflict arises?"
- **Alternatives:** (a) Block all conflicting saves; (b) allow everything, no feedback; (c) hard-block only true cycles, warn on the rest.
- **Decision:** A `BLOCKS` edge that would create a cycle is **rejected** (409). Working a still-blocked task, a due date before a dependency's, or an overloaded assignee return **non-blocking warnings**.
- **Trade-off:** Warnings can be ignored; but hard-blocking soft conflicts would fight the team's judgement and stall work.
- **Rationale:** A cycle is logically impossible to satisfy, so it must be prevented. Everything else is a *judgement* signal — the spec explicitly says surface conflicts and assignee overload "as warnings without blocking saves."

### DD-5 · Constrained task status transitions
- **Context:** "Task progression … less ad-hoc flexibility, but project history stays trustworthy."
- **Alternatives:** Free-form status editing vs an allowed-transition map.
- **Decision:** Explicit transition map; invalid jumps rejected; every change appended to `ActivityLog`.
- **Trade-off:** Users can't skip arbitrarily between states; but history becomes a reliable narrative.
- **Rationale:** Directly implements the product stance that a trustworthy shared history beats unconstrained flexibility.

### DD-6 · RCA sign-off derived from reviewer slots
- **Context:** "An investigation cannot close until all assigned reviewers have decided"; behaviour when a reviewer is unavailable or review can't complete.
- **Alternatives:** (a) Single approver; (b) first-decision-wins; (c) one `Review` slot per reviewer, status derived from the full set.
- **Decision:** Pre-create a `PENDING` `Review` per reviewer; resolve only when none remain pending; any rejection ⇒ REJECTED; every decision needs a mandatory comment.
- **Trade-off:** Resolution can stall if a reviewer never responds; but no RCA is ever silently closed.
- **Rationale:** Modelling reviewers as rows makes "all decided" a trivial, race-free check. An unavailable reviewer simply leaves the RCA open (visible as "N reviewers outstanding") — the author can reject-and-resubmit with new reviewers if needed. Mandatory comments guarantee documented sign-off.

### DD-7 · Log-before-dispatch notifications with a unique dedupe key
- **Context:** "Every alert is logged before dispatch, and duplicates are suppressed"; evaluation replays an event twice.
- **Alternatives:** (a) Fire-and-forget send; (b) in-memory dedup cache; (c) persist first with a unique `dedupeKey`.
- **Decision:** Insert the notification row (`PENDING`) *before* sending; `dedupeKey = hash(recipient, type, entity, channel, 60s bucket)` carries a `UNIQUE` constraint; a collision ⇒ `SUPPRESSED`.
- **Trade-off:** A slight delivery delay and one extra write per alert; but duplicate suppression becomes a **database guarantee**, and delivery state is auditable.
- **Rationale:** In-memory dedup fails across restarts and replicas. Persisting first is the only approach that survives concurrency, retries, and multiple API instances — and it doubles as the delivery log.

### DD-8 · Single pipeline for in-app + email, with opt-out
- **Context:** "Alerts are delivered via an in-app bell and email from a single event pipeline."
- **Alternatives:** Separate code paths per channel vs one `notify()` fanning out to channels.
- **Decision:** One `notify()` entry point iterates channels; in-app is always delivered, email respects `User.emailOptOut`; each channel records its own outcome.
- **Trade-off:** A channel abstraction to maintain; but no divergence between how in-app and email alerts are decided or logged.
- **Rationale:** A single pipeline is what makes dedup, opt-out, and consistent logging uniform across channels — and where a queue slots in later.

### DD-9 · Live analytics over pre-aggregation
- **Context:** "Dashboard figures reflect live data … always current, but very large projects may see slower loads."
- **Alternatives:** (a) Cached/materialised rollups; (b) live aggregation at request time.
- **Decision:** Aggregate live in `analyticsService`.
- **Trade-off:** Slower on very large projects; but always correct with zero cache-invalidation complexity.
- **Rationale:** For current data volumes, correctness and simplicity win. Materialised summaries are a clean later optimisation (noted in architecture scaling) precisely because the aggregation logic is isolated in one service.

### DD-10 · CSV export scoped to active filter state
- **Context:** "All list views support CSV export scoped to the active filter state."
- **Alternatives:** Export everything vs reuse the exact filter/sort the user is viewing.
- **Decision:** The export endpoint reuses the **same filter builder** (`buildTaskFilter`) as the list API; the client passes its current query params through.
- **Trade-off:** None significant; the export can never drift from the list because both share one filter function.
- **Rationale:** Guarantees "the exported file contained only filtered records, with nothing extra" by construction.

### DD-11 · Object-storage abstraction for files
- **Context:** File storage strategy; files must not bloat the DB.
- **Alternatives:** (a) BLOBs in Postgres; (b) files behind a storage adapter (local disk now, S3 later).
- **Decision:** Store only a `storageKey` in the DB; binaries live behind the attachments route's storage adapter.
- **Trade-off:** Local disk isn't durable/shared across nodes in dev; but the swap to S3/GCS touches one module.
- **Rationale:** Keeps the DB lean and lets file serving scale independently, per the brief's file-storage prompt.

### DD-12 · Stateless JWT auth with two-layer authorisation
- **Context:** Users act across multiple projects with different roles.
- **Alternatives:** Server sessions vs stateless JWT; single global role vs per-project roles.
- **Decision:** Stateless JWT for identity + per-project `ProjectMember.role` (VIEWER<MEMBER<ADMIN<OWNER) enforced by middleware.
- **Trade-off:** Coarse token revocation; but horizontal scaling with no session store, and precise per-project permissions.
- **Rationale:** Authorisation is inherently project-scoped here, so identity (JWT) and permission (membership) are cleanly separated. Refresh tokens/httpOnly cookies are the noted production hardening.

### DD-13 · Polling for in-app notifications (no WebSocket yet)
- **Context:** In-app bell needs to update; the brief accepts a short delay as a known limitation.
- **Alternatives:** WebSocket/SSE push vs periodic polling.
- **Decision:** Client polls every 15s.
- **Trade-off:** Up to ~15s latency; but zero extra infrastructure and simpler ops.
- **Rationale:** Matches the acknowledged limitation ("in-app notifications have a short delay"). Push is a clean upgrade behind the same data model when instant delivery is required.

---

## Decision → requirement traceability

| Requirement in brief | Decisions |
|----------------------|-----------|
| Domain model incl. cross-project & dependent tasks | DD-3, DD-4 |
| Architecture (monolith/SQL/sync/files) | DD-1, DD-2, DD-8, DD-11 |
| Dependency conflict behaviour | DD-4 |
| Reviewer unavailable / review can't complete | DD-6 |
| Notification behaviour (single pipeline, dedup, opt-out) | DD-7, DD-8, DD-13 |
| Task workflow & trustworthy history | DD-5 |
| Reporting & export | DD-9, DD-10 |
| Permissions | DD-12 |
