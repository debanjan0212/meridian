import { useState } from "react"
import { Link } from "react-router-dom"
import { inr, legPairs, schedule } from "@shared/route"
import { visaFor } from "@shared/visa"
import { api, ApiError } from "@/lib/api"
import { useTrip } from "@/lib/trip"
import { Icon } from "@/components/Icon"

type Item = { key: string; title: string; sub: string; action: JSX.Element | null }

export default function Book() {
  const [trip, setTrip] = useTrip()
  const [links, setLinks] = useState<{ url: string; provider: string }[] | null>(null)
  const [linkMsg, setLinkMsg] = useState("")
  if (!trip) return <div className="wrap" style={{ padding: 80 }}><Link to="/plan">Plan a trip first →</Link></div>

  const sched = schedule(trip.stops, trip.search.start)
  const flight = trip.flights?.find((f) => f.id === trip.flightId)
  const findLinks = async () => {
    setLinkMsg("Finding the booking page…")
    try {
      setLinks(await api<{ url: string; provider: string }[]>("booklink", { id: flight!.id }))
      setLinkMsg("")
    } catch (err) {
      setLinkMsg(err instanceof ApiError ? err.message : "Could not get a booking link.")
    }
  }

  const items: Item[] = []
  if (flight) items.push({
    key: "flight",
    title: `Flights · ${flight.carrier}`,
    sub: `${inr(flight.price)} for ${trip.search.adults} · ${flight.depart.slice(0, 10)}`,
    action: links ? <span className="row">{links.map((l) => <a key={l.url} className="btn small" href={l.url} target="_blank" rel="noopener noreferrer">{l.provider} <Icon name="out" size={14} /></a>)}</span>
      : <button className="btn small" onClick={findLinks}>Get booking link</button>,
  })
  trip.stops.forEach((s, i) => {
    if (!s.nights) return
    const opts = trip.hotels[`${s.place.id}|${sched[i].checkin}|${sched[i].checkout}`]
    const h = opts?.find((x) => x.id === s.hotelId) ?? opts?.[0]
    if (h) items.push({ key: `stay:${s.place.id}`, title: `Stay · ${h.name}`, sub: `${s.place.name} · ${sched[i].checkin} → ${sched[i].checkout} · ${inr(h.total)}`, action: <a className="btn small" href={h.bookUrl} target="_blank" rel="noopener noreferrer">Booking.com <Icon name="out" size={14} /></a> })
  })
  legPairs(trip.stops).forEach(({ a, b, key, dayTrip }) => {
    const o = trip.legs[key]?.options[trip.legChoice[key] ?? 0]
    if (o) items.push({ key: `leg:${key}`, title: `${o.mode} · ${a.name} ${dayTrip ? "⇄" : "→"} ${b.name}`, sub: `${o.duration}. Book on the operator's official site or at the station.`, action: null })
  })
  new Set(trip.stops.map((s) => s.place.countryCode)).forEach((code) => {
    const v = visaFor(code)
    if (v) items.push({ key: `visa:${code}`, title: `Visa · ${v.country}`, sub: v.status, action: v.portals[0] ? <a className="btn small" href={v.portals[0].url} target="_blank" rel="noopener noreferrer">{v.portals[0].label} <Icon name="out" size={14} /></a> : null })
  })

  const done = items.filter((it) => trip.booked[it.key]).length
  const toggle = (key: string) => setTrip({ ...trip, booked: { ...trip.booked, [key]: !trip.booked[key] } })

  return (
    <div className="wrap stack" style={{ padding: "48px 24px", gap: 24, maxWidth: 900 }}>
      <Link to="/trip">← Back to the plan</Link>
      <p className="kicker">Book · {done} of {items.length} done</p>
      <h1 className="h1">{done === items.length && items.length ? <>{trip.result.title} is <em className="gold">booked.</em></> : <>Book it, <em className="gold">one by one</em></>}</h1>
      <p className="muted" style={{ margin: 0 }}>Each button opens the provider's own site, where you pay them directly. Come back and tick it off.</p>
      {linkMsg && <p role="status" style={{ margin: 0, color: "var(--amber)" }}>{linkMsg}</p>}
      <div className="card" style={{ overflow: "hidden" }}>
        {items.map((it) => (
          <div key={it.key} className="row" style={{ padding: "16px 20px", borderBottom: "1px solid #1d2428", justifyContent: "space-between" }}>
            <label className="row" style={{ gap: 14, cursor: "pointer", flex: "1 1 300px" }}>
              <input type="checkbox" checked={!!trip.booked[it.key]} onChange={() => toggle(it.key)} style={{ width: 20, height: 20, accentColor: "#9fd0c2" }} />
              <span className="stack" style={{ gap: 2 }}>
                <b style={{ textDecoration: trip.booked[it.key] ? "line-through" : "none", opacity: trip.booked[it.key] ? 0.6 : 1 }}>{it.title}</b>
                <span className="dim" style={{ fontSize: 13 }}>{it.sub}</span>
              </span>
            </label>
            {it.action}
          </div>
        ))}
        {!items.length && <p className="pad muted" style={{ margin: 0 }}>Nothing to book yet. Open the plan so flights and stays can load.</p>}
      </div>
    </div>
  )
}
