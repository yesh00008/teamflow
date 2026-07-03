import { useApp } from "../context/AppContext.jsx";

export default function SettingsPage() {
  const { user, toggleTheme, setEmailOptOut, showToast } = useApp();

  const onOptOut = async (e) => {
    await setEmailOptOut(e.target.checked);
    showToast("Preference saved", "success");
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-5 text-2xl font-bold">Settings</h1>
      <div className="card divide-y divide-slate-200 dark:divide-slate-700">
        <Row label="Name" value={user.name} />
        <Row label="Email" value={user.email} />
        <div className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm font-medium">Theme</div>
            <div className="text-xs text-slate-500">Applied instantly across the app.</div>
          </div>
          <button className="btn-outline" onClick={toggleTheme}>
            {user.theme === "DARK" ? "☀️ Switch to light" : "🌙 Switch to dark"}
          </button>
        </div>
        <div className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm font-medium">Email notifications</div>
            <div className="text-xs text-slate-500">
              In-app alerts always arrive. Opt out of email copies here.
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={user.emailOptOut} onChange={onOptOut} />
            Opt out of email
          </label>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-sm text-slate-500">{value}</div>
    </div>
  );
}
