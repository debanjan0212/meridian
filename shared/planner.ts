/** The AI parts of planning: which places, and how to get between them. Server-only. */
import { completeJson, resolveConfigs } from "./llm"
import type { Leg, Place, PlacesResult, Search } from "./types"

const SYSTEM = `You are Meridian, a careful trip planner for travellers starting in India.
Be practical and honest. Never invent visa rules, prices you cannot estimate, or places that do not exist.
Prefer places that are good in the given month. Mention seasonal closures.`

function configs() {
  const c = resolveConfigs(process.env)
  if (!c.length) throw new Error("No AI key is configured (GEMINI_API_KEY).")
  return c
}

export async function suggestPlaces(s: Search): Promise<PlacesResult & { places: (Place & { pick: boolean })[] }> {
  const month = new Date(`${s.start}T00:00:00Z`).toLocaleString("en-IN", { month: "long", timeZone: "UTC" })
  const prompt = `Trip request:
- From: ${s.from}
- Destination: ${s.to} (if "anywhere", choose one country or a pair of neighbouring countries that suits the month and budget)
- Starts: ${s.start} (${month}), ${s.nights} nights in total
- Budget: INR ${s.budget} for ${s.adults} adult(s), including flights

Suggest 8 to 12 places. Include 2 or 3 offbeat places: beautiful, less known, usually cheaper.
Mark a default selection with "pick": true whose nights add up to about ${Math.max(1, s.nights - 1)}.
Use "nights": 0 for a day trip from the previous stop. If a place is not reachable or worth it in ${month}, keep it with "closed" saying why and "pick": false.

JSON shape:
{"title": "short trip name",
 "origin": {"city": "...", "iata": "3-letter home airport"},
 "places": [{"name": "...", "country": "...", "countryCode": "ISO-2", "city": "city to sleep in",
   "iata": "nearest airport 3-letter code", "nights": 2, "note": "one line on why",
   "offbeat": false, "closed": null, "photo": "3-5 words to search a photo", "pick": true}],
 "tips": ["2-4 short practical tips for this month"]}`
  const raw = await completeJson<PlacesResult & { places: (Partial<Place> & { pick?: boolean })[] }>({ configs: configs(), system: SYSTEM, prompt, maxTokens: 4000 })
  return cleanPlaces(raw)
}

const iata = (v: unknown) => (typeof v === "string" && /^[A-Za-z]{3}$/.test(v.trim()) ? v.trim().toUpperCase() : "")
const text = (v: unknown, max = 160) => (typeof v === "string" ? v.trim().slice(0, max) : "")

/** Model output is untrusted: clamp numbers, cap lengths, give every place a unique id. */
export function cleanPlaces(raw: { title?: unknown; origin?: { city?: unknown; iata?: unknown }; places?: unknown; tips?: unknown }) {
  const seen = new Set<string>()
  const places = (Array.isArray(raw.places) ? raw.places : []).slice(0, 14).flatMap((p: Record<string, unknown>) => {
    const name = text(p.name, 60)
    if (!name) return []
    let id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "place"
    while (seen.has(id)) id += "-2"
    seen.add(id)
    const closed = text(p.closed, 120) || null
    return [{
      id,
      name,
      country: text(p.country, 40),
      countryCode: text(p.countryCode, 2).toUpperCase(),
      city: text(p.city, 60) || name,
      iata: iata(p.iata),
      nights: Math.max(0, Math.min(10, Math.round(Number(p.nights) || 0))),
      note: text(p.note),
      offbeat: p.offbeat === true,
      closed,
      photo: text(p.photo, 60) || `${name} ${text(p.country, 40)}`,
      pick: p.pick === true && !closed,
    }]
  })
  return {
    title: text(raw.title, 60) || "Your trip",
    origin: { city: text(raw.origin?.city, 60), iata: iata(raw.origin?.iata) },
    places,
    tips: (Array.isArray(raw.tips) ? raw.tips : []).map((t) => text(t, 200)).filter(Boolean).slice(0, 4),
  }
}

export async function suggestLeg(from: Pick<Place, "name" | "country">, to: Pick<Place, "name" | "country">): Promise<Leg> {
  const prompt = `How do travellers get from ${from.name}, ${from.country} to ${to.name}, ${to.country}?
Give 1 to 3 realistic options (train, bus, shared taxi, ferry, flight, drive). If there is no direct option, say "via <place>" in the note.
"estInr" is a rough fare per person in INR, or null if you are not reasonably sure.
JSON shape: {"options": [{"mode": "Night train", "duration": "about 17h", "estInr": 3300, "note": "one short line"}]}`
  const raw = await completeJson<{ options?: unknown }>({ configs: configs(), system: SYSTEM, prompt, maxTokens: 800 })
  const options = (Array.isArray(raw.options) ? raw.options : []).slice(0, 3).flatMap((o: Record<string, unknown>) => {
    const mode = text(o.mode, 50)
    const est = Number(o.estInr)
    return mode ? [{ mode, duration: text(o.duration, 40), estInr: Number.isFinite(est) && est > 0 ? Math.round(est) : null, note: text(o.note, 120) }] : []
  })
  return { from: from.name, to: to.name, options }
}
