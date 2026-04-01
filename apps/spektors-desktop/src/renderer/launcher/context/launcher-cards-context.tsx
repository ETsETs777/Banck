import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type {
  DockerContainerRow,
  LauncherEnvProfile,
  LauncherUserConfig,
  LogEntry,
} from "../../shared/launcher-types";
import type { SidebarCardId } from "../utils/sidebar-card-order";
import type { SpektorsLauncherAPI } from "../../spektors-launcher";

export type LauncherCardsValue = {
  api: SpektorsLauncherAPI;
  root: string;
  setRoot: Dispatch<SetStateAction<string>>;
  cfg: LauncherUserConfig;
  setCfg: Dispatch<SetStateAction<LauncherUserConfig>>;
  valid: { ok: boolean; reason?: string } | null;
  envText: string;
  setEnvText: Dispatch<SetStateAction<string>>;
  envDirty: boolean;
  setEnvDirty: Dispatch<SetStateAction<boolean>>;
  hasEnvExample: boolean;
  busy: string | null;
  setBusy: Dispatch<SetStateAction<string | null>>;
  reach: Record<string, boolean | null>;
  probing: boolean;
  recentRoots: string[];
  gitBranch: string;
  gitDirty: boolean;
  branches: string[];
  branchPick: string;
  setBranchPick: Dispatch<SetStateAction<string>>;
  alembicHead: string | null;
  toolDocker: string | null;
  toolGit: string | null;
  newSvcLabel: string;
  setNewSvcLabel: Dispatch<SetStateAction<string>>;
  newSvcUrl: string;
  setNewSvcUrl: Dispatch<SetStateAction<string>>;
  newServerName: string;
  setNewServerName: Dispatch<SetStateAction<string>>;
  newServerCwd: string;
  setNewServerCwd: Dispatch<SetStateAction<string>>;
  newServerCmd: string;
  setNewServerCmd: Dispatch<SetStateAction<string>>;
  newServerArgs: string;
  setNewServerArgs: Dispatch<SetStateAction<string>>;
  managedRunning: Record<string, { procId: string; name: string }>;
  setManagedRunning: Dispatch<
    SetStateAction<Record<string, { procId: string; name: string }>>
  >;
  snippetLabel: string;
  setSnippetLabel: Dispatch<SetStateAction<string>>;
  snippetCmd: string;
  setSnippetCmd: Dispatch<SetStateAction<string>>;
  snippetArgs: string;
  setSnippetArgs: Dispatch<SetStateAction<string>>;
  snippetCwd: string;
  setSnippetCwd: Dispatch<SetStateAction<string>>;
  dockerErr: string | null;
  containers: DockerContainerRow[];
  stats: Awaited<ReturnType<SpektorsLauncherAPI["dockerStats"]>>;
  logTailId: string | null;
  appendEntry: (e: LogEntry) => void;
  appendFromRun: (
    source: string,
    r: { code: number | null; stdout: string; stderr: string },
  ) => void;
  pushHistory: (line: string) => void;
  persistCfg: () => Promise<void>;
  pickFolder: () => Promise<void>;
  saveEnv: () => Promise<void>;
  loadEnv: () => Promise<void>;
  refreshGit: () => Promise<void>;
  refreshDocker: () => Promise<void>;
  refreshAlembic: () => Promise<void>;
  runProbeAll: () => Promise<void>;
  runDocker: (label: string, args: string[]) => Promise<void>;
  startTail: (service: string) => Promise<void>;
  stopTail: () => Promise<void>;
  restartAllConfirm: () => Promise<void>;
  containerByCompose: (name?: string) => DockerContainerRow | undefined;
  setEnvProfile: (p: LauncherEnvProfile) => void;
  base: string[];
  openExpandedCard: (id: SidebarCardId) => void;
  applyProjectRoot: (dir: string) => void;
};

const LauncherCardsContext = createContext<LauncherCardsValue | null>(null);

export function LauncherCardsProvider(props: {
  value: LauncherCardsValue;
  children: ReactNode;
}) {
  return (
    <LauncherCardsContext.Provider value={props.value}>
      {props.children}
    </LauncherCardsContext.Provider>
  );
}

export function useLauncherCards(): LauncherCardsValue {
  const v = useContext(LauncherCardsContext);
  if (!v) throw new Error("useLauncherCards: no provider");
  return v;
}
