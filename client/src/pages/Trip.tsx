import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import type { Flight, Hotel, Leg } from "@shared/types"
import { addDays, inr, legPairs, move, nightsStatus, schedule, totals, type Stop } from "@shared/route"
import { visaFor } from "@shared/visa"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { useTrip, type Trip as TripT } from "@/lib/trip"
import { Photo } from "@/components/Photo"
import { Icon } from "@/components/Icon"
import { Concierge } from "@/components/Concierge"

const hotelKey = (id: string, checkin: string, checkout: string) => `${id}|${checkin}|${checkout}`
const time = (s: string | null) => (s ? s.slice(11, 16) : "")
const hours = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`

export default function Trip() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [trip, setTrip] = useTrip()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const [sort, setSort] = useState<"cheap" | "fast">("cheap")
  const [saving, setSaving] = useState("")
  const inflight = useRef(new Set<string>())

  const patch = (p: Partial<TripT> | ((t: TripT) => Partial<TripT>)) => setTrip((t) => (t ? { ...t, ...(typeof p === "function" ? p(t) : p) } : t))
  const fail = (key: string, err: unknown) => setErrors((e) => ({ ...e, [key]: err instanceof ApiError ? err.message : "Could not load this." }))

  const stops = trip?.stops ?? []
  const sched = useMemo(() => (trip ? schedule(stops, trip.search.start) : []), [trip?.search.start, stops])
  const totalNights = stops.reduce((n, s) => n + s.nights, 0)
  const pairs = legPairs(stops)

  // Fetch whatever the current route is missing, a moment after the last edit. Everything runs in parallel.
  useEffect(() => {
    if (!trip || !me?.canPlan) return
    const t = window.setTimeout(() => {
      const once = (key: string, run: () => Promise<void>) => {
        if (inflight.current.has(key)) return
        inflight.current.add(key)
        setErrors((e) => ({ ...e, [key]: "" }))
        run().catch((err) => fail(key, err)).finally(() => inflight.current.delete(key))
      }
      const first = stops[0]?.place
      const last = stops.at(-1)?.place
      const ret = addDays(trip.search.start, totalNights)
      const fkey = `flights|${trip.result.origin.iata}|${first?.iata}|${last?.iata}|${trip.search.start}|${ret}`
      if (first && last && trip.result.origin.iata && first.iata && last.iata && trip.flightsKey !== fkey) {
        once(fkey, async () => {
          const flights = await api<Flight[]>("flights", { from: trip.result.origin.iata, to: first.iata, back: last.iata, depart: trip.search.start, ret, adults: trip.search.adults })
          patch({ flights, flightId: flights[0]?.id ?? null, flightsKey: fkey })
        })
      }
      stops.forEach((s, i) => {
        if (!s.nights) return
        const { checkin, checkout } = sched[i]
        const key = hotelKey(s.place.id, checkin, checkout)
        if (trip.hotels[key] || !s.place.countryCode) return
        once(key, async () => {
          const list = await api<Hotel[]>("hotels", { city: s.place.city, countryCode: s.place.countryCode, checkin, checkout, adults: trip.search.adults })
          patch((t) => ({ hotels: { ...t.hotels, [key]: list } }))
        })
      })
      pairs.forEach(({ a, b, key }) => {
        if (trip.legs[key]) return
        once(key, async () => {
          const leg = await api<Leg>("legs", { from: { name: a.name, country: a.country }, to: { name: b.name, country: b.country } })
          patch((t) => ({ legs: { ...t.legs, [key]: leg } }))
        })
      })
    }, 600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.stops, trip?.search, me?.canPlan])

  if (!trip) return <Empty />
  if (me && !me.canPlan) return <Navigate to="/pricing?next=/trip" replace />

  const hotelsNow: Record<string, Hotel[] | undefined> = Object.fromEntries(stops.map((s, i) => [s.place.id, trip.hotels[hotelKey(s.place.id, sched[i].checkin, sched[i].checkout)]]))
  const flight = trip.flights?.find((f) => f.id === trip.flightId) ?? null
  const sum = totals({
    stops,
    hotels: hotelsNow,
    flight,
    legs: pairs.map(({ key, dayTrip }) => ({ leg: trip.legs[key], choice: trip.legChoice[key] ?? 0, times: dayTrip ? 2 : 1 })),
    adults: trip.search.adults,
    nights: totalNights,
    dailyPerPerson: trip.dailyPerPerson,
  })
  const over_ = sum.total - trip.search.budget
  const nights = nightsStatus(totalNights, trip.search.nights)
  const countries = [...new Map(stops.map((s) => [s.place.countryCode, s.place.country])).entries()]
  const flights = [...(trip.flights ?? [])].sort((a, b) => (sort === "cheap" ? a.price - b.price : a.minutes - b.minutes))

  const setStops = (next: Stop[]) => patch({ stops: next })
  const setNights = (i: number, d: number) => setStops(stops.map((s, j) => (j === i ? { ...s, nights: Math.max(0, Math.min(10, s.nights + d)) } : s)))

  const save = async () => {
    if (!supabase) return
    setSaving("Saving…")
    const row = { title: trip.result.title.slice(0, 80), data: trip }
    const res = trip.savedId
      ? await supabase.from("trips").update(row).eq("id", trip.savedId).select("id").single()
      : await supabase.from("trips").insert(row).select("id").single()
    if (res.error) return setSaving(res.error.message)
    patch({ savedId: res.data.id })
    setSaving("Saved")
  }

  const context = `${trip.result.title}. From ${trip.search.from}, starting ${trip.search.start}, ${trip.search.adults} adults, budget ${inr(trip.search.budget)}. Route: ${stops.map((s) => `${s.place.name} (${s.place.country}, ${s.nights} nights)`).join(" → ")}. Estimated total ${inr(sum.total)}.`

  return (
    <div className="wrap stack" style={{ padding: "40px 24px 120px", gap: 28 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 8 }}>
          <p className="kicker">{new Date(`${trip.search.start}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {totalNights} nights · {trip.search.adults} adults</p>
          <h1 className="h1">{trip.result.title}</h1>
        </div>
        <div className="row">
          {saving && <span className="dim" role="status">{saving}</span>}
          <button className="btn" onClick={save}>{trip.savedId ? "Save changes" : "Save trip"}</button>
          <Link to="/plan" className="btn">Change places</Link>
          <button className="btn primary" onClick={() => navigate("/book")}>Book this trip <Icon name="arrow" /></button>
        </div>
      </div>

      <div className="trip-grid">
        <section aria-label="Route" className="stack" style={{ gap: 0 }}>
          <Marker text={<>Day 1 · Fly in to <b>{stops[0]?.place.name}</b> from {trip.search.from}</>} />
          {stops.map((s, i) => {
            const options = hotelsNow[s.place.id]
            const hk = hotelKey(s.place.id, sched[i].checkin, sched[i].checkout)
            const chosen = options?.find((h) => h.id === s.hotelId) ?? options?.[0]
            const pair = pairs.find((x) => x.b.id === s.place.id)
            const base = stops.slice(0, i).reverse().find((x) => x.nights > 0)
            return (
              <div key={s.place.id}>
                {pair && <LegRow leg={trip.legs[pair.key]} error={errors[pair.key]} choice={trip.legChoice[pair.key] ?? 0} adults={trip.search.adults}
                  onPick={(c) => patch((t) => ({ legChoice: { ...t.legChoice, [pair.key]: c } }))} title={pair.dayTrip ? `Day trip: ${pair.a.name} ⇄ ${pair.b.name} (return)` : `${pair.a.name} to ${pair.b.name}`} times={pair.dayTrip ? 2 : 1} />}
                <article
                  className={`stop rise${over === i && drag !== null && drag !== i ? " over" : ""}${drag === i ? " dragging" : ""}`}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDrag(i) }}
                  onDragOver={(e) => { e.preventDefault(); setOver(i) }}
                  onDrop={(e) => { e.preventDefault(); if (drag !== null) setStops(move(stops, drag, i)); setDrag(null); setOver(null) }}
                  onDragEnd={() => { setDrag(null); setOver(null) }}
                >
                  <div className="row" style={{ padding: "14px 16px 14px 10px", gap: 12 }}>
                    <span className="dim" title="Drag to move" style={{ cursor: "grab" }}><Icon name="grip" /></span>
                    <span style={{ width: 32, height: 32, flex: "0 0 auto", borderRadius: 999, background: "var(--gold)", color: "var(--bg)", fontWeight: 700, display: "grid", placeItems: "center" }}>{i + 1}</span>
                    <Photo small q={s.place.photo} style={{ width: 84, height: 64, borderRadius: 12, flex: "0 0 auto" }} />
                    <div className="stack" style={{ gap: 2, flex: "1 1 150px", minWidth: 0 }}>
                      <span className="serif" style={{ fontSize: 26, lineHeight: 1 }}>{s.place.name}</span>
                      <span className="dim" style={{ fontSize: 12 }}>{s.place.country} · {s.nights ? `Day ${sched[i].fromDay}–${sched[i].toDay}` : base ? `Day trip from ${base.place.name}` : "Day trip"}</span>
                    </div>
                    <span className="row" style={{ gap: 8, marginLeft: "auto", flexWrap: "nowrap" }}>
                    <span className="stepper" role="group" aria-label={`Nights in ${s.place.name}`}>
                      <button onClick={() => setNights(i, -1)} disabled={s.nights <= 0} aria-label={`One night less in ${s.place.name}`}>−</button>
                      <span style={{ minWidth: 30, textAlign: "center", fontWeight: 700, fontSize: 13 }} aria-live="polite">{s.nights}N</span>
                      <button onClick={() => setNights(i, 1)} disabled={s.nights >= 10} aria-label={`One more night in ${s.place.name}`}>+</button>
                    </span>
                    <span className="stack" style={{ gap: 4 }}>
                      <button className="icon-btn" style={{ height: 30 }} onClick={() => setStops(move(stops, i, i - 1))} disabled={i === 0} aria-label={`Move ${s.place.name} earlier`}><Icon name="up" size={14} /></button>
                      <button className="icon-btn" style={{ height: 30 }} onClick={() => setStops(move(stops, i, i + 1))} disabled={i === stops.length - 1} aria-label={`Move ${s.place.name} later`}><Icon name="down" size={14} /></button>
                    </span>
                    <button className="icon-btn" onClick={() => setStops(stops.filter((_, j) => j !== i))} disabled={stops.length === 1} aria-label={`Remove ${s.place.name}`}><Icon name="x" size={14} /></button>
                    </span>
                  </div>
                  {s.nights > 0 && (
                    <div style={{ borderTop: "1px solid #1f262b", padding: "12px 16px" }} className="stack">
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: "var(--soft)" }}>
                          <span className="dim">Stay:</span>{" "}
                          {chosen ? <><b style={{ color: "var(--ivory)" }}>{chosen.name}</b> · {inr(chosen.total)} for {s.nights} night{s.nights > 1 ? "s" : ""}</> : errors[hk] ? <span className="error">{errors[hk]}</span> : options ? "No rooms found for these dates" : "Finding stays…"}
                        </span>
                        {options && options.length > 1 && <button className="btn small" aria-expanded={open === s.place.id} onClick={() => setOpen(open === s.place.id ? null : s.place.id)}>{open === s.place.id ? "Done" : "Swap stay"}</button>}
                      </div>
                      {open === s.place.id && options && (
                        <div role="radiogroup" aria-label={`Stays in ${s.place.name}`} className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                          {options.map((h) => (
                            <button key={h.id} role="radio" aria-checked={h.id === chosen?.id} className="option" style={{ padding: 0, overflow: "hidden" }} onClick={() => setStops(stops.map((x, j) => (j === i ? { ...x, hotelId: h.id } : x)))}>
                              <Photo src={h.photo} q={`${s.place.city} hotel room`} style={{ height: 90, width: "100%" }} />
                              <span className="stack" style={{ padding: "8px 12px 12px", gap: 2 }}>
                                <b style={{ fontSize: 13 }}>{h.name}</b>
                                <span className="sub">{h.stars ? `${h.stars}★ · ` : ""}{inr(h.total)} total</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              </div>
            )
          })}
          <Marker text={<>Day {totalNights + 1} · Fly home from <b>{stops.at(-1)?.place.name}</b></>} />
        </section>

        <aside className="sticky stack" style={{ gap: 16 }}>
          <div className="card pad stack">
            <span className="dim" style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase" }}>Estimated total for {trip.search.adults}</span>
            <span className="serif" aria-live="polite" style={{ fontSize: 48, lineHeight: 1, color: over_ > 0 ? "var(--over)" : "var(--gold2)" }}>{inr(sum.total)}</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: over_ > 0 ? "var(--over)" : "var(--sage)" }}>{over_ > 0 ? `${inr(over_)} over your ${inr(trip.search.budget)}` : `${inr(-over_)} left of ${inr(trip.search.budget)}`}</span>
            <div className="meter"><span style={{ width: `${Math.min(100, (sum.total / trip.search.budget) * 100)}%`, background: over_ > 0 ? "var(--over)" : "var(--gold2)" }} /></div>
            {[["Flights", sum.flights], ["Stays", sum.stays], ["Trains, buses, taxis (est.)", sum.transport], [`Food & local (${inr(trip.dailyPerPerson)}/person/day)`, sum.daily]].map(([k, v]) => (
              <div key={k as string} className="list-row"><span className="muted">{k}</span><b>{inr(v as number)}</b></div>
            ))}
            <label className="list-row" style={{ alignItems: "center" }}>
              <span className="muted">Daily spend per person</span>
              <input className="input" type="number" min={0} step={100} style={{ width: 110, minHeight: 36 }} value={trip.dailyPerPerson} onChange={(e) => patch({ dailyPerPerson: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            {sum.unknown > 0 && <span style={{ fontSize: 12, color: "var(--amber)" }}>{sum.unknown} item{sum.unknown > 1 ? "s" : ""} still loading or not priced yet.</span>}
            <span style={{ fontSize: 13, fontWeight: 700, color: nights.tone === "ok" ? "var(--sage)" : nights.tone === "free" ? "var(--gold2)" : "var(--over)" }}>{nights.text}</span>
          </div>

          <div className="card pad stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="serif" style={{ fontSize: 24 }}>Flights</span>
              <div className="seg" role="group" aria-label="Sort flights">
                <button aria-pressed={sort === "cheap"} onClick={() => setSort("cheap")} style={{ minHeight: 32 }}>Cheapest</button>
                <button aria-pressed={sort === "fast"} onClick={() => setSort("fast")} style={{ minHeight: 32 }}>Fastest</button>
              </div>
            </div>
            {!trip.result.origin.iata && <span className="error">We could not find your home airport. Change “From” and plan again.</span>}
            {Object.entries(errors).filter(([k, v]) => k.startsWith("flights|") && v).map(([k, v]) => <span key={k} className="error">{v}</span>)}
            {!trip.flights && trip.result.origin.iata && <div className="skeleton" style={{ height: 120 }} />}
            {trip.flights?.length === 0 && <span className="muted">No fares found for these dates.</span>}
            <div role="radiogroup" aria-label="Flight" className="stack" style={{ gap: 8 }}>
              {flights.slice(0, 5).map((f) => (
                <button key={f.id} role="radio" aria-checked={f.id === trip.flightId} className="option" onClick={() => patch({ flightId: f.id })}>
                  <span className="list-row" style={{ width: "100%" }}><b>{f.carrier}</b><b>{inr(f.price)}</b></span>
                  <span className="sub">{time(f.depart)} → {time(f.arrive)} · {hours(f.minutes)} · {f.stops ? `${f.stops} stop${f.stops > 1 ? "s" : ""}` : "nonstop"}{f.backDepart ? ` · home ${time(f.backDepart)}` : ""}</span>
                </button>
              ))}
            </div>
            <span className="dim" style={{ fontSize: 12 }}>Fares for all travellers, checked live. Final price is on the airline or agent site.</span>
          </div>

          <div className="card pad stack">
            <span className="serif" style={{ fontSize: 24 }}>Visas · Indian passport</span>
            {countries.map(([code, name]) => {
              const v = visaFor(code)
              return (
                <div key={code} className="stack" style={{ gap: 6, borderTop: "1px solid #1f262b", paddingTop: 10 }}>
                  <div className="list-row"><b>{v?.country ?? name}</b>{v ? <span className={`pill ${v.tone}`}>{v.status}</span> : <span className="pill warn">Not checked yet</span>}</div>
                  <span className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>{v ? v.summary : "We have not verified the rules for this country yet. Use only the official government website (usually ending in .gov or the country code) and avoid agent sites that copy the look."}</span>
                  {v?.portals.map((p) => <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600 }}>{p.label} ↗</a>)}
                </div>
              )
            })}
          </div>
        </aside>
      </div>
      <Concierge context={context} />
    </div>
  )
}

