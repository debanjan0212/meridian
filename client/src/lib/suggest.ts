import { destinations, HOME_CITIES } from "@shared/destinations"
import { GEMS, SEASONS, seasonOf } from "@shared/explore"
import type { Suggestion } from "@/components/PlaceInput"

/** What the To box offers before anything is typed: anywhere, what is good this season, and hidden gems. */
export function destinationIdeas(): Suggestion[] {
  const season = SEASONS.find((s) => s.id === seasonOf())!
  const seen = new Set<string>()
  const add = (name: string, hint: string) => (seen.has(name) ? [] : (seen.add(name), [{ name, hint }]))
  return [
    ...add("Anywhere", "Let Meridian choose"),
    ...season.picks.filter((p) => !p.offbeat).flatMap((p) => add(p.name, `Good in ${season.name.toLowerCase()}`)),
    ...GEMS.flatMap((g) => add(g.name, "Hidden gem")),
  ]
}

export const homeIdeas = (): Suggestion[] => HOME_CITIES.slice(0, 8).map((name) => ({ name }))

let all: string[] | null = null
/** Every country and region, plus the curated names, computed once. */
export function allDestinations(): string[] {
  if (!all) all = [...new Set([...destinations(), ...GEMS.map((g) => g.name), ...SEASONS.flatMap((s) => s.picks.map((p) => p.name))])]
  return all
}
