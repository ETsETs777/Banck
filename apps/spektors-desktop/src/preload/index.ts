import { contextBridge, ipcRenderer } from "electron";

const api = {
  platform: process.platform,
  winMinimize: (): void => {
    ipcRenderer.send("win:minimize");
  },
  winMaximizeToggle: (): void => {
    ipcRenderer.send("win:maximize-toggle");
  },
  winClose: (): void => {
    ipcRenderer.send("win:close");
  },
  openDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:openDirectory"),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("shell:openExternal", url),
  openPath: (dir: string): Promise<string | null> =>
    ipcRenderer.invoke("shell:openPath", dir),
  probeUrl: (url: string): Promise<boolean> =>
    ipcRenderer.invoke("net:probeUrl", url),
  writeClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke("clipboard:writeText", text),
  readProfileFile: (): Promise<string | null> =>
    ipcRenderer.invoke("profile:readFile"),
  writeProfileFile: (json: string): Promise<void> =>
    ipcRenderer.invoke("profile:writeFile", json),
  validateProject: (
    root: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> =>
    ipcRenderer.invoke("project:validate", root),
  readEnv: (root: string): Promise<string> =>
    ipcRenderer.invoke("fs:readEnv", root),
  writeEnv: (root: string, content: string): Promise<void> =>
    ipcRenderer.invoke("fs:writeEnv", root, content),
  copyEnvExample: (root: string): Promise<void> =>
    ipcRenderer.invoke("fs:copyEnvExample", root),
  envExampleExists: (root: string): Promise<boolean> =>
    ipcRenderer.invoke("fs:envExampleExists", root),
  runCommand: (
    opts: { command: string; args: string[]; cwd: string },
  ): Promise<{ code: number | null; stdout: string; stderr: string }> =>
    ipcRenderer.invoke("run-command", opts),
  spawnBackground: (
    opts: { command: string; args: string[]; cwd: string },
  ): Promise<{ pid: number | null }> =>
    ipcRenderer.invoke("spawn-background", opts),
};

contextBridge.exposeInMainWorld("spektorsLauncher", api);
