/** Text helpers for applying AI suggestions to the resume in the editor. */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replace `original` with `improved`, tolerating differences in spacing, bullet
 * characters and trailing punctuation. Returns null when the line can't be found.
 */
export function replaceLoose(text: string, original: string, improved: string): string | null {
  const core = original.replace(/^\s*[-•*–▪●◦]\s*/, "").replace(/[.\s]+$/, "").trim();
  if (!core) return null;
  if (text.includes(core)) return text.replace(core, improved.replace(/[.\s]+$/, ""));
  const words = core.split(/\s+/).map(escape);
  const pattern = new RegExp(words.join("[\\s\\u00a0]+"), "i");
  const match = text.match(pattern);
  if (!match || match.index === undefined) return null;
  return text.slice(0, match.index) + improved.replace(/[.\s]+$/, "") + text.slice(match.index + match[0].length);
}

const HEADING = /^\s*[A-Z][A-Z &/]{2,40}:?\s*$/;

/** Put `summary` under a SUMMARY/PROFILE heading, replacing its text, or add one near the top. */
export function applySummary(text: string, summary: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^\s*(professional\s+)?(summary|profile|about me|objective)\s*:?\s*$/i.test(l));
  if (start >= 0) {
    let end = start + 1;
    while (end < lines.length && !HEADING.test(lines[end])) end++;
    return [...lines.slice(0, start + 1), summary, "", ...lines.slice(end)].join("\n");
  }
  // No summary section: insert after the name/contact block (first blank line).
  const firstBlank = lines.findIndex((l, i) => i > 0 && !l.trim());
  const at = firstBlank > 0 ? firstBlank : Math.min(2, lines.length);
  return [...lines.slice(0, at), "", "SUMMARY", summary, ...lines.slice(at)].join("\n");
}

export function hashText(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function jobTitle(job: string): string {
  for (const raw of job.split("\n")) {
    const line = raw.replace(/^[\s\-•*#:]+|[\s:]+$/g, "");
    if (line.length >= 3 && line.length <= 90) return line;
  }
  return job.trim().slice(0, 60) || "Untitled job";
}
