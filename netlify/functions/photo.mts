import { cached, handle, hashKey, json, rateLimited } from "../../shared/server"
import { unsplashPhoto } from "../../shared/travel"

export default handle(async (req, ctx) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() || ""
  if (q.length < 2 || q.length > 80) return json({ error: "Bad query." }, 400)
  if (rateLimited(`photo:${ctx.ip || "unknown"}`, 60)) return json({ error: "Slow down." }, 429)

  const photo = await cached(`photo:${hashKey(q.toLowerCase())}`, 30 * 86_400_000, () => unsplashPhoto(q))
  if (!photo) return json({ error: "No photo." }, 404)
  return new Response(JSON.stringify(photo), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" },
  })
})
