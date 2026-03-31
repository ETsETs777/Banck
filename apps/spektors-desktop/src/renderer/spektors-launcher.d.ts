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
  readEnv: (root: string) => Promise<string>;
  writeEnv: (root: string, content: string) => Promise<void>;
  copyEnvExample: (root: string) => Promise<void>;
  envExampleExists: (root: string) => Promise<boolean>;
  runCommand: (opts: RunCommandOpts) => Promise<RunCommandResult>;
  spawnBackground: (opts: RunCommandOpts) => Promise<{ pid: number | null }>;
};

declare global {
  interface Window {
    /** Present only in Electron (preload). */
    spektorsLauncher?: SpektorsLauncherAPI;
  }
}

export {};
