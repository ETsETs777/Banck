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
  const app_id = u.searchParams.get("app_id")?.trim() ?? "";
  if (!session_id || !thread_id || !app_id) {
    return NextResponse.json({ code: "validation_error" }, { status: 400 });
  }

  const base = apiBase().replace(/\/$/, "");
  const path = `/api/v1/sessions/${encodeURIComponent(session_id)}/threads/${encodeURIComponent(thread_id)}/messages`;
  const url = `${base}${path}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-App-Id": app_id,
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
