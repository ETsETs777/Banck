import { contextBridge, ipcRenderer } from "electron";
import type {
  DockerContainerRow,
  DockerStatsRow,
  LauncherUserConfig,
} from "../shared/launcher-types";

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
  detectProjectRoot: (): Promise<string | null> =>
    ipcRenderer.invoke("project:detectRoot"),
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
  getLauncherConfig: (): Promise<LauncherUserConfig> =>
    ipcRenderer.invoke("launcher:getConfig"),
  setLauncherConfig: (cfg: LauncherUserConfig): Promise<void> =>
    ipcRenderer.invoke("launcher:setConfig", cfg),
  dockerComposePs: (
    root: string,
    composeFile?: string,
  ): Promise<{
    ok: boolean;
    containers: DockerContainerRow[];
    error?: string;
  }> => ipcRenderer.invoke("docker:composePs", root, composeFile),
  dockerComposeRestart: (opts: {
    root: string;
    service?: string;
    composeFile?: string;
  }): Promise<{ code: number | null; stdout: string; stderr: string }> =>
    ipcRenderer.invoke("docker:composeRestart", opts),
  dockerComposeUp: (opts: {
    root: string;
    composeFile?: string;
  }): Promise<{ code: number | null; stdout: string; stderr: string }> =>
    ipcRenderer.invoke("docker:composeUp", opts),
  dockerStats: (root: string, composeFile?: string): Promise<DockerStatsRow[]> =>
    ipcRenderer.invoke("docker:stats", root, composeFile),
  gitMeta: (
    root: string,
  ): Promise<{ branch: string; dirty: boolean; statusOutput: string }> =>
    ipcRenderer.invoke("git:meta", root),
  gitBranches: (root: string): Promise<string[]> =>
    ipcRenderer.invoke("git:branches", root),
  gitCheckout: (
    root: string,
    branch: string,
  ): Promise<{ code: number | null; stdout: string; stderr: string }> =>
    ipcRenderer.invoke("git:checkout", root, branch),
  gitPull: (
    root: string,
  ): Promise<{ code: number | null; stdout: string; stderr: string }> =>
    ipcRenderer.invoke("git:pull", root),
  gitStatus: (
    root: string,
  ): Promise<{ code: number | null; stdout: string; stderr: string }> =>
    ipcRenderer.invoke("git:status", root),
  saveTextFile: (
    defaultName: string,
    content: string,
  ): Promise<
    { ok: true; path: string } | { ok: false; error?: string }
  > => ipcRenderer.invoke("dialog:saveTextFile", defaultName, content),
  backupEnv: (
    root: string,
  ): Promise<{ ok: true; path: string } | { ok: false }> =>
    ipcRenderer.invoke("fs:backupEnv", root),
  spawnLogStream: (
    opts: { command: string; args: string[]; cwd: string },
  ): Promise<{ id: string }> =>
    ipcRenderer.invoke("process:spawnStream", opts),
  stopLogStream: (id: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("process:stopStream", id),
  spawnManaged: (
    opts: { command: string; args: string[]; cwd: string },
  ): Promise<{ id: string; pid: number | null }> =>
    ipcRenderer.invoke("process:spawnManaged", opts),
  killManaged: (id: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("process:killManaged", id),
  webhookNotify: (
    url: string,
    body: string,
  ): Promise<{ ok: boolean; status?: number; error?: string }> =>
    ipcRenderer.invoke("net:webhookNotify", url, body),
  which: (name: string): Promise<{ found: boolean; path: string }> =>
    ipcRenderer.invoke("tools:which", name),
  onStreamChunk: (
    handler: (payload: {
      id: string;
      chunk: string;
      stream: "stdout" | "stderr";
    }) => void,
  ): () => void => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      payload: { id: string; chunk: string; stream: "stdout" | "stderr" },
    ): void => {
      handler(payload);
    };
    ipcRenderer.on("launcher:streamChunk", listener);
    return () => {
      ipcRenderer.removeListener("launcher:streamChunk", listener);
    };
  },
  onStreamEnd: (
    handler: (payload: {
      id: string;
      code: number | null;
      error?: string;
    }) => void,
  ): () => void => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      payload: { id: string; code: number | null; error?: string },
    ): void => {
      handler(payload);
    };
    ipcRenderer.on("launcher:streamEnd", listener);
    return () => {
      ipcRenderer.removeListener("launcher:streamEnd", listener);
    };
  },
};

contextBridge.exposeInMainWorld("spektorsLauncher", api);
