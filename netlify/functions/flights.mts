import { cached, handle, hashKey, isDate, isIata, json, rateLimited, readBody, requirePlanAccess } from "../../shared/server"
import { searchFlights } from "../../shared/travel"

type Q = { from: string; to: string; back: string; depart: string; ret: string; adults: number }

export default handle(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const gate = await requirePlanAccess(req)
  if (gate instanceof Response) return gate
  if (rateLimited(`flights:${gate.user.id}`, 10)) return json({ error: "Too many fare searches. Give it a minute." }, 429)

  const q = await readBody<Q>(req)
  if (!q || !isIata(q.from) || !isIata(q.to) || !isIata(q.back) || !isDate(q.depart) || !isDate(q.ret) || q.ret < q.depart || !Number.isInteger(q.adults) || q.adults < 1 || q.adults > 9) {
    return json({ error: "Bad flight search." }, 400)
  }
  const query = { from: q.from, to: q.to, back: q.back, depart: q.depart, ret: q.ret, adults: q.adults }
  return json(await cached(`flights:${hashKey(query)}`, 3 * 3_600_000, () => searchFlights(query)))
})
