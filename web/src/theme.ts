import { useEffect, useState } from "react";

export const THEMES = [
  { id: "brutalist", name: "Brutalist", blurb: "Bold outlines, colour pops" },
  { id: "midnight", name: "Midnight", blurb: "Navy and electric lime" },
  { id: "corporate", name: "Corporate", blurb: "Navy ink, confident blue" },
  { id: "sage", name: "Sage", blurb: "Soft greens and warm sand" },
  { id: "terminal", name: "Terminal", blurb: "Monospace, green on black" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type Mode = "system" | "light" | "dark";

const KEY = "ra:theme";
const DEFAULT = { theme: "brutalist" as ThemeId, mode: "system" as Mode };

const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);
const isMode = (v: unknown): v is Mode => v === "system" || v === "light" || v === "dark";

/** Saved choice, overridable with ?theme=sage&mode=dark for sharing a look. */
function initial(): { theme: ThemeId; mode: Mode } {
  let saved = DEFAULT;
  try {
    saved = { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    /* storage blocked: use defaults */
  }
  const params = new URLSearchParams(location.search);
  const theme = params.get("theme") ?? saved.theme;
  const mode = params.get("mode") ?? saved.mode;
  return { theme: isTheme(theme) ? theme : DEFAULT.theme, mode: isMode(mode) ? mode : DEFAULT.mode };
}

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function useTheme() {
  const [state, setState] = useState(initial);
  const [dark, setDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" = state.mode === "system" ? (dark ? "dark" : "light") : state.mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = state.theme;
    root.dataset.mode = resolved;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* not persisted */
    }
  }, [state, resolved]);

  return {
    theme: state.theme,
    mode: state.mode,
    resolved,
    setTheme: (theme: ThemeId) => setState((s) => ({ ...s, theme })),
    setMode: (mode: Mode) => setState((s) => ({ ...s, mode })),
  };
}
