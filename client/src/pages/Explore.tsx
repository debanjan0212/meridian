import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { SEASONS, seasonOf, type Season } from "@shared/explore"
import { Photo } from "@/components/Photo"

export default function Explore() {
  const [params] = useSearchParams()
  const [season, setSeason] = useState<Season["id"]>(seasonOf())
  const [gems, setGems] = useState(params.get("gems") === "1")
  const s = SEASONS.find((x) => x.id === season)!
  const picks = s.picks.filter((p) => !gems || p.offbeat)

  return (
    <div className="wrap stack" style={{ padding: "48px 24px", gap: 28 }}>
      <div className="stack">
        <p className="kicker">Explore the world by season</p>
        <h1 className="h1">Where is good <em className="gold">{season === "autumn" ? "in autumn" : `this ${s.name.toLowerCase()}`}?</em></h1>
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="seg" role="group" aria-label="Season">
          {SEASONS.map((x) => (
            <button key={x.id} aria-pressed={x.id === season} onClick={() => setSeason(x.id)}>{x.name} <span className="dim" style={{ fontWeight: 500, fontSize: 12 }}>{x.months}</span></button>
          ))}
        </div>
        <button className="btn small" aria-pressed={gems} onClick={() => setGems(!gems)} style={gems ? { background: "var(--sagebg)", color: "var(--sage)", borderColor: "#3f5a52" } : undefined}>✦ Hidden gems only</button>
      </div>
      <div className="grid" key={`${season}${gems}`}>
        {picks.map((p, i) => (
          <article key={p.name} className="card rise" style={{ overflow: "hidden", animationDelay: `${i * 60}ms` }}>
            <div style={{ position: "relative" }}>
              <Photo file={p.file} q={p.q} alt={p.name} style={{ height: 220 }} />
              <span className={`pill ${p.offbeat ? "ok" : "glass"}`} style={{ position: "absolute", top: 12, left: 12 }}>{p.offbeat ? "Hidden gem" : p.tag}</span>
            </div>
            <div className="stack pad" style={{ gap: 8 }}>
              <span className="dim" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase" }}>{p.region} · {p.months}</span>
              <h2 className="h3">{p.name}</h2>
              <p style={{ margin: 0, color: "var(--soft)", fontSize: 14, lineHeight: 1.6 }}>{p.why}</p>
              {p.quiet && <p className="dim" style={{ margin: 0, fontSize: 13 }}><span style={{ color: "var(--sage)" }}>Why it's quiet:</span> {p.quiet}</p>}
              <Link to={`/plan?to=${encodeURIComponent(p.name)}`} style={{ marginTop: 6, fontWeight: 600 }}>Plan this →</Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
