"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import AnnotationPanel from "./AnnotationPanel";
import MatchList from "./MatchList";
import AuthGate from "./AuthGate";

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════
interface Match {
  id: number;
  week_id: number;
  date: string;
  time: string;
  club: string;
  team: string;
  opponent: string;
  field: string;
}

interface Shift {
  id: number;
  employee_id: number;
  week_id: number;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  employee_name: string;
}

interface Week {
  id: number;
  week_number: number;
  start_date: string;
  end_date: string;
}

interface DayColumn {
  date: string;
  label: string;
  labelShort: string;
}

interface EmployeeRow {
  name: string;
  shifts: Record<string, { start: string; end: string; location: string } | null>;
}

type ClubFilter = "all" | "NEP" | "HCD";

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════
const API_BASE = "https://hysnprvzeeayxalgicsj.supabase.co/functions/v1";

const DAY_NAMES_NL = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MONTH_NAMES_NL = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════
function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = DAY_NAMES_NL[d.getUTCDay()];
  const date = d.getUTCDate();
  const month = MONTH_NAMES_NL[d.getUTCMonth()];
  return `${day} ${date} ${month}`;
}

function formatDayLabelShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return DAY_NAMES_NL[d.getUTCDay()] + " " + d.getUTCDate();
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const sDay = s.getUTCDate();
  const eDay = e.getUTCDate();
  const sMonth = MONTH_NAMES_NL[s.getUTCMonth()];
  const eMonth = MONTH_NAMES_NL[e.getUTCMonth()];
  if (sMonth === eMonth) return `${sDay} – ${eDay} ${eMonth}`;
  return `${sDay} ${sMonth} – ${eDay} ${eMonth}`;
}

function formatDutchDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  return `${DAY_NAMES_NL[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES_NL[d.getUTCMonth()]}`;
}

function getDaysInWeek(startDate: string): string[] {
  const days: string[] = [];
  const d = new Date(startDate + "T00:00:00Z");
  for (let i = 0; i < 7; i++) {
    const day = new Date(d);
    day.setUTCDate(d.getUTCDate() + i);
    days.push(day.toISOString().split("T")[0]);
  }
  return days;
}

