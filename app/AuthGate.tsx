"use client";

import { useState, useEffect } from "react";

const COOKIE_NAME = "gaar-rooster-auth";
const PASSWORD = "frikandel";

function setCookie(value: string) {
  // Set cookie for 30 days
  const d = new Date();
  d.setTime(d.getTime() + 30 * 24 * 60 * 60 * 1000);
  document.cookie = `${COOKIE_NAME}=${value};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? match[1] : null;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const stored = getCookie();
    if (stored === PASSWORD) {
      setAuthed(true);
    }
    setChecking(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === PASSWORD) {
      setCookie(PASSWORD);
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
      setInput("");
    }
  };

  if (checking) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--washi-cream)",
          color: "var(--slate)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        Laden…
      </div>
    );
  }

  if (!authed) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--washi-cream)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <div
          style={{
            background: "white",
            padding: "2.5rem 2rem",
            borderRadius: "12px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            maxWidth: "360px",
            width: "90%",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "1.3rem",
              color: "var(--ink-indigo)",
              marginBottom: "0.5rem",
            }}
          >
            Gaar Culinair
          </h1>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--slate)",
              marginBottom: "1.5rem",
            }}
          >
            Interne roosterweergave
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Wachtwoord"
              autoFocus
              style={{
                width: "100%",
                padding: "0.65rem 1rem",
                border: error
                  ? "1.5px solid var(--danger)"
                  : "1px solid rgba(0,0,0,0.12)",
                borderRadius: "8px",
                fontFamily: "inherit",
                fontSize: "0.95rem",
                textAlign: "center",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={() => setError(false)}
            />
            {error && (
              <div
                style={{
                  color: "var(--danger)",
                  fontSize: "0.8rem",
                  marginTop: "0.4rem",
                }}
              >
                Verkeerd wachtwoord
              </div>
            )}
            <button
              type="submit"
              style={{
                width: "100%",
                marginTop: "0.75rem",
                padding: "0.6rem",
                background: "var(--ink-indigo)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontFamily: "inherit",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Bekijk rooster
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
