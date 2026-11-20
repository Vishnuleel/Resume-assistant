import { ArrowRight, Plus, Sparkles, Trophy, X } from "lucide-react";
import type { CompareResult } from "../api";
import { SAMPLE_JOB } from "../samples";
import { RatingChip, Ring, Spinner, cx } from "./ui";

export type CompareJob = { title: string; text: string };

export const MAX_COMPARE = 4;

const SAMPLE_JOB_2 = `Data Analyst, Marketing

We're hiring a Data Analyst to support our marketing team.

- Build Tableau dashboards for campaign performance
- Write SQL queries and automate reporting with Python and Pandas
- Run A/B tests and present insights to stakeholders
- Requirements: SQL, Python, Tableau, Excel, statistics, communication`;

export function CompareJobsInput({
  jobs,
  onChange,
}: {
  jobs: CompareJob[];
  onChange: (jobs: CompareJob[]) => void;
}) {
  const set = (i: number, patch: Partial<CompareJob>) =>
    onChange(jobs.map((j, k) => (k === i ? { ...j, ...patch } : j)));

  return (
    <section className="card flex flex-col p-5 sm:p-6" data-pop="blue" aria-labelledby="compare-title">
      <div className="mb-4 flex items-center gap-3">
        <span className="step-badge grid size-7 place-items-center rounded-pill bg-ink text-xs font-bold text-bg">2</span>
        <h2 id="compare-title" className="text-[15px] font-semibold">
          Jobs to compare
        </h2>
        <button
          type="button"
          onClick={() => onChange([{ title: "", text: SAMPLE_JOB }, { title: "", text: SAMPLE_JOB_2 }])}
          className="ml-auto inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-semibold text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
        >
          <Sparkles className="size-3.5" /> Try samples
        </button>
      </div>

      <div className="space-y-3">
        {jobs.map((job, i) => (
          <div key={i} className="rounded-ctl hairline bg-surface-2 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold text-ink-3 tabular-nums">#{i + 1}</span>
              <input
                aria-label={`Job ${i + 1} title`}
                value={job.title}
                onChange={(e) => set(i, { title: e.target.value })}
                placeholder="Title (optional, taken from the first line)"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold placeholder:font-normal placeholder:text-ink-3 focus:outline-none"
              />
              {jobs.length > 2 && (
                <button
                  type="button"
                  onClick={() => onChange(jobs.filter((_, k) => k !== i))}
                  className="btn-quiet size-7 rounded-sm px-0"
                  aria-label={`Remove job ${i + 1}`}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <textarea
              aria-label={`Job ${i + 1} description`}
              value={job.text}
              onChange={(e) => set(i, { text: e.target.value })}
              placeholder="Paste the job description…"
              className="field min-h-[96px] resize-y bg-surface text-[13px] leading-relaxed"
            />
          </div>
        ))}
      </div>

      {jobs.length < MAX_COMPARE && (
        <button
          type="button"
          onClick={() => onChange([...jobs, { title: "", text: "" }])}
          className="btn-quiet mt-3 w-full border-dashed"
        >
          <Plus className="size-4" /> Add another job
        </button>
      )}
    </section>
  );
}

const POPS = ["mint", "yellow", "blue", "pink"];

export function CompareResults({
  results,
  aiScores,
  onOpen,
}: {
  results: (CompareResult & { index: number })[];
  aiScores: Record<number, number | "loading" | "error">;
  onOpen: (index: number) => void;
}) {
  const ranked = [...results].sort((a, b) => b.score - a.score);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(250px,1fr))]">
      {ranked.map((r, rank) => {
        const ai = aiScores[r.index];
        return (
          <article key={r.index} className="card rise flex flex-col p-5" data-pop={POPS[rank % POPS.length]} style={{ animationDelay: `${rank * 60}ms` }}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="line-clamp-2 text-[15px] font-semibold">{r.title}</h3>
              {rank === 0 && results.length > 1 && (
                <span className="chip shrink-0 bg-accent-soft text-accent-fg">
                  <Trophy className="size-3" /> Best match
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Ring value={r.score} suffix="%" size={88} />
              <div className="space-y-1.5">
                <RatingChip score={r.score} />
                <p className="text-xs text-ink-2">
                  {r.matched.length} of {r.total} keywords
                </p>
                {ai !== undefined && (
                  <p className={cx("text-xs", ai === "error" ? "text-bad" : "text-ink-2")}>
                    AI score:{" "}
                    {ai === "loading" ? (
                      <Spinner className="inline size-3" />
                    ) : ai === "error" ? (
                      "failed"
                    ) : (
                      <strong className="font-semibold text-ink">{ai}</strong>
                    )}
                  </p>
                )}
              </div>
            </div>
            {r.missing.length > 0 && (
              <div className="mt-4">
                <p className="eyebrow mb-2">Top missing</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.missing.slice(0, 6).map((k) => (
                    <span key={k} className="chip bg-warn-soft text-warn">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button type="button" className="btn-quiet mt-auto w-full translate-y-0 pt-0" style={{ marginTop: "1.25rem" }} onClick={() => onOpen(r.index)}>
              Full analysis <ArrowRight className="size-4" />
            </button>
          </article>
        );
      })}
    </div>
  );
}
