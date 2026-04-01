import type { DockerContainerRow } from "../../../../shared/launcher-types";
import type { SidebarCardId } from "../../utils/sidebar-card-order";
import { useLauncherCards } from "../../context/launcher-cards-context";
import { DockerStatsBars } from "./DockerStatsBars";
import { EnvEditor } from "./EnvEditor";
import {
  IconApi,
  IconBrowser,
  IconDocker,
  IconFolder,
  IconLog,
} from "../shell/LauncherIcons";
import { LauncherPanel } from "../shell/LauncherPanel";
import { LauncherSelect } from "../shell/LauncherSelect";
import { makeLogEntry } from "../../utils/log-utils";
import { ActionBtn } from "../shell/ActionBtn";

const PSQL =
  "psql postgresql://spektors:spektors@localhost:5432/spektors";

function reachState(
  up: boolean | null | undefined,
  container?: DockerContainerRow,
): "unknown" | "up" | "down" | "restarting" | "error" {
  const st = container?.state?.toLowerCase() ?? "";
  if (st === "restarting") return "restarting";
  if (st === "running" && up === true) return "up";
  if (st && st !== "running") return st === "exited" ? "down" : "error";
  if (up === true) return "up";
  if (up === false) return "down";
  return "unknown";
}

function statusDotClass(
  s: "unknown" | "up" | "down" | "restarting" | "error",
): string {
  switch (s) {
    case "up":
      return "bg-[var(--status-running)]";
    case "restarting":
      return "bg-[var(--status-restarting)] animate-pulse";
    case "error":
      return "bg-[var(--status-error)]";
    case "down":
      return "bg-[var(--status-stopped)]";
    default:
      return "bg-[var(--fg-muted)] opacity-40";
  }
}

