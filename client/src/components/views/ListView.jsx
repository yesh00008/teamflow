import { STATUS_COLORS, PRIORITY_COLORS, fmtDate } from "../../ui.js";
import { Badge } from "../common.jsx";

// Flat sortable list. Sort is driven by the parent (which re-queries the API so
// the CSV export matches the exact same ordering/filter state).
export default function ListView({ tasks, onOpen, sort, dir, onSort }) {
  const cols = [
    { key: "number", label: "#" },
    { key: "title", label: "Title" },
    { key: "status", label: "Status" },
    { key: "priority", label: "Priority" },
    { key: "assignee", label: "Assignee", noSort: true },
    { key: "dueDate", label: "Due" },
  ];
  const arrow = (k) => (sort === k ? (dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
          <tr>
            {cols.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 ${c.noSort ? "" : "cursor-pointer select-none hover:text-brand-600"}`}
                onClick={() => !c.noSort && onSort(c.key)}
              >
                {c.label}{!c.noSort && arrow(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {tasks.map((t) => (
            <tr key={t.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => onOpen(t.id)}>
              <td className="px-3 py-2 text-slate-400">#{t.number}</td>
              <td className="px-3 py-2 font-medium">{t.title}</td>
              <td className="px-3 py-2"><Badge className={STATUS_COLORS[t.status]}>{t.status.replace("_", " ")}</Badge></td>
              <td className="px-3 py-2"><Badge className={PRIORITY_COLORS[t.priority]}>{t.priority}</Badge></td>
              <td className="px-3 py-2 text-slate-500">{t.assignee?.name || "—"}</td>
              <td className="px-3 py-2 text-slate-500">{fmtDate(t.dueDate)}</td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr><td colSpan={6} className="p-6 text-center text-slate-400">No tasks match the current filter.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
