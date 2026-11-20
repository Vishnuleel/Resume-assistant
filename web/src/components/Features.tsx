import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  FileDown,
  FileType2,
  ExternalLink,
  Info,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Markdown from "react-markdown";
import { api, downloadBlob, openInOverleaf, type AtsCheck, type ChatMessage, type KeywordResult } from "../api";
import { Alert, CopyButton, EmptyState, RatingChip, Ring, Spinner, cx } from "./ui";

/* ------------------------------------------------------------ ATS format */

const STATUS_META = {
  fail: { icon: XCircle, cls: "text-bad", chip: "bg-bad-soft text-bad", label: "Fix" },
  warn: { icon: AlertTriangle, cls: "text-warn", chip: "bg-warn-soft text-warn", label: "Check" },
  info: { icon: Info, cls: "text-ink-3", chip: "bg-surface-2 text-ink-2", label: "Tip" },
  pass: { icon: CheckCircle2, cls: "text-good", chip: "bg-good-soft text-good", label: "OK" },
} as const;

export function AtsPanel({ checks, source }: { checks: AtsCheck[]; source: string | null }) {
  const [showPassed, setShowPassed] = useState(false);
  const scored = checks.filter((c) => c.status !== "info");
  const passed = scored.filter((c) => c.status === "pass").length;
  const score = scored.length ? Math.round((passed / scored.length) * 100) : 0;
  const issues = checks.filter((c) => c.status === "fail" || c.status === "warn");
  const tips = checks.filter((c) => c.status === "info");
  const ok = checks.filter((c) => c.status === "pass");

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center gap-6 p-6" data-pop="orange">
        <Ring value={score} suffix="%" size={96} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">ATS format check</p>
          <div className="mt-2 mb-2">
            <RatingChip score={score} kind="format" />
          </div>
          <p className="text-sm text-ink-2">
            <strong className="font-semibold text-ink">{passed}</strong> of {scored.length} checks passed
            {source ? (
              <>
                {" "}
                for <span className="font-semibold text-ink">{source}</span>.
              </>
            ) : (
              ". Upload your PDF or DOCX to also check columns, tables and images."
            )}
          </p>
        </div>
      </section>

      {issues.length > 0 ? (
        <section className="card overflow-hidden">
          <h3 className="border-b-[length:var(--bw)] border-line px-5 py-4 text-sm font-semibold">
            {issues.length} thing{issues.length > 1 ? "s" : ""} to fix
          </h3>
          <ul>{issues.map((c) => <CheckRow key={c.id} check={c} />)}</ul>
        </section>
      ) : (
        <div className="card">
          <EmptyState icon={<CheckCircle2 className="size-5" />} title="No formatting problems found">
            ATS software should read this resume cleanly.
          </EmptyState>
        </div>
      )}

      {tips.length > 0 && (
        <section className="card overflow-hidden">
          <ul>{tips.map((c) => <CheckRow key={c.id} check={c} />)}</ul>
        </section>
      )}

      {ok.length > 0 && (
        <section className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPassed((v) => !v)}
            aria-expanded={showPassed}
            className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold"
          >
            {ok.length} check{ok.length > 1 ? "s" : ""} passed
            <ChevronDown className={cx("size-4 text-ink-3 transition-transform", showPassed && "rotate-180")} />
          </button>
          {showPassed && <ul className="border-t-[length:var(--bw)] border-line">{ok.map((c) => <CheckRow key={c.id} check={c} />)}</ul>}
        </section>
      )}
    </div>
  );
}

