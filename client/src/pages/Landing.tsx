import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { GEMS, HERO } from "@shared/explore"
import { Photo } from "@/components/Photo"
import { Icon } from "@/components/Icon"
import { PlaceInput } from "@/components/PlaceInput"
import { BudgetField } from "@/components/BudgetField"
import { usePrefs } from "@/lib/prefs"
import { allDestinations, destinationIdeas, homeIdeas } from "@/lib/suggest"
import { HOME_CITIES } from "@shared/destinations"

const DUR = 6000
const EASE = "cubic-bezier(.22,.8,.2,1)"

function Hero() {
  const [{ idx, prev }, set] = useState({ idx: 0, prev: -1 })
  const timer = useRef<number>()
  const go = (step: number) => set((s) => ({ prev: s.idx, idx: (s.idx + step + HERO.length) % HERO.length }))
  const restart = () => {
    window.clearInterval(timer.current)
    timer.current = window.setInterval(() => go(1), DUR)
  }
  useEffect(() => {
    restart()
    return () => window.clearInterval(timer.current)
  }, [])
  const cur = HERO[idx]
  const next = HERO[(idx + 1) % HERO.length]
  const nav = (step: number) => {
    go(step)
    restart()
  }

  return (
    <section className="hero" aria-label="Featured destinations">
      <div className="blob" style={{ left: "22%", top: "10%", width: 900, height: 700, background: cur.tint, opacity: 0.9 }} />
      <div className="blob" style={{ right: "-10%", bottom: "-20%", width: 700, height: 600, background: cur.tint2, opacity: 0.6 }} />
      <div className="wrap hero-grid">
        <div className="stack" style={{ gap: 20 }}>
          <p className="kicker">Every road, priced &amp; planned</p>
          <div className="stack-abs" style={{ height: 240 }}>
            {HERO.map((s, i) => (
              <div key={s.name} aria-hidden={i !== idx} style={{ opacity: i === idx || i === prev ? 1 : 0, animation: i === idx ? `titleIn 900ms ${EASE} 120ms both` : i === prev ? `titleOut 600ms ${EASE} both` : "none" }}>
                <span style={{ display: "block", fontSize: 13, letterSpacing: ".16em", textTransform: "uppercase", color: s.offbeat ? "var(--sage)" : "var(--gold2)", marginBottom: 10 }}>{s.tag} · {s.months}</span>
                <h1 className="serif" style={{ margin: 0, fontSize: "clamp(60px, 7.5vw, 112px)", lineHeight: 0.92 }}>{s.name}</h1>
                <p className="muted" style={{ margin: "16px 0 0", maxWidth: 440, fontSize: 17, lineHeight: 1.6 }}>{s.why}</p>
              </div>
            ))}
          </div>
          <div className="row">
            <Link to={`/plan?to=${encodeURIComponent(cur.name)}`} className="btn primary">Plan this trip <Icon name="arrow" /></Link>
            <Link to="/explore" className="btn">Explore every season</Link>
          </div>
        </div>

        <Frame idx={idx} prev={prev} tint={cur.tint} offbeat={!!cur.offbeat} />

        <div className="stack hero-side" style={{ gap: 26, alignSelf: "stretch", justifyContent: "space-between", textAlign: "right" }}>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="icon-btn" style={{ borderRadius: 999, width: 48, height: 48 }} onClick={() => nav(-1)} aria-label="Previous destination"><Icon name="left" /></button>
            <button className="icon-btn" style={{ borderRadius: 999, width: 48, height: 48, background: "var(--ivory)", color: "var(--bg)" }} onClick={() => nav(1)} aria-label="Next destination"><Icon name="right" /></button>
          </div>
          <div key={idx} className="stack" style={{ gap: 18 }}>
            {[["Best months", cur.months], ["Good for", cur.good], ["Why now", cur.why]].map(([k, v], i) => (
              <div key={k} style={{ animation: `rowIn 700ms ${EASE} ${250 + i * 100}ms both` }}>
                <div className="dim" style={{ fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase" }}>{k}</div>
                <div className={i === 0 ? "serif" : ""} style={{ fontSize: i === 0 ? 34 : 15, marginTop: 4 }}>{v}</div>
              </div>
            ))}
          </div>
          <button onClick={() => nav(1)} className="card row" style={{ alignSelf: "flex-end", padding: "10px 10px 10px 18px", cursor: "pointer", textAlign: "left", color: "inherit" }} aria-label={`Show ${next.name}`}>
            <span><span className="dim" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", display: "block" }}>Next</span><span className="serif" style={{ fontSize: 22 }}>{next.name}</span></span>
            <Photo small file={next.file} q={next.q} style={{ width: 72, height: 72, borderRadius: 14 }} />
          </button>
        </div>
      </div>
      <div className="wrap row" style={{ paddingBottom: 32 }}>
        <span className="dim" style={{ fontSize: 13, minWidth: 56 }}>{String(idx + 1).padStart(2, "0")} / {String(HERO.length).padStart(2, "0")}</span>
        <div className="bars">
          {HERO.map((s, i) => (
            <span className="bar" key={s.name}><span key={i === idx ? `on${idx}` : "off"} style={{ width: i < idx ? "100%" : 0, animation: i === idx ? `fillbar ${DUR}ms linear both` : "none" }} /></span>
          ))}
        </div>
      </div>
    </section>
  )
}

/** The photo frame: a slowly turning gradient edge, a glow in the slide's colour, arch and rectangle in turn, and a tilt toward the mouse. */
function Frame({ idx, prev, tint, offbeat }: { idx: number; prev: number; tint: string; offbeat: boolean }) {
  const frame = useRef<HTMLDivElement>(null)
  const arch = idx % 2 === 0
  const outer = arch ? "214px 214px 30px 30px" : "30px"
  const inner = arch ? "208px 208px 24px 24px" : "24px"
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== "mouse" || !frame.current) return
    const r = frame.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    frame.current.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 12}deg) translateZ(20px)`
    frame.current.querySelectorAll<HTMLElement>(".photo").forEach((p) => (p.style.transform = `scale(1.08) translate(${-x * 16}px, ${-y * 16}px)`))
  }
  const reset = () => {
    if (!frame.current) return
    frame.current.style.transform = ""
    frame.current.querySelectorAll<HTMLElement>(".photo").forEach((p) => (p.style.transform = ""))
  }

  return (
    <div className="frame-wrap" style={{ display: "flex", justifyContent: "center", animation: "floaty 7s ease-in-out infinite" }} onPointerMove={tilt} onPointerLeave={reset}>
      <div ref={frame} className="frame" style={{ borderRadius: outer, boxShadow: `0 40px 120px -30px ${tint}` }}>
        <div className="frame-inner" style={{ borderRadius: inner }}>
          {HERO.map((s, i) => (
            <div key={s.name} aria-hidden={i !== idx} style={{ position: "absolute", inset: 0, opacity: i === idx || i === prev ? 1 : 0, animation: i === idx ? `heroIn 1000ms ${EASE} both` : i === prev ? `heroOut 800ms ${EASE} both` : "none" }}>
              <Photo file={s.file} q={s.q} alt={`${s.name}: ${s.why}`} style={{ height: "100%" }} />
            </div>
          ))}
        </div>
      </div>
      <div className="frame-glow" style={{ background: tint }} />
      {offbeat && <span className="pill ok" style={{ position: "absolute", top: 120, left: -8 }}>Hidden gem</span>}
    </div>
  )
}

function SearchBar() {
  const navigate = useNavigate()
  const { money } = usePrefs()
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [budget, setBudget] = useState(200_000)
  const ideas = useMemo(destinationIdeas, [])
  const go = (p: Record<string, string | number | undefined>) => navigate(`/plan?${new URLSearchParams(Object.entries(p).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])))}`)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    go({ ...(from.trim() && { from: from.trim() }), ...(to.trim() && { to: to.trim().replace(/,\s*$/, "") }), budget })
  }
  const nextMarch = `${new Date().getMonth() > 2 ? new Date().getFullYear() + 1 : new Date().getFullYear()}-03-20`
  const prompts = [
    { text: `Mountains in March · ${money(200_000)} for two`, p: { to: "Kazakhstan, Kyrgyzstan", start: nextMarch, nights: 11, budget: 200_000, adults: 2 } },
    { text: `A beach week this winter · ${money(150_000)}`, p: { to: "Thailand", nights: 7, budget: 150_000, adults: 2 } },
    { text: `Hidden gems in Europe · ${money(250_000)}`, p: { to: "Albania, Georgia", nights: 10, budget: 250_000, adults: 2 } },
    { text: `Long weekend near Bengaluru · ${money(30_000)}`, p: { to: "Gandikota", nights: 3, budget: 30_000, adults: 2 } },
  ]
  return (
    <div className="stack" style={{ gap: 14 }}>
      <form onSubmit={submit} className="card" style={{ padding: 18, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", alignItems: "start" }} role="search" aria-label="Plan a trip">
        <PlaceInput id="q-from" label="From" value={from} onChange={setFrom} options={HOME_CITIES} featured={homeIdeas()} placeholder="Your city" />
        <PlaceInput id="q-to" label="To" value={to} onChange={setTo} options={allDestinations()} featured={ideas} placeholder="Anywhere, or pick countries" multi />
        <BudgetField id="q-budget" valueInr={budget} onChange={setBudget} />
        <button className="btn gold" style={{ minHeight: 56, borderRadius: 16, alignSelf: "end" }}>Plan my trip <Icon name="arrow" /></button>
      </form>
      <div className="row" style={{ gap: 8 }}>
        <span className="dim" style={{ fontSize: 13 }}>Try:</span>
        {prompts.map((x) => <button key={x.text} type="button" className="prompt" onClick={() => go(x.p)}>{x.text}</button>)}
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <>
      <Hero />
      <section className="wrap"><SearchBar /></section>

      <section className="wrap stack" style={{ padding: "110px 24px 40px", gap: 40 }}>
        <div className="stack" style={{ maxWidth: 760 }}>
          <p className="kicker">How it works</p>
          <h2 className="h2">You choose the places. <em className="gold">We do the rest.</em></h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
          {[
            ["Say it, or browse", "“Mountains in March, ₹2 lakh for two”, or browse by season and hidden gems."],
            ["Pick your places", "Meridian suggests what's worth it that month and counts nights as you choose."],
            ["Rearrange anything", "Move a stop to any position, change nights, swap the stay or the train."],
            ["Book on official sites", "Each booking opens the airline, hotel or railway. Visas link to government portals."],
          ].map(([t, d], i) => (
            <div key={t} className="stack" style={{ borderTop: "1px solid var(--line2)", paddingTop: 24 }}>
              <span className="serif" style={{ fontSize: 48, color: "var(--gold)", lineHeight: 1 }}>0{i + 1}</span>
              <h3 style={{ margin: 0, fontSize: 20 }}>{t}</h3>
              <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "#11161a", borderBlock: "1px solid #1f262b", marginTop: 60 }}>
        <div className="wrap stack" style={{ padding: "90px 24px", gap: 32 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <div className="stack" style={{ maxWidth: 720 }}>
              <p className="kicker">Hidden gems</p>
              <h2 className="h2">Off the beaten <em className="gold">path</em></h2>
              <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>Beautiful places most itineraries skip. Usually quieter, often cheaper, and we tell you why each one is under the radar.</p>
            </div>
            <Link to="/explore?gems=1">See every hidden gem →</Link>
          </div>
          <div className="grid">
            {GEMS.map((g) => (
              <Link key={g.name} to={`/plan?to=${encodeURIComponent(g.name + ", " + g.region)}`} className="card" style={{ overflow: "hidden", color: "inherit", textDecoration: "none" }}>
                <Photo file={g.file} q={g.q} alt={g.name} style={{ height: 210 }} />
                <div className="stack pad" style={{ gap: 8 }}>
                  <span className="dim" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase" }}>{g.region}</span>
                  <h3 className="h3">{g.name}</h3>
                  <p style={{ margin: 0, color: "var(--soft)", lineHeight: 1.6, fontSize: 14 }}>{g.why}</p>
                  <p className="dim" style={{ margin: 0, fontSize: 13 }}><span style={{ color: "var(--gold2)" }}>Why it's quiet:</span> {g.quiet}</p>
                  <span style={{ fontSize: 12, color: "var(--gold2)" }}>Best · {g.months}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap row" style={{ padding: "90px 24px 20px", gap: 48, alignItems: "flex-start" }}>
        <div className="stack" style={{ flex: "1 1 380px" }}>
          <p className="kicker">Visas &amp; entry rules</p>
          <h2 className="h2">Know the rules <em className="gold">before</em> you land</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>For an Indian passport, the trip page shows what you need for each country, the official portal to apply on, and what to do after you arrive. Rules we have not checked yet are marked, never guessed.</p>
        </div>
        <div className="stack" style={{ flex: "1 1 380px" }}>
          <p className="kicker">Works where you already chat</p>
          <h2 className="h2">Ask the concierge anything</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>Every trip has a concierge that knows your route. Claude, ChatGPT and Gemini connections are coming next.</p>
        </div>
      </section>

      <section className="wrap" style={{ padding: "60px 24px" }}>
        <div className="card pad row" style={{ justifyContent: "space-between", gap: 24 }}>
          <div className="stack" style={{ maxWidth: 640 }}>
            <h2 className="h3">Use it like an app</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>On your phone, open the browser menu and tap <b>Add to Home Screen</b>. Meridian opens full screen, like an app, on iPhone and Android.</p>
          </div>
          <Link to="/plan" className="btn primary">Start planning <Icon name="arrow" /></Link>
        </div>
      </section>
    </>
  )
}
