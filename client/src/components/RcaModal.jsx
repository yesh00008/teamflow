import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../context/AppContext.jsx";
import { Modal, Badge, Avatar, Spinner } from "./common.jsx";
import { RCA_STATUS_COLORS, SEVERITY_COLORS, SECTION_LABELS, fmtDateTime } from "../ui.js";

// RCA detail: edit sections (author, while DRAFT/REJECTED), submit for review,
// and record reviewer decisions. The sign-off rule is enforced server-side; the
// UI simply reflects the derived status.
export default function RcaModal({ rcaId, members, onClose, onChanged }) {
  const { user, showToast } = useApp();
  const [rca, setRca] = useState(null);
  const [reviewerIds, setReviewerIds] = useState([]);
  const [decisionComment, setDecisionComment] = useState("");

  const load = async () => {
    const { rca } = await api.get(`/rcas/${rcaId}`);
    setRca(rca);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rcaId]);

  if (!rca) return <Modal title="RCA" onClose={onClose} wide><Spinner /></Modal>;

  const isAuthor = rca.authorId === user.id;
  const editable = isAuthor && ["DRAFT", "REJECTED"].includes(rca.status);
  const mySlot = rca.reviews.find((r) => r.reviewerId === user.id);
  const canReview = rca.status === "IN_REVIEW" && mySlot && mySlot.decision === "PENDING";

  const saveSection = async (type, content) => {
    try {
      await api.patch(`/rcas/${rcaId}`, { sections: [{ type, content }] });
      onChanged?.();
    } catch (err) { showToast(err.message, "error"); }
  };

  const submit = async () => {
    if (reviewerIds.length === 0) return showToast("Select at least one reviewer", "error");
    try {
      await api.post(`/rcas/${rcaId}/submit`, { reviewerIds });
      showToast("Submitted for review", "success");
      load(); onChanged?.();
    } catch (err) { showToast(err.message, "error"); }
  };

  const decide = async (decision) => {
    if (!decisionComment.trim()) return showToast("A comment is required with your decision", "error");
    try {
      const { outcome } = await api.post(`/rcas/${rcaId}/reviews`, { decision, comment: decisionComment });
      setDecisionComment("");
      showToast(outcome.resolved ? `RCA ${outcome.status.toLowerCase()}` : "Decision recorded — awaiting other reviewers", "success");
      load(); onChanged?.();
    } catch (err) { showToast(err.message, "error"); }
  };

  const pending = rca.reviews.filter((r) => r.decision === "PENDING").length;

  return (
    <Modal title={`RCA · ${rca.title}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={RCA_STATUS_COLORS[rca.status]}>{rca.status.replace("_", " ")}</Badge>
          <Badge className={SEVERITY_COLORS[rca.severity]}>{rca.severity}</Badge>
          <span className="text-xs text-slate-500">by {rca.author.name}</span>
          {rca.status === "IN_REVIEW" && (
            <span className="text-xs text-amber-600">{pending} reviewer(s) outstanding</span>
          )}
        </div>

        {rca.summary && <p className="text-sm text-slate-600 dark:text-slate-300">{rca.summary}</p>}

        {/* Structured sections */}
        <div className="grid gap-3 sm:grid-cols-2">
          {rca.sections.map((s) => (
            <div key={s.id}>
              <label className="label">{SECTION_LABELS[s.type]}</label>
              <textarea
                className="input"
                rows={3}
                defaultValue={s.content}
                disabled={!editable}
                onBlur={(e) => editable && e.target.value !== s.content && saveSection(s.type, e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* Reviews summary */}
        <div>
          <label className="label">Reviews</label>
          <div className="space-y-1">
            {rca.reviews.length === 0 && <div className="text-xs text-slate-400">Not yet submitted for review.</div>}
            {rca.reviews.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-sm dark:bg-slate-700/50">
                <span className="flex items-center gap-2"><Avatar name={r.reviewer.name} /> {r.reviewer.name}</span>
                <span className="flex items-center gap-2">
                  {r.comment && <span className="max-w-xs truncate text-xs text-slate-500">"{r.comment}"</span>}
                  <Badge className={
                    r.decision === "APPROVED" ? "bg-emerald-100 text-emerald-700"
                    : r.decision === "REJECTED" ? "bg-red-100 text-red-700"
                    : "bg-slate-200 text-slate-500"
                  }>{r.decision}</Badge>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Author: submit for review */}
        {editable && (
          <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
            <label className="label">Submit for review — choose reviewers</label>
            <select
              multiple
              className="input h-24"
              value={reviewerIds}
              onChange={(e) => setReviewerIds([...e.target.selectedOptions].map((o) => o.value))}
            >
              {members.filter((m) => m.id !== rca.authorId).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <button className="btn-primary mt-2" onClick={submit}>Submit for review</button>
          </div>
        )}

        {/* Reviewer: record decision (mandatory comment) */}
        {canReview && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
            <label className="label">Your review decision (comment required)</label>
            <textarea className="input" rows={2} value={decisionComment}
              onChange={(e) => setDecisionComment(e.target.value)} placeholder="Explain your decision…" />
            <div className="mt-2 flex gap-2">
              <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => decide("APPROVED")}>Approve</button>
              <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={() => decide("REJECTED")}>Reject</button>
            </div>
          </div>
        )}

        <p className="text-[10px] text-slate-400">
          Submitted {fmtDateTime(rca.submittedAt)} · Closed {fmtDateTime(rca.closedAt)}
        </p>
      </div>
    </Modal>
  );
}
