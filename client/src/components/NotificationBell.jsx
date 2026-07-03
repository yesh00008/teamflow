import { useEffect, useState, useRef } from "react";
import { api } from "../api.js";
import { fmtDateTime } from "../ui.js";

// Bell indicator with unread count; polls periodically (spec notes in-app
// notifications have a short delay rather than being instant).
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const { notifications, unreadCount } = await api.get("/notifications");
      setItems(notifications);
      setUnread(unreadCount);
    } catch {
      /* ignore transient errors */
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15000); // poll every 15s
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = async () => {
    await api.post("/notifications/mark-all-read");
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button className="text-xs text-brand-600 hover:underline" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 && <div className="p-4 text-center text-xs text-slate-400">No notifications</div>}
          {items.map((n) => (
            <div
              key={n.id}
              className={`rounded-md px-2 py-2 text-sm ${n.readAt ? "opacity-60" : "bg-brand-50 dark:bg-slate-700/50"}`}
            >
              <div className="font-medium">{n.title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{n.body}</div>
              <div className="mt-0.5 text-[10px] text-slate-400">{fmtDateTime(n.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
