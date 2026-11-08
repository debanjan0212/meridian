import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { load } from "@cashfreepayments/cashfree-js"
import { comparison, LAUNCH_ENDS, PLANS, priceFor, type PlanId } from "@shared/pricing"
import { inr } from "@shared/route"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { Icon } from "@/components/Icon"
import { safeNext } from "@shared/destinations"
import { usePrefs } from "@/lib/prefs"

type Checkout = { orderId: string; sessionId: string; mode: "sandbox" | "production" }
type Verify = { status: string; passUntil: string | null }

export default function Pricing() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { session, me, refresh } = useAuth()
  const next = params.get("next") ? safeNext(params.get("next"), "/plan") : null
  const [plan, setPlan] = useState<PlanId>("month")
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const launch = new Date() <= LAUNCH_ENDS
  const mode = me?.paymentsMode ?? "off"
  const { currency, money } = usePrefs()

  const verify = async (orderId: string) => {
    const v = await api<Verify>("verify", { orderId })
    if (v.status === "PAID") {
      await refresh()
      setMsg(`Paid. Your pass is active until ${new Date(v.passUntil!).toLocaleDateString("en-IN", { dateStyle: "medium" })}.`)
      if (next) navigate(next)
    } else setMsg(v.status === "ACTIVE" ? "Payment not completed yet." : `Payment status: ${v.status}.`)
  }

  // Back from a redirect-style payment (UPI apps sometimes do this).
  useEffect(() => {
    const order = params.get("order")
    if (order && session) verify(order).catch((e) => setMsg(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id])

  const pay = async () => {
    if (!session) return navigate(`/signin?next=${encodeURIComponent(`/pricing${next ? `?next=${next}` : ""}`)}`)
    setBusy(true)
    setMsg("")
    try {
      const c = await api<Checkout>("checkout", { plan, phone })
      const cashfree = await load({ mode: c.mode })
      const result = await cashfree.checkout({ paymentSessionId: c.sessionId, redirectTarget: "_modal" })
      if (result?.error) setMsg(result.error.message || "Payment was not completed.")
      await verify(c.orderId)
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Could not start the payment. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wrap stack" style={{ padding: "48px 24px", gap: 32 }}>
      <div className="stack" style={{ maxWidth: 760 }}>
        <p className="kicker">Pricing</p>
        <h1 className="h1">One pass. <em className="gold">Every plan you need.</em></h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>Pay once, no auto-renew. Prices include all taxes. {launch && <>Launch prices last until 31 Mar 2027, then the regular price applies.</>}</p>
      </div>

      {mode === "off" && (
        <div className="card pad row" style={{ justifyContent: "space-between", borderColor: "#3f5a52", background: "#121a19" }}>
          <span><b style={{ color: "var(--sage)" }}>Free during the beta.</b> <span className="muted">Every feature is open while we test with friends. Passes start later.</span></span>
          <Link to={next || "/plan"} className="btn primary">Continue free <Icon name="arrow" /></Link>
        </div>
      )}
      {me?.admin && mode !== "off" && (
        <div className="card pad row" style={{ justifyContent: "space-between" }}>
          <span><b style={{ color: "var(--gold2)" }}>Admin · payment skipped.</b> <span className="muted">You can still run a {mode} checkout below to test the flow.</span></span>
          <Link to={next || "/plan"} className="btn primary">Continue as admin <Icon name="arrow" /></Link>
        </div>
      )}

      <div role="radiogroup" aria-label="Pass" className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {PLANS.map((p) => {
          const price = priceFor(p)
          const compare = comparison(p)
          const save = compare ? Math.round((1 - price / compare.amount) * 100) : 0
          const on = plan === p.id
          return (
            <button key={p.id} role="radio" aria-checked={on} onClick={() => setPlan(p.id)} className="card pad stack" style={{ textAlign: "left", cursor: "pointer", color: "inherit", borderColor: on ? "var(--gold)" : undefined, background: on ? "#1a1812" : undefined, position: "relative" }}>
              {p.id === "year" && <span className="pill check" style={{ position: "absolute", top: 18, right: 18 }}>Best value</span>}
              <span className="serif" style={{ fontSize: 30 }}>{p.name}</span>
              <span className="row" style={{ gap: 10, alignItems: "baseline" }}>
                <span className="serif" style={{ fontSize: 52, lineHeight: 1 }}>{inr(price)}</span>
                {price < p.regular && <s className="dim" style={{ fontSize: 18 }}>{inr(p.regular)}</s>}
              </span>
              <span className="muted" style={{ fontSize: 14 }}>{p.note} · {p.days} days</span>
              {currency !== "INR" && <span className="dim" style={{ fontSize: 13 }}>≈ {money(price)} · charged in rupees</span>}
              {compare && <span style={{ fontSize: 13, color: "var(--sage)", fontWeight: 600 }}>{inr(compare.amount)} as {compare.label} · save {save}%</span>}
            </button>
          )
        })}
      </div>

      {mode !== "off" && (
        <div className="card pad row" style={{ gap: 16, alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="phone">Mobile number (for the payment receipt)</label>
            <input id="phone" className="input" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button className="btn gold" onClick={pay} disabled={busy || phone.replace(/\D/g, "").length < 10}>
            {busy ? "Opening payment…" : `Pay ${inr(priceFor(PLANS.find((p) => p.id === plan)!))}`}
          </button>
          {mode === "sandbox" && <span className="pill warn">Test mode · no real money</span>}
        </div>
      )}
      {msg && <p role="status" style={{ margin: 0, color: msg.startsWith("Paid") ? "var(--sage)" : "var(--amber)" }}>{msg}</p>}
      <p className="dim" style={{ margin: 0, fontSize: 13 }}>Payments by Cashfree: UPI, cards, net banking and wallets. Meridian never sees your card or UPI details.</p>
    </div>
  )
}
