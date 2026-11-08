import { describe, expect, it } from "vitest"
import { budgetPresets, currencyFor, FALLBACK_RATES, formatMoney, nice } from "./currency"
import { destinations, safeNext, withPrefix } from "./destinations"
import { comparison, extendPass, LAUNCH_ENDS, planById, PLANS, priceFor } from "./pricing"
import { legPairs, move, nightsStatus, schedule, totals, type Stop } from "./route"
import { isAdmin, searchError } from "./server"
import { cleanPlaces } from "./planner"
import { pickThree, toFlight } from "./travel"
import type { Hotel, Place } from "./types"

const place = (id: string, extra: Partial<Place> = {}): Place => ({
  id, name: id, country: "X", countryCode: "KZ", city: id, iata: "ALA", nights: 2, note: "", offbeat: false, closed: null, photo: id, ...extra,
})

describe("pricing", () => {
  it("charges the launch price until the offer ends, then the regular price", () => {
    const week = planById("week")!
    expect(priceFor(week, new Date("2026-11-08"))).toBe(79)
    expect(priceFor(week, new Date(LAUNCH_ENDS.getTime() + 1000))).toBe(99)
  })
  it("compares against smaller passes at the same moment's prices, never an invented price", () => {
    const launch = new Date("2026-11-08")
    const after = new Date("2027-06-01")
    expect(comparison(planById("month")!, launch)).toEqual({ label: "4 week passes", amount: 316 })
    expect(comparison(planById("year")!, launch)).toEqual({ label: "12 months", amount: 2388 })
    expect(comparison(planById("year")!, after)).toEqual({ label: "12 months", amount: 2988 })
    expect(comparison(PLANS[0])).toBeNull()
  })
  it("stacks a new pass after an active one instead of losing days", () => {
    const now = new Date("2026-11-08T00:00:00Z")
    const active = new Date("2026-11-10T00:00:00Z")
    expect(extendPass(active, planById("week")!, now).toISOString()).toBe("2026-11-17T00:00:00.000Z")
    expect(extendPass(new Date("2026-11-01"), planById("week")!, now).toISOString()).toBe("2026-11-15T00:00:00.000Z")
  })
})

describe("access", () => {
  it("treats only confirmed emails on the list as admin, case-insensitively", () => {
    const list = "boss@x.com, Ops@X.com"
    expect(isAdmin({ email: "ops@x.com", email_confirmed_at: "2026-01-01" }, list)).toBe(true)
    expect(isAdmin({ email: "ops@x.com", email_confirmed_at: undefined }, list)).toBe(false)
    expect(isAdmin({ email: "other@x.com", email_confirmed_at: "2026-01-01" }, list)).toBe(false)
    expect(isAdmin({ email: "boss@x.com", email_confirmed_at: "2026-01-01" }, "")).toBe(false)
  })
  it("rejects bad searches before any paid call is made", () => {
    const ok = { from: "Bengaluru", to: "Kazakhstan", start: "2027-03-20", nights: 11, budget: 200000, adults: 2 }
    expect(searchError(ok, "2026-11-08")).toBeNull()
    expect(searchError({ ...ok, start: "2026-01-01" }, "2026-11-08")).toMatch(/start date/)
    expect(searchError({ ...ok, nights: 0 }, "2026-11-08")).toMatch(/Nights/)
    expect(searchError({ ...ok, adults: 12 }, "2026-11-08")).toMatch(/Travellers/)
    expect(searchError(null)).toMatch(/Missing/)
  })
})

