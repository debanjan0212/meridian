import { useState } from "react"
import { Navigate } from "react-router-dom"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"

type Check = { name: string; ok: boolean; detail: string; ms: number }

export default function Admin() {
  const { me } = useAuth()
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  if (me && !me.admin) return <Navigate to="/" replace />

  const run = async () => {
    setBusy(true)
    setError("")
    try {
      setChecks((await api<{ results: Check[] }>("health")).results)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Health check failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wrap stack" style={{ padding: "48px 24px", gap: 24, maxWidth: 900 }}>
      <p className="kicker">Admin</p>
      <h1 className="h1">Service <em className="gold">health</em></h1>
      <p className="muted" style={{ margin: 0 }}>Signed in as {me?.email}. Payments mode: <b>{me?.paymentsMode}</b>. Admins skip payment everywhere.</p>
      <button className="btn primary" style={{ alignSelf: "flex-start" }} onClick={run} disabled={busy}>{busy ? "Checking…" : "Run checks"}</button>
      {error && <p className="error">{error}</p>}
      {checks && (
        <div className="card" style={{ overflow: "hidden" }}>
          {checks.map((c) => (
            <div key={c.name} className="list-row" style={{ padding: "14px 20px", borderBottom: "1px solid #1d2428" }}>
              <span><span className={`pill ${c.ok ? "ok" : "warn"}`}>{c.ok ? "OK" : "Fix"}</span> <b style={{ marginLeft: 8 }}>{c.name}</b></span>
              <span className="dim" style={{ textAlign: "right" }}>{c.detail} · {c.ms} ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
