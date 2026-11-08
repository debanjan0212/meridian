import { useMemo, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import type { PlacesResult, Search } from "@shared/types"
import { addDays, inr, nightsStatus } from "@shared/route"
import { HOME_CITIES } from "@shared/destinations"
import { PlaceInput } from "@/components/PlaceInput"
import { BudgetField } from "@/components/BudgetField"
import { usePrefs } from "@/lib/prefs"
import { allDestinations, destinationIdeas, homeIdeas } from "@/lib/suggest"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { loadTrip, newTrip, saveTrip, type Candidate } from "@/lib/trip"
import { Photo } from "@/components/Photo"
import { Icon } from "@/components/Icon"

type Result = Omit<PlacesResult, "places"> & { places: Candidate[] }
const today = () => new Date().toISOString().slice(0, 10)

export default function Plan() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { session, me } = useAuth()
  const [search, setSearch] = useState<Search>({
    from: params.get("from") || "Bengaluru",
    to: params.get("to") || "",
    start: params.get("start") && params.get("start")! >= today() ? params.get("start")! : addDays(today(), 30),
    nights: Number(params.get("nights")) || 10,
    budget: Number(params.get("budget")) || 200000,
    adults: Number(params.get("adults")) || 2,
  })
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const last = loadTrip()
  const ideas = useMemo(destinationIdeas, [])
  const { money } = usePrefs()

  const set = <K extends keyof Search>(k: K, v: Search[K]) => setSearch((s) => ({ ...s, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!session) return navigate(`/signin?next=${encodeURIComponent(`/plan?${new URLSearchParams({ to: search.to, from: search.from, budget: String(search.budget) })}`)}`)
    setBusy(true)
    setError("")
    setResult(null)
    try {
      setResult(await api<Result>("places", search))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const update = (id: string, patch: Partial<Candidate>) =>
    setResult((r) => r && { ...r, places: r.places.map((p) => (p.id === id ? { ...p, ...patch } : p)) })

  const picked = result?.places.filter((p) => p.pick) ?? []
  const used = picked.reduce((n, p) => n + p.nights, 0)
  const status = nightsStatus(used, search.nights)

  const build = () => {
    if (!result) return
    saveTrip(newTrip(search, result))
    navigate(me?.canPlan ? "/trip" : "/pricing?next=/trip")
  }

  return (
    <div className="wrap stack" style={{ padding: "48px 24px", gap: 28 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div className="stack">
          <p className="kicker">Plan a trip</p>
          <h1 className="h1">Where should we <em className="gold">take you?</em></h1>
        </div>
        {last && <Link to="/trip">Continue “{last.result.title}” →</Link>}
      </div>

      <form onSubmit={submit} className="card pad" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", alignItems: "end" }}>
        <PlaceInput id="from" label="From" value={search.from} onChange={(v) => set("from", v)} options={HOME_CITIES} featured={homeIdeas()} placeholder="Your city" />
        <div style={{ gridColumn: "span 2" }}><PlaceInput id="to" label="To" value={search.to} onChange={(v) => set("to", v)} options={allDestinations()} featured={ideas} placeholder="Anywhere, or pick countries" multi /></div>
        <div className="field"><label htmlFor="start">Start</label><input id="start" type="date" className="input" min={today()} value={search.start} onChange={(e) => set("start", e.target.value)} required /></div>
        <div className="field"><label htmlFor="nights">Nights</label><input id="nights" type="number" min={1} max={30} className="input" value={search.nights} onChange={(e) => set("nights", Number(e.target.value))} required /></div>
        <div style={{ gridColumn: "span 2" }}><BudgetField id="budget" valueInr={search.budget} onChange={(v) => set("budget", v)} /></div>
        <div className="field"><label htmlFor="adults">Travellers</label><input id="adults" type="number" min={1} max={9} className="input" value={search.adults} onChange={(e) => set("adults", Number(e.target.value))} required /></div>
        <button className="btn gold" disabled={busy}>{busy ? "Finding places…" : "Suggest places"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}

      {busy && <div className="grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" style={{ height: 300 }} />)}</div>}

      {result && (
        <div className="trip-grid">
          <div className="stack" style={{ gap: 20 }}>
            <div className="stack" style={{ gap: 6 }}>
              <h2 className="h2">{result.title}</h2>
              <p className="muted" style={{ margin: 0 }}>Pick the places you want. We pre-selected a calm route; change anything.</p>
            </div>
            <div className="grid">
              {result.places.map((p, i) => (
                <article key={p.id} className="card rise" style={{ overflow: "hidden", opacity: p.closed ? 0.6 : 1, borderColor: p.pick ? "var(--gold)" : undefined, animationDelay: `${i * 40}ms` }}>
                  <div style={{ position: "relative" }}>
                    <Photo q={p.photo} alt={p.name} style={{ height: 170 }} />
                    {p.offbeat && <span className="pill ok" style={{ position: "absolute", top: 10, left: 10 }}>Hidden gem</span>}
                  </div>
                  <div className="stack pad" style={{ gap: 8 }}>
                    <span className="dim" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase" }}>{p.country}</span>
                    <h3 className="h3" style={{ fontSize: 24 }}>{p.name}</h3>
                    <p style={{ margin: 0, color: "var(--soft)", fontSize: 14, lineHeight: 1.55 }}>{p.note}</p>
                    {p.closed && <p style={{ margin: 0, fontSize: 13, color: "var(--amber)" }}>{p.closed}</p>}
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <button className="btn small" role="switch" aria-checked={p.pick} disabled={!!p.closed} onClick={() => update(p.id, { pick: !p.pick })} style={p.pick ? { background: "var(--gold)", color: "var(--bg)", borderColor: "var(--gold)" } : undefined}>
                        {p.pick ? <><Icon name="check" size={16} /> In the trip</> : "Add"}
                      </button>
                      {p.pick && (
                        <span className="stepper" role="group" aria-label={`Nights in ${p.name}`}>
                          <button onClick={() => update(p.id, { nights: Math.max(0, p.nights - 1) })} disabled={p.nights <= 0} aria-label="One night less">−</button>
                          <span style={{ minWidth: 62, textAlign: "center", fontSize: 13, fontWeight: 600 }}>{p.nights ? `${p.nights} night${p.nights > 1 ? "s" : ""}` : "Day trip"}</span>
                          <button onClick={() => update(p.id, { nights: Math.min(10, p.nights + 1) })} disabled={p.nights >= 10} aria-label="One more night">+</button>
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="sticky stack">
            <div className="card pad stack">
              <span className="dim" style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase" }}>Your selection</span>
              <span className="serif" style={{ fontSize: 44, lineHeight: 1 }}>{used} <span className="muted" style={{ fontSize: 22 }}>of {search.nights} nights</span></span>
              <div className="meter"><span style={{ width: `${Math.min(100, (used / search.nights) * 100)}%`, background: status.tone === "over" ? "var(--over)" : "var(--gold2)" }} /></div>
              <span style={{ fontWeight: 700, color: status.tone === "ok" ? "var(--sage)" : status.tone === "free" ? "var(--gold2)" : "var(--over)" }}>{status.text}</span>
              <div className="row" style={{ gap: 6 }}>{picked.map((p) => <span key={p.id} className="pill glass">{p.name}</span>)}</div>
              <span className="dim" style={{ fontSize: 13 }}>Budget {money(search.budget)} for {search.adults}. Flights and stays are priced live on the next step.</span>
              <button className="btn primary" disabled={!picked.length || status.tone === "over"} onClick={build}>Build my plan <Icon name="arrow" /></button>
            </div>
            {result.tips.length > 0 && (
              <div className="card pad stack" style={{ gap: 8 }}>
                <span className="dim" style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase" }}>Good to know</span>
                {result.tips.map((t) => <p key={t} style={{ margin: 0, fontSize: 14, color: "var(--soft)", lineHeight: 1.55 }}>· {t}</p>)}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
