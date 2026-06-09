"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──
interface Week {
  id: number;
  week_number: number;
  start_date: string;
  end_date: string;
}
interface Employee {
  id: number;
  name: string;
}
interface Shift {
  id: number;
  employee_id: number;
  employee_name: string;
  week_id: number;
  week_number: number;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
}

// ── Config ──
const API_BASE = "https://petra-unsulliable-alyce.ngrok-free.dev";

// ── API helper ──
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("gaar_admin_token");
}

async function api(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    sessionStorage.removeItem("gaar_admin_token");
    throw new Error("SESSION_EXPIRED");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Styles ──
const css = {
  container: { maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)" } as React.CSSProperties,
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" } as React.CSSProperties,
  title: { fontSize: "1.5rem", fontWeight: 700, color: "var(--ink-indigo, #1A2A3A)", margin: 0 } as React.CSSProperties,
  logoutBtn: { background: "none", border: "1px solid var(--slate, #6B7280)", color: "var(--slate, #6B7280)", padding: "0.4rem 1rem", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" } as React.CSSProperties,
  select: { padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.9rem", marginBottom: "1rem", minWidth: 280 } as React.CSSProperties,
  addForm: { background: "var(--washi-cream, #F9F4E8)", padding: "1rem", borderRadius: 8, marginBottom: "1.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" } as React.CSSProperties,
  input: { padding: "0.4rem 0.6rem", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.85rem" } as React.CSSProperties,
  addBtn: { padding: "0.4rem 1.2rem", background: "var(--muted-gold, #C5A059)", color: "var(--ink-indigo, #1A2A3A)", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", background: "#fff", borderRadius: 8, overflow: "hidden" } as React.CSSProperties,
  th: { textAlign: "left", padding: "0.6rem 0.75rem", borderBottom: "2px solid var(--ink-indigo, #1A2A3A)", color: "var(--ink-indigo, #1A2A3A)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" } as React.CSSProperties,
  td: { padding: "0.5rem 0.75rem", borderBottom: "1px solid #eee" } as React.CSSProperties,
  delBtn: { background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "1.1rem", padding: "0 0.25rem" } as React.CSSProperties,
  badge: (loc: string) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", background: loc === "NEP" ? "#dbeafe" : "#dcfce7", color: loc === "NEP" ? "#1e40af" : "#166534" }),
  inlineInput: { width: 65, padding: "0.2rem 0.3rem", borderRadius: 3, border: "1px solid #ddd", fontSize: "0.8rem", textAlign: "center" } as React.CSSProperties,
  saveBtn: { padding: "0.2rem 0.5rem", background: "var(--muted-gold, #C5A059)", color: "var(--ink-indigo, #1A2A3A)", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 } as React.CSSProperties,
};

// ── Login Screen ──
function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        headers: { "Content-Type": "application/json" },
      });
      sessionStorage.setItem("gaar_admin_token", data.token);
      window.location.reload();
    } catch (e: any) {
      setError(e.message || "Inloggen mislukt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: "6rem auto", padding: "2rem", background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      <h2 style={{ margin: "0 0 1.5rem", color: "var(--ink-indigo, #1A2A3A)", fontSize: "1.3rem" }}>Gaar Rooster Admin</h2>
      <input
        type="text"
        placeholder="Gebruikersnaam"
        value={username}
        onChange={e => setUsername(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleLogin()}
        autoFocus
        style={{ ...css.input, width: "100%", marginBottom: "0.75rem", boxSizing: "border-box" }}
      />
      <input
        type="password"
        placeholder="Wachtwoord"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleLogin()}
        style={{ ...css.input, width: "100%", marginBottom: "0.75rem", boxSizing: "border-box" }}
      />
      {error && <p style={{ color: "#dc2626", fontSize: "0.8rem", margin: "0 0 0.75rem" }}>{error}</p>}
      <button onClick={handleLogin} disabled={loading} style={{ ...css.addBtn, width: "100%", padding: "0.6rem" }}>
        {loading ? "Inloggen..." : "Inloggen"}
      </button>
    </div>
  );
}

// ── Admin Dashboard ──
export default function AdminClient() {
  const [authed, setAuthed] = useState(false);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [error, setError] = useState("");

  // ── New shift form state ──
  const [newEmp, setNewEmp] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newLoc, setNewLoc] = useState("NEP");

  // ── Inline edit state ──
  const [editId, setEditId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editLoc, setEditLoc] = useState("");

  // Check auth on mount
  useEffect(() => {
    if (getToken()) setAuthed(true);
  }, []);

  // Load data
  const loadMeta = useCallback(async () => {
    try {
      const [w, e] = await Promise.all([api("/api/weeks"), api("/api/employees")]);
      setWeeks(w);
      setEmployees(e);
      if (w.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const current = w.find((wk: Week) => today >= wk.start_date && today <= wk.end_date);
        setSelectedWeekId(current?.id || w[0].id);
      }
    } catch (e: any) {
      if (e.message === "SESSION_EXPIRED") { setAuthed(false); return; }
      setError(String(e));
    }
  }, []);

  const loadShifts = useCallback(async (weekId: number) => {
    try {
      const s = await api(`/api/shifts?week_id=${weekId}`);
      setShifts(s);
    } catch (e: any) {
      if (e.message === "SESSION_EXPIRED") { setAuthed(false); return; }
      setError(String(e));
    }
  }, []);

  useEffect(() => { if (authed) loadMeta(); }, [authed, loadMeta]);
  useEffect(() => { if (selectedWeekId) loadShifts(selectedWeekId); }, [selectedWeekId, loadShifts]);

  // ── CRUD actions ──
  const addShift = async () => {
    if (!newEmp || !newDate || !newStart || !newEnd || !selectedWeekId) return;
    setError("");
    try {
      await api("/api/shifts", {
        method: "POST",
        body: JSON.stringify({
          employee_name: newEmp,
          week_id: selectedWeekId,
          date: newDate,
          start_time: newStart,
          end_time: newEnd,
          location: newLoc,
        }),
      });
      setNewEmp(""); setNewDate(""); setNewStart(""); setNewEnd(""); setNewLoc("NEP");
      loadShifts(selectedWeekId);
    } catch (e: any) { setError(String(e)); }
  };

  const startEdit = (s: Shift) => {
    setEditId(s.id);
    setEditStart(s.start_time);
    setEditEnd(s.end_time);
    setEditLoc(s.location);
  };

  const saveEdit = async () => {
    if (!editId || !selectedWeekId) return;
    const shift = shifts.find(s => s.id === editId);
    if (!shift) return;
    setError("");
    try {
      await api(`/api/shifts/${editId}`, {
        method: "PUT",
        body: JSON.stringify({
          date: shift.date,
          start_time: editStart,
          end_time: editEnd,
          location: editLoc,
        }),
      });
      setEditId(null);
      loadShifts(selectedWeekId);
    } catch (e: any) { setError(String(e)); }
  };

  const deleteShift = async (id: number) => {
    if (!confirm("Deze shift definitief verwijderen?")) return;
    setError("");
    try {
      await api(`/api/shifts/${id}`, { method: "DELETE" });
      loadShifts(selectedWeekId!);
    } catch (e: any) { setError(String(e)); }
  };

  const logout = () => {
    sessionStorage.removeItem("gaar_admin_token");
    setAuthed(false);
  };

  if (!authed) return <LoginScreen />;

  return (
    <div style={css.container}>
      <div style={css.header}>
        <h1 style={css.title}>Gaar Rooster Admin</h1>
        <button onClick={logout} style={css.logoutBtn}>Uitloggen</button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", padding: "0.5rem 1rem", borderRadius: 6, marginBottom: "1rem", fontSize: "0.85rem" }}>
          {error}
          <button onClick={() => setError("")} style={{ marginLeft: "0.75rem", background: "none", border: "none", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>
      )}

      {/* Week selector */}
      <select value={selectedWeekId || ""} onChange={e => setSelectedWeekId(Number(e.target.value))} style={css.select}>
        {weeks.map(w => (
          <option key={w.id} value={w.id}>Week {w.week_number} &nbsp;({w.start_date} – {w.end_date})</option>
        ))}
      </select>

      {/* Add shift form */}
      <div style={css.addForm}>
        <select value={newEmp} onChange={e => setNewEmp(e.target.value)} style={css.input}>
          <option value="">Medewerker...</option>
          {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
        </select>
        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={css.input} />
        <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} style={css.input} placeholder="Start" />
        <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} style={css.input} placeholder="Eind" />
        <select value={newLoc} onChange={e => setNewLoc(e.target.value)} style={css.input}>
          <option value="NEP">Neptunus</option>
          <option value="HCD">HC Delfshaven</option>
        </select>
        <button onClick={addShift} style={css.addBtn}>+ Toevoegen</button>
      </div>

      {/* Shifts table */}
      <table style={css.table}>
        <thead>
          <tr>
            <th style={css.th}>Medewerker</th>
            <th style={css.th}>Datum</th>
            <th style={css.th}>Start</th>
            <th style={css.th}>Eind</th>
            <th style={css.th}>Locatie</th>
            <th style={{ ...css.th, width: 80 }}></th>
          </tr>
        </thead>
        <tbody>
          {shifts.map(s => (
            <tr key={s.id}>
              <td style={css.td}>{s.employee_name}</td>
              <td style={css.td}>{s.date}</td>
              <td style={css.td}>
                {editId === s.id ? (
                  <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} style={css.inlineInput} />
                ) : s.start_time}
              </td>
              <td style={css.td}>
                {editId === s.id ? (
                  <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} style={css.inlineInput} />
                ) : s.end_time}
              </td>
              <td style={css.td}>
                {editId === s.id ? (
                  <select value={editLoc} onChange={e => setEditLoc(e.target.value)} style={css.input}>
                    <option value="NEP">NEP</option>
                    <option value="HCD">HCD</option>
                  </select>
                ) : (
                  <span style={css.badge(s.location)}>{s.location}</span>
                )}
              </td>
              <td style={css.td}>
                {editId === s.id ? (
                  <>
                    <button onClick={saveEdit} style={css.saveBtn}>Opslaan</button>
                    <button onClick={() => setEditId(null)} style={{ ...css.delBtn, color: "#666", marginLeft: 4 }}>✕</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(s)} style={{ ...css.delBtn, color: "var(--muted-gold, #C5A059)", fontSize: "0.85rem" }}>✎</button>
                    <button onClick={() => deleteShift(s.id)} style={css.delBtn}>🗑</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {shifts.length === 0 && (
            <tr><td colSpan={6} style={{ ...css.td, textAlign: "center", color: "#999", padding: "2rem" }}>Geen shifts deze week</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
