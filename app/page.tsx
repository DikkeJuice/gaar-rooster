"use client";

import { useState, useMemo } from "react";
import rosterData from "@/data/roster-data.json";
import AnnotationPanel from "./AnnotationPanel";
import MatchList from "./MatchList";
import AuthGate from "./AuthGate";

interface Match {
  date: string;
  time: string;
  club: string;
  team: string;
  opponent: string;
  field: string;
}

interface Shift {
  start: string;
  end: string;
  location: string;
}

interface EmployeeShifts {
  [date: string]: Shift | null;
}

interface RosterEmployee {
  name: string;
  shifts: EmployeeShifts;
}

interface RosterWeek {
  week: number;
  startDate: string;
  endDate: string;
  days: string[];
  dayLabels: string[];
  employees: RosterEmployee[];
  notes: string[];
  matches: Match[];
}

type ClubFilter = "all" | "NEP" | "HCD";

const typedData = rosterData as { weeks: RosterWeek[]; generated: string };
const WEEKS = typedData.weeks;

// Collect all unique employee names across all weeks
const ALL_EMPLOYEES = [...new Set(
  WEEKS.flatMap((w) => w.employees.map((e) => e.name))
)].sort();

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const months = [
    "jan", "feb", "mrt", "apr", "mei", "jun",
    "jul", "aug", "sep", "okt", "nov", "dec",
  ];
  const sDay = s.getUTCDate();
  const eDay = e.getUTCDate();
  const sMonth = months[s.getUTCMonth()];
  const eMonth = months[e.getUTCMonth()];
  if (sMonth === eMonth) {
    return `${sDay} – ${eDay} ${eMonth}`;
  }
  return `${sDay} ${sMonth} – ${eDay} ${eMonth}`;
}

function formatDayLabel(label: string): string {
  const dayMap: Record<string, string> = {
    Mon: "ma", Tue: "di", Wed: "wo", Thu: "do", Fri: "vr", Sat: "za", Sun: "zo",
  };
  let short = label;
  for (const [en, nl] of Object.entries(dayMap)) {
    if (label.startsWith(en)) {
      short = nl + label.slice(3);
    }
  }
  return short;
}

function formatDayLabelMobile(label: string): string {
  return formatDayLabel(label).replace(/\/\d+$/, "");
}

function formatDutchDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  const months = [
    "jan", "feb", "mrt", "apr", "mei", "jun",
    "jul", "aug", "sep", "okt", "nov", "dec",
  ];
  const days = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

