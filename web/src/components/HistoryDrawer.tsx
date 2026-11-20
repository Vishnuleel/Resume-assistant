import { Download, FolderOpen, History, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { downloadText } from "../api";
import { STATUSES, historyCsv, type HistoryEntry, type Status } from "../history";
import { EmptyState, cx } from "./ui";

const STATUS_CHIP: Record<Status, string> = {
  Saved: "bg-surface-2 text-ink-2",
  Applied: "bg-accent-soft text-accent-fg",
  Interviewing: "bg-warn-soft text-warn",
  Offer: "bg-good-soft text-good",
  Rejected: "bg-bad-soft text-bad",
};

type Props = {
  open: boolean;
  onClose: () => void;
  entries: HistoryEntry[];
  onOpenEntry: (e: HistoryEntry) => void;
  onUpdate: (id: string, patch: Partial<HistoryEntry>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
};

export function HistoryDrawer({ open, onClose, entries, onOpenEntry, onUpdate, onRemove, onClear }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Status | "All">("All");

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);

  const stats = useMemo(() => {
    const applied = entries.filter((e) => e.status !== "Saved").length;
    const best = entries.reduce<HistoryEntry | null>((b, e) => (!b || e.keywordScore > b.keywordScore ? e : b), null);
    const avg = entries.length ? Math.round(entries.reduce((s, e) => s + e.keywordScore, 0) / entries.length) : 0;
    return { applied, best, avg };
  }, [entries]);

  if (!open) return null;
  const shown = filter === "All" ? entries : entries.filter((e) => e.status === filter);

  return (
    <div className="fixed inset-0 z-50">
      <div className="rise absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className="rise absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col border-l-[length:var(--bw)] border-line bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b-[length:var(--bw)] border-line px-6 py-4">
          <h2 id="history-title" className="flex items-center gap-2 text-base font-semibold">
            <History className="size-4" /> Your applications
          </h2>
          <button type="button" onClick={onClose} className="btn-quiet size-9 px-0" aria-label="Close history">
            <X className="size-4" />
          </button>
        </div>

        {entries.length === 0 ? (
          <EmptyState icon={<History className="size-5" />} title="Nothing saved yet">
            Every job you analyze is saved here automatically, so you can compare scores and track where you've applied.
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 border-b-[length:var(--bw)] border-line px-6 py-4">
              <Stat label="Jobs" value={entries.length} />
              <Stat label="Applied" value={stats.applied} />
              <Stat label="Avg match" value={`${stats.avg}%`} />
            </div>

            <div className="flex gap-1.5 overflow-x-auto border-b-[length:var(--bw)] border-line px-6 py-3">
              {(["All", ...STATUSES] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  aria-pressed={filter === s}
                  className={cx(
                    "chip h-7 px-3 transition-colors duration-150",
                    filter === s ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:text-ink",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <ul className="flex-1 overflow-y-auto">
              {shown.map((e) => (
                <li key={e.id} className="border-b-[length:var(--bw)] border-line/70 px-6 py-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <input
                        aria-label="Job title"
                        value={e.title}
                        onChange={(ev) => onUpdate(e.id, { title: ev.target.value })}
                        className="w-full truncate bg-transparent text-sm font-semibold focus:outline-none"
                      />
                      <p className="text-xs text-ink-3">
                        {new Date(e.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · match{" "}
                        <strong className="text-ink">{e.keywordScore}%</strong>
                        {e.aiScore !== null && (
                          <>
                            {" "}
                            · AI <strong className="text-ink">{e.aiScore}</strong>
                          </>
                        )}
                      </p>
                    </div>
                    <select
                      aria-label="Status"
                      value={e.status}
                      onChange={(ev) => onUpdate(e.id, { status: ev.target.value as Status })}
                      className={cx("chip h-7 cursor-pointer appearance-none border-0 pr-3 focus:outline-none", STATUS_CHIP[e.status])}
                    >
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  {e.missing.length > 0 && (
                    <p className="mt-1.5 truncate text-xs text-ink-3">Missing: {e.missing.slice(0, 5).join(", ")}</p>
                  )}
                  <div className="mt-2.5 flex gap-2">
                    <button type="button" className="btn-quiet h-8 rounded-sm px-2.5 text-xs" onClick={() => onOpenEntry(e)}>
                      <FolderOpen className="size-3.5" /> Open
                    </button>
                    <button
                      type="button"
                      className="btn-quiet h-8 rounded-sm px-2.5 text-xs"
                      onClick={() => onRemove(e.id)}
                      aria-label={`Delete ${e.title}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
              {shown.length === 0 && <li className="px-6 py-10 text-center text-sm text-ink-3">No jobs with this status.</li>}
            </ul>

            <div className="flex gap-2 border-t-[length:var(--bw)] border-line px-6 py-4">
              <button type="button" className="btn-quiet flex-1" onClick={() => downloadText("applications.csv", historyCsv(entries), "text/csv")}>
                <Download className="size-4" /> Export CSV
              </button>
              <button
                type="button"
                className="btn-quiet"
                onClick={() => window.confirm("Delete all saved jobs? This can't be undone.") && onClear()}
              >
                <Trash2 className="size-4" /> Clear all
              </button>
            </div>
          </>
        )}
        <p className="px-6 pb-4 text-xs text-ink-3">{entries.length > 0 && "Saved only in this browser."}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-ctl bg-surface-2 px-3 py-2.5">
      <p className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{label}</p>
      <p className="font-display text-xl tabular-nums [font-weight:var(--head-weight)]">{value}</p>
    </div>
  );
}
