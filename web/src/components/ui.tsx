import { AlertCircle, Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function rating(score: number) {
  if (score >= 75) return { tone: "good", label: "Strong match", color: "var(--good)" } as const;
  if (score >= 50) return { tone: "fair", label: "Fair match", color: "var(--warn)" } as const;
  return { tone: "weak", label: "Needs work", color: "var(--bad)" } as const;
}

const TONE_CHIP = {
  good: "bg-good-soft text-good",
  fair: "bg-warn-soft text-warn",
  weak: "bg-bad-soft text-bad",
} as const;

export function RatingChip({ score }: { score: number }) {
  const r = rating(score);
  return <span className={cx("chip", TONE_CHIP[r.tone])}>{r.label}</span>;
}

/** Circular score meter. Animates from 0 on mount (skipped with reduced motion). */
export function Ring({ value, size = 104, suffix = "" }: { value: number; size?: number; suffix?: string }) {
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={rating(value).color}
          strokeWidth={stroke}
          style={{ strokeLinecap: "var(--ring-cap)" as "round", transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex items-baseline justify-center pt-[30%]">
        <span className="font-display text-[38px] leading-none tracking-tight tabular-nums [font-weight:var(--head-weight)]">{value}</span>
        {suffix && <span className="ml-0.5 text-sm font-semibold text-ink-3">{suffix}</span>}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-ctl hairline bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-[13px] font-semibold transition-colors duration-150",
            value === o.value ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-quiet h-8 rounded-sm px-2.5 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <Check className="size-3.5 text-good" /> : <Copy className="size-3.5" />}
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}

export function Alert({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-ctl border border-bad/25 bg-bad-soft px-4 py-3 text-sm text-ink">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-bad" />
      <div className="flex-1">{children}</div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-sm font-semibold text-bad underline-offset-2 hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-4 animate-spin", className)} aria-hidden="true" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-sm bg-surface-2", className)} />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-card bg-accent-soft text-accent-fg">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="mt-1.5 max-w-md text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
