import type {
  DockerContainerRow,
  DockerStatsRow,
  LauncherUserConfig,
} from "../shared/launcher-types";

export type RunCommandOpts = {
  command: string;
  args: string[];
  cwd: string;
};

export type RunCommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

export type ValidateResult = { ok: true } | { ok: false; reason: string };

export type StreamChunkPayload = {
  id: string;
  chunk: string;
  stream: "stdout" | "stderr";
};

export type StreamEndPayload = {
  id: string;
  code: number | null;
  error?: string;
};

export type SpektorsLauncherAPI = {
  platform: NodeJS.Platform;
  winMinimize: () => void;
  winMaximizeToggle: () => void;
  winClose: () => void;
  openDirectory: () => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
  openPath: (dir: string) => Promise<string | null>;
  probeUrl: (url: string) => Promise<boolean>;
  writeClipboard: (text: string) => Promise<void>;
  readProfileFile: () => Promise<string | null>;
  writeProfileFile: (json: string) => Promise<void>;
  validateProject: (root: string) => Promise<ValidateResult>;
  /** Авто-поиск корня монорепо (cwd, каталог exe, родители out/main). */
  detectProjectRoot: () => Promise<string | null>;
  readEnv: (root: string) => Promise<string>;
  writeEnv: (root: string, content: string) => Promise<void>;
  copyEnvExample: (root: string) => Promise<void>;
  envExampleExists: (root: string) => Promise<boolean>;
  runCommand: (opts: RunCommandOpts) => Promise<RunCommandResult>;
  spawnBackground: (opts: RunCommandOpts) => Promise<{ pid: number | null }>;
  getLauncherConfig: () => Promise<LauncherUserConfig>;
  setLauncherConfig: (cfg: LauncherUserConfig) => Promise<void>;
  dockerComposePs: (
    root: string,
    composeFile?: string,
  ) => Promise<{
    ok: boolean;
    containers: DockerContainerRow[];
    error?: string;
  }>;
  dockerComposeRestart: (opts: {
    root: string;
    service?: string;
    composeFile?: string;
  }) => Promise<RunCommandResult>;
  dockerComposeUp: (opts: {
    root: string;
    composeFile?: string;
  }) => Promise<RunCommandResult>;
  dockerStats: (root: string, composeFile?: string) => Promise<DockerStatsRow[]>;
  gitMeta: (root: string) => Promise<{
    branch: string;
    dirty: boolean;
    statusOutput: string;
  }>;
  gitBranches: (root: string) => Promise<string[]>;
  gitCheckout: (root: string, branch: string) => Promise<RunCommandResult>;
  gitPull: (root: string) => Promise<RunCommandResult>;
  gitStatus: (root: string) => Promise<RunCommandResult>;
  saveTextFile: (
    defaultName: string,
    content: string,
  ) => Promise<
    { ok: true; path: string } | { ok: false; error?: string }
  >;
  backupEnv: (
    root: string,
  ) => Promise<{ ok: true; path: string } | { ok: false }>;
  spawnLogStream: (opts: RunCommandOpts) => Promise<{ id: string }>;
  stopLogStream: (id: string) => Promise<{ ok: boolean }>;
  spawnManaged: (
    opts: RunCommandOpts,
  ) => Promise<{ id: string; pid: number | null }>;
  killManaged: (id: string) => Promise<{ ok: boolean }>;
  webhookNotify: (
    url: string,
    body: string,
  ) => Promise<{ ok: boolean; status?: number; error?: string }>;
  which: (name: string) => Promise<{ found: boolean; path: string }>;
  onStreamChunk: (handler: (payload: StreamChunkPayload) => void) => () => void;
  onStreamEnd: (handler: (payload: StreamEndPayload) => void) => () => void;
};

declare global {
  interface Window {
    spektorsLauncher?: SpektorsLauncherAPI;
  }
}

export {};
