import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { saveTrip, type Trip } from "@/lib/trip"

type Row = { id: string; title: string; created_at: string; data: Trip }

export default function Trips() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState("")

  const load = () =>
    supabase?.from("trips").select("id, title, created_at, data").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error) setError(error.message)
      setRows((data as Row[]) ?? [])
    })
  useEffect(() => {
    load()
  }, [])

  const open = (r: Row) => {
    saveTrip({ ...r.data, savedId: r.id })
    navigate("/trip")
  }
  const remove = async (id: string) => {
    await supabase?.from("trips").delete().eq("id", id)
    load()
  }

  return (
    <div className="wrap stack" style={{ padding: "48px 24px", gap: 24 }}>
      <p className="kicker">My trips</p>
      <h1 className="h1">Saved <em className="gold">plans</em></h1>
      {error && <p className="error">{error}</p>}
      {rows?.length === 0 && <p className="muted">No saved trips yet. Use “Save trip” on a plan.</p>}
      <div className="grid">
        {rows?.map((r) => (
          <div key={r.id} className="card pad stack">
            <span className="serif" style={{ fontSize: 26 }}>{r.title}</span>
            <span className="dim" style={{ fontSize: 13 }}>{r.data.search.start} · {r.data.stops.map((s) => s.place.name).join(" → ")}</span>
            <div className="row">
              <button className="btn small primary" onClick={() => open(r)}>Open</button>
              <button className="btn small" onClick={() => remove(r.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
