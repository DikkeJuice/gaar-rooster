"use client";

import { useState, useMemo } from "react";
import rosterData from "@/data/roster-data.json";
import AnnotationPanel from "./AnnotationPanel";

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
}

type ClubFilter = "all" | "NEP" | "HCD";

const typedData = rosterData as { weeks: RosterWeek[]; generated: string };
const WEEKS = typedData.weeks;

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
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
  // "Thu 18/06" → "do 18/06"
  const dayMap: Record<string, string> = {
    Mon: "ma", Tue: "di", Wed: "wo", Thu: "do", Fri: "vr", Sat: "za", Sun: "zo",
  };
  for (const [en, nl] of Object.entries(dayMap)) {
    if (label.startsWith(en)) {
      return nl + label.slice(3);
    }
  }
  return label;
}

export default function RosterPage() {
  // Find current week (containing today)
  const today = new Date().toISOString().split("T")[0];
  const currentWeekIdx = useMemo(() => {
    const idx = WEEKS.findIndex(
      (w) => today >= w.startDate && today <= w.endDate
    );
    return idx >= 0 ? idx : WEEKS.length - 1;
  }, []);

  const [weekIdx, setWeekIdx] = useState(currentWeekIdx);
  const [clubFilter, setClubFilter] = useState<ClubFilter>("all");

  const week = WEEKS[weekIdx];
  if (!week) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500">
        Geen roosterdata beschikbaar.
      </div>
    );
  }

  // Filter employees: show only those with shifts at the selected club
  const filteredEmployees = useMemo(() => {
    if (clubFilter === "all") return week.employees;

    return week.employees.filter((emp) => {
      return Object.values(emp.shifts).some(
        (shift) => shift && shift.location === clubFilter
      );
    });
  }, [week, clubFilter]);

  // Day columns to show (all 4 days: Thu-Sun)
  const dayColumns = week.days.map((date, i) => ({
    date,
    label: formatDayLabel(week.dayLabels[i]),
  }));

  return (
    <>
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
      <div className="club-filter" style={{ justifyContent: "center", gap: "0.35rem", flexWrap: "wrap" }}>
        {WEEKS.map((w, i) => (
          <button
            key={w.week}
            onClick={() => setWeekIdx(i)}
            className={i === weekIdx ? "current" : ""}
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
          >
            W{w.week}
          </button>
        ))}
      </div>

      {/* Club filter */}
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

      {/* Roster grid */}
      <div className="roster-grid">
        <table className="roster-table">
          <thead>
            <tr>
              <th>Medewerker</th>
              {dayColumns.map((dc) => (
                <th key={dc.date}>{dc.label}</th>
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
                  Geen diensten voor deze club in week {week.week}.
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
                        {shift.start} – {shift.end}
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
      </div>

      {/* Notes (filtered: no legend, render markdown bold + code) */}
      {(() => {
        const realNotes = week.notes.filter(
          (n) => !n.startsWith("**ZK** =") && !n.startsWith("ZK =")
        );
        if (realNotes.length === 0) return null;

        function renderNote(text: string) {
          // Bold: **text** → <strong>
          let html = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
          // Inline code: `text` → <code>
          html = html.replace(/`(.+?)`/g, "<code>$1</code>");
          return html;
        }

        return (
          <div className="roster-notes">
            {realNotes.map((n, i) => (
              <div key={i} dangerouslySetInnerHTML={{ __html: renderNote(n) }} />
            ))}
          </div>
        );
      })()}

      {/* Annotations */}
      <AnnotationPanel
        week={week.week}
        employees={week.employees.map((e) => e.name)}
      />

      {/* Footer */}
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
    </>
  );
}
