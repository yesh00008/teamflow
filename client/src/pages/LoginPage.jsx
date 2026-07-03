import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";

export default function LoginPage() {
  const { user, login, register } = useApp();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/projects" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.email, form.password, form.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="mb-6 text-center">
        <div className="text-4xl">🌊</div>
        <h1 className="text-2xl font-bold text-brand-600">TeamFlow</h1>
        <p className="text-sm text-slate-500">Plan, execute, and investigate work in one place.</p>
      </div>
      <form onSubmit={submit} className="card space-y-3 p-5">
        {mode === "register" && (
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
            />
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
          />
        </div>
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40">{error}</div>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          className="w-full text-center text-xs text-brand-600 hover:underline"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
        </button>
      </form>
      <div className="mt-4 rounded-md bg-slate-100 p-3 text-center text-xs text-slate-500 dark:bg-slate-800">
        Demo: <b>alice@teamflow.dev</b> / <b>password123</b>
      </div>
    </div>
  );
}
