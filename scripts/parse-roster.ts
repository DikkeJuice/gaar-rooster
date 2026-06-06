/**
 * parse-roster.ts
 * 
 * Parses all .md roster files in data/rosters/ → outputs data/roster-data.json
 * Run: npx tsx scripts/parse-roster.ts
 */

import fs from "fs";
import path from "path";

interface Shift {
  start: string;
  end: string;
  location: string; // "NEP" or "HCD"
}

interface Match {
  date: string;
  time: string;
  club: string; // "Neptunus" or "HC Delfshaven"
  team: string;
  opponent: string;
  field: string;
}

interface EmployeeShifts {
  [date: string]: Shift | null; // null = day off ("—")
}

interface RosterWeek {
  week: number;
  startDate: string;
  endDate: string;
  days: string[]; // ISO date strings for Thu/Fri/Sat/Sun
  dayLabels: string[]; // e.g. "Thu 18/06"
  employees: {
    name: string;
    shifts: EmployeeShifts;
  }[];
  notes: string[]; // any special notes at bottom of file
  matches: Match[]; // matches for this week
}

const ROSTER_DIR = path.join(__dirname, "..", "data", "rosters");
const OUTPUT_FILE = path.join(__dirname, "..", "data", "roster-data.json");

// Month name → number (case-insensitive lookup)
const MONTH_NAMES: [string, number][] = [
  ["january", 0], ["february", 1], ["march", 2], ["april", 3], ["may", 4], ["june", 5],
  ["july", 6], ["august", 7], ["september", 8], ["october", 9], ["november", 10], ["december", 11],
  ["januari", 0], ["februari", 1], ["maart", 2], ["mei", 4], ["juni", 5],
  ["juli", 6], ["augustus", 7], ["oktober", 9],
];

function monthToNumber(name: string): number {
  const lower = name.toLowerCase();
  for (const [key, val] of MONTH_NAMES) {
    if (key === lower) return val;
  }
  throw new Error(`Unknown month: ${name}`);
}

function parseDate(day: number, monthName: string, year: number): string {
  const month = monthToNumber(monthName);
  const d = new Date(Date.UTC(year, month, day));
  return d.toISOString().split("T")[0];
}

function parseShift(cell: string): Shift | null {
  const trimmed = cell.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-" || trimmed === "–") {
    return null;
  }

  // Format: "HH:MM-HH:MM (LOC)" or "16:30-23:30 (NEP)"
  const match = trimmed.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*\((\w+)\)/);
  if (match) {
    return {
      start: match[1],
      end: match[2],
      location: match[3],
    };
  }

  // Fallback: just "HH:MM-HH:MM"
  const simpleMatch = trimmed.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
  if (simpleMatch) {
    return {
      start: simpleMatch[1],
      end: simpleMatch[2],
      location: "??",
    };
  }

  console.warn(`  ⚠ Could not parse shift: "${trimmed}"`);
  return null;
}

function parseRosterFile(filePath: string): RosterWeek | null {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Parse title: "# Rooster — Week 25 (15 June - 21 June 2026)"
  const titleMatch = lines[0]?.match(
    /#\s*Rooster\s*[-—]\s*Week\s*(\d+)\s*\((\d+)\s*(\w+)\s*[-–]\s*(\d+)\s*(\w+)\s*(\d{4})\)/i
  );
  if (!titleMatch) {
    // Try Dutch months
    const dutchMatch = lines[0]?.match(
      /#\s*Rooster\s*[-—]\s*Week\s*(\d+)\s*\((\d+)\s*(\w+)\s*[-–]\s*(\d+)\s*(\w+)\s*(\d{4})\)/i
    );
    if (!dutchMatch) {
      console.warn(`  ⚠ Could not parse title: "${lines[0]}"`);
      return null;
    }
    const [, week, startDay, startMonth, endDay, endMonth, year] = dutchMatch;
    return parseRosterBody(
      parseInt(week),
      parseDate(parseInt(startDay), startMonth, parseInt(year)),
      parseDate(parseInt(endDay), endMonth, parseInt(year)),
      lines
    );
  }

  const [, week, startDay, startMonth, endDay, endMonth, year] = titleMatch;
  return parseRosterBody(
    parseInt(week),
    parseDate(parseInt(startDay), startMonth, parseInt(year)),
    parseDate(parseInt(endDay), endMonth, parseInt(year)),
    lines
  );
}

