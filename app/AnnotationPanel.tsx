"use client";

import { useState, useEffect, useCallback } from "react";

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

const LOCAL_KEY = "gaar-rooster-annotations";

function loadLocal(): Annotation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(annotations: Annotation[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(annotations.slice(0, 50)));
  } catch { /* ignore quota errors */ }
}

export default function AnnotationPanel({
  week,
  employees,
}: {
  week: number;
  employees: string[];
}) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [employee, setEmployee] = useState("");
  const [action, setAction] = useState<"afwezig" | "beschikbaar" | "notitie">("notitie");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Load annotations from localStorage + remote
  const refresh = useCallback(async () => {
    const local = loadLocal();
    setAnnotations(local);

    try {
      const res = await fetch("/api/annotate");
      if (res.ok) {
        const data: AnnotationsFile = await res.json();
        // Merge remote with local, deduplicate by id
        const merged = new Map<string, Annotation>();
        for (const a of [...data.annotations, ...local]) {
          merged.set(a.id, a);
        }
        const mergedList = Array.from(merged.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setAnnotations(mergedList);
        saveLocal(mergedList);
      }
    } catch {
      // Offline — use local
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSubmit = async () => {
    if (!employee) return;

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/annotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week,
          date: new Date().toISOString().split("T")[0],
          employee,
          note,
          action,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Netwerkfout" }));
        setErrorMsg(err.error || "Fout bij versturen");
        return;
      }

      const data = await res.json();
      // Add to local
      const updated = [data.annotation, ...annotations];
      setAnnotations(updated);
      saveLocal(updated);

      setSuccessMsg("Verstuurd! Robert is op de hoogte.");
      setEmployee("");
      setNote("");
      setAction("notitie");
      setFormOpen(false);

      setTimeout(() => setSuccessMsg(""), 4000);
    } catch {
      setErrorMsg("Kan geen verbinding maken. Probeer opnieuw.");
    } finally {
      setSubmitting(false);
    }
  };

  const actionLabel = (a: Annotation) => {
    switch (a.action) {
      case "afwezig": return "❌ Afwezig";
      case "beschikbaar": return "✅ Beschikbaar";
      default: return "📝 Notitie";
    }
  };

  const actionColor = (a: Annotation) => {
    switch (a.action) {
      case "afwezig": return "#EF4444";
      case "beschikbaar": return "#10B981";
      default: return "var(--muted-gold)";
    }
  };

  return (
    <div style={{ padding: "0 1rem 2rem" }}>
      {/* Success/Error messages */}
      {successMsg && (
        <div className="annotation-success" style={{ marginBottom: "0.5rem" }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ color: "var(--danger)", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
          {errorMsg}
        </div>
      )}

      {/* Add annotation button */}
      {!formOpen && (
        <button
          onClick={() => setFormOpen(true)}
          style={{
            background: "var(--muted-gold)",
            color: "var(--ink-indigo)",
            border: "none",
            padding: "0.5rem 1.25rem",
            borderRadius: "6px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          + Aantekening toevoegen
        </button>
      )}

      {/* Annotation form */}
      {formOpen && (
        <div
          className="annotation-panel"
          style={{ marginTop: "0.75rem" }}
        >
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              marginBottom: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <select
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              style={{
                padding: "0.5rem",
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: "6px",
                fontFamily: "inherit",
                fontSize: "0.85rem",
                minWidth: "140px",
              }}
            >
              <option value="">Wie ben je?</option>
              {employees.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
              <option value="Anders">Anders...</option>
            </select>

            <select
              value={action}
              onChange={(e) => setAction(e.target.value as typeof action)}
              style={{
                padding: "0.5rem",
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: "6px",
                fontFamily: "inherit",
                fontSize: "0.85rem",
              }}
            >
              <option value="notitie">📝 Gewone notitie</option>
              <option value="afwezig">❌ Kan niet werken</option>
              <option value="beschikbaar">✅ Kan extra werken</option>
            </select>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              action === "afwezig"
                ? "Waarom kun je niet? (bijv. tentamen, ziek, andere afspraak)"
                : action === "beschikbaar"
                ? "Wanneer kun je extra werken?"
                : "Schrijf je notitie..."
            }
          />

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              onClick={handleSubmit}
              disabled={!employee || submitting}
            >
              {submitting ? "Versturen..." : "Verstuur naar Robert"}
            </button>
            <button
              onClick={() => {
                setFormOpen(false);
                setErrorMsg("");
              }}
              style={{
                background: "transparent",
                color: "var(--slate)",
                border: "1px solid rgba(0,0,0,0.12)",
              }}
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Annotations list */}
      {annotations.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--ink-indigo)",
              marginBottom: "0.75rem",
            }}
          >
            Recente aantekeningen ({annotations.length})
          </h3>
          {annotations.slice(0, 10).map((a) => (
            <div
              key={a.id}
              style={{
                background: "white",
                borderLeft: `3px solid ${actionColor(a)}`,
                padding: "0.65rem 1rem",
                marginBottom: "0.5rem",
                borderRadius: "0 6px 6px 0",
                fontSize: "0.85rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <strong style={{ color: "var(--ink-indigo)" }}>
                  {a.employee}
                </strong>
                <span style={{ color: actionColor(a), fontWeight: 500 }}>
                  {actionLabel(a)}
                </span>
                <span style={{ color: "var(--slate)", fontSize: "0.75rem" }}>
                  {new Date(a.timestamp).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {a.note && (
                <div style={{ marginTop: "0.25rem", color: "var(--slate)" }}>
                  {a.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
