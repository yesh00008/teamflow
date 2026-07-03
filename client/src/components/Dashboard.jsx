import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Spinner } from "./common.jsx";
import { STATUS_COLORS } from "../ui.js";

// Live analytics (aggregated at request time). Charts are lightweight, pure-CSS
// bars so there is no extra charting dependency to explain in the demo.
export default function Dashboard({ projectId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(`/projects/${projectId}/dashboard`).then(setData);
  }, [projectId]);

  if (!data) return <Spinner label="Loading dashboard…" />;
  const maxVel = Math.max(1, ...data.velocity.map((v) => v.completed));
  const maxLoad = Math.max(1, ...data.workload.map((w) => w.open));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Stat title="Project health">
        <div className="flex items-center gap-4">
          <Gauge score={data.health.score} />
          <div>
            <div className="text-2xl font-bold">{data.health.label}</div>
            <div className="text-sm text-slate-500">Score {data.health.score}/100</div>
          </div>
        </div>
      </Stat>

      <Stat title="Completion">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Total" value={data.totals.tasks} />
          <Metric label="Done" value={data.totals.done} />
          <Metric label="Overdue" value={data.totals.overdue} accent={data.totals.overdue ? "text-red-600" : ""} />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Completion rate</span><span>{data.totals.completionRate}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${data.totals.completionRate}%` }} />
          </div>
        </div>
      </Stat>

      <Stat title="Tasks by status">
        <div className="space-y-1.5">
          {Object.entries(data.byStatus).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className={`badge w-24 justify-center ${STATUS_COLORS[k] || ""}`}>{k.replace("_", " ")}</span>
              <div className="h-3 flex-1 rounded bg-slate-100 dark:bg-slate-700">
                <div className="h-3 rounded bg-brand-500" style={{ width: `${(v / data.totals.tasks) * 100}%` }} />
              </div>
              <span className="w-5 text-right">{v}</span>
            </div>
          ))}
        </div>
      </Stat>

      <Stat title="Workload per assignee (open tasks)">
        {data.workload.length === 0 ? <Empty /> : data.workload.map((w) => (
          <div key={w.assigneeId} className="mb-1.5 flex items-center gap-2 text-xs">
            <span className="w-28 truncate">{w.name}</span>
            <div className="h-3 flex-1 rounded bg-slate-100 dark:bg-slate-700">
              <div className="h-3 rounded bg-amber-500" style={{ width: `${(w.open / maxLoad) * 100}%` }} />
            </div>
            <span className="w-5 text-right">{w.open}</span>
          </div>
        ))}
      </Stat>

      <Stat title="Velocity (tasks completed / week)">
        <div className="flex h-32 items-end gap-1">
          {data.velocity.map((v) => (
            <div key={v.weekStart} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-brand-500" style={{ height: `${(v.completed / maxVel) * 100}%`, minHeight: v.completed ? 4 : 0 }} title={`${v.completed} on ${v.weekStart}`} />
              <span className="text-[9px] text-slate-400">{v.weekStart.slice(5)}</span>
            </div>
          ))}
        </div>
      </Stat>

      <Stat title="RCA volume by status">
        {Object.keys(data.rcaByStatus).length === 0 ? <Empty text="No RCAs yet" /> : (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.rcaByStatus).map(([k, v]) => (
              <div key={k} className="rounded bg-slate-50 p-2 text-center dark:bg-slate-700/50">
                <div className="text-xl font-bold">{v}</div>
                <div className="text-[11px] text-slate-500">{k}</div>
              </div>
            ))}
          </div>
        )}
      </Stat>
    </div>
  );
}

const Stat = ({ title, children }) => (
  <div className="card p-4">
    <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</h3>
    {children}
  </div>
);
const Metric = ({ label, value, accent = "" }) => (
  <div>
    <div className={`text-2xl font-bold ${accent}`}>{value}</div>
    <div className="text-[11px] text-slate-500">{label}</div>
  </div>
);
const Empty = ({ text = "No data" }) => <div className="text-xs text-slate-400">{text}</div>;

function Gauge({ score }) {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-full text-sm font-bold"
      style={{ background: `conic-gradient(${color} ${score * 3.6}deg, #e2e8f0 0deg)` }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-slate-800">{score}</div>
    </div>
  );
}
