import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://petra-unsulliable-alyce.ngrok-free.dev";

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
  const path = request.nextUrl.pathname.replace("/api/admin-proxy", "");
  const search = request.nextUrl.search;
  const url = `${API_BASE}${path}${search}`;

  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "1",
  };

  // Forward Authorization header
  const auth = request.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;

  // Forward Content-Type
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.text();

  try {
    const res = await fetch(url, {
      method: request.method,
      headers,
      body: body || undefined,
    });

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
