const PREFIX = "spektors-admin";

export type AdminPrefs = {
  pollIntervalMs: number;
  soundOnNewThread: boolean;
  inboxListCollapsed: boolean;
};

const defaults: AdminPrefs = {
  pollIntervalMs: 15_000,
  soundOnNewThread: true,
  inboxListCollapsed: false,
};

function key(k: string) {
  return `${PREFIX}:${k}`;
}

export function loadAdminPrefs(): AdminPrefs {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const poll = window.localStorage.getItem(key("pollIntervalMs"));
    const sound = window.localStorage.getItem(key("soundOnNewThread"));
    const collapsed = window.localStorage.getItem(key("inboxListCollapsed"));
    return {
      pollIntervalMs: Math.min(
        120_000,
        Math.max(5_000, poll ? Number(poll) || defaults.pollIntervalMs : defaults.pollIntervalMs),
      ),
      soundOnNewThread:
        sound === null ? defaults.soundOnNewThread : sound === "1" || sound === "true",
      inboxListCollapsed:
        collapsed === "1" || collapsed === "true",
    };
  } catch {
    return { ...defaults };
  }
}

export function saveAdminPrefs(p: Partial<AdminPrefs>) {
  if (typeof window === "undefined") return;
  try {
    if (p.pollIntervalMs != null) {
      window.localStorage.setItem(key("pollIntervalMs"), String(p.pollIntervalMs));
    }
    if (p.soundOnNewThread != null) {
      window.localStorage.setItem(key("soundOnNewThread"), p.soundOnNewThread ? "1" : "0");
    }
    if (p.inboxListCollapsed != null) {
      window.localStorage.setItem(key("inboxListCollapsed"), p.inboxListCollapsed ? "1" : "0");
    }
  } catch {
    /* ignore */
  }
}

export const OPERATOR_NAME_KEY = `${PREFIX}:operator-name`;

export const RECENT_THREADS_KEY = `${PREFIX}:recent-threads`;
export const TEMPLATES_KEY = `${PREFIX}:reply-templates`;
export const LOCALE_KEY = `${PREFIX}:locale`;
export const OPERATOR_STATUS_KEY = `${PREFIX}:operator-status`;

export type RecentThread = {
  session_id: string;
  thread_id: string;
  app_id: string;
  last_preview: string | null;
  updated_at: string;
};

export function loadRecentThreads(): RecentThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_THREADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentThread =>
        typeof x === "object" &&
        x != null &&
        typeof (x as RecentThread).session_id === "string" &&
        typeof (x as RecentThread).thread_id === "string" &&
        typeof (x as RecentThread).app_id === "string",
    );
  } catch {
    return [];
  }
}

export function pushRecentThread(row: RecentThread, max = 40) {
  if (typeof window === "undefined") return;
  try {
    const cur = loadRecentThreads().filter(
      (r) =>
        !(
          r.session_id === row.session_id &&
          r.thread_id === row.thread_id &&
          r.app_id === row.app_id
        ),
    );
    cur.unshift({
      ...row,
      updated_at: row.updated_at || new Date().toISOString(),
    });
    window.localStorage.setItem(
      RECENT_THREADS_KEY,
      JSON.stringify(cur.slice(0, max)),
    );
  } catch {
    /* ignore */
  }
}

export function loadReplyTemplates(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATES_KEY);
    if (!raw) {
      return [
        "Здравствуйте! Спасибо за обращение.",
        "Уточните, пожалуйста, детали.",
      ];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function saveReplyTemplates(templates: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    /* ignore */
  }
}
