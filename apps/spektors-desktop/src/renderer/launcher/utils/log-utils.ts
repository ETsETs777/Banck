import type { LogEntry, LogLevel } from "../../../shared/launcher-types";

export function inferLevel(stderr: string, code: number | null): LogLevel {
  if (code != null && code !== 0) return "error";
  if (/error|fatal/i.test(stderr)) return "error";
  if (/warn|warning/i.test(stderr)) return "warning";
  if (/debug|trace/i.test(stderr)) return "debug";
  return "info";
}

export function makeLogEntry(
  source: string,
  raw: string,
  level?: LogLevel,
): LogEntry {
  return {
    id: crypto.randomUUID(),
    ts: Date.now(),
    source,
    level: level ?? "info",
    raw,
  };
}

export function formatLogLine(e: LogEntry): string {
  const t = new Date(e.ts).toISOString().slice(11, 23);
  return `[${t}] [${e.source}] [${e.level}] ${e.raw}`;
}
