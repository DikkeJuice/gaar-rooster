"use client";

interface Match {
  date: string;
  time: string;
  club: string;
  team: string;
  opponent: string;
  field: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  const day = days[d.getUTCDay()];
  const date = d.getUTCDate();
  const months = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const month = months[d.getUTCMonth()];
  return `${day} ${date} ${month}`;
}

function shortenTeam(name: string): string {
  // "Neptunus - MHU15-1" → "MHU15-1" or keep original if short enough
  return name.replace(/^(Neptunus|Rotterdam Unicorns|HC Delfshaven)\s*[-–]\s*/i, "");
}

export default function MatchList({ matches }: { matches: Match[] }) {
  if (matches.length === 0) return null;

  // Group by date
  const grouped = new Map<string, Match[]>();
  for (const m of matches) {
    const list = grouped.get(m.date) || [];
    list.push(m);
    grouped.set(m.date, list);
  }

  return (
    <div style={{ padding: "0 1rem 1.5rem" }}>
      <h3
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--ink-indigo)",
          marginBottom: "0.75rem",
        }}
      >
        Wedstrijden deze week ({matches.length})
      </h3>

      {Array.from(grouped.entries()).map(([date, dayMatches]) => (
        <div
          key={date}
          style={{
            background: "white",
            borderRadius: "8px",
            marginBottom: "0.5rem",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              background: "var(--ink-indigo)",
              color: "white",
              padding: "0.4rem 0.75rem",
              fontSize: "0.78rem",
              fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {formatDate(date)} · {dayMatches.length} wedstrijd{dayMatches.length > 1 ? "en" : ""}
          </div>
          <div style={{ padding: "0.35rem 0" }}>
            {dayMatches.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.3rem 0.75rem",
                  fontSize: "0.78rem",
                  borderBottom:
                    i < dayMatches.length - 1
                      ? "1px solid rgba(0,0,0,0.04)"
                      : "none",
                }}
              >
                <span
                  style={{
                    color: "var(--slate)",
                    fontWeight: 500,
                    minWidth: "2.8rem",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {m.time.slice(0, 5)}
                </span>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    padding: "0.05rem 0.35rem",
                    borderRadius: "3px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: m.club === "Neptunus" ? "var(--nep)" : "var(--hcd)",
                    background:
                      m.club === "Neptunus"
                        ? "rgba(37,99,235,0.08)"
                        : "rgba(5,150,105,0.08)",
                    flexShrink: 0,
                  }}
                >
                  {m.club === "Neptunus" ? "NEP" : "HCD"}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 500, color: "var(--ink-indigo)" }}>
                    {shortenTeam(m.team)}
                  </span>{" "}
                  <span style={{ color: "var(--slate)" }}>vs</span>{" "}
                  <span style={{ color: "var(--slate)" }}>
                    {m.opponent.length > 28
                      ? m.opponent.slice(0, 28) + "…"
                      : m.opponent}
                  </span>
                </span>
                {m.field && (
                  <span
                    style={{
                      color: "var(--slate)",
                      fontSize: "0.7rem",
                      opacity: 0.7,
                      flexShrink: 0,
                    }}
                  >
                    {m.field}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
