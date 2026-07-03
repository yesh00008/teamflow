import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useApp } from "./context/AppContext.jsx";
import { Spinner, Avatar } from "./components/common.jsx";
import NotificationBell from "./components/NotificationBell.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";
import ProjectPage from "./pages/ProjectPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

function TopBar() {
  const { user, logout, toggleTheme } = useApp();
  const loc = useLocation();
  if (!user) return null;
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-800/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5">
        <Link to="/projects" className="flex items-center gap-2 text-lg font-bold text-brand-600">
          <span className="text-xl">🌊</span> TeamFlow
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button className="btn-ghost" onClick={toggleTheme} title="Toggle theme">
            {user.theme === "DARK" ? "☀️" : "🌙"}
          </button>
          <Link
            to="/settings"
            className={`btn-ghost ${loc.pathname === "/settings" ? "bg-slate-100 dark:bg-slate-700" : ""}`}
          >
            <Avatar name={user.name} /> <span className="hidden sm:inline">{user.name}</span>
          </Link>
          <button className="btn-outline" onClick={logout}>Sign out</button>
        </div>
      </div>
    </header>
  );
}

function Protected({ children }) {
  const { user, loading } = useApp();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  const color =
    toast.kind === "error"
      ? "bg-red-600"
      : toast.kind === "success"
      ? "bg-emerald-600"
      : "bg-slate-800";
  return (
    <div className={`fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-md ${color} px-4 py-2 text-sm text-white shadow-lg`}>
      {toast.message}
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/projects" element={<Protected><ProjectsPage /></Protected>} />
          <Route path="/projects/:projectId" element={<Protected><ProjectPage /></Protected>} />
          <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </main>
      <Toast />
    </div>
  );
}
