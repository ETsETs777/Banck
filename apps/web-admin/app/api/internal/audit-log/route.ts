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
  const qs = u.searchParams.toString();
  const base = apiBase().replace(/\/$/, "");
  const url = `${base}/internal/admin/v1/audit-log${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
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