export default function RosterPage() {
  const today = new Date().toISOString().split("T")[0];
  const currentWeekIdx = useMemo(() => {
    const idx = WEEKS.findIndex(
      (w) => today >= w.startDate && today <= w.endDate
    );
    return idx >= 0 ? idx : WEEKS.length - 1;
  }, []);

  const [weekIdx, setWeekIdx] = useState(currentWeekIdx);
  const [clubFilter, setClubFilter] = useState<ClubFilter>("all");
  const [nameFilter, setNameFilter] = useState<string>("");

  const week = WEEKS[weekIdx];
  if (!week) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500">
        Geen roosterdata beschikbaar.
      </div>
    );
  }

  // ── Personal schedule view (when a name is selected) ──
  const personalShifts = useMemo(() => {
    if (!nameFilter) return [];

    const shifts: {
      date: string;
      week: number;
      start: string;
      end: string;
      location: string;
    }[] = [];

    for (const w of WEEKS) {
      const emp = w.employees.find((e) => e.name === nameFilter);
      if (!emp) continue;
      for (const [date, shift] of Object.entries(emp.shifts)) {
        if (!shift) continue;
        if (clubFilter !== "all" && shift.location !== clubFilter) continue;
        shifts.push({
          date,
          week: w.week,
          start: shift.start,
          end: shift.end,
          location: shift.location,
        });
      }
    }

    // Sort by date ascending
    shifts.sort((a, b) => a.date.localeCompare(b.date));
    return shifts;
  }, [nameFilter, clubFilter]);

  // ── Regular grid view (no name filter) ──
  const filteredEmployees = useMemo(() => {
    if (clubFilter === "all") return week.employees;

    return week.employees.filter((emp) => {
      return Object.values(emp.shifts).some(
        (shift) => shift && shift.location === clubFilter
      );
    });
  }, [week, clubFilter]);

  const dayColumns = useMemo(() => {
    const allDays = week.days.map((date, i) => ({
      date,
      label: formatDayLabel(week.dayLabels[i]),
      labelShort: formatDayLabelMobile(week.dayLabels[i]),
    }));

    const pool = clubFilter === "all" ? week.employees : filteredEmployees;

    return allDays.filter((day) => {
      return pool.some((emp) => emp.shifts[day.date] !== null);
    });
  }, [week, clubFilter, filteredEmployees]);

  // ── Nep disclaimer: show when NEP shifts are visible ──
  const showNepDisclaimer = useMemo(() => {
    if (nameFilter && personalShifts.length > 0) {
      return personalShifts.some((s) => s.location === "NEP");
    }
    if (clubFilter === "HCD") return false;
    const pool = clubFilter === "all" ? week.employees : filteredEmployees;
    return pool.some((emp) =>
      Object.values(emp.shifts).some((s) => s && s.location === "NEP")
    );
  }, [nameFilter, personalShifts, clubFilter, week, filteredEmployees]);

  return (
    <AuthGate>
      {/* Week navigation */}
      <div className="week-nav">
        <button
          onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
          disabled={weekIdx === 0}
        >
          ← Vorige
        </button>
        <h1>
          Week {week.week} — {formatDateRange(week.startDate, week.endDate)}
        </h1>
        <button
          onClick={() => setWeekIdx((i) => Math.min(WEEKS.length - 1, i + 1))}
          disabled={weekIdx === WEEKS.length - 1}
        >
          Volgende →
        </button>
      </div>

      {/* Quick week jump */}
      <div className="week-strip">
        {WEEKS.map((w, i) => (
          <button
            key={w.week}
            onClick={() => setWeekIdx(i)}
            className={i === weekIdx ? "current" : ""}
          >
            W{w.week}
          </button>
        ))}
      </div>

      {/* Club filter + Name filter */}
      <div className="filters-row">
        <div className="club-filter">
          <button
            onClick={() => setClubFilter("all")}
            className={clubFilter === "all" ? "active" : ""}
          >
            Alle clubs
          </button>
          <button
            onClick={() => setClubFilter("NEP")}
            className={clubFilter === "NEP" ? "active" : ""}
          >
            ⚾ Neptunus
          </button>
          <button
            onClick={() => setClubFilter("HCD")}
            className={clubFilter === "HCD" ? "active" : ""}
          >
            🏑 HC Delfshaven
          </button>
        </div>

        <div className="name-filter">
          <select
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
          >
            <option value="">👤 Alle medewerkers</option>
            {ALL_EMPLOYEES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {nameFilter && (
            <button
              className="name-filter-clear"
              onClick={() => setNameFilter("")}
              title="Wis filter"
            >
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
                    <td>
                      {s.start} – {s.end}{s.location === "NEP" ? "*" : ""}
                    </td>
                    <td>
                      <span className={`shift-badge ${s.location.toLowerCase()}`}>
                        {s.location}
                      </span>
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
              <div
                style={{
                  textAlign: "center",
                  padding: "2.5rem 1rem",
                  color: "var(--slate)",
                  background: "white",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                }}
              >
                Geen diensten voor {clubFilter === "all" ? "deze week" : clubFilter === "NEP" ? "Neptunus" : "HC Delfshaven"} in week {week.week}.
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
                    <td
                      colSpan={dayColumns.length + 1}
                      style={{ textAlign: "center", padding: "2rem", color: "var(--slate)" }}
                    >
                      Geen medewerkers met diensten voor deze club in week {week.week}.
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

          {/* Notes + Matches */}
          {(() => {
            const realNotes = week.notes.filter(
              (n) => !n.startsWith("**ZK** =") && !n.startsWith("ZK =")
            );

            const filteredMatches = clubFilter === "all"
              ? week.matches
              : week.matches.filter((m) =>
                  clubFilter === "NEP" ? m.club === "Neptunus" : m.club === "HC Delfshaven"
                );

            if (realNotes.length === 0 && filteredMatches.length === 0) return null;

            return (
              <>
                {realNotes.length > 0 && (
                  <div className="roster-notes">
                    {realNotes.map((n, i) => (
                      <div
                        key={i}
                        dangerouslySetInnerHTML={{
                          __html: (() => {
                            let html = n.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
                            html = html.replace(/`(.+?)`/g, "<code>$1</code>");
                            return html;
                          })(),
                        }}
                      />
                    ))}
                  </div>
                )}
                <MatchList matches={filteredMatches} />
              </>
            );
          })()}

          {/* Annotations */}
          <AnnotationPanel
            week={week.week}
            employees={week.employees.map((e) => e.name)}
            days={week.days.map((date, i) => ({
              date,
              label: formatDayLabel(week.dayLabels[i]),
            }))}
          />
        </>
      )}

      {/* Footer */}
      {showNepDisclaimer && (
        <div className="nep-disclaimer">
          * Eindtijden bij Neptunus zijn afhankelijk van het wedstrijdverloop (innings).<br />
          Door het accepteren van deze dienst ga je akkoord met mogelijke uitloop.
        </div>
      )}
      <div className="site-footer">
        Gaar Culinair · Rooster bijgewerkt {new Date(typedData.generated).toLocaleDateString("nl-NL")} ·{" "}
        <a
          href="https://kraamwinkel.catering"
          target="_blank"
          rel="noopener"
          style={{ color: "var(--muted-gold)" }}
        >
          kraamwinkel.catering
        </a>
      </div>
    </AuthGate>
  );
}
