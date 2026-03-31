export type ClientKind = "public" | "admin" | "dev";

export type SpektorsClientOptions = {
  baseUrl: string;
  /** Для публичного API */
  appId?: string;
  /** Bearer для /internal/admin или /internal/dev */
  token?: string;
  kind?: ClientKind;
  /**
   * Если не `false` — на каждый HTTP-запрос добавляется `X-Request-ID` (корреляция с ответом API).
   * @default true
   */
  traceRequestId?: boolean;
};

export type ChatBody = {
  content: string;
  stream?: boolean;
  session_id?: string | null;
  thread_id?: string | null;
};

export type ChatJsonResponse = {
  session_id: string;
  thread_id: string;
  message: unknown;
};

export type ThreadMessage = {
  id: number;
  role: string;
  content: string;
  msg_source?: string;
  author_label?: string | null;
  created_at: string | null;
};

export type ThreadMessagesResponse = {
  session_id: string;
  thread_id: string;
  messages: ThreadMessage[];
};

export type AppMetaPublic = {
  app_id: string;
  display_name: string | null;
  features: Record<string, boolean>;
  tools: Record<string, boolean>;
  rag_enabled: boolean;
  ollama_model: string;
  prompt_version: string;
};

export type RagHit = {
  id: string | number | null;
  document: string;
  metadata: Record<string, unknown>;
  distance: number | null;
};

export type RagQueryResponse = {
  collection: string;
  hits: RagHit[];
};

export type ChatStreamHandlers = {
  onDelta: (text: string) => void;
  onSession?: (sessionId: string, threadId: string) => void;
  onError?: (message: string) => void;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function newRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Заголовки для вызовов API.
 */
export function buildHeaders(opts: SpektorsClientOptions): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/json",
  };
  const kind = opts.kind ?? "public";
  if (kind === "public" && opts.appId) {
    h["X-App-Id"] = opts.appId;
  }
  if (kind === "admin" || kind === "dev") {
    if (opts.token) {
      h.Authorization = `Bearer ${opts.token}`;
    }
  }
  if (opts.traceRequestId !== false) {
    h["X-Request-ID"] = newRequestId();
  }
  return h;
}

function parseSseDataLine(line: string): unknown | null {
  if (!line.startsWith("data: ")) return null;
  const raw = line.slice(6).trim();
  if (raw === "[DONE]") return { done: true };
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractDeltaContent(obj: unknown): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as Record<string, unknown>;
  if (typeof o.error === "string") return "";
  const choices = o.choices;
  if (!Array.isArray(choices)) return "";
  let out = "";
  for (const c of choices) {
    if (!c || typeof c !== "object") continue;
    const delta = (c as Record<string, unknown>).delta;
    if (!delta || typeof delta !== "object") continue;
    const content = (delta as Record<string, unknown>).content;
    if (typeof content === "string") out += content;
  }
  return out;
}

function extractSseError(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const e = (obj as Record<string, unknown>).error;
  return typeof e === "string" ? e : null;
}

/**
 * Читает тело ответа как SSE (строки `data: ...`), вызывает onDelta по кускам текста модели.
 */
