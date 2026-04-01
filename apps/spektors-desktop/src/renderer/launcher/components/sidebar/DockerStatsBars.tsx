import type { DockerStatsRow } from "../../../../shared/launcher-types";

export function DockerStatsBars(props: { rows: DockerStatsRow[] }) {
  if (props.rows.length === 0) {
    return (
      <p className="text-[10px] text-[color:var(--fg-muted)]">Нет данных stats.</p>
    );
  }
  const maxCpu = Math.max(5, ...props.rows.map((r) => r.cpuPercent));
  return (
    <div className="space-y-2">
      {props.rows.map((r) => (
        <div key={r.name} className="text-[10px]">
          <div className="mb-0.5 flex justify-between gap-2 text-[color:var(--fg-muted)]">
            <span className="truncate font-mono" title={r.name}>
              {r.name}
            </span>
            <span>
              CPU {r.cpuPercent.toFixed(1)}% · RAM {r.memMb.toFixed(0)} MiB
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-border)]"
            title={`CPU ${r.cpuPercent}%`}
          >
            <div
              className="h-full rounded-full bg-emerald-500/70 transition-[width]"
              style={{ width: `${Math.min(100, (r.cpuPercent / maxCpu) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
