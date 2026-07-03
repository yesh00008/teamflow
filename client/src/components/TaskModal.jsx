import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../context/AppContext.jsx";
import { Modal, Badge, Avatar, Warnings, Spinner } from "./common.jsx";
import {
  STATUS_COLUMNS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  fmtDate,
  fmtDateTime,
} from "../ui.js";

const ALL_STATUSES = [...STATUS_COLUMNS.map((c) => c.key), "CANCELLED"];

// Task detail: fields, status changes, dependencies, comments (@mention), attachments.
export default function TaskModal({ taskId, projectKey, members, onClose, onChanged }) {
  const { user, showToast } = useApp();
  const [task, setTask] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState("");
  const [relTarget, setRelTarget] = useState("");
  const [relDir, setRelDir] = useState("blocks");
  const [tasksInProject, setTasksInProject] = useState([]);

  const load = async () => {
    const { task, warnings } = await api.get(`/tasks/${taskId}`);
    setTask(task);
    setWarnings(warnings);
    const { comments } = await api.get(`/tasks/${taskId}/comments`);
    setComments(comments);
  };

  useEffect(() => {
    load();
    // Load sibling tasks for the dependency picker.
    (async () => {
      const { task } = await api.get(`/tasks/${taskId}`);
      const { tasks } = await api.get(`/projects/${task.projectId}/tasks`);
      setTasksInProject(tasks.filter((t) => t.id !== taskId));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (!task) {
    return (
      <Modal title="Task" onClose={onClose} wide>
        <Spinner />
      </Modal>
    );
  }

  const patch = async (data) => {
    try {
      const { task: updated, warnings } = await api.patch(`/tasks/${taskId}`, data);
      setTask(updated);
      setWarnings(warnings);
      onChanged?.();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const changeStatus = async (status) => {
    try {
      const { task: updated, warnings } = await api.post(`/tasks/${taskId}/status`, { status });
      setTask(updated);
      setWarnings(warnings);
      onChanged?.();
    } catch (err) {
      showToast(err.message, "error"); // invalid transitions surface here
    }
  };

  // Parse @mentions by matching member names present in the comment body.
  const addComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    const mentionIds = members
      .filter((m) => commentBody.includes(`@${m.name}`))
      .map((m) => m.id);
    try {
      await api.post(`/tasks/${taskId}/comments`, { body: commentBody, mentionIds });
      setCommentBody("");
      const { comments } = await api.get(`/tasks/${taskId}/comments`);
      setComments(comments);
      if (mentionIds.length) showToast(`Notified ${mentionIds.length} mentioned user(s)`, "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const addRelation = async () => {
    if (!relTarget) return;
    try {
      const { warnings } = await api.post(`/tasks/${taskId}/relations`, {
        targetId: relTarget,
        type: "BLOCKS",
        direction: relDir,
      });
      setRelTarget("");
      showToast("Dependency added", "success");
      setWarnings(warnings);
      load();
    } catch (err) {
      showToast(err.message, "error"); // e.g. cycle rejected
    }
  };

  const removeRelation = async (relId) => {
    await api.del(`/tasks/${taskId}/relations/${relId}`);
    load();
  };

  const uploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("taskId", taskId);
    try {
      await api.upload("/attachments", fd);
      showToast("File attached", "success");
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
    e.target.value = "";
  };

  return (
    <Modal title={`${projectKey}-${task.number}`} onClose={onClose} wide>
      <div className="space-y-4">
        {/* Title */}
        <input
          className="input text-lg font-semibold"
          value={task.title}
          onChange={(e) => setTask({ ...task, title: e.target.value })}
          onBlur={() => patch({ title: task.title })}
        />

        <Warnings warnings={warnings} />

        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              className={`badge ${s === task.status ? STATUS_COLORS[s] + " ring-2 ring-brand-400" : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700"}`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Left column: fields */}
          <div className="space-y-3">
            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                rows={4}
                value={task.description || ""}
                onChange={(e) => setTask({ ...task, description: e.target.value })}
                onBlur={() => patch({ description: task.description })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Priority</label>
                <select className="input" value={task.priority} onChange={(e) => patch({ priority: e.target.value })}>
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Assignee</label>
                <select
                  className="input"
                  value={task.assigneeId || ""}
                  onChange={(e) => patch({ assigneeId: e.target.value || null })}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Due date</label>
                <input
                  type="date"
                  className="input"
                  value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                  onChange={(e) => patch({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
              <div>
                <label className="label">Start date</label>
                <input
                  type="date"
                  className="input"
                  value={task.startDate ? task.startDate.slice(0, 10) : ""}
                  onChange={(e) => patch({ startDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
            </div>
          </div>

          {/* Right column: dependencies + attachments */}
          <div className="space-y-3">
            <div>
              <label className="label">Dependencies</label>
              <div className="space-y-1">
                {task.incomingRelations.filter((r) => r.type === "BLOCKS").map((r) => (
                  <DepRow key={r.id} text={`Blocked by ${r.source.number} ${r.source.title}`}
                    status={r.source.status} onRemove={() => removeRelation(r.id)} />
                ))}
                {task.outgoingRelations.filter((r) => r.type === "BLOCKS").map((r) => (
                  <DepRow key={r.id} text={`Blocks ${r.target.number} ${r.target.title}`}
                    status={r.target.status} onRemove={() => removeRelation(r.id)} />
                ))}
                {task.incomingRelations.length + task.outgoingRelations.length === 0 && (
                  <div className="text-xs text-slate-400">No dependencies</div>
                )}
              </div>
              <div className="mt-2 flex gap-1">
                <select className="input" value={relDir} onChange={(e) => setRelDir(e.target.value)}>
                  <option value="blocks">Blocks…</option>
                  <option value="blocked_by">Blocked by…</option>
                </select>
                <select className="input" value={relTarget} onChange={(e) => setRelTarget(e.target.value)}>
                  <option value="">Select task</option>
                  {tasksInProject.map((t) => (
                    <option key={t.id} value={t.id}>{t.number} {t.title}</option>
                  ))}
                </select>
                <button className="btn-outline" onClick={addRelation}>Add</button>
              </div>
            </div>

            <div>
              <label className="label">Attachments ({task._count.attachments})</label>
              <input type="file" onChange={uploadFile} className="text-xs" />
            </div>
          </div>
        </div>

        {/* Comments */}
        <div>
          <label className="label">Comments</label>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="rounded-md bg-slate-50 p-2 text-sm dark:bg-slate-700/50">
                <div className="flex items-center gap-2">
                  <Avatar name={c.author.name} />
                  <span className="font-medium">{c.author.name}</span>
                  <span className="text-xs text-slate-400">{fmtDateTime(c.createdAt)}</span>
                  {c.mentions?.length > 0 && <Badge className="bg-brand-50 text-brand-700">@{c.mentions.length}</Badge>}
                </div>
                <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
            {comments.length === 0 && <div className="text-xs text-slate-400">No comments yet.</div>}
          </div>
          <form onSubmit={addComment} className="mt-2 flex gap-1">
            <input
              className="input"
              placeholder="Add a comment… use @Name to mention"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
            <button className="btn-primary">Send</button>
          </form>
          <p className="mt-1 text-[10px] text-slate-400">
            Created {fmtDate(task.createdAt)} by {task.creator.name}
          </p>
        </div>
      </div>
    </Modal>
  );
}

function DepRow({ text, status, onRemove }) {
  return (
    <div className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs dark:bg-slate-700/50">
      <span className="flex items-center gap-1">
        <Badge className={STATUS_COLORS[status]}>{status}</Badge> {text}
      </span>
      <button className="text-slate-400 hover:text-red-500" onClick={onRemove}>✕</button>
    </div>
  );
}
