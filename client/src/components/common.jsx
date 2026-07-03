import { initials } from "../ui.js";

export function Badge({ className = "", children }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function Avatar({ name, size = 8 }) {
  return (
    <span
      className={`inline-flex h-${size} w-${size} items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white`}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      {label}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="p-6 text-center text-sm text-slate-400">{children}</div>;
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className={`card mt-10 w-full ${wide ? "max-w-3xl" : "max-w-lg"} p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Renders non-blocking warnings (dependency conflicts, assignee overload).
export function Warnings({ warnings }) {
  if (!warnings?.length) return null;
  return (
    <div className="space-y-1">
      {warnings.map((w, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <span>⚠️</span>
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
}
