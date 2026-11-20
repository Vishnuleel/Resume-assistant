import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { THEMES, type Mode, type ThemeId } from "../theme";
import { Segmented, cx } from "./ui";

type Props = {
  theme: ThemeId;
  mode: Mode;
  resolved: "light" | "dark";
  onTheme: (t: ThemeId) => void;
  onMode: (m: Mode) => void;
};

export function ThemePicker({ theme, mode, resolved, onTheme, onMode }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = THEMES.find((t) => t.id === theme)!;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="btn-quiet h-9 rounded-pill px-3"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Palette className="size-4 text-ink-2" />
        <span className="hidden text-[13px] sm:inline">{current.name}</span>
        <span className="sr-only sm:hidden">Theme: {current.name}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Theme"
          className="pop card fixed inset-x-3 top-[68px] z-50 max-h-[calc(100dvh-84px)] overflow-y-auto p-3 sm:absolute sm:inset-x-auto sm:top-11 sm:right-0 sm:w-[360px]"
        >
          <div className="mb-3 flex items-center justify-between gap-3 px-1 pt-1">
            <span className="text-sm font-semibold">Theme</span>
            <Segmented
              label="Colour mode"
              value={mode}
              onChange={onMode}
              options={[
                { value: "system", label: <Monitor className="size-3.5" aria-label="System" /> },
                { value: "light", label: <Sun className="size-3.5" aria-label="Light" /> },
                { value: "dark", label: <Moon className="size-3.5" aria-label="Dark" /> },
              ]}
            />
          </div>

          <div role="radiogroup" aria-label="Theme" className="grid gap-2">
            {THEMES.map((t) => {
              const selected = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onTheme(t.id)}
                  className={cx(
                    "group flex items-center gap-3 rounded-ctl p-1.5 pr-3 text-left transition-colors duration-150",
                    selected ? "bg-surface-2" : "hover:bg-surface-2",
                  )}
                >
                  {/* Rendered in the theme itself, so the preview is exact. */}
                  <div
                    data-theme={t.id}
                    data-mode={resolved}
                    className="relative flex h-14 w-24 shrink-0 flex-col justify-between overflow-hidden rounded-sm bg-bg p-2 text-ink hairline"
                  >
                    <span className="display text-[17px] leading-none">Aa</span>
                    <div className="flex items-center gap-1">
                      <span className="h-2.5 w-7 rounded-pill bg-accent" />
                      <span className="h-2.5 w-4 rounded-pill bg-surface-2" />
                      <span className="h-2.5 w-3 rounded-pill bg-warn-soft" />
                    </div>
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t.name}</span>
                    <span className="block truncate text-xs text-ink-3">{t.blurb}</span>
                  </span>
                  <Check className={cx("size-4 shrink-0 text-accent-fg", !selected && "invisible")} />
                </button>
              );
            })}
          </div>
          <p className="mt-3 px-1 text-xs text-ink-3">Saved on this device. Share a look with ?theme=sage&amp;mode=dark</p>
        </div>
      )}
    </div>
  );
}
