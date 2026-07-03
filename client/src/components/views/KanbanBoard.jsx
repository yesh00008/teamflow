import { STATUS_COLUMNS, STATUS_COLORS, PRIORITY_COLORS } from "../../ui.js";
import { Avatar, Badge } from "../common.jsx";

// Kanban grouped by status. Cards are draggable between columns; dropping calls
// onStatusChange, which hits the constrained-transition endpoint (invalid moves
// are rejected and surfaced as a toast).
export default function KanbanBoard({ tasks, onOpen, onStatusChange }) {
  const grouped = STATUS_COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.key),
  }));

  const onDrop = (e, status) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task-id");
    const from = e.dataTransfer.getData("text/task-status");
    if (id && from !== status) onStatusChange(id, status);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {grouped.map((col) => (
        <div
          key={col.key}
          className="flex w-72 shrink-0 flex-col rounded-lg bg-slate-100/70 p-2 dark:bg-slate-800/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDrop(e, col.key)}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm font-semibold">{col.label}</span>
            <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700">{col.tasks.length}</span>
          </div>
          <div className="space-y-2">
            {col.tasks.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/task-id", t.id);
                  e.dataTransfer.setData("text/task-status", t.status);
                }}
                onClick={() => onOpen(t.id)}
                className="card cursor-pointer p-2.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-400">#{t.number}</span>
                  <Badge className={PRIORITY_COLORS[t.priority]}>{t.priority}</Badge>
                </div>
                <p className="mt-1 text-sm font-medium">{t.title}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex gap-1 text-[10px] text-slate-400">
                    {t._count.comments > 0 && <span>💬 {t._count.comments}</span>}
                    {t._count.attachments > 0 && <span>📎 {t._count.attachments}</span>}
                    {t.incomingRelations?.some((r) => r.type === "BLOCKS") && <span title="Has dependencies">🔗</span>}
                  </div>
                  {t.assignee ? <Avatar name={t.assignee.name} /> : <span className="text-[10px] text-slate-300">—</span>}
                </div>
              </div>
            ))}
            {col.tasks.length === 0 && <div className="py-4 text-center text-xs text-slate-300">Empty</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
