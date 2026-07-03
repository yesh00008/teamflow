import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, getToken } from "../api.js";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Apply theme to <html> whenever the user's preference changes.
  const applyTheme = useCallback((theme) => {
    const root = document.documentElement;
    if (theme === "DARK") root.classList.add("dark");
    else root.classList.remove("dark");
  }, []);

  // Load the current user on boot if a token exists.
  useEffect(() => {
    (async () => {
      if (!getToken()) return setLoading(false);
      try {
        const { user } = await api.get("/auth/me");
        setUser(user);
        applyTheme(user.theme);
      } catch {
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [applyTheme]);

  const login = async (email, password) => {
    const { token, user } = await api.post("/auth/login", { email, password });
    setToken(token);
    setUser(user);
    applyTheme(user.theme);
  };

  const register = async (email, password, name) => {
    const { token, user } = await api.post("/auth/register", { email, password, name });
    setToken(token);
    setUser(user);
    applyTheme(user.theme);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    applyTheme("LIGHT");
  };

  const toggleTheme = async () => {
    const next = user.theme === "DARK" ? "LIGHT" : "DARK";
    applyTheme(next); // instant, no reload
    setUser((u) => ({ ...u, theme: next }));
    await api.patch("/auth/me", { theme: next });
  };

  const setEmailOptOut = async (emailOptOut) => {
    const { user: updated } = await api.patch("/auth/me", { emailOptOut });
    setUser(updated);
  };

  const showToast = (message, kind = "info") => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <AppContext.Provider
      value={{ user, loading, login, register, logout, toggleTheme, setEmailOptOut, showToast, toast }}
    >
      {children}
    </AppContext.Provider>
  );
}
