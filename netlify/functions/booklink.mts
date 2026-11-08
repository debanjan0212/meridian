import { handle, json, rateLimited, readBody, requirePlanAccess } from "../../shared/server"
import { bookingLinks } from "../../shared/travel"

export default handle(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const gate = await requirePlanAccess(req)
  if (gate instanceof Response) return gate
  if (rateLimited(`booklink:${gate.user.id}`, 10)) return json({ error: "Give it a minute." }, 429)

  const b = await readBody<{ id: string }>(req)
  if (!b || typeof b.id !== "string" || b.id.length > 170) return json({ error: "Bad flight id." }, 400)
  const links = await bookingLinks(b.id)
  return links.length ? json(links) : json({ error: "That fare is no longer available. Search again." }, 404)
})
