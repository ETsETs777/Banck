import { NextResponse } from "next/server";

function apiBase(): string {
  return (
    process.env.SPEKTORS_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:8000"
  );
}

export async function GET() {
  const base = apiBase().replace(/\/$/, "");
  const url = `${base}/api/v1/health`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, code: "network_error", message: msg },
      { status: 502 },
    );
  }
}
