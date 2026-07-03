import { useState } from "react";
import { STATUS_COLORS } from "../../ui.js";

// Month calendar keyed by task due date. Days with many tasks can feel crowded
// (a known limitation) — we cap visible chips per day and show a "+N more".
export default function CalendarView({ tasks, onOpen }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const first = new Date(cursor.year, cursor.month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();

  const byDay = {};
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const d = new Date(t.dueDate);
    if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) {
      const key = d.getDate();
      (byDay[key] = byDay[key] || []).push(t);
    }
  }

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthName = first.toLocaleString(undefined, { month: "long", year: "numeric" });
  const shift = (delta) => {
    let m = cursor.month + delta, y = cursor.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCursor({ year: y, month: m });
  };
  const noDue = tasks.filter((t) => !t.dueDate).length;

  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <button className="btn-ghost" onClick={() => shift(-1)}>← Prev</button>
        <span className="font-semibold">{monthName}</span>
        <button className="btn-ghost" onClick={() => shift(1)}>Next →</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => (
          <div key={i} className={`min-h-20 rounded border p-1 text-left ${d ? "border-slate-200 dark:border-slate-700" : "border-transparent"}`}>
            {d && <div className="text-[11px] text-slate-400">{d}</div>}
            <div className="space-y-0.5">
              {(byDay[d] || []).slice(0, 3).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onOpen(t.id)}
                  className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] ${STATUS_COLORS[t.status]}`}
                  title={t.title}
                >
                  {t.title}
                </button>
              ))}
              {(byDay[d]?.length || 0) > 3 && (
                <div className="text-[10px] text-slate-400">+{byDay[d].length - 3} more</div>
              )}
            </div>
          </div>
        ))}
      </div>
      {noDue > 0 && (
        <div className="mt-2 text-xs text-slate-400">{noDue} task(s) without a due date are not shown.</div>
      )}
    </div>
  );
}
