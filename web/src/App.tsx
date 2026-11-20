import { ArrowDown, Columns3, FileCheck2, FileText, History, Info, RotateCw, Settings2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  downloadText,
  type AISettings,
  type Analysis,
  type AtsCheck,
  type ChatMessage,
  type CompareResult,
  type KeywordResult,
  type Provider,
  type Tone,
} from "./api";
import { CompareJobsInput, CompareResults, type CompareJob } from "./components/Compare";
import { AtsPanel, ChatPanel, EditorPanel } from "./components/Features";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { JobInput, ResumeInput, type UploadedFile } from "./components/Inputs";
import {
  CoverLetterPanel,
  ImprovementsPanel,
  InterviewPanel,
  KeywordsPanel,
  NeedsAI,
  RewritesPanel,
  ScoreSummary,
  TabPanel,
  Tabs,
  type TabId,
} from "./components/Results";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { ThemePicker } from "./components/ThemePicker";
import { Alert, Segmented, Spinner, cx } from "./components/ui";
import { applySummary, replaceLoose } from "./edit";
import { useHistory, type HistoryEntry } from "./history";
import { useTheme } from "./theme";

type AIState = "off" | "loading" | "done" | "error";
type Mode = "single" | "compare";

const message = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Please try again.");

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}

const EMPTY_JOBS: CompareJob[] = [
  { title: "", text: "" },
  { title: "", text: "" },
];

