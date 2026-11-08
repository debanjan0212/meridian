/** Thin clients for the outside services. Server-only. */
import { env, paymentsMode } from "./server"
import type { Flight, Hotel } from "./types"

async function call<T>(name: string, url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`${name} ${res.status}: ${detail.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

// ---------- Flights: Ignav ----------
const IGNAV = "https://ignav.com/api"

type IgnavSegment = { departure_time_local?: string; arrival_time_local?: string }
type IgnavLeg = { carrier?: string | { name?: string }; duration_minutes?: number; segments?: IgnavSegment[] }
type IgnavItinerary = {
  ignav_id: string
  price: { amount: number; currency: string }
  outbound: IgnavLeg
  inbound?: IgnavLeg
}

function ignav<T>(path: string, body: unknown): Promise<T> {
  if (!env("IGNAV_API_KEY")) throw new Error("Flights are not configured (IGNAV_API_KEY).")
  return call<T>("ignav", `${IGNAV}${path}`, {
    method: "POST",
    headers: { "X-Api-Key": env("IGNAV_API_KEY"), "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const carrierName = (leg: IgnavLeg) => (typeof leg.carrier === "string" ? leg.carrier : leg.carrier?.name || "Airline")
const stopsOf = (leg?: IgnavLeg) => Math.max(0, (leg?.segments?.length || 1) - 1)
const firstDep = (leg?: IgnavLeg) => leg?.segments?.[0]?.departure_time_local || ""
const lastArr = (leg?: IgnavLeg) => leg?.segments?.at(-1)?.arrival_time_local || ""

export function toFlight(out: IgnavItinerary, back?: IgnavItinerary): Flight {
  const ret = back?.outbound ?? out.inbound
  return {
    id: back ? `${out.ignav_id}|${back.ignav_id}` : out.ignav_id,
    price: Math.round(out.price.amount + (back?.price.amount ?? 0)),
    currency: out.price.currency,
    carrier: carrierName(out.outbound),
    stops: stopsOf(out.outbound),
    minutes: out.outbound.duration_minutes || 0,
    depart: firstDep(out.outbound),
    arrive: lastArr(out.outbound),
    backDepart: ret ? firstDep(ret) : null,
    backArrive: ret ? lastArr(ret) : null,
    backStops: ret ? stopsOf(ret) : null,
  }
}

/** Round trip when you fly home from the same airport, otherwise two one-ways (open jaw). */
export async function searchFlights(q: { from: string; to: string; back: string; depart: string; ret: string; adults: number }): Promise<Flight[]> {
  const common = { adults: q.adults, market: "IN", cabin_class: "economy" }
  type Res = { itineraries?: IgnavItinerary[] }
  let flights: Flight[]
  if (q.to === q.back) {
    const res = await ignav<Res>("/fares/round-trip", { ...common, origin: q.from, destination: q.to, departure_date: q.depart, return_date: q.ret })
    flights = (res.itineraries || []).map((it) => toFlight(it))
  } else {
    const [out, home] = await Promise.all([
      ignav<Res>("/fares/one-way", { ...common, origin: q.from, destination: q.to, departure_date: q.depart }),
      ignav<Res>("/fares/one-way", { ...common, origin: q.back, destination: q.from, departure_date: q.ret }),
    ])
    const cheapestHome = [...(home.itineraries || [])].sort((a, b) => a.price.amount - b.price.amount)[0]
    flights = cheapestHome ? (out.itineraries || []).map((it) => toFlight(it, cheapestHome)) : []
  }
  return flights.sort((a, b) => a.price - b.price).slice(0, 8)
}

type LinkRes = { booking_options?: { links?: { url: string; specificity?: string; provider_name?: string }[] }[] }

/** One purchase link per ignav_id; a flight id may hold two (outbound|home). */
export async function bookingLinks(id: string): Promise<{ url: string; provider: string }[]> {
  const ids = id.split("|").filter((x) => /^[\w-]{6,80}$/.test(x)).slice(0, 2)
  const results = await Promise.all(ids.map((ignav_id) => ignav<LinkRes>("/fares/booking-links", { ignav_id })))
  return results.flatMap((r) => {
    const links = (r.booking_options || []).flatMap((o) => o.links || [])
    const best = links.find((l) => l.specificity === "exact_flight") || links[0]
    if (!best) return []
    const url = /^https?:\/\//.test(best.url) ? best.url : `https://${best.url}`
    return [{ url, provider: best.provider_name || new URL(url).hostname }]
  })
}

// ---------- Hotels: liteAPI (Nuitee) ----------
const LITE = "https://api.liteapi.travel/v3.0"
const liteHeaders = () => {
  if (!env("LITEAPI_KEY")) throw new Error("Hotels are not configured (LITEAPI_KEY).")
  return { "X-API-Key": env("LITEAPI_KEY"), "content-type": "application/json", accept: "application/json" }
}

