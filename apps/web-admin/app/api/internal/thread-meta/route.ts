import { NextRequest, NextResponse } from "next/server";

function apiBase(): string {
  return (
    process.env.SPEKTORS_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:8000"
  );
}

function adminToken(): string | undefined {
  return process.env.INTERNAL_ADMIN_TOKEN?.trim();
}

function metaPath(sessionId: string, threadId: string) {
  return `/internal/admin/v1/sessions/${encodeURIComponent(sessionId)}/threads/${encodeURIComponent(threadId)}/meta`;
}

export async function GET(req: NextRequest) {
  const token = adminToken();
  if (!token) {
    return NextResponse.json(
      { code: "bff_not_configured" },
      { status: 503 },
    );
  }
  const u = new URL(req.url);
  const session_id = u.searchParams.get("session_id")?.trim() ?? "";
  const thread_id = u.searchParams.get("thread_id")?.trim() ?? "";
  if (!session_id || !thread_id) {
    return NextResponse.json({ code: "validation_error" }, { status: 400 });
  }
  const base = apiBase().replace(/\/$/, "");
  const res = await fetch(`${base}${metaPath(session_id, thread_id)}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}

export async function PATCH(req: NextRequest) {
  const token = adminToken();
  if (!token) {
    return NextResponse.json(
      { code: "bff_not_configured" },
      { status: 503 },
    );
  }
  const u = new URL(req.url);
  const session_id = u.searchParams.get("session_id")?.trim() ?? "";
  const thread_id = u.searchParams.get("thread_id")?.trim() ?? "";
  if (!session_id || !thread_id) {
    return NextResponse.json({ code: "validation_error" }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ code: "invalid_json" }, { status: 400 });
  }
  const actorLabel =
    typeof body.actor_label === "string" ? body.actor_label : undefined;
  const payload = { ...body };
  delete payload.actor_label;

  const base = apiBase().replace(/\/$/, "");
  const path = metaPath(session_id, thread_id);
  const url = new URL(path, `${base}/`);
  if (actorLabel?.trim()) {
    url.searchParams.set("actor_label", actorLabel.trim());
  }
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}
