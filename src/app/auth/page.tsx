"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function AuthPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setLoading(false)
        setError(error.message)
        return
      }
      if (!data.session) {
        setLoading(false)
        setError("Account created. Ask the admin to confirm your account, then sign in.")
        setMode("signin")
        return
      }
      window.location.href = "/dashboard"
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }
    window.location.href = "/dashboard"
  }

  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={s.brandRow}>
          <div style={s.mark}>LK</div>
          <div>
            <div style={s.brand}>Latino Kings</div>
            <div style={s.brandSub}>Operations</div>
          </div>
        </div>

        <h1 style={s.heading}>
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p style={s.lede}>
          {mode === "signin"
            ? "Sign in to manage events, hospitality, lineup and budget."
            : "Set up access to the internal operations platform."}
        </p>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@latinokings.com"
              style={s.input}
              autoFocus
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
              style={s.input}
            />
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
            {!loading && <ArrowRight size={16} strokeWidth={2.2} />}
          </button>
        </form>

        <button
          type="button"
          style={s.toggle}
          onClick={() => {
            setError(null)
            setMode(mode === "signin" ? "signup" : "signin")
          }}
        >
          {mode === "signin"
            ? "First time here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>

      <div style={s.footer}>Latino Kings · Internal Operations Platform</div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "var(--bg)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    gap: 20,
  },
  card: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    padding: "36px 34px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "var(--shadow)",
    animation: "lk-fade-up 0.4s ease both",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 11,
    background: "var(--accent)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-fraunces), serif",
    fontWeight: 600,
    fontSize: 17,
    letterSpacing: "0.02em",
  },
  brand: {
    fontFamily: "var(--font-fraunces), serif",
    fontSize: 18,
    fontWeight: 600,
    color: "var(--text)",
    lineHeight: 1.1,
  },
  brandSub: {
    fontSize: 12,
    color: "var(--muted)",
    letterSpacing: "0.02em",
  },
  heading: {
    fontFamily: "var(--font-fraunces), serif",
    fontSize: 24,
    fontWeight: 600,
    color: "var(--text)",
    margin: "0 0 6px",
    letterSpacing: "-0.01em",
  },
  lede: {
    fontSize: 13.5,
    color: "var(--text-2)",
    lineHeight: 1.5,
    margin: "0 0 24px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 12.5,
    fontWeight: 500,
    color: "var(--text-2)",
  },
  input: {
    background: "var(--inset)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontSize: 14.5,
    padding: "11px 13px",
    outline: "none",
    transition: "border-color 0.15s, background 0.15s",
  },
  btn: {
    marginTop: 6,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    transition: "background 0.15s",
  },
  toggle: {
    background: "transparent",
    border: "none",
    color: "var(--accent)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    marginTop: 18,
    width: "100%",
    textAlign: "center",
  },
  error: {
    fontSize: 13,
    color: "var(--red)",
    background: "var(--red-tint)",
    borderRadius: 9,
    padding: "10px 12px",
    lineHeight: 1.45,
  },
  footer: {
    fontSize: 11.5,
    color: "var(--muted)",
    letterSpacing: "0.03em",
  },
}
