import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import { useApp } from "../context/AppContext.jsx";
import { Spinner, Modal } from "../components/common.jsx";
import KanbanBoard from "../components/views/KanbanBoard.jsx";
import ListView from "../components/views/ListView.jsx";
import CalendarView from "../components/views/CalendarView.jsx";
import TaskModal from "../components/TaskModal.jsx";
import RcaPanel from "../components/RcaPanel.jsx";
import Dashboard from "../components/Dashboard.jsx";
import ActivityFeed from "../components/ActivityFeed.jsx";

const TABS = ["Board", "Calendar", "List", "RCAs", "Dashboard", "Activity"];
const VIEW_FOR_TAB = { Board: "KANBAN", Calendar: "CALENDAR", List: "LIST" };

export default function ProjectPage() {
  const { projectId } = useParams();
  const { showToast } = useApp();
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [tab, setTab] = useState("Board");
  const [tasks, setTasks] = useState([]);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", priority: "MEDIUM", assigneeId: "" });

  // Filter + sort state (drives both the list view and the CSV export scope).
  const [filters, setFilters] = useState({ status: "", priority: "", assigneeId: "", q: "" });
  const [sort, setSort] = useState("number");
  const [dir, setDir] = useState("asc");

  const queryString = useCallback(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    p.set("sort", sort);
    p.set("dir", dir);
    return p.toString();
  }, [filters, sort, dir]);

  const loadTasks = useCallback(async () => {
    const { tasks } = await api.get(`/projects/${projectId}/tasks?${queryString()}`);
    setTasks(tasks);
  }, [projectId, queryString]);

  // Initial project + members + saved view preference.
  useEffect(() => {
    (async () => {
      const { project } = await api.get(`/projects/${projectId}`);
      setProject(project);
      setMembers(project.members.map((m) => m.user));
      const { viewMode } = await api.get(`/projects/${projectId}/view-preference`);
      const savedTab = Object.entries(VIEW_FOR_TAB).find(([, v]) => v === viewMode)?.[0];
      if (savedTab) setTab(savedTab);
    })();
  }, [projectId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Persist per-user view preference when switching between task views.
  const selectTab = async (t) => {
    setTab(t);
    if (VIEW_FOR_TAB[t]) {
      api.put(`/projects/${projectId}/view-preference`, { viewMode: VIEW_FOR_TAB[t] }).catch(() => {});
    }
  };

  const changeStatus = async (taskId, status) => {
    try {
      await api.post(`/tasks/${taskId}/status`, { status });
      loadTasks();
    } catch (err) {
      showToast(err.message, "error"); // invalid transition rejected
    }
  };

  const onSort = (key) => {
    if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(key); setDir("asc"); }
  };

  const createTask = async (e) => {
    e.preventDefault();
    try {
      const { warnings } = await api.post(`/projects/${projectId}/tasks`, {
        title: newTask.title,
        priority: newTask.priority,
        assigneeId: newTask.assigneeId || null,
      });
      setCreating(false);
      setNewTask({ title: "", priority: "MEDIUM", assigneeId: "" });
      if (warnings?.length) showToast(warnings[0].message, "info");
      loadTasks();
    } catch (err) { showToast(err.message, "error"); }
  };

  const exportCsv = () => api.download(`/projects/${projectId}/tasks/export.csv?${queryString()}`, `${project.key}-tasks.csv`);

  if (!project) return <Spinner />;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <Link to="/projects" className="text-xs text-slate-400 hover:underline">← All projects</Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700 dark:bg-slate-700 dark:text-brand-50">{project.key}</span>
            <h1 className="text-2xl font-bold">{project.name}</h1>
          </div>
          <button className="btn-primary" onClick={() => setCreating(true)}>+ New task</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => selectTab(t)}
            className={`px-3 py-2 text-sm font-medium ${tab === t ? "border-b-2 border-brand-500 text-brand-600" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filter bar (shown for task views) */}
      {["Board", "Calendar", "List"].includes(tab) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className="input max-w-[200px]" placeholder="Search…" value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <select className="input max-w-[150px]" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>
            {["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <select className="input max-w-[150px]" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
            <option value="">All priorities</option>
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input max-w-[160px]" value={filters.assigneeId} onChange={(e) => setFilters({ ...filters, assigneeId: e.target.value })}>
            <option value="">All assignees</option>
            <option value="none">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button className="btn-outline ml-auto" onClick={exportCsv}>⬇ Export CSV</button>
        </div>
      )}

      {/* View body */}
      {tab === "Board" && <KanbanBoard tasks={tasks} onOpen={setOpenTaskId} onStatusChange={changeStatus} />}
      {tab === "Calendar" && <CalendarView tasks={tasks} onOpen={setOpenTaskId} />}
      {tab === "List" && <ListView tasks={tasks} onOpen={setOpenTaskId} sort={sort} dir={dir} onSort={onSort} />}
      {tab === "RCAs" && <RcaPanel projectId={projectId} members={members} />}
      {tab === "Dashboard" && <Dashboard projectId={projectId} />}
      {tab === "Activity" && <ActivityFeed projectId={projectId} />}

      {/* Task detail */}
      {openTaskId && (
        <TaskModal
          taskId={openTaskId}
          projectKey={project.key}
          members={members}
          onClose={() => setOpenTaskId(null)}
          onChanged={loadTasks}
        />
      )}

      {/* New task */}
      {creating && (
        <Modal title="New task" onClose={() => setCreating(false)}>
          <form onSubmit={createTask} className="space-y-3">
            <div>
              <label className="label">Title</label>
              <input className="input" required value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Priority</label>
                <select className="input" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}>
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Assignee</label>
                <select className="input" value={newTask.assigneeId} onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn-primary">Create</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