function CheckRow({ check }: { check: AtsCheck }) {
  const meta = STATUS_META[check.status];
  const Icon = meta.icon;
  return (
    <li className="flex gap-3 border-b-[length:var(--bw)] border-line/60 px-5 py-3.5 last:border-b-0">
      <Icon className={cx("mt-0.5 size-[18px] shrink-0", meta.cls)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{check.title}</p>
        <p className="text-sm text-ink-2">{check.detail}</p>
      </div>
      <span className={cx("chip h-fit", meta.chip)}>{meta.label}</span>
    </li>
  );
}

/* ------------------------------------------------------------ editor */

export function EditorPanel({
  text,
  onChange,
  original,
  job,
  topN,
  startScore,
  startMissing,
  onReanalyze,
  onDownloadReport,
  reportBusy,
}: {
  text: string;
  onChange: (t: string) => void;
  original: string;
  job: string;
  topN: number;
  startScore: number;
  startMissing: string[];
  onReanalyze: () => void;
  onDownloadReport: () => void;
  reportBusy: boolean;
}) {
  const [live, setLive] = useState<KeywordResult | null>(null);
  const [scoring, setScoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [overleafBusy, setOverleafBusy] = useState(false);
  const [error, setError] = useState("");

  // Re-score while typing, after a short pause.
  useEffect(() => {
    if (!text.trim()) return;
    setScoring(true);
    const id = setTimeout(() => {
      api
        .keywords(text, job, topN)
        .then(setLive)
        .catch(() => {})
        .finally(() => setScoring(false));
    }, 450);
    return () => clearTimeout(id);
  }, [text, job, topN]);

  const score = live?.score ?? startScore;
  const delta = score - startScore;
  const nowFound = useMemo(() => new Set(live?.matched ?? []), [live]);
  const edited = text !== original;

  async function exportDocx() {
    setExporting(true);
    setError("");
    try {
      downloadBlob("tailored_resume.docx", await api.exportDocx(text));
    } catch {
      setError("Couldn't create the Word file. Is the app server running?");
    } finally {
      setExporting(false);
    }
  }

  async function sendToOverleaf() {
    setOverleafBusy(true);
    setError("");
    try {
      openInOverleaf(await api.exportTex(text));
    } catch {
      setError("Couldn't create the LaTeX file. Is the app server running?");
    } finally {
      setOverleafBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <section className="card flex flex-col overflow-hidden" data-pop="pink">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b-[length:var(--bw)] border-line px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">Edit your resume</h3>
            <p className="text-xs text-ink-3">The score updates as you type. Rewrites you apply land here too.</p>
          </div>
          {edited && (
            <button type="button" className="btn-quiet h-8 rounded-sm px-2.5 text-xs" onClick={() => onChange(original)}>
              <RotateCcw className="size-3.5" /> Reset
            </button>
          )}
        </header>
        <textarea
          aria-label="Resume editor"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          spellCheck
          className="min-h-[560px] flex-1 resize-y bg-transparent px-5 py-4 text-[14px] leading-[1.7] focus:outline-none"
        />
      </section>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <section className="card p-5" data-pop="mint">
          <div className="flex items-center gap-4">
            <Ring value={score} suffix="%" size={84} />
            <div>
              <p className="eyebrow flex items-center gap-1.5">
                Live match {scoring && <Spinner className="size-3" />}
              </p>
              <p className={cx("mt-1 text-sm font-semibold", delta > 0 ? "text-good" : delta < 0 ? "text-bad" : "text-ink-2")} aria-live="polite">
                {delta > 0 ? `+${delta} points` : delta < 0 ? `${delta} points` : "No change yet"}
              </p>
              <p className="text-xs text-ink-3">since you started</p>
            </div>
          </div>
        </section>

        {startMissing.length > 0 && (
          <section className="card p-5">
            <h3 className="text-sm font-semibold">Missing keywords</h3>
            <p className="mb-3 text-xs text-ink-3">Click to copy. Only add ones you really have.</p>
            <ul className="flex flex-wrap gap-1.5">
              {startMissing.map((k) => {
                const done = nowFound.has(k);
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(k)}
                      title={done ? "Now in your resume" : "Copy"}
                      className={cx("chip", done ? "bg-accent-soft text-accent-fg" : "bg-warn-soft text-warn")}
                    >
                      {done && <Check className="size-3" />}
                      {k}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="card space-y-2 p-5">
          <button type="button" className="btn-primary w-full" onClick={exportDocx} disabled={exporting || !text.trim()}>
            {exporting ? <Spinner /> : <FileType2 className="size-4" />} Download Word (.docx)
          </button>
          <p className="pb-1 text-xs text-ink-3">Clean single-column layout that ATS software reads easily.</p>
          <button type="button" className="btn-quiet w-full" onClick={sendToOverleaf} disabled={overleafBusy || !text.trim()}>
            {overleafBusy ? <Spinner /> : <ExternalLink className="size-4" />} Open in Overleaf
          </button>
          <p className="pb-1 text-xs text-ink-3">
            {/\\documentclass/.test(text)
              ? "Sends your LaTeX as-is to a new Overleaf project."
              : "Turns this into a simple LaTeX resume in a new Overleaf project."}{" "}
            Only sent when you click.
          </p>
          <button type="button" className="btn-quiet w-full" onClick={onReanalyze} disabled={!edited}>
            <RefreshCw className="size-4" /> Re-analyze this version
          </button>
          <button type="button" className="btn-quiet w-full" onClick={onDownloadReport} disabled={reportBusy}>
            {reportBusy ? <Spinner /> : <FileDown className="size-4" />} Download full report (.md)
          </button>
          {error && <Alert>{error}</Alert>}
        </section>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------ chat */

const SUGGESTIONS = [
  "Why is my score not higher?",
  "Which missing skill should I learn first?",
  "Rewrite my summary in 2 sentences",
  "How do I explain my lack of experience with the main tools?",
];

export function ChatPanel({
  messages,
  onSend,
  busy,
  error,
  onClear,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  busy: boolean;
  error: string;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length, busy]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    onSend(text);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <section className="card flex flex-col overflow-hidden" data-pop="lilac">
      <header className="flex items-center justify-between gap-3 border-b-[length:var(--bw)] border-line px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold">Ask about your results</h3>
          <p className="text-xs text-ink-3">The AI sees your resume, this job and the review above.</p>
        </div>
        {messages.length > 0 && (
          <button type="button" className="btn-quiet h-8 rounded-sm px-2.5 text-xs" onClick={onClear}>
            <RotateCcw className="size-3.5" /> New chat
          </button>
        )}
      </header>

      <div className="max-h-[560px] min-h-[320px] flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
        {messages.length === 0 ? (
          <EmptyState icon={<Sparkles className="size-5" />} title="Ask anything about this application">
            <span className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((q) => (
                <button key={q} type="button" onClick={() => onSend(q)} className="btn-quiet h-auto rounded-pill px-3 py-1.5 text-xs font-medium">
                  {q}
                </button>
              ))}
            </span>
          </EmptyState>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-ctl bg-accent-soft px-4 py-2.5 text-sm whitespace-pre-wrap text-ink">{m.content}</p>
              </div>
            ) : (
              <div key={i} className="group max-w-[92%]">
                <div className="prose-interview rounded-ctl bg-surface-2 px-4 py-3 text-sm">
                  <Markdown>{m.content}</Markdown>
                </div>
                <div className="mt-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <CopyButton text={m.content} />
                </div>
              </div>
            ),
          )
        )}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <Spinner /> Thinking…
          </p>
        )}
        {error && <Alert>{error}</Alert>}
        <div ref={end} />
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t-[length:var(--bw)] border-line p-3">
        <textarea
          aria-label="Your question"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          placeholder="Ask a follow-up question…"
          className="field max-h-40 min-h-11 flex-1 resize-y py-2.5"
        />
        <button type="submit" className="btn-primary size-11 shrink-0 px-0" disabled={!draft.trim() || busy} aria-label="Send">
          {busy ? <Spinner /> : <Send className="size-4" />}
        </button>
      </form>
    </section>
  );
}