export function SidebarCardBody(props: { id: SidebarCardId }) {
  const p = useLauncherCards();
  const expandHeader = {
    onHeaderClick: () => p.openExpandedCard(props.id),
  };

  switch (props.id) {
    case "repo":
      return (
        <LauncherPanel
          {...expandHeader}
          title="Репозиторий"
          description="Ветка, статус, git pull."
          icon={<IconFolder />}
        >
          <div className="flex flex-wrap gap-2">
            <input
              readOnly
              value={p.root}
              placeholder="Корень монорепо…"
              className="min-w-[160px] flex-1 rounded-lg border px-2 py-2 font-mono text-[10px] outline-none"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-highlight)",
                color: "var(--fg)",
              }}
            />
            <ActionBtn
              disabled={false}
              onClick={() => void p.pickFolder()}
              label="Папка"
            />
            <ActionBtn
              disabled={false}
              title="Найти корень по cwd и каталогу приложения"
              onClick={() => {
                void (async () => {
                  const found = await p.api.detectProjectRoot();
                  if (found) {
                    p.applyProjectRoot(found);
                    p.appendEntry(
                      makeLogEntry("repo", `Корень: ${found}`, "info"),
                    );
                  } else {
                    p.appendEntry(
                      makeLogEntry(
                        "repo",
                        "Авто-поиск: не найден каталог с package.json, docker-compose.yml и apps/api.",
                        "warning",
                      ),
                    );
                  }
                })();
              }}
              label="Авто"
            />
            <ActionBtn
              disabled={!p.root.trim()}
              onClick={() => void p.api.openPath(p.root.trim())}
              label="Проводник"
            />
          </div>
          {p.recentRoots.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {p.recentRoots.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => p.applyProjectRoot(r)}
                  className="max-w-full truncate rounded border px-1.5 py-0.5 font-mono text-[9px]"
                  style={{
                    borderColor: "var(--glass-border)",
                    color: "var(--fg-muted)",
                  }}
                  title={r}
                >
                  {r.replace(/\\/g, "/").split("/").slice(-2).join("/")}
                </button>
              ))}
            </div>
          ) : null}
          {p.valid && (
            <p
              className={`mt-2 text-xs ${p.valid.ok ? "text-emerald-500" : "text-amber-500"}`}
            >
              {p.valid.ok ? "Корень OK." : p.valid.reason}
            </p>
          )}
          <div className="mt-2 space-y-1 text-[10px] text-[color:var(--fg-muted)]">
            <p>
              docker: {p.toolDocker ? "✓" : "✗"} git:{" "}
              {p.toolGit ? "✓" : "✗"}
            </p>
            <p>
              Ветка:{" "}
              <strong className="text-[color:var(--fg)]">
                {p.gitBranch || "—"}
              </strong>
              {p.gitDirty ? (
                <span className="ml-1 text-amber-500">● изменения</span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-1">
              <LauncherSelect
                aria-label="Выбор ветки"
                value={p.branchPick}
                onChange={(v) => p.setBranchPick(v)}
                className="max-w-[140px]"
                buttonClassName="rounded px-1 py-0.5 text-[10px]"
                options={[
                  { value: "", label: "Ветка…" },
                  ...p.branches.map((b) => ({ value: b, label: b })),
                ]}
              />
              <ActionBtn
                disabled={!p.branchPick || !p.valid?.ok || p.busy !== null}
                onClick={() => {
                  if (
                    p.gitDirty &&
                    !window.confirm(
                      "Есть незакоммиченные изменения. Переключить ветку?",
                    )
                  )
                    return;
                  void (async () => {
                    p.setBusy("git");
                    const r = await p.api.gitCheckout(
                      p.root.trim(),
                      p.branchPick,
                    );
                    p.appendFromRun("git checkout", r);
                    await p.refreshGit();
                    p.setBusy(null);
                  })();
                }}
                label="Checkout"
              />
              <ActionBtn
                disabled={!p.valid?.ok || p.busy !== null}
                onClick={() => {
                  void (async () => {
                    p.setBusy("git");
                    const r = await p.api.gitPull(p.root.trim());
                    p.appendFromRun("git pull", r);
                    await p.refreshGit();
                    p.setBusy(null);
                  })();
                }}
                label="Pull"
              />
              <ActionBtn
                disabled={!p.valid?.ok || p.busy !== null}
                onClick={() => {
                  void (async () => {
                    const r = await p.api.gitStatus(p.root.trim());
                    p.appendFromRun("git status", r);
                  })();
                }}
                label="Status"
              />
            </div>
          </div>
        </LauncherPanel>
      );

    case "services":
      return (
        <LauncherPanel
          {...expandHeader}
          title="DEV-серверы"
          description="HTTP и docker. Окружение и webhook."
          icon={<IconBrowser />}
          actions={
            <button
              type="button"
              disabled={!p.valid?.ok || p.probing}
              onClick={() => void p.runProbeAll()}
              className="rounded-md border px-2 py-0.5 text-[10px]"
              style={{ borderColor: "var(--glass-border)" }}
            >
              Сейчас
            </button>
          }
        >
          <div className="mb-2 flex flex-wrap gap-2 text-[10px]">
            {(["dev", "staging", "prod"] as const).map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => p.setEnvProfile(env)}
                className={`rounded border px-2 py-0.5 capitalize ${
                  p.cfg.activeEnv === env ? "border-accent/50 bg-accent/10" : ""
                }`}
                style={{ borderColor: "var(--glass-border)" }}
              >
                {env}
              </button>
            ))}
          </div>
          <input
            type="url"
            placeholder="Webhook URL (опц.)"
            value={p.cfg.webhookUrl}
            onChange={(e) =>
              p.setCfg((c) => ({ ...c, webhookUrl: e.target.value }))
            }
            className="mb-2 w-full rounded border px-2 py-1 text-[10px]"
            style={{
              borderColor: "var(--glass-border)",
              background: "var(--glass-highlight)",
              color: "var(--fg)",
            }}
          />
          <div className="mb-2 flex w-full flex-wrap gap-2">
            {p.cfg.services.map((s) => {
              const cont = p.containerByCompose(s.composeService);
              const st = reachState(p.reach[s.url], cont);
              return (
                <div
                  key={s.id}
                  className="flex min-w-[min(100%,130px)] max-w-full flex-[1_1_130px] flex-col gap-1 rounded-md border p-2 text-[10px]"
                  style={{
                    borderColor: "var(--glass-border)",
                    background: "var(--glass-highlight)",
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(st)}`}
                    />
                    <span className="truncate font-medium text-[color:var(--fg)]">
                      {s.label}
                    </span>
                  </div>
                  <div className="text-[9px] text-[color:var(--fg-muted)]">
                    {st}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={!p.valid?.ok}
                      className="rounded border px-1 py-0.5 text-[9px]"
                      style={{ borderColor: "var(--glass-border)" }}
                      onClick={() => void p.api.openExternal(s.url)}
                    >
                      URL
                    </button>
                    {s.composeService ? (
                      <button
                        type="button"
                        disabled={!p.valid?.ok || p.busy !== null}
                        className="rounded border px-1 py-0.5 text-[9px]"
                        style={{ borderColor: "var(--glass-border)" }}
                        onClick={() =>
                          void (async () => {
                            const r = await p.api.dockerComposeRestart({
                              root: p.root.trim(),
                              service: s.composeService,
                              composeFile: p.cfg.composeFile,
                            });
                            p.appendFromRun(`restart ${s.composeService}`, r);
                            void p.refreshDocker();
                          })()
                        }
                      >
                        ↻
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1 border-t border-[var(--glass-border)] pt-2">
            <input
              placeholder="Название"
              value={p.newSvcLabel}
              onChange={(e) => p.setNewSvcLabel(e.target.value)}
              className="w-24 rounded border px-1 py-0.5 text-[10px]"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-highlight)",
                color: "var(--fg)",
              }}
            />
            <input
              placeholder="http://..."
              value={p.newSvcUrl}
              onChange={(e) => p.setNewSvcUrl(e.target.value)}
              className="min-w-[120px] flex-1 rounded border px-1 py-0.5 text-[10px]"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-highlight)",
                color: "var(--fg)",
              }}
            />
            <button
              type="button"
              className="rounded bg-accent/20 px-2 py-0.5 text-[10px] text-accent"
              onClick={() => {
                if (!p.newSvcLabel.trim() || !p.newSvcUrl.trim()) return;
                p.setCfg((c) => ({
                  ...c,
                  services: [
                    ...c.services,
                    {
                      id: `svc-${Date.now()}`,
                      label: p.newSvcLabel.trim(),
                      url: p.newSvcUrl.trim(),
                      kind: "http",
                    },
                  ],
                }));
                p.setNewSvcLabel("");
                p.setNewSvcUrl("");
              }}
            >
              +
            </button>
            <button
              type="button"
              className="rounded border px-2 py-0.5 text-[10px]"
              style={{ borderColor: "var(--glass-border)" }}
              onClick={() => void p.persistCfg()}
            >
              Сохранить конфиг
            </button>
          </div>
        </LauncherPanel>
      );

    case "docker":
      return (
        <LauncherPanel
          {...expandHeader}
          title="Docker и конфигурация"
          description="Compose, контейнеры, CPU/RAM."
          icon={<IconDocker />}
        >
          <input
            placeholder="compose файл (опц.)"
            value={p.cfg.composeFile ?? ""}
            onChange={(e) =>
              p.setCfg((c) => ({ ...c, composeFile: e.target.value }))
            }
            className="mb-2 w-full rounded border px-2 py-1 font-mono text-[10px]"
            style={{
              borderColor: "var(--glass-border)",
              background: "var(--glass-highlight)",
              color: "var(--fg)",
            }}
          />
          <div className="mb-2 flex flex-wrap gap-1">
            <ActionBtn
              disabled={!p.valid?.ok || p.busy !== null}
              loading={p.busy === "postgres"}
              onClick={() =>
                void p.runDocker("postgres", [
                  ...p.base,
                  "up",
                  "-d",
                  "postgres",
                ])
              }
              label="Postgres"
            />
            <ActionBtn
              disabled={!p.valid?.ok || p.busy !== null}
              loading={p.busy === "stack"}
              onClick={() => void p.runDocker("stack", [...p.base, "up", "-d"])}
              label="Весь стек"
            />
            <ActionBtn
              disabled={!p.valid?.ok || p.busy !== null}
              loading={p.busy === "down"}
              onClick={() => void p.runDocker("down", [...p.base, "down"])}
              label="down"
            />
            <ActionBtn
              disabled={!p.valid?.ok || p.busy !== null}
              onClick={() => void p.restartAllConfirm()}
              label="Restart all"
            />
          </div>
          {p.dockerErr ? (
            <p className="mb-2 text-[10px] text-amber-500">{p.dockerErr}</p>
          ) : null}
          <div className="space-y-1 text-[10px]">
            {p.containers.map((c) => (
              <div
                key={c.name}
                className="flex flex-wrap items-center justify-between gap-1 rounded border px-2 py-1"
                style={{ borderColor: "var(--glass-border)" }}
              >
                <span className="font-mono">{c.service}</span>
                <span className="text-[color:var(--fg-muted)]">{c.state}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded border px-1 text-[9px]"
                    style={{ borderColor: "var(--glass-border)" }}
                    onClick={() => void p.startTail(c.service)}
                  >
                    лог
                  </button>
                  <button
                    type="button"
                    className="rounded border px-1 text-[9px]"
                    style={{ borderColor: "var(--glass-border)" }}
                    onClick={() =>
                      void (async () => {
                        const r = await p.api.dockerComposeRestart({
                          root: p.root.trim(),
                          service: c.service,
                          composeFile: p.cfg.composeFile,
                        });
                        p.appendFromRun(`restart ${c.service}`, r);
                        void p.refreshDocker();
                      })()
                    }
                  >
                    ↻
                  </button>
                </div>
              </div>
            ))}
          </div>
          {p.logTailId ? (
            <button
              type="button"
              className="mt-2 text-[10px] text-accent"
              onClick={() => void p.stopTail()}
            >
              Остановить поток логов
            </button>
          ) : null}
          <p className="mb-1 mt-2 text-[10px] font-medium text-[color:var(--fg-muted)]">
            Ресурсы
          </p>
          <DockerStatsBars rows={p.stats} />
        </LauncherPanel>
      );

    case "api":
      return (
        <LauncherPanel
          {...expandHeader}
          title="API и БД"
          description="FastAPI, alembic, postgres."
          icon={<IconApi />}
        >
          <div className="mb-2 flex flex-wrap gap-1">
            <ActionBtn
              disabled={!p.valid?.ok || p.busy !== null}
              onClick={() =>
                void p.api.openExternal("http://localhost:8000/docs")
              }
              label="Swagger"
            />
            <ActionBtn
              disabled={!p.valid?.ok || p.busy !== null}
              onClick={() => {
                void (async () => {
                  const { pid } = await p.api.spawnBackground({
                    command: "py",
                    args: [
                      "-3",
                      "-m",
                      "uvicorn",
                      "spektors_api.main:app",
                      "--reload",
                      "--port",
                      "8000",
                    ],
                    cwd: `${p.root.trim()}/apps/api`,
                  });
                  p.appendEntry(
                    makeLogEntry(
                      "api",
                      `uvicorn фон pid=${pid ?? "?"}`,
                      "info",
                    ),
                  );
                })();
              }}
              label="API локально"
            />
            <ActionBtn
              disabled={!p.valid?.ok || p.busy !== null}
              loading={p.busy === "alembic"}
              onClick={() => {
                void (async () => {
                  p.setBusy("alembic");
                  const r = await p.api.runCommand({
                    command: "py",
                    args: ["-3", "-m", "alembic", "upgrade", "head"],
                    cwd: `${p.root.trim()}/apps/api`,
                  });
                  p.appendFromRun("alembic", r);
                  p.pushHistory("alembic upgrade head");
                  await p.refreshAlembic();
                  p.setBusy(null);
                })();
              }}
              label="Alembic upgrade"
            />
            <ActionBtn
              disabled={!p.valid?.ok}
              onClick={() => void p.api.writeClipboard(PSQL)}
              label="psql"
            />
            <ActionBtn
              disabled={!p.valid?.ok || p.busy !== null}
              onClick={() => {
                void (async () => {
                  const r = await p.api.runCommand({
                    command: "docker",
                    args: [
                      ...p.base,
                      "exec",
                      "postgres",
                      "pg_isready",
                      "-U",
                      "spektors",
                    ],
                    cwd: p.root.trim(),
                  });
                  p.appendFromRun("pg_isready", r);
                })();
              }}
              label="Проверить БД"
            />
          </div>
          <p className="text-[10px] text-[color:var(--fg-muted)]">
            Alembic current:{" "}
            <span className="font-mono text-[color:var(--fg)]">
              {p.alembicHead ?? "—"}
            </span>
          </p>
        </LauncherPanel>
      );

    case "env":
      return (
        <LauncherPanel
          {...expandHeader}
          title=".env и Docker"
          description="Редактор, маскирование секретов."
          icon={<IconFolder />}
          actions={
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                disabled={!p.valid?.ok || !p.hasEnvExample}
                onClick={() => {
                  void (async () => {
                    await p.api.copyEnvExample(p.root.trim());
                    await p.loadEnv();
                    p.appendEntry(
                      makeLogEntry("env", "Скопировано из .env.example", "info"),
                    );
                  })();
                }}
                className="rounded border px-2 py-0.5 text-[10px]"
                style={{ borderColor: "var(--glass-border)" }}
              >
                Из example
              </button>
              <button
                type="button"
                disabled={!p.valid?.ok || !p.envDirty}
                onClick={() => void p.saveEnv()}
                className="rounded bg-accent/25 px-2 py-0.5 text-[10px] font-semibold text-accent"
              >
                Сохранить
              </button>
            </div>
          }
        >
          <EnvEditor
            value={p.envText}
            disabled={!p.valid?.ok}
            onChange={(v) => {
              p.setEnvText(v);
              p.setEnvDirty(true);
            }}
          />
          <p className="mt-2 text-[10px] text-[color:var(--fg-muted)]">
            После сохранения при необходимости перезапустите контейнеры вручную.
          </p>
        </LauncherPanel>
      );

    case "customServers":
      return (
        <LauncherPanel
          {...expandHeader}
          title="Пользовательские серверы"
          description="Любая команда в каталоге относительно корня."
          icon={<IconBrowser />}
        >
          <div className="mb-2 grid gap-1 text-[10px]">
            <input
              placeholder="Имя"
              value={p.newServerName}
              onChange={(e) => p.setNewServerName(e.target.value)}
              className="rounded border px-2 py-1"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-highlight)",
                color: "var(--fg)",
              }}
            />
            <input
              placeholder="cwd от корня"
              value={p.newServerCwd}
              onChange={(e) => p.setNewServerCwd(e.target.value)}
              className="rounded border px-2 py-1 font-mono"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-highlight)",
                color: "var(--fg)",
              }}
            />
            <input
              placeholder="команда"
              value={p.newServerCmd}
              onChange={(e) => p.setNewServerCmd(e.target.value)}
              className="rounded border px-2 py-1 font-mono"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-highlight)",
                color: "var(--fg)",
              }}
            />
            <input
              placeholder="аргументы через пробел"
              value={p.newServerArgs}
              onChange={(e) => p.setNewServerArgs(e.target.value)}
              className="rounded border px-2 py-1 font-mono"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-highlight)",
                color: "var(--fg)",
              }}
            />
            <button
              type="button"
              className="rounded bg-accent/20 py-1 text-accent"
              onClick={() => {
                if (!p.newServerName.trim()) return;
                const id = `srv-${Date.now()}`;
                const args = p.newServerArgs
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean);
                p.setCfg((c) => ({
                  ...c,
                  customServers: [
                    ...c.customServers,
                    {
                      id,
                      name: p.newServerName.trim(),
                      cwdRelative: p.newServerCwd.trim() || ".",
                      command: p.newServerCmd.trim() || "npm",
                      args: args.length ? args : ["run", "dev"],
                    },
                  ],
                }));
                p.setNewServerName("");
              }}
            >
              Добавить в список
            </button>
          </div>
          {p.cfg.customServers.map((s) => (
            <div
              key={s.id}
              className="mb-1 flex flex-wrap items-center justify-between gap-1 rounded border px-2 py-1 text-[10px]"
              style={{ borderColor: "var(--glass-border)" }}
            >
              <span>{s.name}</span>
              <span className="font-mono text-[9px] text-[color:var(--fg-muted)]">
                {s.cwdRelative}: {s.command} {s.args.join(" ")}
              </span>
              <div className="flex gap-1">
                {p.managedRunning[s.id] ? (
                  <button
                    type="button"
                    className="text-red-400"
                    onClick={() => {
                      void (async () => {
                        const id = p.managedRunning[s.id]?.procId;
                        if (id) await p.api.killManaged(id);
                        p.setManagedRunning((m) => {
                          const n = { ...m };
                          delete n[s.id];
                          return n;
                        });
                      })();
                    }}
                  >
                    Стоп
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!p.valid?.ok}
                    className="text-accent"
                    onClick={() => {
                      void (async () => {
                        const cwd = `${p.root.trim()}/${s.cwdRelative}`;
                        try {
                          const r = await p.api.spawnManaged({
                            command: s.command,
                            args: s.args,
                            cwd,
                          });
                          p.setManagedRunning((m) => ({
                            ...m,
                            [s.id]: { procId: r.id, name: s.name },
                          }));
                          p.appendEntry(
                            makeLogEntry(
                              s.name,
                              `Запуск ${s.command} ${s.args.join(" ")} pid=${r.pid ?? "?"}`,
                              "info",
                            ),
                          );
                          p.pushHistory(
                            `${s.name}: ${s.command} ${s.args.join(" ")}`,
                          );
                        } catch (e) {
                          p.appendEntry(
                            makeLogEntry(
                              s.name,
                              `Старт не удался: ${String(e)}`,
                              "error",
                            ),
                          );
                        }
                      })();
                    }}
                  >
                    Старт
                  </button>
                )}
              </div>
            </div>
          ))}
        </LauncherPanel>
      );

    case "snippets":
      return (
        <LauncherPanel
          {...expandHeader}
          title="Сниппеты и история"
          description="Повтор команд."
          icon={<IconLog />}
        >
          <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
            <input
              placeholder="метка"
              value={p.snippetLabel}
              onChange={(e) => p.setSnippetLabel(e.target.value)}
              className="w-20 rounded border px-1"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-highlight)",
                color: "var(--fg)",
              }}
            />
            <input
              placeholder="cwd"
              value={p.snippetCwd}
              onChange={(e) => p.setSnippetCwd(e.target.value)}
              className="w-16 rounded border px-1 font-mono"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-highlight)",
                color: "var(--fg)",
              }}
            />
            <input
              placeholder="cmd"
              value={p.snippetCmd}
              onChange={(e) => p.setSnippetCmd(e.target.value)}
              className="w-14 rounded border px-1 font-mono"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-highlight)",
                color: "var(--fg)",
              }}
            />
            <input
              placeholder="args"
              value={p.snippetArgs}
              onChange={(e) => p.setSnippetArgs(e.target.value)}
              className="min-w-0 flex-1 rounded border px-1 font-mono"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-highlight)",
                color: "var(--fg)",
              }}
            />
            <button
              type="button"
              className="rounded bg-accent/15 px-1 text-accent"
              onClick={() => {
                if (!p.snippetLabel.trim()) return;
                const args = p.snippetArgs
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean);
                p.setCfg((c) => ({
                  ...c,
                  snippets: [
                    ...c.snippets,
                    {
                      id: `sn-${Date.now()}`,
                      label: p.snippetLabel.trim(),
                      command: p.snippetCmd.trim() || "npm",
                      args: args.length ? args : ["run", "dev"],
                      cwdRelative: p.snippetCwd.trim() || ".",
                    },
                  ],
                }));
                p.setSnippetLabel("");
              }}
            >
              +
            </button>
          </div>
          {p.cfg.snippets.map((sn) => (
            <button
              key={sn.id}
              type="button"
              disabled={!p.valid?.ok || p.busy !== null}
              className="mb-1 mr-1 rounded border px-2 py-0.5 text-[10px]"
              style={{ borderColor: "var(--glass-border)" }}
              onClick={() => {
                void (async () => {
                  const cwd = `${p.root.trim()}/${sn.cwdRelative}`;
                  const r = await p.api.runCommand({
                    command: sn.command,
                    args: sn.args,
                    cwd,
                  });
                  p.appendFromRun(sn.label, r);
                  p.pushHistory(`${sn.label}`);
                })();
              }}
            >
              {sn.label}
            </button>
          ))}
          <div className="launcher-thin-scroll mt-2 max-h-24 overflow-y-auto border-t border-[var(--glass-border)] pt-1 text-[9px] text-[color:var(--fg-muted)]">
            {p.cfg.commandHistory.map((h, i) => (
              <button
                key={`${i}-${h}`}
                type="button"
                className="mb-0.5 block w-full truncate text-left hover:text-accent"
                onClick={() =>
                  p.appendEntry(makeLogEntry("history", h, "debug"))
                }
              >
                {h}
              </button>
            ))}
          </div>
        </LauncherPanel>
      );

    default:
      return null;
  }
}
