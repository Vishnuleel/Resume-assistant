import { useCallback, useEffect, useState } from "react";
import { hashText, jobTitle } from "./edit";

export const STATUSES = ["Saved", "Applied", "Interviewing", "Offer", "Rejected"] as const;
export type Status = (typeof STATUSES)[number];

export type HistoryEntry = {
  id: string;
  title: string;
  job: string;
  keywordScore: number;
  aiScore: number | null;
  missing: string[];
  status: Status;
  createdAt: number;
  updatedAt: number;
};

const KEY = "ra:history";
const MAX = 100;

function read(): HistoryEntry[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Jobs you've analyzed, kept only in this browser. */
export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(entries));
    } catch {
      /* storage full or blocked: history just isn't kept */
    }
  }, [entries]);

  /** Add or update the entry for this job description. */
  const record = useCallback(
    (job: string, patch: Partial<Pick<HistoryEntry, "keywordScore" | "aiScore" | "missing" | "title">>) => {
      const id = hashText(job.trim());
      setEntries((list) => {
        const now = Date.now();
        const existing = list.find((e) => e.id === id);
        const next: HistoryEntry = existing
          ? { ...existing, ...patch, updatedAt: now }
          : {
              id,
              title: patch.title ?? jobTitle(job),
              job: job.trim(),
              keywordScore: patch.keywordScore ?? 0,
              aiScore: patch.aiScore ?? null,
              missing: patch.missing ?? [],
              status: "Saved",
              createdAt: now,
              updatedAt: now,
            };
        return [next, ...list.filter((e) => e.id !== id)].slice(0, MAX);
      });
    },
    [],
  );

  const update = useCallback((id: string, patch: Partial<HistoryEntry>) => {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e)));
  }, []);

  const remove = useCallback((id: string) => setEntries((list) => list.filter((e) => e.id !== id)), []);
  const clear = useCallback(() => setEntries([]), []);

  return { entries, record, update, remove, clear };
}

export function historyCsv(entries: HistoryEntry[]): string {
  const cell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = entries.map((e) =>
    [e.title, e.status, e.keywordScore, e.aiScore, e.missing.slice(0, 8).join("; "), new Date(e.createdAt).toISOString().slice(0, 10)]
      .map(cell)
      .join(","),
  );
  return ["Job,Status,Keyword match %,AI score,Top missing keywords,Analyzed on", ...rows].join("\n");
}
