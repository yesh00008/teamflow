// Shared display constants + helpers.

export const STATUS_COLUMNS = [
  { key: "BACKLOG", label: "Backlog" },
  { key: "TODO", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "IN_REVIEW", label: "In Review" },
  { key: "DONE", label: "Done" },
];

export const STATUS_COLORS = {
  BACKLOG: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  TODO: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
  IN_REVIEW: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200",
  DONE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
  CANCELLED: "bg-slate-200 text-slate-500 line-through dark:bg-slate-700",
};

export const PRIORITY_COLORS = {
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  MEDIUM: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
};

export const RCA_STATUS_COLORS = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  IN_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
  CLOSED: "bg-slate-200 text-slate-600 dark:bg-slate-700",
};

export const SEVERITY_COLORS = {
  SEV1: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
  SEV2: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200",
  SEV3: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
  SEV4: "bg-slate-100 text-slate-600 dark:bg-slate-700",
};

export const SECTION_LABELS = {
  TIMELINE: "Timeline",
  CONTRIBUTING_FACTORS: "Contributing Factors",
  CORRECTIVE_ACTIONS: "Corrective Actions",
  PREVENTIVE_MEASURES: "Preventive Measures",
};

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : "—");
export const initials = (name) =>
  (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
