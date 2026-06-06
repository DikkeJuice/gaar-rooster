import { NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = "DikkeJuice/gaar-rooster";
const ANNOTATIONS_PATH = "data/annotations.json";

interface Annotation {
  id: string;
  week: number;
  date: string;
  employee: string;
  note: string;
  action: "afwezig" | "beschikbaar" | "notitie";
  timestamp: string;
}

interface AnnotationsFile {
  annotations: Annotation[];
}

async function getAnnotations(): Promise<{ data: AnnotationsFile; sha: string } | null> {
  const url = `https://api.github.com/repos/${REPO}/contents/${ANNOTATIONS_PATH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    console.error("GitHub fetch failed:", res.status, await res.text());
    return null;
  }

  const raw = await res.json();
  const content = Buffer.from(raw.content, "base64").toString("utf-8");
  return { data: JSON.parse(content), sha: raw.sha };
}

async function saveAnnotations(
  data: AnnotationsFile,
  sha: string | null,
  message: string
): Promise<boolean> {
  const url = `https://api.github.com/repos/${REPO}/contents/${ANNOTATIONS_PATH}`;
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");

  const body: Record<string, string> = {
    message,
    content,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("GitHub save failed:", res.status, await res.text());
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  if (!GITHUB_TOKEN) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { week, date, employee, note, action } = body;

    if (!week || !date || !employee || !action) {
      return NextResponse.json(
        { error: "Missing required fields: week, date, employee, action" },
        { status: 400 }
      );
    }

    const annotation: Annotation = {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      week: Number(week),
      date,
      employee,
      note: note || "",
      action: action || "notitie",
      timestamp: new Date().toISOString(),
    };

    // Load existing annotations
    const existing = await getAnnotations();
    const data: AnnotationsFile = existing
      ? existing.data
      : { annotations: [] };

    // Add new annotation
    data.annotations.unshift(annotation);

    // Save to repo
    const emoji = annotation.action === "afwezig" ? "❌" : annotation.action === "beschikbaar" ? "✅" : "📝";
    const success = await saveAnnotations(
      data,
      existing?.sha ?? null,
      `${emoji} ${annotation.employee}: ${annotation.action} in W${annotation.week}`
    );

    if (!success) {
      return NextResponse.json(
        { error: "Failed to save annotation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, annotation });
  } catch (err) {
    console.error("Annotation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ annotations: [] });
  }

  const existing = await getAnnotations();
  return NextResponse.json(
    existing ? existing.data : { annotations: [] }
  );
}
