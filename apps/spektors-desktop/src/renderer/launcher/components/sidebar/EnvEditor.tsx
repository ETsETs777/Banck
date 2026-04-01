import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;

const SECRET_RE = /^(.*(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE|KEY))=(.*)$/i;

function maskLine(line: string, show: boolean): string {
  if (show) return line;
  const m = line.match(SECRET_RE);
  if (!m || !m[1] || m[2] === undefined) return line;
  const val = m[2].trim();
  if (val === "" || val.startsWith("#")) return line;
  return `${m[1]}=********`;
}

function highlightEnvLine(line: string, masked: string): ReactNode {
  if (line.trim().startsWith("#")) {
    return <span className="text-emerald-600/80 dark:text-emerald-400/70">{masked}</span>;
  }
  const eq = masked.indexOf("=");
  if (eq <= 0) return masked;
  return (
    <>
      <span className="text-sky-600 dark:text-sky-400">{masked.slice(0, eq)}</span>
      <span className="text-[color:var(--fg-muted)]">=</span>
      <span>{masked.slice(eq + 1)}</span>
    </>
  );
}

export function EnvEditor(props: {
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const [showSecrets, setShowSecrets] = useState(false);
  const lines = useMemo(() => props.value.split("\n"), [props.value]);

  return (
    <div style={noDrag}>
      <label className="mb-2 flex cursor-pointer items-center gap-2 text-[11px] text-[color:var(--fg-muted)]">
        <input
          type="checkbox"
          checked={showSecrets}
          onChange={(e) => setShowSecrets(e.target.checked)}
        />
        Показать секреты (пароли / ключи)
      </label>
      <div
        className="max-h-48 overflow-auto rounded-md border p-2 font-mono text-[11px] leading-relaxed"
        style={{
          borderColor: "var(--glass-border)",
          background: "var(--glass-highlight)",
          color: "var(--fg)",
        }}
      >
        {lines.map((line, i) => {
          const masked = maskLine(line, showSecrets);
          return (
            <div key={i} className="whitespace-pre-wrap break-all">
              {highlightEnvLine(line, masked)}
            </div>
          );
        })}
      </div>
      <textarea
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        spellCheck={false}
        className="mt-2 h-40 w-full resize-y rounded-md border p-3 font-mono text-xs leading-relaxed outline-none transition focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
        style={{
          borderColor: "var(--glass-border)",
          background: "var(--glass-highlight)",
          color: "var(--fg)",
        }}
        placeholder="# редактирование .env"
      />
    </div>
  );
}
