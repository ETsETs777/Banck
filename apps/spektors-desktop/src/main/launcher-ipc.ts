import {
  app,
  dialog,
  ipcMain,
  type WebContents,
} from "electron";
import { randomUUID } from "node:crypto";
import {
  appendFile,
  readFile,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { spawnCmd } from "./spawn-utils";
import type {
  DockerContainerRow,
  DockerStatsRow,
  LauncherUserConfig,
} from "../shared/launcher-types";
import { DEFAULT_LAUNCHER_CONFIG } from "../shared/launcher-types";

function launcherConfigPath(): string {
  return path.join(app.getPath("userData"), "launcher.services.json");
}

function auditLogPath(): string {
  return path.join(app.getPath("userData"), "audit.log");
}

export async function auditLog(entry: Record<string, unknown>): Promise<void> {
  try {
    const line = JSON.stringify({
      ts: Date.now(),
      ...entry,
    });
    mkdirSync(path.dirname(auditLogPath()), { recursive: true });
    await appendFile(auditLogPath(), line + "\n", "utf-8");
  } catch {
    /* ignore */
  }
}

function mergeDefaults(cfg: Partial<LauncherUserConfig>): LauncherUserConfig {
  return {
    ...DEFAULT_LAUNCHER_CONFIG,
    ...cfg,
    services:
      cfg.services && cfg.services.length > 0
        ? cfg.services
        : DEFAULT_LAUNCHER_CONFIG.services,
    customServers: cfg.customServers ?? DEFAULT_LAUNCHER_CONFIG.customServers,
    snippets: cfg.snippets ?? DEFAULT_LAUNCHER_CONFIG.snippets,
    commandHistory: cfg.commandHistory ?? DEFAULT_LAUNCHER_CONFIG.commandHistory,
    activeEnv: cfg.activeEnv ?? DEFAULT_LAUNCHER_CONFIG.activeEnv,
    webhookUrl: cfg.webhookUrl ?? "",
    composeFile: cfg.composeFile,
    sidebarCardOrder:
      cfg.sidebarCardOrder && cfg.sidebarCardOrder.length > 0
        ? cfg.sidebarCardOrder
        : DEFAULT_LAUNCHER_CONFIG.sidebarCardOrder,
    pinnedSidebarCardId: cfg.pinnedSidebarCardId ?? null,
  };
}

type RunCmdResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
};

const DOCKER_CMD_TIMEOUT_MS = 120_000;
const DOCKER_COMPOSE_UP_TIMEOUT_MS = 300_000;
const GIT_CMD_TIMEOUT_MS = 90_000;

async function runCmd(
  command: string,
  args: string[],
  cwd: string,
  options?: { timeoutMs?: number },
): Promise<RunCmdResult> {
  const cwdResolved = path.resolve(cwd);
  return new Promise((resolve) => {
    const child = spawnCmd(command, args, cwdResolved);
    let stdout = "";
    let stderr = "";
    let settled = false;
    const settle = (r: RunCmdResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(r);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ms = options?.timeoutMs;
    if (ms != null && ms > 0) {
      timer = setTimeout(() => {
        try {
          child.kill("SIGTERM");
        } catch {
          /* */
        }
        settle({
          code: null,
          stdout,
          stderr: `${stderr}\n[launcher] превышено время ожидания (${ms} ms)`.trim(),
          timedOut: true,
        });
      }, ms);
    }
    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("close", (code) => {
      settle({ code, stdout, stderr });
    });
    child.on("error", (err) => {
      settle({ code: -1, stdout, stderr: stderr + String(err) });
    });
  });
}

function parseLauncherConfigJson(
  raw: string,
): Partial<LauncherUserConfig> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Partial<LauncherUserConfig>;
  } catch {
    return null;
  }
}

function sanitizeGitRef(branch: string): string | null {
  const b = branch.trim();
  if (!b || b.length > 280) return null;
  if (/[\r\n\0]/.test(b)) return null;
  return b;
}

