import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://hysnprvzeeayxalgicsj.supabase.co/functions/v1";

export async function GET(request: NextRequest) {
  return proxy(request);
}

export async function POST(request: NextRequest) {
  return proxy(request);
}

export async function PUT(request: NextRequest) {
  return proxy(request);
}

export async function DELETE(request: NextRequest) {
  return proxy(request);
}

async function proxy(request: NextRequest) {
  // Strip /api/admin-proxy prefix, then strip optional /api/ prefix
  let path = request.nextUrl.pathname.replace("/api/admin-proxy", "");
  path = path.replace(/^\/api\//, "/");
  // Map legacy paths to Edge Function names
  path = path.replace("/auth/login", "/auth");
  const search = request.nextUrl.search;

  // Routes now go direct to Supabase Edge Functions:
  // /api/admin-proxy/auth → /functions/v1/auth
  // /api/admin-proxy/weeks → /functions/v1/weeks
  // etc.
  const url = `${API_BASE}${path}${search}`;

  const headers: Record<string, string> = {};

  // Forward Authorization header (application JWT)
  const auth = request.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;

  // Forward Content-Type
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.text();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const res = await fetch(url, {
      method: request.method,
      headers,
      body: body || undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.text();
    const responseHeaders: Record<string, string> = {};

    res.headers.forEach((value, key) => {
      if (!["content-encoding", "transfer-encoding"].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    return new NextResponse(data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return NextResponse.json({ error: "API niet bereikbaar" }, { status: 502 });
  }
}