export default function App() {
  const themeState = useTheme();
  const history = useHistory();

  /* ---------------------------------------------------------- settings */
  const [providers, setProviders] = useState<Provider[]>([]);
  const [serverError, setServerError] = useState("");
  const [settings, setSettings] = useState<AISettings>(() => ({
    ...load("ra:settings", { provider: "", model: "", temperature: 0.3 }),
    apiKey: "",
  }));
  const [topN, setTopN] = useState(() => load("ra:topN", 25));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  /* ---------------------------------------------------------- inputs */
  const [mode, setMode] = useState<Mode>("single");
  const [resume, setResume] = useState("");
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [job, setJob] = useState("");
  const [compareJobs, setCompareJobs] = useState<CompareJob[]>(EMPTY_JOBS);

  /* ---------------------------------------------------------- single-job results */
  const [keywords, setKeywords] = useState<KeywordResult | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [aiState, setAIState] = useState<AIState>("off");
  const [aiError, setAIError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [runError, setRunError] = useState("");
  const [analyzed, setAnalyzed] = useState({ resume: "", job: "" });
  const [tab, setTab] = useState<TabId>("keywords");
  const [ats, setAts] = useState<{ checks: AtsCheck[]; source: string | null }>({ checks: [], source: null });

  const [editorText, setEditorText] = useState("");
  const [editorStart, setEditorStart] = useState({ score: 0, missing: [] as string[] });
  const [appliedRewrites, setAppliedRewrites] = useState<Set<number>>(new Set());
  const [summaryApplied, setSummaryApplied] = useState(false);
  const [rewriteNotice, setRewriteNotice] = useState("");

  const [letter, setLetter] = useState({ text: "", busy: false, error: "" });
  const [prep, setPrep] = useState({ text: "", busy: false, error: "" });
  const [chat, setChat] = useState({ messages: [] as ChatMessage[], busy: false, error: "" });
  const [reportBusy, setReportBusy] = useState(false);

  /* ---------------------------------------------------------- compare results */
  const [compareResults, setCompareResults] = useState<(CompareResult & { index: number })[] | null>(null);
  const [compareAI, setCompareAI] = useState(false);
  const [aiScores, setAiScores] = useState<Record<number, number | "loading" | "error">>({});
  const [comparing, setComparing] = useState(false);

  const resultsRef = useRef<HTMLElement>(null);
  const scrollToResults = () =>
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

  useEffect(() => {
    api
      .providers()
      .then(({ default: def, providers }) => {
        setProviders(providers);
        setSettings((s) => {
          const current = providers.find((p) => p.name === s.provider);
          if (current) return { ...s, model: s.model || current.models[0] };
          const fallback = providers.find((p) => p.name === def) ?? providers[0];
          return { ...s, provider: fallback.name, model: fallback.models[0] };
        });
      })
      .catch((e) => setServerError(message(e)));
  }, []);

  useEffect(() => save("ra:settings", { provider: settings.provider, model: settings.model, temperature: settings.temperature }), [settings]);
  useEffect(() => save("ra:topN", topN), [topN]);

  const provider = providers.find((p) => p.name === settings.provider);
  const aiReady = !!provider && (!provider.needs_key || provider.has_env_key || !!settings.apiKey);
  const filledJobs = compareJobs.filter((j) => j.text.trim());
  const ready = resume.trim().length > 0 && (mode === "single" ? job.trim().length > 0 : filledJobs.length > 0);
  const stale = mode === "single" && keywords !== null && (analyzed.resume !== resume || analyzed.job !== job);

  /* ---------------------------------------------------------- single-job flow */
  const runAI = useCallback(
    async (r: string, j: string) => {
      setAIState("loading");
      setAIError("");
      try {
        const result = await api.analyze(r, j, settings);
        setAnalysis(result);
        setAIState("done");
        history.record(j, { aiScore: result.ats_score });
      } catch (e) {
        setAnalysis(null);
        setAIError(message(e));
        setAIState("error");
      }
    },
    [settings, history],
  );

  const analyze = useCallback(
    async (resumeOverride?: string, jobOverride?: string) => {
      const r = (resumeOverride ?? resume).trim();
      const j = (jobOverride ?? job).trim();
      if (!r || !j || analyzing) return;
      setAnalyzing(true);
      setRunError("");
      setAnalysis(null);
      setLetter({ text: "", busy: false, error: "" });
      setPrep({ text: "", busy: false, error: "" });
      setChat({ messages: [], busy: false, error: "" });
      setAppliedRewrites(new Set());
      setSummaryApplied(false);
      setRewriteNotice("");

      const ai = aiReady ? runAI(r, j) : (setAIState("off"), Promise.resolve());
      const fromFile = uploaded && uploaded.text.trim() === r;
      const atsJob = fromFile
        ? Promise.resolve({ checks: uploaded.checks, source: uploaded.name })
        : api.atsText(r).then((res) => ({ checks: res.checks, source: null }));
      try {
        const [kw, atsResult] = await Promise.all([api.keywords(r, j, topN), atsJob]);
        setKeywords(kw);
        setAts(atsResult);
        setAnalyzed({ resume: resumeOverride ?? resume, job: jobOverride ?? job });
        setEditorText(r);
        setEditorStart({ score: kw.score, missing: kw.missing });
        setTab("keywords");
        history.record(j, { keywordScore: kw.score, missing: kw.missing });
        scrollToResults();
      } catch (e) {
        setRunError(message(e));
      }
      await ai;
      setAnalyzing(false);
    },
    [resume, job, analyzing, aiReady, runAI, uploaded, topN, history],
  );

  /* ---------------------------------------------------------- compare flow */
  const compare = useCallback(async () => {
    const r = resume.trim();
    const jobs = compareJobs.map((j, index) => ({ ...j, index })).filter((j) => j.text.trim());
    if (!r || !jobs.length || comparing) return;
    setComparing(true);
    setRunError("");
    setAiScores({});
    try {
      const { results } = await api.compare(
        r,
        jobs.map(({ title, text }) => ({ title, text })),
        topN,
      );
      const withIndex = results.map((res, k) => ({ ...res, index: jobs[k].index }));
      setCompareResults(withIndex);
      withIndex.forEach((res) =>
        history.record(compareJobs[res.index].text, { keywordScore: res.score, missing: res.missing, title: res.title }),
      );
      scrollToResults();
      if (compareAI && aiReady) {
        setAiScores(Object.fromEntries(jobs.map((j) => [j.index, "loading" as const])));
        // One at a time: free tiers have tight per-minute limits.
        for (const j of jobs) {
          try {
            const result = await api.analyze(r, j.text, settings);
            setAiScores((s) => ({ ...s, [j.index]: result.ats_score }));
            history.record(j.text, { aiScore: result.ats_score });
          } catch {
            setAiScores((s) => ({ ...s, [j.index]: "error" }));
          }
        }
      }
    } catch (e) {
      setRunError(message(e));
    } finally {
      setComparing(false);
    }
  }, [resume, compareJobs, comparing, topN, compareAI, aiReady, settings, history]);

  const run = mode === "single" ? () => analyze() : compare;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  function openJob(text: string) {
    setMode("single");
    setJob(text);
    if (resume.trim()) analyze(resume, text);
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openHistory(entry: HistoryEntry) {
    setHistoryOpen(false);
    openJob(entry.job);
  }

  /* ---------------------------------------------------------- AI extras */
  async function writeLetter(tone: Tone) {
    setLetter((l) => ({ ...l, busy: true, error: "" }));
    try {
      const { text } = await api.coverLetter(analyzed.resume.trim(), analyzed.job.trim(), settings, tone);
      setLetter({ text, busy: false, error: "" });
    } catch (e) {
      setLetter((l) => ({ ...l, busy: false, error: message(e) }));
    }
  }

  async function writePrep() {
    setPrep((p) => ({ ...p, busy: true, error: "" }));
    try {
      const { text } = await api.interview(analyzed.resume.trim(), analyzed.job.trim(), settings);
      setPrep({ text, busy: false, error: "" });
    } catch (e) {
      setPrep((p) => ({ ...p, busy: false, error: message(e) }));
    }
  }

  async function sendChat(text: string) {
    const messages: ChatMessage[] = [...chat.messages, { role: "user", content: text }];
    setChat({ messages, busy: true, error: "" });
    try {
      const reply = await api.chat(editorText || analyzed.resume.trim(), analyzed.job.trim(), settings, messages, analysis);
      setChat({ messages: [...messages, { role: "assistant", content: reply.text }], busy: false, error: "" });
    } catch (e) {
      setChat({ messages, busy: false, error: message(e) });
    }
  }

  function applyRewrite(i: number) {
    const rw = analysis?.bullet_rewrites[i];
    if (!rw) return;
    const next = rw.original ? replaceLoose(editorText, rw.original, rw.improved) : null;
    if (next === null) {
      navigator.clipboard?.writeText(rw.improved).catch(() => {});
      setRewriteNotice(
        "Couldn't find that line in your resume (the AI may have paraphrased it). The new version is copied: paste it in Edit & export.",
      );
      return;
    }
    setEditorText(next);
    setAppliedRewrites((s) => new Set(s).add(i));
    setRewriteNotice("");
  }

  async function downloadReport() {
    setReportBusy(true);
    try {
      const md = await api.report({
        resume: editorText || analyzed.resume.trim(),
        job: analyzed.job.trim(),
        top_n: topN,
        analysis,
        cover_letter: letter.text || null,
        interview: prep.text || null,
      });
      downloadText("resume_report.md", md, "text/markdown");
    } catch (e) {
      setRunError(message(e));
    } finally {
      setReportBusy(false);
    }
  }

  const openSettings = () => setSettingsOpen(true);
  const hasAI = aiState === "done" && analysis;
  const busy = mode === "single" ? analyzing : comparing;
  const showSingle = mode === "single" && keywords;
  const showCompare = mode === "compare" && compareResults;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b-[length:var(--bw)] border-line/80 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <div className="grid size-8 shrink-0 place-items-center rounded-sm bg-accent text-accent-ink">
            <FileCheck2 className="size-[18px]" />
          </div>
          <span className="display hidden text-[15px] whitespace-nowrap [letter-spacing:-0.01em] [text-transform:none] min-[520px]:inline">
            Resume Assistant
          </span>
          <div className="ml-auto" />
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="btn-quiet h-9 rounded-pill px-3"
            aria-label={`Applications (${history.entries.length})`}
          >
            <History className="size-4 text-ink-2" />
            <span className="hidden text-[13px] md:inline">Applications</span>
            {history.entries.length > 0 && (
              <span className="chip bg-accent-soft px-1.5 text-[11px] text-accent-fg tabular-nums">{history.entries.length}</span>
            )}
          </button>
          <ThemePicker
            theme={themeState.theme}
            mode={themeState.mode}
            resolved={themeState.resolved}
            onTheme={themeState.setTheme}
            onMode={themeState.setMode}
          />
          <button type="button" onClick={openSettings} className="btn-quiet h-9 rounded-pill pr-3 pl-2.5">
            <span className={cx("size-2 rounded-full", aiReady ? "bg-good" : "bg-warn")} aria-hidden="true" />
            <span className="hidden text-[13px] lg:inline">
              {provider ? provider.name.replace(" (free)", "").replace(" (local)", "") : "AI"}
              <span className="text-ink-3"> · {aiReady ? settings.model : "add a key"}</span>
            </span>
            <span className="text-[13px] lg:hidden">{aiReady ? "AI" : "Key"}</span>
            <Settings2 className="size-4 text-ink-2" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <section className="pt-12 pb-10 sm:pt-16 sm:pb-12">
          <p className="sticker eyebrow mb-4 text-accent-fg">Resume match · free &amp; private</p>
          <h1 className="display max-w-3xl text-[44px] sm:text-[68px]">
            Tailor your resume to <span className="hl">the job</span>, not the other way round.
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2">
            See how well your resume fits a posting, which keywords are missing, and exactly what to change before you
            apply.
          </p>
        </section>

        {serverError && (
          <div className="mb-6">
            <Alert>{serverError}</Alert>
          </div>
        )}

        <div className="mb-4">
          <Segmented
            label="What do you want to do?"
            value={mode}
            onChange={setMode}
            options={[
              {
                value: "single",
                label: (
                  <>
                    <FileText className="size-3.5" /> One job
                  </>
                ),
              },
              {
                value: "compare",
                label: (
                  <>
                    <Columns3 className="size-3.5" /> Compare jobs
                  </>
                ),
              },
            ]}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ResumeInput value={resume} onChange={setResume} onFile={setUploaded} />
          {mode === "single" ? (
            <JobInput value={job} onChange={setJob} />
          ) : (
            <CompareJobsInput jobs={compareJobs} onChange={setCompareJobs} />
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button type="button" className="btn-primary h-12 px-6 text-[15px]" onClick={run} disabled={!ready || busy}>
            {busy ? <Spinner /> : mode === "single" ? <ArrowDown className="size-4" /> : <Columns3 className="size-4" />}
            {busy
              ? mode === "single"
                ? "Analyzing…"
                : "Comparing…"
              : mode === "single"
                ? keywords
                  ? "Analyze again"
                  : "Analyze match"
                : `Compare ${filledJobs.length || ""} job${filledJobs.length === 1 ? "" : "s"}`}
          </button>
          {mode === "compare" && aiReady && (
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={compareAI}
                onChange={(e) => setCompareAI(e.target.checked)}
                className="size-4 accent-[var(--accent-fg)]"
              />
              Also get AI scores ({filledJobs.length} request{filledJobs.length === 1 ? "" : "s"})
            </label>
          )}
          <p className="flex items-center gap-2 text-sm text-ink-2" aria-live="polite">
            {!ready ? (
              <>
                Add {!resume.trim() ? "your resume" : ""}
                {!resume.trim() && (mode === "single" ? !job.trim() : !filledJobs.length) ? " and " : ""}
                {(mode === "single" ? !job.trim() : !filledJobs.length) ? (mode === "single" ? "a job description" : "at least one job") : ""} to
                start.
              </>
            ) : aiReady ? (
              <>
                <kbd className="rounded-sm hairline bg-surface px-1.5 py-0.5 font-sans text-[11px] font-semibold text-ink-3">Ctrl</kbd>
                <kbd className="rounded-sm hairline bg-surface px-1.5 py-0.5 font-sans text-[11px] font-semibold text-ink-3">Enter</kbd>
                {mode === "single" && <span>Full review with {provider?.name.split(" (")[0]}.</span>}
              </>
            ) : (
              <>
                <Info className="size-4 shrink-0 text-ink-3" />
                <span>
                  Keyword match only.{" "}
                  <button type="button" onClick={openSettings} className="font-semibold text-accent-fg hover:underline">
                    Add a free key
                  </button>{" "}
                  for the full AI review.
                </span>
              </>
            )}
          </p>
        </div>
        {runError && (
          <div className="mt-4">
            <Alert>{runError}</Alert>
          </div>
        )}

        {showCompare && (
          <section ref={resultsRef} aria-labelledby="compare-results-title" className="scroll-mt-20 pt-16">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 id="compare-results-title" className="display text-4xl">
                Best fit
              </h2>
              <p className="text-sm text-ink-2">Ranked by keyword match. Open any job for the full analysis.</p>
            </div>
            <CompareResults results={compareResults} aiScores={aiScores} onOpen={(i) => openJob(compareJobs[i].text)} />
          </section>
        )}

        {showSingle && (
          <section ref={resultsRef} aria-labelledby="results-title" className="scroll-mt-20 pt-16">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 id="results-title" className="display text-4xl">
                Your match
              </h2>
              {stale && (
                <button
                  type="button"
                  onClick={() => analyze()}
                  className="chip h-8 gap-1.5 bg-warn-soft px-3 text-[13px] text-warn hover:brightness-95"
                >
                  <RotateCw className="size-3.5" /> Inputs changed. Update results
                </button>
              )}
            </div>

            <ScoreSummary
              keywords={keywords}
              analysis={analysis}
              aiState={aiState}
              aiError={aiError}
              onRetry={() => runAI(analyzed.resume.trim(), analyzed.job.trim())}
              onOpenSettings={openSettings}
            />

            <div className="mt-10">
              <Tabs active={tab} onChange={setTab} />
              <TabPanel id="keywords" active={tab}>
                <KeywordsPanel result={keywords} resume={analyzed.resume.trim()} analysis={hasAI ? analysis : null} />
              </TabPanel>
              <TabPanel id="format" active={tab}>
                <AtsPanel checks={ats.checks} source={ats.source} />
              </TabPanel>
              <TabPanel id="improve" active={tab}>
                {hasAI ? (
                  <ImprovementsPanel
                    analysis={analysis}
                    summaryApplied={summaryApplied}
                    onApplySummary={() => {
                      setEditorText((t) => applySummary(t, analysis.suggested_summary));
                      setSummaryApplied(true);
                    }}
                  />
                ) : (
                  <NeedsAI aiState={aiState} onOpenSettings={openSettings} />
                )}
              </TabPanel>
              <TabPanel id="rewrites" active={tab}>
                {hasAI ? (
                  <RewritesPanel analysis={analysis} applied={appliedRewrites} onApply={applyRewrite} notice={rewriteNotice} />
                ) : (
                  <NeedsAI aiState={aiState} onOpenSettings={openSettings} />
                )}
              </TabPanel>
              <TabPanel id="editor" active={tab}>
                <EditorPanel
                  text={editorText}
                  onChange={setEditorText}
                  original={analyzed.resume.trim()}
                  job={analyzed.job.trim()}
                  topN={topN}
                  startScore={editorStart.score}
                  startMissing={editorStart.missing}
                  onReanalyze={() => {
                    setResume(editorText);
                    analyze(editorText, analyzed.job);
                  }}
                  onDownloadReport={downloadReport}
                  reportBusy={reportBusy}
                />
              </TabPanel>
              <TabPanel id="ask" active={tab}>
                {aiReady ? (
                  <ChatPanel
                    messages={chat.messages}
                    onSend={sendChat}
                    busy={chat.busy}
                    error={chat.error}
                    onClear={() => setChat({ messages: [], busy: false, error: "" })}
                  />
                ) : (
                  <NeedsAI aiState="off" onOpenSettings={openSettings} />
                )}
              </TabPanel>
              <TabPanel id="letter" active={tab}>
                {aiReady ? (
                  <CoverLetterPanel
                    text={letter.text}
                    onChange={(text) => setLetter((l) => ({ ...l, text }))}
                    onGenerate={writeLetter}
                    busy={letter.busy}
                    error={letter.error}
                  />
                ) : (
                  <NeedsAI aiState="off" onOpenSettings={openSettings} />
                )}
              </TabPanel>
              <TabPanel id="interview" active={tab}>
                {aiReady ? (
                  <InterviewPanel text={prep.text} onGenerate={writePrep} busy={prep.busy} error={prep.error} />
                ) : (
                  <NeedsAI aiState="off" onOpenSettings={openSettings} />
                )}
              </TabPanel>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t-[length:var(--bw)] border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-ink-3 sm:px-6">
          <span>Nothing you upload leaves your computer, except to the AI provider you choose.</span>
          <span>Runs on your own computer · Open source</span>
        </div>
      </footer>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        providers={providers}
        settings={settings}
        onChange={setSettings}
        topN={topN}
        onTopN={setTopN}
      />
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entries={history.entries}
        onOpenEntry={openHistory}
        onUpdate={history.update}
        onRemove={history.remove}
        onClear={history.clear}
      />
    </div>
  );
}
