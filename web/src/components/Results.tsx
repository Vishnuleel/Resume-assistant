import {
  ArrowRight,
  Check,
  FilePen,
  ScanLine,
  FileDown,
  KeyRound,
  Lightbulb,
  Mail,
  MessagesSquare,
  PenLine,
  Search,
  Sparkles,
} from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Markdown from "react-markdown";
import type { Analysis, KeywordResult, Tone } from "../api";
import { Alert, CopyButton, EmptyState, RatingChip, Ring, Segmented, Skeleton, Spinner, cx } from "./ui";

/* ------------------------------------------------------------ scores */

export function ScoreSummary({
  keywords,
  analysis,
  aiState,
  aiError,
  onRetry,
  onOpenSettings,
}: {
  keywords: KeywordResult;
  analysis: Analysis | null;
  aiState: "off" | "loading" | "done" | "error";
  aiError: string;
  onRetry: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <article className="card rise flex items-center gap-6 p-6" data-pop="mint">
          <Ring value={keywords.score} suffix="%" />
          <div>
            <p className="eyebrow">Keyword match</p>
            <div className="mt-2 mb-2">
              <RatingChip score={keywords.score} />
            </div>
            <p className="text-sm text-ink-2">
              <strong className="font-semibold text-ink">{keywords.matched.length}</strong> of{" "}
              {keywords.keywords.length} top job keywords appear in your resume.
            </p>
          </div>
        </article>

        <article className="card rise flex items-center gap-6 p-6" data-pop="lilac" style={{ animationDelay: "60ms" }}>
          {aiState === "done" && analysis ? (
            <>
              <Ring value={analysis.ats_score} />
              <div>
                <p className="eyebrow">AI ATS score</p>
                <div className="mt-2 mb-2">
                  <RatingChip score={analysis.ats_score} />
                </div>
                <p className="text-sm text-ink-2">How likely this resume is to pass an applicant tracking system.</p>
              </div>
            </>
          ) : aiState === "loading" ? (
            <>
              <div className="grid size-[104px] shrink-0 place-items-center rounded-full border-[9px] border-surface-2">
                <Spinner className="size-5 text-ink-3" />
              </div>
              <div className="flex-1 space-y-2.5">
                <p className="eyebrow">AI ATS score</p>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-full" />
                <p className="text-xs text-ink-3">Reviewing your resume. Usually 5–20 seconds.</p>
              </div>
            </>
          ) : aiState === "error" ? (
            <div className="w-full space-y-3">
              <p className="eyebrow">AI ATS score</p>
              <Alert onRetry={onRetry}>{aiError}</Alert>
            </div>
          ) : (
            <>
              <div className="grid size-[104px] shrink-0 place-items-center rounded-full border-2 border-dashed border-line-strong text-ink-3">
                <KeyRound className="size-6" />
              </div>
              <div>
                <p className="eyebrow">AI ATS score</p>
                <p className="mt-2 text-sm text-ink-2">
                  Add a free Groq or Gemini key to unlock the AI review, rewrites, cover letter and interview prep.
                </p>
                <button type="button" onClick={onOpenSettings} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-fg hover:underline">
                  Add a key <ArrowRight className="size-3.5" />
                </button>
              </div>
            </>
          )}
        </article>
      </div>

      {analysis?.verdict && aiState === "done" && (
        <blockquote className="verdict quote rise border-l-[3px] border-accent-fg pl-5 text-[22px] leading-snug text-ink sm:text-2xl">
          {analysis.verdict}
        </blockquote>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ tabs */

export type TabId = "keywords" | "format" | "improve" | "rewrites" | "editor" | "ask" | "letter" | "interview";

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: "keywords", label: "Keywords", icon: <Search className="size-4" /> },
  { id: "format", label: "ATS format", icon: <ScanLine className="size-4" /> },
  { id: "improve", label: "Improvements", icon: <Lightbulb className="size-4" /> },
  { id: "rewrites", label: "Rewrites", icon: <PenLine className="size-4" /> },
  { id: "editor", label: "Edit & export", icon: <FilePen className="size-4" /> },
  { id: "ask", label: "Ask AI", icon: <Sparkles className="size-4" /> },
  { id: "letter", label: "Cover letter", icon: <Mail className="size-4" /> },
  { id: "interview", label: "Interview prep", icon: <MessagesSquare className="size-4" /> },
];

const POPS = ["yellow", "pink", "blue", "mint", "orange", "lilac"];

export function Tabs({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent, i: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + TABS.length) % TABS.length;
    refs.current[next]?.focus();
    onChange(TABS[next].id);
  }
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="tablist" aria-label="Results" className="flex min-w-max gap-1 border-b-[length:var(--bw)] border-line">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            data-pop={POPS[i % POPS.length]}
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx(
              "relative -mb-px inline-flex h-11 items-center gap-2 border-b-2 px-3.5 text-sm font-semibold transition-colors duration-150",
              active === t.id ? "border-accent-fg text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: TabId; active: TabId; children: ReactNode }) {
  if (id !== active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="rise pt-6" tabIndex={0}>
      {children}
    </div>
  );
}

/** Placeholder for AI tabs when the AI review isn't available. */
export function NeedsAI({
  aiState,
  onOpenSettings,
}: {
  aiState: "off" | "loading" | "done" | "error";
  onOpenSettings: () => void;
}) {
  if (aiState === "loading")
    return (
      <div className="card space-y-3 p-6">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  return (
    <div className="card">
      <EmptyState
        icon={<Sparkles className="size-5" />}
        title={aiState === "error" ? "The AI review didn't finish" : "This part needs an AI provider"}
        action={
          <button type="button" className="btn-primary" onClick={onOpenSettings}>
            <KeyRound className="size-4" /> Open AI settings
          </button>
        }
      >
        {aiState === "error"
          ? "Check the message above the tabs, then run the analysis again."
          : "Groq and Gemini have free keys. Ollama runs on your own computer with no key at all."}
      </EmptyState>
    </div>
  );
}

/* ------------------------------------------------------------ keywords */

export function KeywordsPanel({ result, resume, analysis }: { result: KeywordResult; resume: string; analysis: Analysis | null }) {
  const [filter, setFilter] = useState<"all" | "missing" | "found">("all");
  const rows = useMemo(() => {
    const sorted = [...result.keywords].sort((a, b) => Number(a.found) - Number(b.found));
    return sorted.filter((r) => filter === "all" || (filter === "found") === r.found);
  }, [result, filter]);

  const highlighted = useMemo(() => {
    const parts: ReactNode[] = [];
    let last = 0;
    result.spans.forEach(([a, b], i) => {
      parts.push(resume.slice(last, a));
      parts.push(
        <mark key={i} className="rounded-sm bg-mark px-0.5 font-semibold text-ink">
          {resume.slice(a, b)}
        </mark>,
      );
      last = b;
    });
    parts.push(resume.slice(last));
    return parts;
  }, [result, resume]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
        <section className="card overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b-[length:var(--bw)] border-line px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold">Job keywords</h3>
              <p className="text-xs text-ink-3">Only add missing ones you really have.</p>
            </div>
            <Segmented
              label="Filter keywords"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: `All ${result.keywords.length}` },
                { value: "missing", label: `Missing ${result.missing.length}` },
                { value: "found", label: `Found ${result.matched.length}` },
              ]}
            />
          </header>
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-[11px] tracking-[0.08em] text-ink-3 uppercase">
                  <th className="px-5 py-2.5 font-semibold">Keyword</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 text-right font-semibold" title="Times it appears in the job description">
                    Job
                  </th>
                  <th className="py-2.5 pr-5 pl-3 text-right font-semibold" title="Times it appears in your resume">
                    Resume
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.keyword} className="border-t-[length:var(--bw)] border-line/70">
                    <td className="px-5 py-2.5 font-medium">{r.keyword}</td>
                    <td className="px-3 py-2.5">
                      {r.found ? (
                        <span className="chip bg-accent-soft text-accent-fg">
                          <Check className="size-3" /> Found
                        </span>
                      ) : (
                        <span className="chip bg-warn-soft text-warn">Missing</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-ink-2 tabular-nums">{r.job_count}</td>
                    <td className="py-2.5 pr-5 pl-3 text-right text-ink-2 tabular-nums">{r.resume_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card flex flex-col overflow-hidden">
          <header className="border-b-[length:var(--bw)] border-line px-5 py-4">
            <h3 className="text-sm font-semibold">Your resume</h3>
            <p className="text-xs text-ink-3">Job keywords you already have are highlighted.</p>
          </header>
          <div tabIndex={0} className="max-h-[480px] flex-1 overflow-y-auto px-5 py-4 text-[13.5px] leading-[1.75] whitespace-pre-wrap text-ink-2">
            {highlighted}
          </div>
        </section>
      </div>

      {analysis && (analysis.matched_keywords.length > 0 || analysis.missing_keywords.length > 0) && (
        <section className="card p-5">
          <h3 className="text-sm font-semibold">AI keyword review</h3>
          <p className="mb-3 text-xs text-ink-3">Skills the AI spotted, including ones phrased differently.</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.matched_keywords.map((k) => (
              <span key={`m-${k}`} className="chip bg-accent-soft text-accent-fg">
                <Check className="size-3" /> {k}
              </span>
            ))}
            {analysis.missing_keywords.map((k) => (
              <span key={`x-${k}`} className="chip bg-warn-soft text-warn">
                {k}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ improvements */

export function ImprovementsPanel({
  analysis,
  onApplySummary,
  summaryApplied,
}: {
  analysis: Analysis;
  onApplySummary: () => void;
  summaryApplied: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
        <section className="card p-6">
          <h3 className="mb-4 text-sm font-semibold">What's working</h3>
          <ul className="space-y-3">
            {analysis.strengths.map((s) => (
              <li key={s} className="flex gap-3 text-sm leading-relaxed">
                <span className="check-badge mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-good-soft text-good">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {s}
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <h3 className="mb-4 text-sm font-semibold">What to change, in order</h3>
          <ol className="space-y-3.5">
            {analysis.improvements.map((s, i) => (
              <li key={s} className="flex gap-3.5 text-sm leading-relaxed">
                <span className="num-badge font-display [font-weight:var(--head-weight)] w-5 shrink-0 text-right text-xl leading-6 text-warn">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </section>
      </div>
      {analysis.suggested_summary && (
        <section className="card p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Suggested summary</h3>
              <p className="text-xs text-ink-3">A professional summary tailored to this job.</p>
            </div>
            <div className="flex gap-2">
              <CopyButton text={analysis.suggested_summary} />
              <ApplyButton applied={summaryApplied} onClick={onApplySummary} />
            </div>
          </div>
          <p className="quote text-xl leading-relaxed">{analysis.suggested_summary}</p>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ rewrites */

export function ApplyButton({ applied, onClick }: { applied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={applied}
      className={cx("h-8 rounded-sm px-2.5 text-xs", applied ? "btn-quiet text-good" : "btn-primary")}
    >
      {applied ? <Check className="size-3.5" /> : <ArrowRight className="size-3.5" />}
      {applied ? "Applied" : "Apply to resume"}
    </button>
  );
}

export function RewritesPanel({
  analysis,
  applied,
  onApply,
  notice,
}: {
  analysis: Analysis;
  applied: Set<number>;
  onApply: (index: number) => void;
  notice: string;
}) {
  if (!analysis.bullet_rewrites.length)
    return (
      <div className="card">
        <EmptyState icon={<Check className="size-5" />} title="No rewrites needed">
          Your bullet points already read well for this job.
        </EmptyState>
      </div>
    );
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        <strong className="font-semibold text-ink">Apply</strong> swaps the line in your resume in the{" "}
        <strong className="font-semibold text-ink">Edit &amp; export</strong> tab, where you can review it and download a
        Word file.
      </p>
      {notice && <Alert>{notice}</Alert>}
      {analysis.bullet_rewrites.map((rw, i) => (
        <article key={i} className="card grid gap-4 p-5 md:grid-cols-[1fr_auto_1.15fr] md:items-start">
          <div>
            <p className="eyebrow mb-1.5">Before</p>
            <p className="text-sm leading-relaxed text-ink-3 line-through decoration-line-strong">{rw.original || "—"}</p>
          </div>
          <ArrowRight className="hidden size-4 text-ink-3 md:mt-7 md:block" aria-hidden="true" />
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="eyebrow text-accent-fg">After</p>
              <div className="flex gap-2">
                <CopyButton text={rw.improved} />
                <ApplyButton applied={applied.has(i)} onClick={() => onApply(i)} />
              </div>
            </div>
            <p className="text-sm leading-relaxed font-medium">{rw.improved}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ generators */

export function CoverLetterPanel({
  text,
  onChange,
  onGenerate,
  busy,
  error,
}: {
  text: string;
  onChange: (t: string) => void;
  onGenerate: (tone: Tone) => void;
  busy: boolean;
  error: string;
}) {
  const [tone, setTone] = useState<Tone>("professional");
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm font-semibold">Tone</span>
        <Segmented
          label="Cover letter tone"
          value={tone}
          onChange={setTone}
          options={[
            { value: "professional", label: "Professional" },
            { value: "enthusiastic", label: "Enthusiastic" },
            { value: "concise", label: "Concise" },
          ]}
        />
        <button type="button" className="btn-primary ml-auto" onClick={() => onGenerate(tone)} disabled={busy}>
          {busy ? <Spinner /> : <PenLine className="size-4" />}
          {busy ? "Writing…" : text ? "Write again" : "Write cover letter"}
        </button>
      </div>
      {error && <Alert>{error}</Alert>}
      {text ? (
        <section className="card p-2">
          <textarea
            aria-label="Cover letter"
            value={text}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[420px] w-full resize-y rounded-ctl bg-transparent px-5 py-4 text-[15px] leading-[1.8] focus:outline-none"
          />
          <div className="flex justify-end gap-2 border-t-[length:var(--bw)] border-line px-3 pt-2 pb-1">
            <CopyButton text={text} />
            <button type="button" className="btn-quiet h-8 rounded-sm px-2.5 text-xs" onClick={() => downloadLetter(text)}>
              <FileDown className="size-3.5" /> Download .txt
            </button>
          </div>
        </section>
      ) : (
        !busy && (
          <div className="card">
            <EmptyState icon={<Mail className="size-5" />} title="A cover letter for this job">
              Written only from facts in your resume. You can edit it before you copy it.
            </EmptyState>
          </div>
        )
      )}
    </div>
  );
}

function downloadLetter(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  Object.assign(document.createElement("a"), { href: url, download: "cover_letter.txt" }).click();
  URL.revokeObjectURL(url);
}

export function InterviewPanel({
  text,
  onGenerate,
  busy,
  error,
}: {
  text: string;
  onGenerate: () => void;
  busy: boolean;
  error: string;
}) {
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <p className="text-sm text-ink-2">
          8 likely questions: role-specific, behavioral, and ones about gaps in your resume.
        </p>
        <button type="button" className="btn-primary ml-auto" onClick={onGenerate} disabled={busy}>
          {busy ? <Spinner /> : <MessagesSquare className="size-4" />}
          {busy ? "Preparing…" : text ? "New questions" : "Prepare questions"}
        </button>
      </div>
      {error && <Alert>{error}</Alert>}
      {text ? (
        <article className="card prose-interview p-6 sm:p-8">
          <Markdown>{text}</Markdown>
        </article>
      ) : (
        !busy && (
          <div className="card">
            <EmptyState icon={<MessagesSquare className="size-5" />} title="Practice before the interview">
              Each question comes with pointers on how to answer using your own experience.
            </EmptyState>
          </div>
        )
      )}
    </div>
  );
}
