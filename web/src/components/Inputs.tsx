import { FileText, FileUp, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError, type AtsCheck } from "../api";
import { SAMPLE_JOB, SAMPLE_RESUME } from "../samples";
import { Alert, Segmented, Spinner, cx } from "./ui";

function Panel({
  step,
  title,
  aside,
  children,
}: {
  step: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card flex flex-col p-5 sm:p-6" data-pop={step === 1 ? "pink" : "blue"} aria-labelledby={`step-${step}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="step-badge grid size-7 place-items-center rounded-pill bg-ink text-xs font-bold text-bg">{step}</span>
        <h2 id={`step-${step}`} className="text-[15px] font-semibold">
          {title}
        </h2>
        <div className="ml-auto">{aside}</div>
      </div>
      {children}
    </section>
  );
}

function SampleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-semibold text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
    >
      <Sparkles className="size-3.5" /> Try a sample
    </button>
  );
}

export type UploadedFile = { name: string; words: number; text: string; checks: AtsCheck[] };

export function ResumeInput({
  value,
  onChange,
  onFile,
}: {
  value: string;
  onChange: (text: string) => void;
  /** The uploaded file's details (with ATS layout checks), or null when there's no file. */
  onFile: (file: UploadedFile | null) => void;
}) {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [file, setFileState] = useState<UploadedFile | null>(null);
  const setFile = (f: UploadedFile | null) => {
    setFileState(f);
    onFile(f);
  };

  // The text was changed elsewhere (e.g. the editor): it no longer matches the file.
  useEffect(() => {
    if (file && value !== file.text) {
      setFile(null);
      setMode("paste");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function handle(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.parse(f);
      setFile({ name: f.name, words: res.words, text: res.text, checks: res.checks });
      onChange(res.text);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setFile(null);
    onChange("");
    if (input.current) input.current.value = "";
  }

  return (
    <Panel
      step={1}
      title="Your resume"
      aside={
        <SampleButton
          onClick={() => {
            setMode("paste");
            setFile(null);
            onChange(SAMPLE_RESUME);
          }}
        />
      }
    >
      <div className="mb-3">
        <Segmented
          label="Resume input"
          value={mode}
          onChange={setMode}
          options={[
            { value: "upload", label: "Upload file" },
            { value: "paste", label: "Paste text" },
          ]}
        />
      </div>

      {mode === "upload" ? (
        file ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-3 rounded-ctl hairline bg-surface-2 px-4 py-3.5">
              <div className="grid size-10 place-items-center rounded-sm bg-accent-soft text-accent-fg">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                <p className="text-xs text-ink-2">{file.words.toLocaleString()} words read</p>
              </div>
              <button type="button" onClick={clear} className="btn-quiet size-8 px-0" aria-label="Remove file">
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-3 line-clamp-6 text-[13px] leading-relaxed whitespace-pre-line text-ink-3">{value}</p>
          </div>
        ) : (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handle(e.dataTransfer.files[0]);
            }}
            className={cx(
              "flex min-h-[236px] flex-1 flex-col items-center justify-center rounded-ctl border-2 border-dashed px-6 text-center transition-colors duration-150",
              dragging ? "border-accent-fg bg-accent-soft/50" : "border-line-strong hover:border-accent-fg hover:bg-surface-2",
            )}
          >
            <input
              ref={input}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="sr-only"
              onChange={(e) => handle(e.target.files?.[0])}
            />
            <div className="mb-3 grid size-11 place-items-center rounded-ctl bg-surface-2 text-ink-2">
              {busy ? <Spinner className="size-5" /> : <FileUp className="size-5" />}
            </div>
            <p className="text-sm font-semibold">{busy ? "Reading your resume…" : "Drop your resume here"}</p>
            <p className="mt-1 text-xs text-ink-3">
              or <span className="font-semibold text-accent-fg">browse files</span> · PDF, DOCX or TXT up to 10 MB
            </p>
          </label>
        )
      ) : (
        <textarea
          aria-label="Resume text"
          className="field min-h-[236px] flex-1 resize-y leading-relaxed"
          placeholder="Paste the full text of your resume…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </Panel>
  );
}

export function JobInput({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <Panel step={2} title="Job description" aside={<SampleButton onClick={() => onChange(SAMPLE_JOB)} />}>
      <textarea
        aria-label="Job description"
        className="field min-h-[284px] flex-1 resize-y leading-relaxed"
        placeholder="Paste the job title, responsibilities and requirements…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-2 text-right text-xs text-ink-3 tabular-nums">{words.toLocaleString()} words</p>
    </Panel>
  );
}
