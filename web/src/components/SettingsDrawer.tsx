import { ExternalLink, KeyRound, Lock, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AISettings, Provider } from "../api";

type Props = {
  open: boolean;
  onClose: () => void;
  providers: Provider[];
  settings: AISettings;
  onChange: (s: AISettings) => void;
  topN: number;
  onTopN: (n: number) => void;
};

export function SettingsDrawer({ open, onClose, providers, settings, onChange, topN, onTopN }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const provider = providers.find((p) => p.name === settings.provider);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("select, input, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const set = (patch: Partial<AISettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="fixed inset-0 z-50">
      <div className="rise absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="rise absolute inset-y-0 right-0 flex w-full max-w-[400px] flex-col border-l-[length:var(--bw)] border-line bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b-[length:var(--bw)] border-line px-6 py-4">
          <h2 id="settings-title" className="text-base font-semibold">
            AI settings
          </h2>
          <button type="button" onClick={onClose} className="btn-quiet size-9 px-0" aria-label="Close settings">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
          <section>
            <label htmlFor="provider" className="mb-2 block text-sm font-semibold">
              Provider
            </label>
            <div className="grid gap-2">
              {providers.map((p) => (
                <label
                  key={p.name}
                  className={
                    "flex items-start gap-3 rounded-ctl border px-3.5 py-3 transition-colors duration-150 " +
                    (p.name === settings.provider
                      ? "border-accent-fg bg-accent-soft/60"
                      : "border-line hover:border-line-strong")
                  }
                >
                  <input
                    type="radio"
                    name="provider"
                    id={p.name === settings.provider ? "provider" : undefined}
                    className="mt-1 accent-[var(--accent-fg)]"
                    checked={p.name === settings.provider}
                    onChange={() => set({ provider: p.name, model: p.models[0], apiKey: "" })}
                  />
                  <span>
                    <span className="block text-sm font-semibold">{p.name}</span>
                    <span className="block text-xs text-ink-2">{p.note}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {provider && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="api-key" className="text-sm font-semibold">
                  API key
                </label>
                <a
                  href={provider.key_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent-fg hover:underline"
                >
                  {provider.needs_key ? "Get a key" : "Install Ollama"} <ExternalLink className="size-3" />
                </a>
              </div>
              {!provider.needs_key ? (
                <p className="rounded-ctl bg-surface-2 px-3.5 py-3 text-sm text-ink-2">
                  No key needed. Runs on your computer: install Ollama, then run{" "}
                  <code className="rounded bg-surface px-1.5 py-0.5 text-xs">ollama pull {provider.models[0]}</code>.
                </p>
              ) : provider.has_env_key ? (
                <p className="flex items-center gap-2 rounded-ctl bg-good-soft px-3.5 py-3 text-sm text-ink">
                  <KeyRound className="size-4 text-good" /> Using the key from your <code>.env</code> file.
                </p>
              ) : (
                <>
                  <input
                    id="api-key"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    className="field font-mono"
                    placeholder="Paste your key"
                    value={settings.apiKey}
                    onChange={(e) => set({ apiKey: e.target.value.trim() })}
                  />
                  <p className="mt-2 text-xs text-ink-3">Kept in this tab's memory only. Cleared when you reload.</p>
                </>
              )}
            </section>
          )}

          {provider && (
            <section>
              <label htmlFor="model" className="mb-2 block text-sm font-semibold">
                Model
              </label>
              <input
                id="model"
                list="model-options"
                className="field"
                value={settings.model}
                onChange={(e) => set({ model: e.target.value })}
              />
              <datalist id="model-options">
                {provider.models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <p className="mt-2 text-xs text-ink-3">Pick a suggestion or type any model your provider offers.</p>
            </section>
          )}

          <section className="space-y-5">
            <Slider
              id="temperature"
              label="Creativity"
              hint="Lower is more consistent."
              min={0}
              max={1}
              step={0.1}
              value={settings.temperature}
              onChange={(v) => set({ temperature: v })}
              format={(v) => v.toFixed(1)}
            />
            <Slider
              id="top-n"
              label="Keywords to check"
              hint="How many job keywords the match score uses."
              min={10}
              max={50}
              step={5}
              value={topN}
              onChange={onTopN}
            />
          </section>

          <section className="rounded-ctl hairline px-4 py-3.5">
            <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <Lock className="size-3.5 text-accent-fg" /> Your data
            </h3>
            <p className="text-xs leading-relaxed text-ink-2">
              Nothing is stored. Your resume goes only to the provider you pick, or nowhere with Ollama and the keyword
              match.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Slider(props: {
  id: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={props.id} className="text-sm font-semibold">
          {props.label}
        </label>
        <span className="text-sm text-ink-2 tabular-nums">{props.format ? props.format(props.value) : props.value}</span>
      </div>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent-fg)]"
      />
      <p className="text-xs text-ink-3">{props.hint}</p>
    </div>
  );
}