function assertLauncherConfig(
  cfg: unknown,
): asserts cfg is LauncherUserConfig {
  if (cfg == null || typeof cfg !== "object" || Array.isArray(cfg)) {
    throw new Error("Invalid launcher config");
  }
}

const MAX_EXPORT_TEXT_BYTES = 32 * 1024 * 1024;

function mapDockerState(state: string, status: string): string {
  const s = (state || "").toLowerCase();
  const st = (status || "").toLowerCase();
  if (st.includes("restarting")) return "restarting";
  if (s === "running") return "running";
  if (s === "exited" || s === "dead") return "exited";
  return state || "unknown";
}

const logStreams = new Map<string, ChildProcess>();
const managedProcesses = new Map<string, ChildProcess>();

function spawnDetachedManaged(
  command: string,
  args: string[],
  cwd: string,
): ChildProcess {
  const cwdResolved = path.resolve(cwd);
  if (process.platform === "win32") {
    const quote = (s: string) =>
      /\s/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
    const line = [command, ...args].map(quote).join(" ");
    return spawn(line, {
      shell: true,
      cwd: cwdResolved,
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });
  }
  return spawn(command, args, {
    shell: false,
    cwd: cwdResolved,
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });
}

function sendSafe(contents: WebContents, channel: string, payload: unknown) {
  try {
    if (!contents.isDestroyed()) contents.send(channel, payload);
  } catch {
    /* */
  }
}

function composeArgs(composeFile: string | undefined, rest: string[]): string[] {
  const prefix = ["compose"];
  if (composeFile?.trim()) {
    prefix.push("-f", composeFile.trim());
  }
  return [...prefix, ...rest];
}

