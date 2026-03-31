import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  type IpcMainEvent,
} from "electron";
import http from "node:http";
import https from "node:https";
import { access, copyFile, readFile, writeFile } from "node:fs/promises";
import {
  constants as fsConstants,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function windowStatePath(): string {
  return path.join(app.getPath("userData"), "window-bounds.json");
}

function profileFilePath(): string {
  return path.join(app.getPath("userData"), "spektors-profile.json");
}

function loadWindowBounds(): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  try {
    const raw = readFileSync(windowStatePath(), "utf-8");
    const d = JSON.parse(raw) as Partial<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    if (
      typeof d.width === "number" &&
      typeof d.height === "number" &&
      d.width >= 400 &&
      d.height >= 400
    ) {
      return {
        x: typeof d.x === "number" ? d.x : 0,
        y: typeof d.y === "number" ? d.y : 0,
        width: d.width,
        height: d.height,
      };
    }
  } catch {
    /* no state */
  }
  return null;
}

function saveWindowBounds(win: BrowserWindow): void {
  try {
    mkdirSync(path.dirname(windowStatePath()), { recursive: true });
    writeFileSync(
      windowStatePath(),
      JSON.stringify(win.getBounds()),
      "utf-8",
    );
  } catch {
    /* ignore */
  }
}

function probeUrl(targetUrl: string, timeoutMs = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: boolean) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    try {
      const u = new URL(targetUrl);
      const lib = u.protocol === "https:" ? https : http;
      const req = lib.request(
        targetUrl,
        { method: "GET", timeout: timeoutMs },
        (res) => {
          res.resume();
          done(true);
        },
      );
      req.on("error", () => done(false));
      req.on("timeout", () => {
        req.destroy();
        done(false);
      });
      req.end();
    } catch {
      done(false);
    }
  });
}

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
  const js = `${base}.js`;
  const chosen = existsSync(mjs) ? mjs : js;
  return path.resolve(chosen);
}

function loadWindowIcon(): Electron.NativeImage | undefined {
  const png = path.resolve(__dirname, "../../resources/app-icon.png");
  if (!existsSync(png)) return undefined;
  try {
    const img = nativeImage.createFromPath(png);
    return img.isEmpty() ? undefined : img;
  } catch {
    return undefined;
  }
}

function stripWindowMenu(win: BrowserWindow): void {
  if (os.platform() === "darwin") return;
  try {
    win.removeMenu();
    win.setAutoHideMenuBar(true);
    win.setMenuBarVisibility(false);
  } catch {
    /* */
  }
}

function createWindow(): void {
  const saved = loadWindowBounds();
  const preloadAbs = preloadPath();
  if (!existsSync(preloadAbs)) {
    console.error(
      "[spektors-desktop] Preload script not found:",
      preloadAbs,
      "__dirname",
      __dirname,
    );
  } else {
    console.log("[spektors-desktop] preload:", preloadAbs);
  }
  /** Без рамки везде, кроме macOS: убираем меню File/Edit и нативную шапку — своя полоса в renderer. */
  const platform = os.platform();
  const forceOsFrame = process.env["SPEKTORS_USE_OS_FRAME"] === "1";
  const frameless = platform !== "darwin" && !forceOsFrame;
  const icon = loadWindowIcon();

  const win = new BrowserWindow({
    width: saved?.width ?? 1000,
    height: saved?.height ?? 740,
    x: saved?.x,
    y: saved?.y,
    minWidth: 820,
    minHeight: 560,
    title: "Spektors Launcher",
    backgroundColor: "#0b0d12",
    frame: !frameless,
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: preloadAbs,
      contextIsolation: true,
      nodeIntegration: false,
      // Sandboxed preload + ESM often breaks contextBridge; keep off for this dev tool.
      sandbox: false,
    },
  });

  console.log("[spektors-desktop] window:", {
    platform,
    frameless,
    browserFrame: !frameless,
  });

  stripWindowMenu(win);
  win.once("ready-to-show", () => stripWindowMenu(win));
  win.webContents.once("did-finish-load", () => stripWindowMenu(win));

  win.on("close", () => saveWindowBounds(win));

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void (async () => {
      const delay = (ms: number) =>
        new Promise<void>((r) => setTimeout(r, ms));
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline && !(await probeUrl(devUrl, 3000))) {
        await delay(400);
      }
      for (let i = 0; i < 30; i++) {
        try {
          await win.loadURL(devUrl);
          return;
        } catch {
          await delay(300);
        }
      }
      try {
        await win.loadURL(devUrl);
      } catch {
        /* окно остаётся — можно Reload */
      }
    })();
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.on("browser-window-created", (_, window) => {
  stripWindowMenu(window);
});

app.on("will-finish-launching", () => {
  if (os.platform() !== "darwin") {
    Menu.setApplicationMenu(null);
  }
});

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
          ],
        },
      ]),
    );
  } else {
    Menu.setApplicationMenu(null);
  }
  createWindow();
  if (process.platform === "darwin") {
    const dockIcon = loadWindowIcon();
    if (dockIcon) app.dock.setIcon(dockIcon);
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function windowFromIpc(e: IpcMainEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(e.sender);
}

ipcMain.on("win:minimize", (e) => {
  windowFromIpc(e)?.minimize();
});

ipcMain.on("win:maximize-toggle", (e) => {
  const w = windowFromIpc(e);
  if (!w) return;
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
});

ipcMain.on("win:close", (e) => {
  windowFromIpc(e)?.close();
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

ipcMain.handle("shell:openPath", async (_e, dir: string) => {
  const resolved = path.resolve(dir);
  const err = await shell.openPath(resolved);
  return err || null;
});

ipcMain.handle("net:probeUrl", async (_e, url: string) => {
  return probeUrl(url);
});

ipcMain.handle("clipboard:writeText", async (_e, text: string) => {
  clipboard.writeText(text);
});

ipcMain.handle("profile:readFile", async (): Promise<string | null> => {
  try {
    return await readFile(profileFilePath(), "utf-8");
  } catch {
    return null;
  }
});

ipcMain.handle("profile:writeFile", async (_e, json: string) => {
  mkdirSync(path.dirname(profileFilePath()), { recursive: true });
  await writeFile(profileFilePath(), json, "utf-8");
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