export async function consumeChatSseStream(
  response: Response,
  handlers: ChatStreamHandlers,
): Promise<void> {
  const sid = response.headers.get("X-Session-Id");
  const tid = response.headers.get("X-Thread-Id");
  if (sid && tid) handlers.onSession?.(sid, tid);

  const body = response.body;
  if (!body) {
    handlers.onError?.("empty_response_body");
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const parsed = parseSseDataLine(line);
        if (parsed === null) continue;
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "done" in parsed
        ) {
          continue;
        }
        const err = extractSseError(parsed);
        if (err) {
          handlers.onError?.(err);
          return;
        }
        const delta = extractDeltaContent(parsed);
        if (delta) handlers.onDelta(delta);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Текст ассистента из тела ответа OpenAI-совместного chat/completions. */
export function assistantTextFromChatPayload(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const m = message as Record<string, unknown>;
  const choices = m.choices;
  if (!Array.isArray(choices) || !choices[0]) return "";
  const first = choices[0] as Record<string, unknown>;
  const msg = first.message;
  if (!msg || typeof msg !== "object") return "";
  const c = (msg as Record<string, unknown>).content;
  return typeof c === "string" ? c : "";
}

export type HumanReplyBody = {
  content: string;
  author_label: string;
};

export type HumanReplyResponse = {
  ok: boolean;
  message_id: number;
  app_id: string;
  session_id: string;
  thread_id: string;
};

export type AdminInboxThreadRow = {
  thread_id: string;
  session_id: string;
  app_id: string;
  last_preview: string | null;
  updated_at: string | null;
  message_count: number;
};

export type AdminThreadsListResponse = {
  items: AdminInboxThreadRow[];
  limit: number;
  offset: number;
};

export function createSpektorsClient(opts: SpektorsClientOptions) {
  const kind = opts.kind ?? "public";
  return {
    kind,
    async health(): Promise<{ status: string }> {
      const path =
        kind === "admin"
          ? "internal/admin/v1/health"
          : kind === "dev"
            ? "internal/dev/v1/health"
            : "api/v1/health";
      const res = await fetch(joinUrl(opts.baseUrl, path), {
        headers: buildHeaders(opts),
      });
      if (!res.ok) throw new Error(`health failed: ${res.status}`);
      return res.json() as Promise<{ status: string }>;
    },
    async healthDb(): Promise<{ ok: boolean; backend?: string }> {
      if (kind !== "public") {
        throw new Error("healthDb доступен только для kind=public");
      }
      const res = await fetch(joinUrl(opts.baseUrl, "api/v1/health/db"), {
        headers: buildHeaders(opts),
      });
      if (!res.ok) throw new Error(`healthDb failed: ${res.status}`);
      return res.json() as Promise<{ ok: boolean; backend?: string }>;
    },
    async healthLlm(): Promise<{
      ok: boolean;
      llm_base?: string;
      models?: string[];
      detail?: string;
    }> {
      if (kind !== "public") {
        throw new Error("healthLlm доступен только для kind=public");
      }
      const res = await fetch(joinUrl(opts.baseUrl, "api/v1/health/llm"), {
        headers: buildHeaders(opts),
      });
      if (!res.ok) throw new Error(`healthLlm failed: ${res.status}`);
      return res.json() as Promise<{
        ok: boolean;
        llm_base?: string;
        models?: string[];
        detail?: string;
      }>;
    },
    /** Публичные флаги приложения из `config/apps.yaml` (без заголовка X-App-Id). */
    async metaApp(appId: string): Promise<AppMetaPublic> {
      if (kind !== "public") {
        throw new Error("metaApp доступен только для kind=public");
      }
      const path = `api/v1/meta/app/${encodeURIComponent(appId)}`;
      const res = await fetch(joinUrl(opts.baseUrl, path), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`metaApp failed: ${res.status}`);
      return res.json() as Promise<AppMetaPublic>;
    },
    async healthRag(): Promise<{
      ok: boolean;
      chroma_url?: string | null;
      detail?: string | null;
    }> {
      if (kind !== "public") {
        throw new Error("healthRag доступен только для kind=public");
      }
      const res = await fetch(joinUrl(opts.baseUrl, "api/v1/health/rag"), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`healthRag failed: ${res.status}`);
      return res.json() as Promise<{
        ok: boolean;
        chroma_url?: string | null;
        detail?: string | null;
      }>;
    },
    async ragQuery(body: {
      query: string;
      top_k?: number;
    }): Promise<RagQueryResponse> {
      if (kind !== "public") {
        throw new Error("ragQuery доступен только для kind=public");
      }
      if (!opts.appId) {
        throw new Error("Нужен appId для ragQuery");
      }
      const h = new Headers(buildHeaders(opts));
      h.set("Content-Type", "application/json");
      const res = await fetch(joinUrl(opts.baseUrl, "api/v1/rag/query"), {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          query: body.query,
          top_k: body.top_k ?? 5,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`ragQuery failed: ${res.status} ${t.slice(0, 400)}`);
      }
      return res.json() as Promise<RagQueryResponse>;
    },
    async chat(body: ChatBody): Promise<ChatJsonResponse> {
      if (kind !== "public") {
        throw new Error("chat доступен только для kind=public");
      }
      if (!opts.appId) {
        throw new Error("Нужен appId для chat");
      }
      const h = new Headers(buildHeaders(opts));
      h.set("Content-Type", "application/json");
      const res = await fetch(joinUrl(opts.baseUrl, "api/v1/chat"), {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          content: body.content,
          stream: body.stream ?? false,
          session_id: body.session_id ?? undefined,
          thread_id: body.thread_id ?? undefined,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`chat failed: ${res.status} ${t.slice(0, 500)}`);
      }
      return res.json() as Promise<ChatJsonResponse>;
    },
    /**
     * Стриминг чата (SSE). После вызова проверьте response.ok; при ошибке тело может быть не SSE.
     */
    async chatStream(body: Omit<ChatBody, "stream">): Promise<Response> {
      if (kind !== "public") {
        throw new Error("chatStream доступен только для kind=public");
      }
      if (!opts.appId) {
        throw new Error("Нужен appId для chatStream");
      }
      const h = new Headers(buildHeaders(opts));
      h.set("Content-Type", "application/json");
      h.set("Accept", "text/event-stream");
      return fetch(joinUrl(opts.baseUrl, "api/v1/chat"), {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          content: body.content,
          stream: true,
          session_id: body.session_id ?? undefined,
          thread_id: body.thread_id ?? undefined,
        }),
      });
    },
    async listThreadMessages(
      sessionId: string,
      threadId: string,
    ): Promise<ThreadMessagesResponse> {
      if (kind !== "public") {
        throw new Error("listThreadMessages доступен только для kind=public");
      }
      if (!opts.appId) {
        throw new Error("Нужен appId для listThreadMessages");
      }
      const path = `api/v1/sessions/${encodeURIComponent(sessionId)}/threads/${encodeURIComponent(threadId)}/messages`;
      const res = await fetch(joinUrl(opts.baseUrl, path), {
        headers: buildHeaders(opts),
      });
      if (!res.ok) throw new Error(`messages failed: ${res.status}`);
      return res.json() as Promise<ThreadMessagesResponse>;
    },
    /** Ответ оператора в тред (internal admin, Bearer). */
    async adminHumanReply(
      sessionId: string,
      threadId: string,
      body: HumanReplyBody,
    ): Promise<HumanReplyResponse> {
      if (kind !== "admin") {
        throw new Error("adminHumanReply только для kind=admin");
      }
      const path = `internal/admin/v1/sessions/${encodeURIComponent(sessionId)}/threads/${encodeURIComponent(threadId)}/reply`;
      const headers = new Headers(buildHeaders(opts));
      headers.set("Content-Type", "application/json");
      const res = await fetch(joinUrl(opts.baseUrl, path), {
        method: "POST",
        headers,
        body: JSON.stringify({
          content: body.content,
          author_label: body.author_label,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const rid = res.headers.get("X-Request-ID");
        const suffix = rid ? ` X-Request-ID=${rid}` : "";
        throw new Error(
          `adminHumanReply failed: ${res.status} ${text.slice(0, 400)}${suffix}`,
        );
      }
      return res.json() as Promise<HumanReplyResponse>;
    },
    /**
     * Список тредов для инбокса (internal admin, Bearer).
     * Требует заданного токена, если он включён на API.
     */
    async adminListThreads(params?: {
      app_id?: string;
      limit?: number;
      offset?: number;
    }): Promise<AdminThreadsListResponse> {
      if (kind !== "admin") {
        throw new Error("adminListThreads только для kind=admin");
      }
      const search = new URLSearchParams();
      if (params?.app_id) search.set("app_id", params.app_id);
      if (params?.limit != null) search.set("limit", String(params.limit));
      if (params?.offset != null) search.set("offset", String(params.offset));
      const qs = search.toString();
      const path = `internal/admin/v1/threads${qs ? `?${qs}` : ""}`;
      const res = await fetch(joinUrl(opts.baseUrl, path), {
        headers: buildHeaders(opts),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const rid = res.headers.get("X-Request-ID");
        const suffix = rid ? ` X-Request-ID=${rid}` : "";
        throw new Error(
          `adminListThreads failed: ${res.status} ${text.slice(0, 400)}${suffix}`,
        );
      }
      return res.json() as Promise<AdminThreadsListResponse>;
    },
  };
}
