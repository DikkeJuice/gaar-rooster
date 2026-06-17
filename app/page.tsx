"use client";

import { useState, useEffect } from "react";
import AnnotationPanel from "./AnnotationPanel";
import MatchList from "./MatchList";
import AuthGate from "./AuthGate";

const API_BASE = "https://hysnprvzeeayxalgicsj.supabase.co/functions/v1";

const DAY_NAMES_NL = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MONTH_NAMES_NL = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function fmtDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return DAY_NAMES_NL[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTH_NAMES_NL[d.getUTCMonth()];
}
function fmtDayShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return DAY_NAMES_NL[d.getUTCDay()] + " " + d.getUTCDate();
}
function fmtRange(s: string, e: string): string {
  const sd = new Date(s + "T00:00:00Z"), ed = new Date(e + "T00:00:00Z");
  if (MONTH_NAMES_NL[sd.getUTCMonth()] === MONTH_NAMES_NL[ed.getUTCMonth()])
    return `${sd.getUTCDate()} – ${ed.getUTCDate()} ${MONTH_NAMES_NL[ed.getUTCMonth()]}`;
  return `${sd.getUTCDate()} ${MONTH_NAMES_NL[sd.getUTCMonth()]} – ${ed.getUTCDate()} ${MONTH_NAMES_NL[ed.getUTCMonth()]}`;
}
function fmtDutchDt(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return DAY_NAMES_NL[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTH_NAMES_NL[d.getUTCMonth()];
}
function getWeekDays(start: string): string[] {
  const out: string[] = [];
  const base = new Date(start + "T00:00:00Z");
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    out.push(d.toISOString().split("T")[0]);
  }
  return out;
}

type ClubFilter = "all" | "NEP" | "HCD";

