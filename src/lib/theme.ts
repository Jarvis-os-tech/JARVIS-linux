import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "system";
const STORAGE_KEY = "jarvis-theme";

function resolveTheme(t: Theme): "dark" | "light" {
  if (t === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  }
  return t;
}

/** Apply a theme class to <html>. Safe to call on the server (no-op). */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(theme);
  const el = document.documentElement;
  el.classList.toggle("dark", resolved === "dark");
  el.classList.toggle("light", resolved === "light");
  el.style.colorScheme = resolved;
}

export function getStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "dark" || v === "light" || v === "system" ? v : "system";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === "undefined" ? "system" : getStoredTheme(),
  );

  // apply + persist whenever the user's choice changes
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // follow OS changes while in "system" mode
  useEffect(() => {
    if (theme !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const cycle = useCallback(
    () =>
      setThemeState((t) => (t === "dark" ? "light" : t === "light" ? "system" : "dark")),
    [],
  );

  return { theme, setTheme, cycle, resolved: resolveTheme(theme) };
}
