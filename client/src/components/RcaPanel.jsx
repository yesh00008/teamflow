import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../context/AppContext.jsx";
import { Empty, Modal, Badge } from "./common.jsx";
import RcaModal from "./RcaModal.jsx";
import { RCA_STATUS_COLORS, SEVERITY_COLORS, fmtDate } from "../ui.js";

export default function RcaPanel({ projectId, members }) {
  const { showToast } = useApp();
  const [rcas, setRcas] = useState([]);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState({ title: "", summary: "", severity: "SEV3" });

  const load = async () => {
    const { rcas } = await api.get(`/projects/${projectId}/rcas`);
    setRcas(rcas);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  const create = async (e) => {
    e.preventDefault();
    try {
      const { rca } = await api.post(`/projects/${projectId}/rcas`, form);
      setCreating(false);
      setForm({ title: "", summary: "", severity: "SEV3" });
      load();
      setOpenId(rca.id);
    } catch (err) { showToast(err.message, "error"); }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Root Cause Analyses</h2>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ New RCA</button>
      </div>

      {rcas.length === 0 ? (
        <Empty>No investigations yet.</Empty>
      ) : (
        <div className="space-y-2">
          {rcas.map((r) => (
            <button key={r.id} onClick={() => setOpenId(r.id)} className="card flex w-full items-center justify-between p-3 text-left hover:shadow-md">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-slate-400">
                  by {r.author.name} · {fmtDate(r.createdAt)} · {r.reviews.length} reviewer(s)
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={SEVERITY_COLORS[r.severity]}>{r.severity}</Badge>
                <Badge className={RCA_STATUS_COLORS[r.status]}>{r.status.replace("_", " ")}</Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      {creating && (
        <Modal title="New RCA" onClose={() => setCreating(false)}>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className="label">Title</label>
              <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Summary</label>
              <textarea className="input" rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </div>
            <div>
              <label className="label">Severity</label>
              <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {["SEV1", "SEV2", "SEV3", "SEV4"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn-primary">Create draft</button>
            </div>
          </form>
        </Modal>
      )}

      {openId && (
        <RcaModal rcaId={openId} members={members} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </div>
  );
}
