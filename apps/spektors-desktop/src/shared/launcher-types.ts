/** Shared launcher domain types (mirrored loosely in main/renderer). */

export type LogLevel = "error" | "warning" | "info" | "debug";

export type LogEntry = {
  id: string;
  ts: number;
  source: string;
  level: LogLevel;
  raw: string;
};

export type ServiceKind = "http" | "docker";

export type LauncherServiceDef = {
  id: string;
  label: string;
  url: string;
  kind: ServiceKind;
  /** docker compose service name if applicable */
  composeService?: string;
};

export type HttpReachState = "unknown" | "up" | "down" | "restarting" | "error";

export type CustomServerDef = {
  id: string;
  name: string;
  cwdRelative: string;
  command: string;
  args: string[];
};

export type CommandSnippet = {
  id: string;
  label: string;
  command: string;
  args: string[];
  cwdRelative: string;
};

export type LauncherEnvProfile = "dev" | "staging" | "prod";

export type LauncherUserConfig = {
  services: LauncherServiceDef[];
  customServers: CustomServerDef[];
  snippets: CommandSnippet[];
  commandHistory: string[];
  activeEnv: LauncherEnvProfile;
  /** optional Telegram / webhook URL for service-down alerts */
  webhookUrl: string;
  /** optional compose file relative to repo root, e.g. docker-compose.override.yml */
  composeFile?: string;
  /** Порядок карточек в боковой панели (id: repo, services, docker, …). */
  sidebarCardOrder?: string[];
  /** Карточка, закреплённая под логом в центре (не дублируется в сайдбаре). */
  pinnedSidebarCardId?: string | null;
};

export type DockerContainerRow = {
  name: string;
  service: string;
  state: string;
  status: string;
  health?: string;
};

export type DockerStatsRow = {
  name: string;
  cpuPercent: number;
  memMb: number;
  memLimitMb: number | null;
};

export const DEFAULT_LAUNCHER_CONFIG: LauncherUserConfig = {
  services: [
    {
      id: "web-client",
      label: "web-client :3000",
      url: "http://localhost:3000",
      kind: "http",
    },
    {
      id: "web-lite",
      label: "web-lite :3001",
      url: "http://localhost:3001",
      kind: "http",
    },
    {
      id: "web-admin",
      label: "web-admin :3002",
      url: "http://localhost:3002",
      kind: "http",
    },
    {
      id: "web-dev",
      label: "web-dev :3003",
      url: "http://localhost:3003",
      kind: "http",
    },
    {
      id: "api",
      label: "API Swagger :8000",
      url: "http://localhost:8000/docs",
      kind: "http",
      composeService: "api",
    },
  ],
  customServers: [],
  snippets: [],
  commandHistory: [],
  activeEnv: "dev",
  webhookUrl: "",
  sidebarCardOrder: [
    "repo",
    "services",
    "docker",
    "api",
    "env",
    "customServers",
    "snippets",
  ],
  pinnedSidebarCardId: null,
};