function parseRosterBody(
  week: number,
  startDate: string,
  endDate: string,
  lines: string[]
): RosterWeek | null {
  // Find the table header line (line with "Medewerker")
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Medewerker")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    console.warn("  ⚠ Could not find table header");
    return null;
  }

  // Parse day labels and dates from header: "| Medewerker | Thu 18/06 | Fri 19/06 | ... |"
  const headerCells = lines[headerIdx]
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);

  const dayLabels: string[] = [];
  const days: string[] = [];
  const startD = new Date(startDate + "T00:00:00Z");

  // Day-of-week targets for Thu(4), Fri(5), Sat(6), Sun(0)
  const targetDows = [4, 5, 6, 0];

  for (let i = 1; i < headerCells.length; i++) {
    dayLabels.push(headerCells[i]);
    const targetDow = targetDows[i - 1];
    const daysToAdd = (targetDow - startD.getUTCDay() + 7) % 7;
    const d = new Date(startD);
    d.setUTCDate(startD.getUTCDate() + daysToAdd);
    days.push(d.toISOString().split("T")[0]);
  }

  // Parse employee rows
  const employees: RosterWeek["employees"] = [];
  const notes: string[] = [];

  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();

    // Empty line = end of table
    if (!line || line === "") continue;

    // Lines starting with ">" are notes
    if (line.startsWith(">")) {
      const noteText = line.replace(/^>\s*/, "").trim();
      if (noteText && !noteText.includes("ZK =") && !noteText.includes("MK =")) {
        notes.push(noteText);
      }
      continue;
    }

    // Employee row: "| **Name** | — | HH:MM-HH:MM (LOC) | ... |"
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);

    if (cells.length < 2) continue;

    // Extract name (strip ** markers)
    const name = cells[0].replace(/\*\*/g, "").trim();
    if (!name || name === "Flex") continue;

    const shifts: EmployeeShifts = {};
    for (let j = 1; j < cells.length && j - 1 < days.length; j++) {
      const dateKey = days[j - 1];
      shifts[dateKey] = parseShift(cells[j]);
    }

    employees.push({ name, shifts });
  }

  return { week, startDate, endDate, days, dayLabels, employees, notes, matches: [] };
}

function parseMatchCSV(filePath: string, club: string): Match[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = headers.indexOf("datum");
  const timeIdx = headers.indexOf("tijd");
  const teamIdx = headers.indexOf("team");
  const opponentIdx = headers.indexOf("tegenstander");
  const fieldIdx = headers.indexOf("veld");

  const matches: Match[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = line.split(",").map((c) => c.trim());
    const date = cells[dateIdx] || "";
    if (!date || !date.startsWith("2026-")) continue;

    matches.push({
      date,
      time: cells[timeIdx] || "",
      club,
      team: cells[teamIdx] || "",
      opponent: cells[opponentIdx] || "",
      field: fieldIdx >= 0 ? cells[fieldIdx] || "" : "",
    });
  }

  return matches;
}

function main() {
  console.log("📋 Parsing roster files...\n");

  const files = fs
    .readdirSync(ROSTER_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const weeks: RosterWeek[] = [];

  for (const file of files) {
    const filePath = path.join(ROSTER_DIR, file);
    console.log(`  ${file}`);
    const week = parseRosterFile(filePath);
    if (week) {
      weeks.push(week);
    }
  }

  // Sort by week number
  weeks.sort((a, b) => a.week - b.week);

  // Parse match data
  const DATA_DIR = path.join(__dirname, "..", "data");
  const nepMatches = parseMatchCSV(path.join(DATA_DIR, "neptunus_wedstrijden_2026.csv"), "Neptunus");
  const hcdMatches = parseMatchCSV(path.join(DATA_DIR, "hcd_wedstrijden_2026.csv"), "HC Delfshaven");
  const allMatches = [...nepMatches, ...hcdMatches];

  // Assign matches to weeks
  for (const w of weeks) {
    w.matches = allMatches.filter(
      (m) => m.date >= w.startDate && m.date <= w.endDate
    );
    // Sort by date, then time
    w.matches.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }

  const totalMatches = weeks.reduce((sum, w) => sum + w.matches.length, 0);

  // Output
  const output = {
    generated: new Date().toISOString(),
    totalWeeks: weeks.length,
    weeks,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✅ Written ${weeks.length} weeks to ${OUTPUT_FILE}`);

  // Summary
  const allEmployees = new Set<string>();
  for (const w of weeks) {
    for (const e of w.employees) {
      allEmployees.add(e.name);
    }
  }
  console.log(`   Employees: ${[...allEmployees].join(", ")}`);
  console.log(`   Matches: ${totalMatches}`);
  console.log(`   Date range: ${weeks[0]?.startDate} → ${weeks[weeks.length - 1]?.endDate}`);
}

main();