// ═══════════════════════════════════════════
// Page Component
// ═══════════════════════════════════════════
export default function RosterPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI state
  const [weekIdx, setWeekIdx] = useState(0);
  const [clubFilter, setClubFilter] = useState<ClubFilter>("all");
  const [nameFilter, setNameFilter] = useState<string>("");
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);

  // Fetch all data on mount
  useEffect(() => {
    async function fetchAll() {
      try {
        const [wRes, sRes, mRes] = await Promise.all([
          fetch(`${API_BASE}/weeks`),
          fetch(`${API_BASE}/shifts`),
          fetch(`${API_BASE}/matches`),
        ]);
        const [w, s, m] = await Promise.all([wRes.json(), sRes.json(), mRes.json()]);

        if (w.error) throw new Error(w.error);
        setWeeks(Array.isArray(w) ? w.sort((a: Week, b: Week) => a.week_number - b.week_number) : []);
        setAllShifts(Array.isArray(s) ? s : []);
        setAllMatches(Array.isArray(m) ? m : []);

        // Find current week
        const today = new Date().toISOString().split("T")[0];
        const currentIdx = (Array.isArray(w) ? w : []).findIndex(
          (wk: Week) => today >= wk.start_date && today <= wk.end_date
        );
        setWeekIdx(currentIdx >= 0 ? currentIdx : Math.max(0, (Array.isArray(w) ? w : []).length - 1));
      } catch (e: any) {
        setError(e.message || "Kan gegevens niet laden");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Reload shifts when week changes or globally
  const reloadShifts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/shifts`);
      const s = await res.json();
      if (Array.isArray(s)) setAllShifts(s);
    } catch { /* silent */ }
  }, []);

  // Wait for request to complete on annotation submit
  useEffect(() => {
    const handler = () => reloadShifts();
    window.addEventListener("annotation-submitted", handler);
    return () => window.removeEventListener("annotation-submitted", handler);
  }, [reloadShifts]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", color: "#6B7280" }}>
        Rooster laden...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", color: "#dc2626" }}>
        Fout bij laden: {error}
      </div>
    );
  }

  const week = weeks[weekIdx];
  if (!week || weeks.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", color: "#6B7280" }}>
        Geen roosterdata beschikbaar.
      </div>
    );
  }

  // Build week data from Supabase shifts
  const weekShifts = allShifts.filter((s) => s.week_id === week.id);
  const weekMatches = allMatches.filter((m) => m.week_id === week.id);

  // Generate all 7 days of the week
  const allDays = getDaysInWeek(week.start_date);

  // Build employee → shifts map for this week
  const employeeMap = new Map<string, Record<string, { start: string; end: string; location: string } | null>>();
  for (const s of weekShifts) {
    const name = s.employee_name || "Onbekend";
    if (!employeeMap.has(name)) {
      employeeMap.set(name, {});
    }
    employeeMap.get(name)![s.date] = {
      start: s.start_time,
      end: s.end_time,
      location: s.location,
    };
  }

  const employees: EmployeeRow[] = Array.from(employeeMap.entries())
    .map(([name, shifts]) => ({ name, shifts }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // All unique employees across all weeks (for name filter)
  const allEmployees = useMemo(() => {
    const names = new Set<string>();
    for (const s of allShifts) {
      if (s.employee_name) names.add(s.employee_name);
    }
    return Array.from(names).sort();
  }, [allShifts]);

  // Day columns — show only days that have shifts (or all when unfiltered)
  const dayColumns: DayColumn[] = useMemo(() => {
    // For "Alle clubs", show all days of the week
    const days: DayColumn[] = allDays.map((date) => ({
      date,
      label: formatDayLabel(date),
      labelShort: formatDayLabelShort(date),
    }));

    if (clubFilter === "all") {
      // Show all days, but only if at least one employee has a shift
      return days.filter((day) =>
        employees.some((emp) => emp.shifts[day.date] !== null && emp.shifts[day.date] !== undefined)
      );
    }
    // When filtering, show only days with shifts for that club
    return days.filter((day) =>
      employees.some((emp) => {
        const s = emp.shifts[day.date];
        return s && s.location === clubFilter;
      })
    );
  }, [allDays, employees, clubFilter]);

  // Filter employees by club
  const filteredEmployees = useMemo(() => {
    if (clubFilter === "all") return employees;
    return employees.filter((emp) =>
      Object.values(emp.shifts).some((s) => s && s.location === clubFilter)
    );
  }, [employees, clubFilter]);

  // Personal schedule view
  const personalShifts = useMemo(() => {
    if (!nameFilter) return [];
    const result: { date: string; week: number; start: string; end: string; location: string }[] = [];
    for (const s of allShifts) {
      if (s.employee_name !== nameFilter) continue;
      if (clubFilter !== "all" && s.location !== clubFilter) continue;
      const wk = weeks.find((w) => w.id === s.week_id);
      result.push({
        date: s.date,
        week: wk?.week_number || 0,
        start: s.start_time,
        end: s.end_time,
        location: s.location,
      });
    }
    result.sort((a, b) => a.date.localeCompare(b.date));
    return result;
  }, [nameFilter, clubFilter, allShifts, weeks]);

  // NEP disclaimer
  const showNepDisclaimer = useMemo(() => {
    if (nameFilter && personalShifts.length > 0) {
      return personalShifts.some((s) => s.location === "NEP");
    }
    if (clubFilter === "HCD") return false;
    const pool = clubFilter === "all" ? employees : filteredEmployees;
    return pool.some((emp) =>
      Object.values(emp.shifts).some((s) => s && s.location === "NEP")
    );
  }, [nameFilter, personalShifts, clubFilter, employees, filteredEmployees]);

  // Filter matches by club
  const filteredMatches = clubFilter === "all"
    ? weekMatches
    : weekMatches.filter((m) =>
        clubFilter === "NEP" ? m.club === "Neptunus" : m.club === "HC Delfshaven"
      );

  return (
    <AuthGate>
      {/* Week navigation */}
      <div className="week-nav">
        <button onClick={() => setWeekIdx((i) => Math.max(0, i - 1))} disabled={weekIdx === 0}>
          ← Vorige
        </button>
        <h1>
          Week {week.week_number} — {formatDateRange(week.start_date, week.end_date)}
        </h1>
        <button onClick={() => setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))} disabled={weekIdx === weeks.length - 1}>
          Volgende →
        </button>
      </div>

      {/* Quick week jump */}
      <div className="week-strip">
        {weeks.map((w, i) => (
          <button key={w.week_number} onClick={() => setWeekIdx(i)} className={i === weekIdx ? "current" : ""}>
            W{w.week_number}
          </button>
        ))}
      </div>

      {/* Club + Name filters */}
      <div className="filters-row">
        <div className="club-filter">
          <button onClick={() => setClubFilter("all")} className={clubFilter === "all" ? "active" : ""}>
            Alle clubs
          </button>
          <button onClick={() => setClubFilter("NEP")} className={clubFilter === "NEP" ? "active" : ""}>
            ⚾ Neptunus
          </button>
          <button onClick={() => setClubFilter("HCD")} className={clubFilter === "HCD" ? "active" : ""}>
            🏑 HC Delfshaven
          </button>
        </div>

        <div className="name-filter">
          <select value={nameFilter} onChange={(e) => setNameFilter(e.target.value)}>
            <option value="">👤 Alle medewerkers</option>
            {allEmployees.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {nameFilter && (
            <button className="name-filter-clear" onClick={() => setNameFilter("")} title="Wis filter">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── PERSONAL SCHEDULE VIEW ── */}
      {nameFilter && (
        <div className="personal-schedule">
          <h2>
            {nameFilter}
            {clubFilter !== "all" && (
              <span> · {clubFilter === "NEP" ? "Neptunus" : "HC Delfshaven"}</span>
            )}
          </h2>

          {personalShifts.length === 0 ? (
            <div className="personal-empty">
              Geen diensten{clubFilter !== "all" ? ` bij ${clubFilter === "NEP" ? "Neptunus" : "HC Delfshaven"}` : ""} gevonden.
            </div>
          ) : (
            <table className="personal-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Tijd</th>
                  <th>Locatie</th>
                </tr>
              </thead>
              <tbody>
                {personalShifts.map((s, i) => (
                  <tr key={i}>
                    <td>{formatDutchDate(s.date)}</td>
                    <td>{s.start} – {s.end}{s.location === "NEP" ? "*" : ""}</td>
                    <td>
                      <span className={`shift-badge ${s.location.toLowerCase()}`}>{s.location}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── STANDARD GRID VIEW ── */}
      {!nameFilter && (
        <>
          <div className="roster-grid">
            {dayColumns.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "2.5rem 1rem", color: "#6B7280",
                background: "white", borderRadius: "8px", fontSize: "0.9rem",
              }}>
                Geen diensten voor {clubFilter === "all" ? "deze week" : clubFilter === "NEP" ? "Neptunus" : "HC Delfshaven"} in week {week.week_number}.
              </div>
            ) : (
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Medewerker</th>
                  {dayColumns.map((dc) => (
                    <th key={dc.date}>
                      <span className="day-label-full">{dc.label}</span>
                      <span className="day-label-short">{dc.labelShort}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={dayColumns.length + 1} style={{ textAlign: "center", padding: "2rem", color: "#6B7280" }}>
                      Geen medewerkers met diensten voor deze club in week {week.week_number}.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.name}>
                      <td className="employee-name">{emp.name}</td>
                      {dayColumns.map((dc) => {
                        const shift = emp.shifts[dc.date];
                        if (!shift) {
                          return (
                            <td key={dc.date} className="shift-cell empty">
                              —
                            </td>
                          );
                        }
                        return (
                          <td key={dc.date} className="shift-cell">
                            {shift.start} – {shift.end}{shift.location === "NEP" ? "*" : ""}
                            <span className={`shift-badge ${shift.location.toLowerCase()}`}>
                              {shift.location}
                            </span>
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

          {/* Matches */}
          <MatchList matches={filteredMatches} />

          {/* Annotations */}
          <AnnotationPanel
            week={week.week_number}
            employees={employees.map((e) => e.name)}
            days={allDays.map((date) => ({
              date,
              label: formatDayLabel(date),
            }))}
          />
        </>
      )}

      {/* Footer */}
      {showNepDisclaimer && !disclaimerDismissed && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: "var(--ink-indigo, #1A2A3A)", borderTop: "2px solid var(--nep, #2563EB)",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", maxWidth: 900, margin: "0 auto", padding: "0.7rem 1rem" }}>
            <span style={{ fontSize: "1.3rem", flexShrink: 0, lineHeight: 1 }}>⚠️</span>
            <span style={{ flex: 1, fontSize: "0.8rem", color: "var(--washi-cream, #F9F4E8)", lineHeight: 1.45 }}>
              <strong style={{ color: "#93c5fd" }}>Let op:</strong> Eindtijden bij Neptunus zijn afhankelijk van het wedstrijdverloop (innings). Door het accepteren van deze dienst ga je akkoord met mogelijke uitloop.
            </span>
            <button onClick={() => setDisclaimerDismissed(true)} aria-label="Sluiten" style={{
              flexShrink: 0, background: "rgba(255,255,255,0.12)", border: "none",
              color: "var(--washi-cream, #F9F4E8)", width: 28, height: 28,
              borderRadius: 6, fontSize: "0.85rem", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0, lineHeight: 1,
            }}>
              ✕
            </button>
          </div>
        </div>
      )}
      <div className="site-footer">
        Gaar Culinair · Live rooster ·{" "}
        <a href="https://kraamwinkel.catering" target="_blank" rel="noopener" style={{ color: "var(--muted-gold, #C5A059)" }}>
          kraamwinkel.catering
        </a>
      </div>
    </AuthGate>
  );
}
