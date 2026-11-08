/** Suggestions for the trip search boxes. Country names come from the browser's own Intl data, so nothing to maintain. */

const REGIONS = [
  "Anywhere", "Central Asia", "Southeast Asia", "Europe", "Scandinavia", "Balkans", "Caucasus", "Middle East",
  "East Africa", "South America", "Himalayas", "Northeast India", "Ladakh", "Kashmir", "Kerala", "Rajasthan",
  "Andaman Islands", "Bali", "Lapland", "Patagonia",
]

// ISO codes that name groups or placeholders, not places you can visit.
const NOT_PLACES = new Set(["EU", "EZ", "UN", "QO", "ZZ", "XA", "XB"])

export function destinations(locale = "en"): string[] {
  const names = new Intl.DisplayNames([locale], { type: "region" })
  const countries = new Set<string>()
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b)
      if (NOT_PLACES.has(code)) continue
      try {
        const name = names.of(code)
        if (name && name !== code) countries.add(name)
      } catch {
        // Not a region code.
      }
    }
  }
  return [...REGIONS, ...[...countries].sort((x, y) => x.localeCompare(y))]
}

export const HOME_CITIES = [
  "Bengaluru", "Delhi", "Mumbai", "Chennai", "Hyderabad", "Kolkata", "Pune", "Ahmedabad", "Kochi", "Goa",
  "Jaipur", "Lucknow", "Chandigarh", "Guwahati", "Bhubaneswar", "Indore", "Coimbatore", "Thiruvananthapuram",
  "Nagpur", "Varanasi", "Amritsar", "Srinagar", "Bagdogra", "Patna", "Visakhapatnam", "Mangaluru",
]

/** Datalist options for a comma-separated box: keep what is typed before the last comma, suggest the next name. */
export function withPrefix(typed: string, names: string[]): string[] {
  const cut = typed.lastIndexOf(",")
  if (cut < 0) return names
  const done = typed.slice(0, cut).split(",").map((s) => s.trim().toLowerCase())
  const prefix = `${typed.slice(0, cut + 1).trimEnd()} `
  return names.filter((n) => !done.includes(n.toLowerCase())).map((n) => prefix + n)
}

/** Only same-site paths are allowed as a "next" redirect; anything else goes to the fallback. */
export function safeNext(raw: string | null, fallback: string): string {
  return raw && /^\/(?![/\\])/.test(raw) ? raw : fallback
}
