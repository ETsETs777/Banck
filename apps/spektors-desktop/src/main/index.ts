import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  shell,
} from "electron";
import { access, copyFile, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants, existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function spawnCmd(command: string, args: string[], cwd: string): ChildProcess {
  const cwdResolved = path.resolve(cwd);
  if (process.platform === "win32") {
    const quote = (s: string) =>
      /\s/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
    const line = [command, ...args].map(quote).join(" ");
    return spawn(line, {
      shell: true,
      cwd: cwdResolved,
      env: { ...process.env },
    });
  }
  return spawn(command, args, {
    shell: false,
    cwd: cwdResolved,
    env: { ...process.env },
  });
}

function preloadPath(): string {
  const base = path.join(__dirname, "../preload/index");
  const mjs = `${base}.mjs`;
  if (existsSync(mjs)) return mjs;
  return `${base}.js`;
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: "Spektors Launcher",
    backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("dialog:openDirectory", async () => {
  const r = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
});

ipcMain.handle("shell:openExternal", async (_e, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle("clipboard:writeText", async (_e, text: string) => {
  clipboard.writeText(text);
});

ipcMain.handle("project:validate", async (_e, root: string) => {
  const r = path.resolve(root);
  const pkg = path.join(r, "package.json");
  const dc = path.join(r, "docker-compose.yml");
  const api = path.join(r, "apps", "api");
  try {
    await access(pkg, fsConstants.R_OK);
    await access(dc, fsConstants.R_OK);
    await access(api, fsConstants.R_OK);
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      reason:
        "Ожидается корень монорепо Spektors: package.json, docker-compose.yml, apps/api.",
    };
  }
});

ipcMain.handle("fs:readEnv", async (_e, root: string) => {
  const p = path.join(path.resolve(root), ".env");
  try {
    return await readFile(p, "utf-8");
  } catch {
    return "";
  }
});

ipcMain.handle("fs:writeEnv", async (_e, root: string, content: string) => {
  const p = path.join(path.resolve(root), ".env");
  await writeFile(p, content, "utf-8");
});

ipcMain.handle("fs:copyEnvExample", async (_e, root: string) => {
  const r = path.resolve(root);
  const ex = path.join(r, ".env.example");
  const env = path.join(r, ".env");
  await copyFile(ex, env);
});

ipcMain.handle(
  "fs:envExampleExists",
  async (_e, root: string): Promise<boolean> => {
    try {
      await access(path.join(path.resolve(root), ".env.example"), fsConstants.R_OK);
      return true;
    } catch {
      return false;
    }
  },
);

ipcMain.handle(
  "run-command",
  async (
    _e,
    opts: { command: string; args: string[]; cwd: string },
  ): Promise<{ code: number | null; stdout: string; stderr: string }> => {
    const cwd = path.resolve(opts.cwd);
    return new Promise((resolve) => {
      const child = spawnCmd(opts.command, opts.args, cwd);
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr?.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      child.on("close", (code) => {
        resolve({ code, stdout, stderr });
      });
      child.on("error", (err) => {
        resolve({ code: -1, stdout, stderr: stderr + String(err) });
      });
    });
  },
);

ipcMain.handle(
  "spawn-background",
  (
    _e,
    opts: { command: string; args: string[]; cwd: string },
  ): { pid: number | null } => {
    const cwdResolved = path.resolve(opts.cwd);
    if (process.platform === "win32") {
      const quote = (s: string) =>
        /\s/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
      const line = [opts.command, ...opts.args].map(quote).join(" ");
      const child = spawn(line, {
        shell: true,
        cwd: cwdResolved,
        detached: true,
        stdio: "ignore",
        env: { ...process.env },
      });
      child.unref();
      return { pid: child.pid ?? null };
    }
    const child = spawn(opts.command, opts.args, {
      shell: false,
      cwd: cwdResolved,
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });
    child.unref();
    return { pid: child.pid ?? null };
  },
);
