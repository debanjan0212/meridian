/** Route maths for the trip editor. Pure, so it is tested without a browser. */
import type { Flight, Hotel, Leg, Place } from "./types"

export type Stop = { place: Place; nights: number; hotelId: string | null }

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export const legKey = (a: Place, b: Place) => `${a.id}>${b.id}`

export type Pair = { a: Place; b: Place; key: string; dayTrip: boolean }

/** Transport legs: overnight stops chain in order; a day trip goes out and back from the last overnight base. */
export function legPairs(stops: Stop[]): Pair[] {
  const pairs: Pair[] = []
  let base: Place | null = null
  let prev: Place | null = null
  for (const s of stops) {
    const from = base ?? prev
    if (from && from.id !== s.place.id) pairs.push({ a: from, b: s.place, key: legKey(from, s.place), dayTrip: s.nights === 0 })
    if (s.nights > 0) base = s.place
    prev = s.place
  }
  return pairs
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Day numbers and hotel dates for each stop. Day-trip stops (0 nights) get no hotel dates. */
export function schedule(stops: Stop[], start: string) {
  let offset = 0
  return stops.map((s) => {
    const row = { fromDay: offset + 1, toDay: offset + 1 + s.nights, checkin: addDays(start, offset), checkout: addDays(start, offset + s.nights) }
    offset += s.nights
    return row
  })
}

export function nightsStatus(used: number, target: number): { tone: "ok" | "free" | "over"; text: string } {
  const gap = target - used
  if (gap === 0) return { tone: "ok", text: `Fits your ${target} nights` }
  const n = (k: number) => `${k} night${k === 1 ? "" : "s"}`
  return gap > 0 ? { tone: "free", text: `${n(gap)} free` } : { tone: "over", text: `${n(-gap)} over your dates` }
}

export type Totals = { flights: number; stays: number; transport: number; daily: number; total: number; unknown: number }

/** Everything for the whole group, in INR. `unknown` counts parts we could not price yet. */
export function totals(a: {
  stops: Stop[]
  hotels: Record<string, Hotel[] | undefined>
  flight: Flight | null
  legs: { leg: Leg | undefined; choice: number; times?: number }[]
  adults: number
  nights: number
  dailyPerPerson: number
}): Totals {
  let unknown = a.flight ? 0 : 1
  const stays = a.stops.reduce((sum, s) => {
    if (s.nights === 0) return sum
    const options = a.hotels[s.place.id]
    const h = options?.find((x) => x.id === s.hotelId) ?? options?.[0]
    if (!h) unknown++
    return sum + (h?.total ?? 0)
  }, 0)
  const transport = a.legs.reduce((sum, { leg, choice, times = 1 }) => {
    const est = leg?.options[choice]?.estInr
    if (est == null) unknown++
    return sum + (est ?? 0) * a.adults * times
  }, 0)
  const flights = a.flight?.price ?? 0
  const daily = a.dailyPerPerson * a.adults * (a.nights + 1)
  return { flights, stays, transport, daily, total: flights + stays + transport + daily, unknown }
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`
