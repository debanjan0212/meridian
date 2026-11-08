import { cached, handle, hashKey, json, rateLimited, readBody, requirePlanAccess } from "../../shared/server"
import { suggestLeg } from "../../shared/planner"

type End = { name: string; country: string }
const ok = (e: unknown): e is End =>
  !!e && typeof (e as End).name === "string" && typeof (e as End).country === "string" && (e as End).name.length <= 60 && (e as End).country.length <= 40

export default handle(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const gate = await requirePlanAccess(req)
  if (gate instanceof Response) return gate
  if (rateLimited(`legs:${gate.user.id}`, 30)) return json({ error: "Slow down a little." }, 429)

  const b = await readBody<{ from: End; to: End }>(req)
  if (!b || !ok(b.from) || !ok(b.to)) return json({ error: "Bad leg." }, 400)
  const key = `legs:${hashKey([b.from.name, b.from.country, b.to.name, b.to.country].map((s) => s.toLowerCase()))}`
  return json(await cached(key, 30 * 86_400_000, () => suggestLeg(b.from, b.to)))
})