describe("route", () => {
  it("moves a stop to any position and ignores out-of-range moves", () => {
    expect(move(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"])
    expect(move(["a", "b"], 0, 5)).toEqual(["a", "b"])
  })
  it("gives each stop its days and hotel dates; day trips add no nights", () => {
    const stops: Stop[] = [{ place: place("a"), nights: 4, hotelId: null }, { place: place("b"), nights: 0, hotelId: null }, { place: place("c"), nights: 2, hotelId: null }]
    expect(schedule(stops, "2027-03-20")).toEqual([
      { fromDay: 1, toDay: 5, checkin: "2027-03-20", checkout: "2027-03-24" },
      { fromDay: 5, toDay: 5, checkin: "2027-03-24", checkout: "2027-03-24" },
      { fromDay: 5, toDay: 7, checkin: "2027-03-24", checkout: "2027-03-26" },
    ])
  })
  it("reports nights left or over", () => {
    expect(nightsStatus(11, 11).tone).toBe("ok")
    expect(nightsStatus(10, 11).text).toBe("1 night free")
    expect(nightsStatus(13, 11).text).toBe("2 nights over your dates")
  })
  it("adds the trip up for the whole group and counts what is not priced", () => {
    const h: Hotel = { id: "h1", name: "H", photo: null, stars: 3, total: 15200, currency: "INR", bookUrl: "" }
    const stops: Stop[] = [{ place: place("a"), nights: 4, hotelId: "h1" }, { place: place("b"), nights: 2, hotelId: null }]
    const t = totals({
      stops, hotels: { a: [h] }, flight: null,
      legs: [{ leg: { from: "a", to: "b", options: [{ mode: "Bus", duration: "5h", estInr: 900, note: "" }] }, choice: 0 }],
      adults: 2, nights: 6, dailyPerPerson: 1500,
    })
    expect(t).toEqual({ flights: 0, stays: 15200, transport: 1800, daily: 21000, total: 38000, unknown: 2 })
  })
})

describe("model and partner output is cleaned", () => {
  it("clamps nights, de-duplicates ids and never pre-picks a closed place", () => {
    const r = cleanPlaces({
      title: "T", origin: { city: "Bengaluru", iata: "blr" },
      places: [
        { name: "Almaty", nights: 40, pick: true, iata: "ALA", countryCode: "kz" },
        { name: "Almaty", nights: -2, pick: true },
        { name: "Song-Kul", closed: "Snowed in until June", pick: true },
        { name: "" },
      ],
      tips: "not a list",
    })
    expect(r.origin.iata).toBe("BLR")
    expect(r.places.map((p) => [p.id, p.nights, p.pick])).toEqual([["almaty", 10, true], ["almaty-2", 0, true], ["song-kul", 0, false]])
    expect(r.places[0].countryCode).toBe("KZ")
    expect(r.tips).toEqual([])
  })
  it("keeps three distinct hotel choices: cheapest, middle and best rated", () => {
    const mk = (id: string, total: number, stars: number): Hotel => ({ id, name: id, photo: null, stars, total, currency: "INR", bookUrl: "" })
    expect(pickThree([mk("a", 9000, 5), mk("b", 3000, 2), mk("c", 5000, 3), mk("d", 7000, 4)]).map((h) => h.id)).toEqual(["b", "d", "a"])
    expect(pickThree([mk("a", 1000, 3)]).map((h) => h.id)).toEqual(["a"])
  })
  it("joins an open-jaw trip into one fare with both prices", () => {
    const leg = (dep: string, arr: string, n = 1) => ({ carrier: "Air Astana", duration_minutes: 420, segments: Array.from({ length: n }, () => ({ departure_time_local: dep, arrival_time_local: arr })) })
    const f = toFlight(
      { ignav_id: "out1", price: { amount: 26800, currency: "INR" }, outbound: leg("2027-03-20T06:10", "2027-03-20T17:35", 2) },
      { ignav_id: "home1", price: { amount: 22400, currency: "INR" }, outbound: leg("2027-03-31T08:45", "2027-03-31T16:30") },
    )
    expect(f).toMatchObject({ id: "out1|home1", price: 49200, stops: 1, backStops: 0, carrier: "Air Astana" })
  })
})

describe("transport legs", () => {
  it("sends a day trip out and back from the last base, then continues from that base", () => {
    const s = (id: string, nights: number): Stop => ({ place: place(id), nights, hotelId: null })
    const pairs = legPairs([s("almaty", 3), s("charyn", 0), s("bishkek", 2), s("tashkent", 2)])
    expect(pairs.map((p) => [p.key, p.dayTrip])).toEqual([["almaty>charyn", true], ["almaty>bishkek", false], ["bishkek>tashkent", false]])
  })
})

describe("search suggestions", () => {
  it("lists real countries and regions, without group codes or duplicates", () => {
    const all = destinations()
    expect(all).toContain("Switzerland")
    expect(all).toContain("Kazakhstan")
    expect(all).toContain("Anywhere")
    expect(all).not.toContain("European Union")
    expect(all).not.toContain("Unknown Region")
    expect(new Set(all).size).toBe(all.length)
  })
  it("suggests the next country after a comma and skips ones already typed", () => {
    const opts = withPrefix("Kazakhstan, Uz", ["Kazakhstan", "Uzbekistan"])
    expect(opts).toEqual(["Kazakhstan, Uzbekistan"])
    expect(withPrefix("Swi", ["Switzerland"])).toEqual(["Switzerland"])
  })
  it("only follows same-site next links", () => {
    expect(safeNext("/trip", "/plan")).toBe("/trip")
    expect(safeNext("//evil.com", "/plan")).toBe("/plan")
    expect(safeNext("/\\evil.com", "/plan")).toBe("/plan")
    expect(safeNext("https://evil.com", "/plan")).toBe("/plan")
    expect(safeNext(null, "/plan")).toBe("/plan")
  })
})

describe("currency", () => {
  const rates = { ...FALLBACK_RATES, USD: 0.012 }
  it("guesses the currency from time zone first, then region, then language", () => {
    expect(currencyFor("en-US", "Asia/Kolkata")).toBe("INR")
    expect(currencyFor("en-GB", "Europe/London")).toBe("GBP")
    expect(currencyFor("de-DE")).toBe("EUR")
    expect(currencyFor("ja")).toBe("JPY")
    expect(currencyFor("sw")).toBe("USD")
  })
  it("rounds presets to clean amounts and keeps INR exact", () => {
    expect(nice(565.4)).toBe(570)
    expect(nice(2260)).toBe(2300)
    expect(budgetPresets("INR", rates)[2]).toEqual({ inr: 200000, shown: 200000 })
    const usd = budgetPresets("USD", rates)[2]
    expect(usd.shown).toBe(2400)
    expect(usd.inr).toBe(200000)
  })
  it("formats with the right symbol and Indian grouping for rupees", () => {
    expect(formatMoney(200000, "INR")).toBe("₹2,00,000")
    expect(formatMoney(2400, "USD", "en-US")).toBe("$2,400")
  })
})
