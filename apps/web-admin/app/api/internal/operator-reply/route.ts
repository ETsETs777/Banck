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

export async function POST(req: NextRequest) {
  const token = adminToken();
  if (!token) {
    return NextResponse.json(
      { code: "bff_not_configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "invalid_json" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const session_id =
    typeof b.session_id === "string" ? b.session_id.trim() : "";
  const thread_id = typeof b.thread_id === "string" ? b.thread_id.trim() : "";
  const content = typeof b.content === "string" ? b.content : "";
  const author_label =
    typeof b.author_label === "string" ? b.author_label : "";

  if (!session_id || !thread_id || !content.trim() || !author_label.trim()) {
    return NextResponse.json({ code: "validation_error" }, { status: 400 });
  }

  const base = apiBase().replace(/\/$/, "");
  const url = `${base}/internal/admin/v1/sessions/${encodeURIComponent(session_id)}/threads/${encodeURIComponent(thread_id)}/reply`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      content: content.trim(),
      author_label: author_label.trim(),
    }),
  });

  const text = await res.text();
  const ct = res.headers.get("Content-Type") || "application/json";
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": ct },
  });
}
