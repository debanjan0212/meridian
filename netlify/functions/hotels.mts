import { cached, handle, hashKey, isDate, json, rateLimited, readBody, requirePlanAccess } from "../../shared/server"
import { searchHotels } from "../../shared/travel"

type Q = { city: string; countryCode: string; checkin: string; checkout: string; adults: number }

export default handle(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const gate = await requirePlanAccess(req)
  if (gate instanceof Response) return gate
  if (rateLimited(`hotels:${gate.user.id}`, 20)) return json({ error: "Too many hotel searches. Give it a minute." }, 429)

  const q = await readBody<Q>(req)
  if (!q || typeof q.city !== "string" || !q.city.trim() || q.city.length > 60 || !/^[A-Z]{2}$/.test(q.countryCode) || !isDate(q.checkin) || !isDate(q.checkout) || q.checkout <= q.checkin || !Number.isInteger(q.adults) || q.adults < 1 || q.adults > 9) {
    return json({ error: "Bad hotel search." }, 400)
  }
  const query = { city: q.city.trim(), countryCode: q.countryCode, checkin: q.checkin, checkout: q.checkout, adults: q.adults }
  return json(await cached(`hotels:${hashKey(query)}`, 6 * 3_600_000, () => searchHotels(query)))
})
