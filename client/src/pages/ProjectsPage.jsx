import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useApp } from "../context/AppContext.jsx";
import { Spinner, Empty, Modal, Badge } from "../components/common.jsx";

export default function ProjectsPage() {
  const { showToast } = useApp();
  const [projects, setProjects] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ key: "", name: "", description: "" });

  const load = async () => {
    const { projects } = await api.get("/projects");
    setProjects(projects);
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/projects", form);
      setCreating(false);
      setForm({ key: "", name: "", description: "" });
      showToast("Project created", "success");
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  if (!projects) return <Spinner />;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ New project</button>
      </div>

      {projects.length === 0 ? (
        <Empty>No projects yet. Create your first one.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="card p-4 transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-slate-700 dark:text-brand-50">
                  {p.key}
                </span>
                <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-700">{p.myRole}</Badge>
              </div>
              <h3 className="mt-2 font-semibold">{p.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.description || "No description"}</p>
              <div className="mt-3 flex gap-4 text-xs text-slate-400">
                <span>{p._count.tasks} tasks</span>
                <span>{p._count.rcas} RCAs</span>
                <span>{p._count.members} members</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <Modal title="New project" onClose={() => setCreating(false)}>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className="label">Key (short code, e.g. TF)</label>
              <input className="input uppercase" required maxLength={10} value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={3} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
