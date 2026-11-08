import { addDays, db, env, handle, isAdmin, json, paymentsMode, requireUser } from "../../shared/server"
import { completeWithFallback, resolveConfigs } from "../../shared/llm"
import { getOrder, searchFlights, unsplashPhoto } from "../../shared/travel"

/** Admin-only: one tiny real call to each service, so you can see what works on the deployed site. */
export default handle(async (req) => {
  const gate = await requireUser(req)
  if (gate instanceof Response) return gate
  if (!isAdmin(gate.user)) return json({ error: "Admins only." }, 403)

  const soon = addDays(new Date().toISOString().slice(0, 10), 30)
  const checks: [string, () => Promise<string>][] = [
    ["Supabase", async () => {
      const { error } = await db().from("passes").select("order_id", { count: "exact", head: true })
      if (error) throw new Error(error.message)
      return "tables reachable"
    }],
    ["Gemini", async () => {
      const configs = resolveConfigs(process.env)
      if (!configs.length) throw new Error("no key")
      const reply = await completeWithFallback({ configs, system: "Reply with the single word OK.", messages: [{ role: "user", content: "ping" }], maxTokens: 20 })
      return `${configs[0].provider}: ${reply.slice(0, 20)}`
    }],
    ["Ignav flights", async () => `${(await searchFlights({ from: "BLR", to: "DEL", back: "DEL", depart: soon, ret: addDays(soon, 3), adults: 1 })).length} fares BLR-DEL`],
    ["liteAPI hotels", async () => {
      const res = await fetch("https://api.liteapi.travel/v3.0/data/hotels?countryCode=KZ&cityName=Almaty&limit=1", { headers: { "X-API-Key": env("LITEAPI_KEY") } })
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`)
      return "hotel list OK"
    }],
    ["Unsplash", async () => ((await unsplashPhoto("Almaty mountains")) ? "photo found" : "no key or no result")],
    ["Cashfree", async () => {
      try {
        await getOrder("mrd_health_check_0000")
        return "reachable"
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/ 404:/.test(msg)) return `keys OK (${paymentsMode() === "live" ? "production" : "sandbox"})`
        throw err
      }
    }],
  ]

  const results = await Promise.all(checks.map(async ([name, run]) => {
    const t = Date.now()
    try {
      return { name, ok: true, detail: await run(), ms: Date.now() - t }
    } catch (err) {
      return { name, ok: false, detail: (err instanceof Error ? err.message : String(err)).slice(0, 200), ms: Date.now() - t }
    }
  }))
  return json({ paymentsMode: paymentsMode(), results })
})