export function registerLauncherIpc(): void {
  ipcMain.handle(
    "launcher:getConfig",
    async (): Promise<LauncherUserConfig> => {
      try {
        const raw = await readFile(launcherConfigPath(), "utf-8");
        const parsed = parseLauncherConfigJson(raw);
        if (!parsed) return { ...DEFAULT_LAUNCHER_CONFIG };
        return mergeDefaults(parsed);
      } catch {
        return { ...DEFAULT_LAUNCHER_CONFIG };
      }
    },
  );

  ipcMain.handle(
    "launcher:setConfig",
    async (_e, cfg: LauncherUserConfig) => {
      assertLauncherConfig(cfg);
      mkdirSync(path.dirname(launcherConfigPath()), { recursive: true });
      await writeFile(
        launcherConfigPath(),
        JSON.stringify(cfg, null, 2),
        "utf-8",
      );
      void auditLog({ action: "launcher.config.save" });
    },
  );

  ipcMain.handle(
    "docker:composePs",
    async (
      _e,
      root: string,
      composeFile?: string,
    ): Promise<{ ok: boolean; containers: DockerContainerRow[]; error?: string }> => {
      const cwd = path.resolve(root);
      const r = await runCmd(
        "docker",
        composeArgs(composeFile, ["ps", "-a", "--format", "json"]),
        cwd,
        { timeoutMs: DOCKER_CMD_TIMEOUT_MS },
      );
      const text = (r.stdout || "").trim();
      if (r.timedOut) {
        return {
          ok: false,
          containers: [],
          error: r.stderr || "docker compose ps: timeout",
        };
      }
      if (r.code !== 0 && !text) {
        return {
          ok: false,
          containers: [],
          error: (r.stderr || r.stdout || "docker compose ps failed").trim(),
        };
      }
      const rows: DockerContainerRow[] = [];
      try {
        if (text.startsWith("[")) {
          const arr = JSON.parse(text) as Record<string, unknown>[];
          for (const item of arr) {
            const name = String(item["Name"] ?? item["name"] ?? "");
            const service = String(item["Service"] ?? item["service"] ?? "");
            const state = String(item["State"] ?? item["state"] ?? "");
            const status = String(item["Status"] ?? item["status"] ?? "");
            const health = item["Health"] != null ? String(item["Health"]) : undefined;
            rows.push({
              name: name || service,
              service: service || name,
              state: mapDockerState(state, status),
              status,
              health,
            });
          }
        } else {
          for (const line of text.split("\n")) {
            const t = line.trim();
            if (!t) continue;
            try {
              const item = JSON.parse(t) as Record<string, unknown>;
              const name = String(item["Name"] ?? "");
              const service = String(item["Service"] ?? "");
              const state = String(item["State"] ?? "");
              const status = String(item["Status"] ?? "");
              rows.push({
                name,
                service,
                state: mapDockerState(state, status),
                status,
              });
            } catch {
              /* skip line */
            }
          }
        }
      } catch {
        return { ok: false, containers: [], error: "Failed to parse docker compose ps JSON" };
      }
      return { ok: true, containers: rows };
    },
  );

  ipcMain.handle(
    "docker:composeRestart",
    async (
      _e,
      opts: { root: string; service?: string; composeFile?: string },
    ) => {
      const cwd = path.resolve(opts.root);
      const tail =
        opts.service && opts.service.length > 0
          ? ["restart", opts.service]
          : ["restart"];
      const r = await runCmd(
        "docker",
        composeArgs(opts.composeFile, tail),
        cwd,
        { timeoutMs: DOCKER_CMD_TIMEOUT_MS },
      );
      void auditLog({
        action: "docker.restart",
        service: opts.service ?? "*all*",
        code: r.code,
      });
      return r;
    },
  );

  ipcMain.handle(
    "docker:composeUp",
    async (
      _e,
      opts: { root: string; composeFile?: string },
    ): Promise<{ code: number | null; stdout: string; stderr: string }> => {
      const cwd = path.resolve(opts.root);
      const r = await runCmd(
        "docker",
        composeArgs(opts.composeFile, ["up", "-d"]),
        cwd,
        { timeoutMs: DOCKER_COMPOSE_UP_TIMEOUT_MS },
      );
      void auditLog({ action: "docker.up", code: r.code, timedOut: r.timedOut });
      return r;
    },
  );

  ipcMain.handle(
    "docker:stats",
    async (_e, root: string, composeFile?: string): Promise<DockerStatsRow[]> => {
      const cwd = path.resolve(root);
      const namesR = await runCmd(
        "docker",
        composeArgs(composeFile, ["ps", "-a", "--format", "{{.Name}}"]),
        cwd,
        { timeoutMs: DOCKER_CMD_TIMEOUT_MS },
      );
      const names = namesR.stdout
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (names.length === 0) return [];
      const st = await runCmd(
        "docker",
        [
          "stats",
          "--no-stream",
          "--format",
          "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}",
          ...names,
        ],
        cwd,
        { timeoutMs: DOCKER_CMD_TIMEOUT_MS },
      );
      if (st.code !== 0) return [];
      const out: DockerStatsRow[] = [];
      for (const line of st.stdout.split("\n")) {
        const parts = line.split("|");
        if (parts.length < 3) continue;
        const name = parts[0]?.trim() ?? "";
        const cpuStr = parts[1]?.replace("%", "").trim() ?? "0";
        const memRaw = parts[2]?.trim() ?? "";
        const cpuPercent = Number.parseFloat(cpuStr) || 0;
        const memMatch = memRaw.match(
          /^([\d.]+)\s*([KMGT]?i?B?)\s*\/\s*([\d.]+)\s*([KMGT]?i?B?)/i,
        );
        let memMb = 0;
        let memLimitMb: number | null = null;
        if (memMatch) {
          const toMb = (n: string, u: string) => {
            const v = Number.parseFloat(n) || 0;
            const up = u.toUpperCase();
            if (up.startsWith("G")) return v * 1024;
            if (up.startsWith("M") || up === "MIB") return v;
            if (up.startsWith("K")) return v / 1024;
            return v / (1024 * 1024);
          };
          memMb = toMb(memMatch[1], memMatch[2]);
          memLimitMb = toMb(memMatch[3], memMatch[4]);
        }
        out.push({ name, cpuPercent, memMb, memLimitMb });
      }
      return out;
    },
  );

  ipcMain.handle("git:meta", async (_e, root: string) => {
    const cwd = path.resolve(root);
    const branchR = await runCmd(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      cwd,
      { timeoutMs: GIT_CMD_TIMEOUT_MS },
    );
    const branch = branchR.code === 0 ? branchR.stdout.trim() : "";
    const st = await runCmd(
      "git",
      ["status", "--porcelain"],
      cwd,
      { timeoutMs: GIT_CMD_TIMEOUT_MS },
    );
    const dirty = st.code === 0 && st.stdout.trim().length > 0;
    return { branch, dirty, statusOutput: st.stdout };
  });

  ipcMain.handle("git:branches", async (_e, root: string): Promise<string[]> => {
    const cwd = path.resolve(root);
    const r = await runCmd(
      "git",
      ["branch", "-a", "--format=%(refname:short)"],
      cwd,
      { timeoutMs: GIT_CMD_TIMEOUT_MS },
    );
    if (r.code !== 0) return [];
    const set = new Set<string>();
    for (const line of r.stdout.split("\n")) {
      const b = line.trim();
      if (!b || b === "HEAD") continue;
      set.add(b.replace(/^remotes\/[^/]+\//, ""));
    }
    return [...set].sort();
  });

  ipcMain.handle("git:checkout", async (_e, root: string, branch: string) => {
    const cwd = path.resolve(root);
    const safe = sanitizeGitRef(branch);
    if (!safe) {
      return {
        code: -1 as const,
        stdout: "",
        stderr: "Некорректное имя ветки",
      };
    }
    const r = await runCmd(
      "git",
      ["checkout", safe],
      cwd,
      { timeoutMs: GIT_CMD_TIMEOUT_MS },
    );
    void auditLog({ action: "git.checkout", branch: safe, code: r.code });
    return r;
  });

  ipcMain.handle("git:pull", async (_e, root: string) => {
    const cwd = path.resolve(root);
    const r = await runCmd(
      "git",
      ["pull"],
      cwd,
      { timeoutMs: GIT_CMD_TIMEOUT_MS },
    );
    void auditLog({ action: "git.pull", code: r.code });
    return r;
  });

  ipcMain.handle("git:status", async (_e, root: string) => {
    const cwd = path.resolve(root);
    return runCmd(
      "git",
      ["status", "-sb"],
      cwd,
      { timeoutMs: GIT_CMD_TIMEOUT_MS },
    );
  });

  ipcMain.handle(
    "dialog:saveTextFile",
    async (_e, defaultName: string, content: string) => {
      if (typeof content !== "string") {
        return { ok: false as const, error: "invalid content" };
      }
      if (content.length > MAX_EXPORT_TEXT_BYTES) {
        void auditLog({
          action: "export.log",
          rejected: "too_large",
          bytes: content.length,
        });
        return { ok: false as const, error: "file too large" };
      }
      const r = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: [{ name: "Log", extensions: ["log", "txt"] }],
      });
      if (r.canceled || !r.filePath) return { ok: false as const };
      await writeFile(r.filePath, content, "utf-8");
      void auditLog({ action: "export.log", path: r.filePath });
      return { ok: true as const, path: r.filePath };
    },
  );

  ipcMain.handle(
    "fs:backupEnv",
    async (_e, root: string) => {
      const r = path.resolve(root);
      const envPath = path.join(r, ".env");
      if (!existsSync(envPath)) return { ok: false as const };
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const dest = path.join(app.getPath("userData"), `env-backup-${stamp}.env`);
      await copyFile(envPath, dest);
      void auditLog({ action: "env.backup", dest });
      return { ok: true as const, path: dest };
    },
  );

  ipcMain.handle(
    "process:spawnStream",
    async (
      event,
      opts: { command: string; args: string[]; cwd: string },
    ): Promise<{ id: string }> => {
      if (typeof opts?.command !== "string" || !opts.command.trim()) {
        throw new Error("Invalid command");
      }
      if (typeof opts?.cwd !== "string" || !opts.cwd.trim()) {
        throw new Error("Invalid working directory");
      }
      const cwdResolved = path.resolve(opts.cwd.trim());
      if (!existsSync(cwdResolved)) {
        throw new Error("Working directory does not exist");
      }
      const id = randomUUID();
      const child = spawnCmd(opts.command, opts.args ?? [], cwdResolved);
      logStreams.set(id, child);
      const wc = event.sender;
      child.stdout?.on("data", (d: Buffer) => {
        sendSafe(wc, "launcher:streamChunk", {
          id,
          chunk: d.toString(),
          stream: "stdout" as const,
        });
      });
      child.stderr?.on("data", (d: Buffer) => {
        sendSafe(wc, "launcher:streamChunk", {
          id,
          chunk: d.toString(),
          stream: "stderr" as const,
        });
      });
      child.on("close", (code) => {
        logStreams.delete(id);
        sendSafe(wc, "launcher:streamEnd", { id, code });
      });
      child.on("error", (err) => {
        logStreams.delete(id);
        sendSafe(wc, "launcher:streamEnd", {
          id,
          code: -1,
          error: String(err),
        });
      });
      void auditLog({
        action: "process.stream.start",
        cmd: opts.command,
        args: opts.args,
      });
      return { id };
    },
  );

  ipcMain.handle("process:stopStream", async (_e, id: string) => {
    const ch = logStreams.get(id);
    if (ch) {
      try {
        ch.kill("SIGTERM");
      } catch {
        /* */
      }
      logStreams.delete(id);
      void auditLog({ action: "process.stream.stop", id });
    }
    return { ok: true };
  });

  ipcMain.handle(
    "process:spawnManaged",
    async (
      _e,
      opts: { command: string; args: string[]; cwd: string },
    ): Promise<{ id: string; pid: number | null }> => {
      if (typeof opts?.command !== "string" || !opts.command.trim()) {
        throw new Error("Invalid command");
      }
      if (typeof opts?.cwd !== "string" || !opts.cwd.trim()) {
        throw new Error("Invalid working directory");
      }
      const cwdResolved = path.resolve(opts.cwd.trim());
      if (!existsSync(cwdResolved)) {
        throw new Error("Working directory does not exist");
      }
      const id = randomUUID();
      const child = spawnDetachedManaged(
        opts.command,
        opts.args ?? [],
        cwdResolved,
      );
      child.unref();
      managedProcesses.set(id, child);
      void auditLog({
        action: "process.managed.start",
        id,
        cmd: opts.command,
      });
      return { id, pid: child.pid ?? null };
    },
  );

  ipcMain.handle("process:killManaged", async (_e, id: string) => {
    const ch = managedProcesses.get(id);
    if (ch) {
      try {
        ch.kill("SIGTERM");
      } catch {
        /* */
      }
      managedProcesses.delete(id);
      void auditLog({ action: "process.managed.kill", id });
    }
    return { ok: true };
  });

  ipcMain.handle(
    "net:webhookNotify",
    async (_e, url: string, body: string) => {
      try {
        const u = new URL(url);
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          return { ok: false, error: "invalid protocol" };
        }
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body,
        });
        return { ok: res.ok, status: res.status };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
  );

  ipcMain.handle("tools:which", async (_e, name: string) => {
    const r = await runCmd(
      process.platform === "win32" ? "where" : "which",
      [name],
      process.cwd(),
      { timeoutMs: 15_000 },
    );
    if (r.code !== 0) return { found: false, path: "" };
    return { found: true, path: r.stdout.trim().split("\n")[0] ?? "" };
  });
}
