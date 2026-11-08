import { cached, handle, hashKey, json, rateLimited, readBody, requireUser, searchError } from "../../shared/server"
import { suggestPlaces } from "../../shared/planner"
import type { Search } from "../../shared/types"

export default handle(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const gate = await requireUser(req)
  if (gate instanceof Response) return gate
  if (rateLimited(`places:${gate.user.id}`, 6)) return json({ error: "Too many searches at once. Give it a minute." }, 429)

  const s = await readBody<Search>(req)
  const error = searchError(s)
  if (error) return json({ error }, 400)
  const search: Search = { from: s!.from.trim(), to: s!.to.trim(), start: s!.start, nights: s!.nights, budget: s!.budget, adults: s!.adults }
  return json(await cached(`places:${hashKey(search)}`, 86_400_000, () => suggestPlaces(search)))
})
