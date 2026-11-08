import { useState, type FormEvent } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { Photo } from "@/components/Photo"
import { safeNext } from "@shared/destinations"

type Method = "google" | "email" | "password"

export default function SignIn() {
  const { session } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get("next"), "/plan")
  const [method, setMethod] = useState<Method>("google")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  if (session) return <Navigate to={next} replace />
  if (!supabase) return <SetupNotice />

  const redirectTo = `${window.location.origin}${next}`
  const run = async (fn: () => Promise<{ error: { message: string } | null }>, okText?: string) => {
    setBusy(true)
    setMsg(null)
    const { error } = await fn()
    setBusy(false)
    setMsg(error ? { ok: false, text: error.message } : okText ? { ok: true, text: okText } : null)
  }
  const google = () => run(() => supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo } }))
  const email = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const address = String(new FormData(e.currentTarget).get("email"))
    run(() => supabase!.auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirectTo } }), `Check ${address} for a sign-in link.`)
  }
  const password = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    run(() => supabase!.auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) }))
  }

  return (
    <div className="wrap row" style={{ padding: "48px 24px", gap: 48, alignItems: "stretch" }}>
      <div className="card" style={{ flex: "1 1 420px", minHeight: 520, overflow: "hidden", position: "relative" }}>
        <Photo file="finland-northern-lights.jpg" q="lapland northern lights" style={{ position: "absolute", inset: 0 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(13,17,20,.2), rgba(13,17,20,.92))" }} />
        <div className="stack" style={{ position: "absolute", left: 32, right: 32, bottom: 32 }}>
          <span className="serif" style={{ fontSize: 30 }}>Meridian</span>
          <p className="serif" style={{ margin: 0, fontSize: 38, lineHeight: 1.1 }}>The world is wide. <em className="gold">Your plan fits on one page.</em></p>
        </div>
      </div>

      <div className="stack" style={{ flex: "1 1 380px", maxWidth: 460, justifyContent: "center", gap: 20 }}>
        <p className="kicker">Welcome</p>
        <h1 className="h1" style={{ fontSize: 52 }}>Sign in to <em className="gold">Meridian</em></h1>
        <div className="seg" role="tablist" aria-label="Sign-in method">
          {(["google", "email", "password"] as Method[]).map((m) => (
            <button key={m} role="tab" aria-selected={method === m} onClick={() => setMethod(m)}>
              {m === "google" ? "Google" : m === "email" ? "Email link" : "Password"}
            </button>
          ))}
        </div>

        {method === "google" && (
          <button className="btn primary" style={{ minHeight: 58 }} onClick={google} disabled={busy}>Continue with Google</button>
        )}
        {method === "email" && (
          <form onSubmit={email} className="stack">
            <div className="field"><label htmlFor="em">Email</label><input id="em" name="email" type="email" required className="input" autoComplete="email" /></div>
            <button className="btn primary" disabled={busy}>Email me a sign-in link</button>
          </form>
        )}
        {method === "password" && (
          <form onSubmit={password} className="stack">
            <div className="field"><label htmlFor="pe">Email</label><input id="pe" name="email" type="email" required className="input" autoComplete="email" /></div>
            <div className="field"><label htmlFor="pw">Password</label><input id="pw" name="password" type="password" required className="input" autoComplete="current-password" /></div>
            <button className="btn primary" disabled={busy}>Sign in</button>
            <span className="dim" style={{ fontSize: 13 }}>For accounts created by the team, like the admin account.</span>
          </form>
        )}
        {msg && <p className={msg.ok ? "" : "error"} style={{ margin: 0, color: msg.ok ? "var(--sage)" : undefined }} role="status">{msg.text}</p>}
        <p className="dim" style={{ margin: 0, fontSize: 13 }}>No passwords to remember for most people. We never post or share anything.</p>
      </div>
    </div>
  )
}

function SetupNotice() {
  return (
    <div className="wrap" style={{ padding: "80px 24px" }}>
      <div className="card pad stack">
        <h1 className="h3">Sign-in is not set up yet</h1>
        <p className="muted" style={{ margin: 0 }}>Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Netlify's environment variables, then redeploy.</p>
      </div>
    </div>
  )
}