function LegRow({ leg, error, choice, adults, onPick, title, times }: { leg?: Leg; error?: string; choice: number; adults: number; onPick: (c: number) => void; title: string; times: number }) {
  return (
    <div className="leg">
      <span className="dash" aria-hidden="true" />
      <div className="stack" style={{ padding: "12px 0", gap: 8, flex: 1 }}>
        <span style={{ fontSize: 13 }} className="muted"><b style={{ color: "var(--ivory)" }}>{title}</b></span>
        {error ? <span className="error">{error}</span> : !leg ? <div className="skeleton" style={{ height: 44, maxWidth: 360 }} /> : (
          <div role="radiogroup" aria-label={title} className="row" style={{ gap: 8 }}>
            {leg.options.map((o, i) => (
              <button key={o.mode} role="radio" aria-checked={i === choice} className="option" onClick={() => onPick(i)}>
                <b style={{ fontSize: 13 }}>{o.mode}</b>
                <span className="sub">{o.duration} · {o.estInr ? `~${inr(o.estInr * adults * times)}` : "price varies"}</span>
              </button>
            ))}
          </div>
        )}
        {leg?.options[choice]?.note && <span className="dim" style={{ fontSize: 12 }}>{leg.options[choice].note} · AI estimate, check before booking</span>}
      </div>
    </div>
  )
}

function Marker({ text }: { text: ReactNode }) {
  return <div className="card row" style={{ padding: "12px 16px", borderStyle: "dashed", background: "var(--surface2)", fontSize: 14, color: "var(--muted)" }}>✈ <span>{text}</span></div>
}

function Empty() {
  return (
    <div className="wrap" style={{ padding: "80px 24px" }}>
      <div className="card pad stack">
        <h1 className="h3">No trip yet</h1>
        <p className="muted" style={{ margin: 0 }}>Start by telling us where and when.</p>
        <Link to="/plan" className="btn primary" style={{ alignSelf: "flex-start" }}>Plan a trip</Link>
      </div>
    </div>
  )
}
