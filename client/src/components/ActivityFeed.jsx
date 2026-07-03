import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Spinner, Empty, Avatar } from "./common.jsx";
import { fmtDateTime } from "../ui.js";

// Read-only view over the append-only ActivityLog.
const ICONS = {
  "task.created": "➕",
  "task.updated": "✏️",
  "task.status_changed": "🔀",
  "task.commented": "💬",
  "task.relation_added": "🔗",
  "rca.created": "🧪",
  "rca.submitted": "📤",
  "rca.review_recorded": "✅",
  "project.created": "📁",
  "project.member_added": "👤",
};

export default function ActivityFeed({ projectId }) {
  const [activity, setActivity] = useState(null);
  useEffect(() => {
    api.get(`/projects/${projectId}/activity`).then((d) => setActivity(d.activity));
  }, [projectId]);

  if (!activity) return <Spinner />;
  if (activity.length === 0) return <Empty>No activity recorded yet.</Empty>;

  return (
    <div className="card divide-y divide-slate-100 dark:divide-slate-700">
      {activity.map((a) => (
        <div key={a.id} className="flex items-start gap-3 p-3 text-sm">
          <span className="text-lg">{ICONS[a.action] || "•"}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {a.actor && <Avatar name={a.actor.name} />}
              <span className="font-medium">{a.actor?.name || "System"}</span>
              <span className="text-slate-500">{describe(a)}</span>
            </div>
            <div className="text-xs text-slate-400">{fmtDateTime(a.createdAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function describe(a) {
  const m = a.metadata || {};
  switch (a.action) {
    case "task.created": return `created task "${m.title}"`;
    case "task.status_changed": return `moved a task ${m.from} → ${m.to}`;
    case "task.updated": return `updated ${(m.fields || []).join(", ")}`;
    case "task.commented": return "commented on a task";
    case "task.relation_added": return "added a dependency";
    case "rca.created": return `opened RCA "${m.title}"`;
    case "rca.submitted": return `submitted an RCA for review`;
    case "rca.review_recorded": return `recorded a review (${m.decision})`;
    case "project.created": return "created the project";
    case "project.member_added": return "added a member";
    default: return a.action;
  }
}