export default function RosterPage() {
  const [weeks, setWeeks] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [wi, setWi] = useState(0);
  const [club, setClub] = useState<ClubFilter>("all");
  const [nameF, setNameF] = useState("");
  const [discDismissed, setDiscDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [wr, sr, mr] = await Promise.all([
          fetch(API_BASE + "/weeks"),
          fetch(API_BASE + "/shifts"),
          fetch(API_BASE + "/matches"),
        ]);
        const [w, s, m] = await Promise.all([wr.json(), sr.json(), mr.json()]);
        if (!Array.isArray(w)) throw new Error("Weken laden mislukt");
        const sorted = w.sort((a: any, b: any) => a.week_number - b.week_number);
        setWeeks(sorted);
        setShifts(Array.isArray(s) ? s : []);
        setMatches(Array.isArray(m) ? m : []);
        const today = new Date().toISOString().split("T")[0];
        const ci = sorted.findIndex((wk: any) => today >= wk.start_date && today <= wk.end_date);
        setWi(ci >= 0 ? ci : Math.max(0, sorted.length - 1));
      } catch (e: any) {
        setErr(e.message || "Fout bij laden");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", color: "#6B7280", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rooster laden...</div>;
  }
  if (err) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", color: "#dc2626", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "1rem", textAlign: "center" }}>{err}</div>;
  }
  if (!weeks.length) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", color: "#6B7280" }}>Geen roosterdata.</div>;
  }

  const wk = weeks[wi];
  const wkShifts = shifts.filter((s: any) => s.week_id === wk.id);
  const wkMatches = matches.filter((m: any) => m.week_id === wk.id);
  const allDays = getWeekDays(wk.start_date);

  // Build employee map
  const empMap = new Map<string, Record<string, { start: string; end: string; location: string } | null>>();
  for (const s of wkShifts) {
    const name = s.employee_name || "?";
    if (!empMap.has(name)) empMap.set(name, {});
    empMap.get(name)![s.date] = { start: s.start_time, end: s.end_time, location: s.location };
  }
  const employees = Array.from(empMap.entries())
    .map(([name, sh]) => ({ name, shifts: sh }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const allNames = Array.from(new Set(shifts.map((s: any) => s.employee_name).filter(Boolean))).sort() as string[];

  // Day columns
  const dayCols = (() => {
    const days = allDays.map((d) => ({ date: d, label: fmtDayLabel(d), labelShort: fmtDayShort(d) }));
    if (club === "all") {
      return days.filter((d) => employees.some((e) => e.shifts[d.date] != null));
    }
    return days.filter((d) => employees.some((e) => { const s = e.shifts[d.date]; return s && s.location === club; }));
  })();

  const filtEmps = club === "all" ? employees : employees.filter((e) => Object.values(e.shifts).some((s) => s && s.location === club));

  // Personal
  const personal = (() => {
    if (!nameF) return [];
    const r: any[] = [];
    for (const s of shifts) {
      if (s.employee_name !== nameF) continue;
      if (club !== "all" && s.location !== club) continue;
      const w = weeks.find((w2: any) => w2.id === s.week_id);
      r.push({ date: s.date, week: w?.week_number || 0, start: s.start_time, end: s.end_time, location: s.location });
    }
    return r.sort((a: any, b: any) => a.date.localeCompare(b.date));
  })();

  const showNep = (() => {
    if (nameF && personal.length) return personal.some((s: any) => s.location === "NEP");
    if (club === "HCD") return false;
    const pool = club === "all" ? employees : filtEmps;
    return pool.some((e) => Object.values(e.shifts).some((s) => s && s.location === "NEP"));
  })();

  const filtMatches = club === "all" ? wkMatches : wkMatches.filter((m: any) => club === "NEP" ? m.club === "Neptunus" : m.club === "HC Delfshaven");

  return (
    <AuthGate>
      <div className="week-nav">
        <button onClick={() => setWi((i) => Math.max(0, i - 1))} disabled={wi === 0}>← Vorige</button>
        <h1>Week {wk.week_number} — {fmtRange(wk.start_date, wk.end_date)}</h1>
        <button onClick={() => setWi((i) => Math.min(weeks.length - 1, i + 1))} disabled={wi === weeks.length - 1}>Volgende →</button>
      </div>

      <div className="week-strip">
        {weeks.map((w: any, i: number) => (
          <button key={w.week_number} onClick={() => setWi(i)} className={i === wi ? "current" : ""}>W{w.week_number}</button>
        ))}
      </div>

      <div className="filters-row">
        <div className="club-filter">
          {(["all", "NEP", "HCD"] as const).map((c) => (
            <button key={c} onClick={() => setClub(c)} className={club === c ? "active" : ""}>
              {c === "all" ? "Alle clubs" : c === "NEP" ? "⚾ Neptunus" : "🏑 HC Delfshaven"}
            </button>
          ))}
        </div>
        <div className="name-filter">
          <select value={nameF} onChange={(e) => setNameF(e.target.value)}>
            <option value="">👤 Alle medewerkers</option>
            {allNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {nameF && <button className="name-filter-clear" onClick={() => setNameF("")} title="Wis filter">✕</button>}
        </div>
      </div>

      {nameF && (
        <div className="personal-schedule">
          <h2>{nameF}{club !== "all" && <span> · {club === "NEP" ? "Neptunus" : "HC Delfshaven"}</span>}</h2>
          {personal.length === 0 ? (
            <div className="personal-empty">Geen diensten gevonden.</div>
          ) : (
            <table className="personal-table">
              <thead><tr><th>Datum</th><th>Tijd</th><th>Locatie</th></tr></thead>
              <tbody>
                {personal.map((s: any, i: number) => (
                  <tr key={i}><td>{fmtDutchDt(s.date)}</td><td>{s.start} – {s.end}{s.location === "NEP" ? "*" : ""}</td><td><span className={`shift-badge ${s.location.toLowerCase()}`}>{s.location}</span></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!nameF && (
        <>
          <div className="roster-grid">
            {dayCols.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#6B7280", background: "white", borderRadius: "8px", fontSize: "0.9rem" }}>
                Geen diensten voor {club === "all" ? "deze week" : club === "NEP" ? "Neptunus" : "HC Delfshaven"} in week {wk.week_number}.
              </div>
            ) : (
              <table className="roster-table">
                <thead>
                  <tr>
                    <th>Medewerker</th>
                    {dayCols.map((dc) => (
                      <th key={dc.date}><span className="day-label-full">{dc.label}</span><span className="day-label-short">{dc.labelShort}</span></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtEmps.length === 0 ? (
                    <tr><td colSpan={dayCols.length + 1} style={{ textAlign: "center", padding: "2rem", color: "#6B7280" }}>Geen medewerkers met diensten voor deze club in week {wk.week_number}.</td></tr>
                  ) : (
                    filtEmps.map((emp) => (
                      <tr key={emp.name}>
                        <td className="employee-name">{emp.name}</td>
                        {dayCols.map((dc) => {
                          const shift = emp.shifts[dc.date];
                          if (!shift) return <td key={dc.date} className="shift-cell empty">—</td>;
                          return (
                            <td key={dc.date} className="shift-cell">
                              {shift.start} – {shift.end}{shift.location === "NEP" ? "*" : ""}
                              <span className={`shift-badge ${shift.location.toLowerCase()}`}>{shift.location}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
          <MatchList matches={filtMatches} />
          <AnnotationPanel week={wk.week_number} employees={employees.map((e) => e.name)} days={allDays.map((d) => ({ date: d, label: fmtDayLabel(d) }))} />
        </>
      )}

      {showNep && !discDismissed && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: "var(--ink-indigo, #1A2A3A)", borderTop: "2px solid var(--nep, #2563EB)", boxShadow: "0 -4px 20px rgba(0,0,0,0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", maxWidth: 900, margin: "0 auto", padding: "0.7rem 1rem" }}>
            <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>⚠️</span>
            <span style={{ flex: 1, fontSize: "0.8rem", color: "var(--washi-cream, #F9F4E8)", lineHeight: 1.45 }}>
              <strong style={{ color: "#93c5fd" }}>Let op:</strong> Eindtijden bij Neptunus zijn afhankelijk van het wedstrijdverloop (innings).
            </span>
            <button onClick={() => setDiscDismissed(true)} aria-label="Sluiten" style={{ flexShrink: 0, background: "rgba(255,255,255,0.12)", border: "none", color: "var(--washi-cream, #F9F4E8)", width: 28, height: 28, borderRadius: 6, fontSize: "0.85rem", cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}
      <div className="site-footer">
        Gaar Culinair · Live rooster ·{" "}
        <a href="https://kraamwinkel.catering" target="_blank" rel="noopener" style={{ color: "var(--muted-gold, #C5A059)" }}>kraamwinkel.catering</a>
      </div>
    </AuthGate>
  );
}