type LiteHotel = { id: string; name: string; main_photo?: string; thumbnail?: string; stars?: number }
type LiteRates = { data?: { hotelId: string; roomTypes?: { offerRetailRate?: { amount: number; currency: string } }[] }[] }

export async function searchHotels(q: { city: string; countryCode: string; checkin: string; checkout: string; adults: number }): Promise<Hotel[]> {
  const list = await call<{ data?: LiteHotel[] }>(
    "liteapi",
    `${LITE}/data/hotels?${new URLSearchParams({ countryCode: q.countryCode, cityName: q.city, limit: "40" })}`,
    { headers: liteHeaders() },
  )
  const hotels = list.data || []
  if (!hotels.length) return []
  const rates = await call<LiteRates>("liteapi", `${LITE}/hotels/rates`, {
    method: "POST",
    headers: liteHeaders(),
    body: JSON.stringify({
      hotelIds: hotels.map((h) => h.id),
      checkin: q.checkin,
      checkout: q.checkout,
      currency: "INR",
      guestNationality: "IN",
      occupancies: [{ adults: q.adults }],
    }),
  })
  const priced = (rates.data || []).flatMap((r) => {
    const offers = (r.roomTypes || []).map((t) => t.offerRetailRate).filter((o): o is { amount: number; currency: string } => !!o)
    const best = offers.sort((a, b) => a.amount - b.amount)[0]
    const h = hotels.find((x) => x.id === r.hotelId)
    return best && h ? [{ h, best }] : []
  })
  return pickThree(
    priced.map(({ h, best }) => ({
      id: h.id,
      name: h.name,
      photo: h.main_photo || h.thumbnail || null,
      stars: h.stars ?? null,
      total: Math.round(best.amount),
      currency: best.currency,
      bookUrl: bookingSearchUrl(h.name, q),
    })),
  )
}

/** Cheapest, a middle option, and the best-rated: three real choices instead of forty. */
export function pickThree(hotels: Hotel[]): Hotel[] {
  const byPrice = [...hotels].sort((a, b) => a.total - b.total)
  const chosen = [byPrice[0], byPrice[Math.floor(byPrice.length / 2)], [...byPrice].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))[0]]
  return chosen.filter((h, i) => h && chosen.findIndex((x) => x?.id === h.id) === i)
}

// shortcut: hands off to a Booking.com search for the hotel; switch to liteAPI's own checkout when bookings go in-house.
export function bookingSearchUrl(name: string, q: { city: string; checkin: string; checkout: string; adults: number }): string {
  const p = new URLSearchParams({ ss: `${name}, ${q.city}`, checkin: q.checkin, checkout: q.checkout, group_adults: String(q.adults), no_rooms: "1" })
  return `https://www.booking.com/searchresults.html?${p}`
}

// ---------- Photos: Unsplash ----------
export async function unsplashPhoto(query: string): Promise<{ url: string; credit: string; link: string } | null> {
  if (!env("UNSPLASH_ACCESS_KEY")) return null
  type Res = { results?: { urls: { regular: string }; user: { name: string; links: { html: string } } }[] }
  const res = await call<Res>(
    "unsplash",
    `https://api.unsplash.com/search/photos?${new URLSearchParams({ query, per_page: "1", orientation: "landscape", content_filter: "high" })}`,
    { headers: { authorization: `Client-ID ${env("UNSPLASH_ACCESS_KEY")}`, "accept-version": "v1" } },
  )
  const p = res.results?.[0]
  if (!p) return null
  return { url: p.urls.regular, credit: p.user.name, link: `${p.user.links.html}?utm_source=meridian&utm_medium=referral` }
}

// ---------- Payments: Cashfree ----------
const cashfreeBase = () => (paymentsMode() === "live" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg")
const cashfreeHeaders = () => {
  if (!env("CASHFREE_APP_ID") || !env("CASHFREE_SECRET_KEY")) throw new Error("Payments are not configured (CASHFREE_*).")
  return {
    "x-client-id": env("CASHFREE_APP_ID"),
    "x-client-secret": env("CASHFREE_SECRET_KEY"),
    "x-api-version": "2025-01-01",
    "content-type": "application/json",
  }
}

export type CashfreeOrder = { order_id: string; order_amount: number; order_status: string; payment_session_id?: string }

export function createOrder(o: { orderId: string; amount: number; customerId: string; phone: string; email?: string; returnUrl: string; plan: string }) {
  return call<CashfreeOrder>("cashfree", `${cashfreeBase()}/orders`, {
    method: "POST",
    headers: cashfreeHeaders(),
    body: JSON.stringify({
      order_id: o.orderId,
      order_amount: o.amount,
      order_currency: "INR",
      customer_details: { customer_id: o.customerId, customer_phone: o.phone, customer_email: o.email },
      order_meta: { return_url: o.returnUrl },
      order_tags: { plan: o.plan },
    }),
  })
}

export function getOrder(orderId: string) {
  return call<CashfreeOrder>("cashfree", `${cashfreeBase()}/orders/${encodeURIComponent(orderId)}`, { headers: cashfreeHeaders() })
}
