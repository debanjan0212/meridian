import { getStore } from "@netlify/blobs"
import { handle, hashKey, json, rateLimited, readBody } from "../../shared/server"
import { completeJson, resolveConfigs } from "../../shared/llm"

const SYSTEM = `You translate the interface of Meridian, a travel planning website.
Keep the brand name Meridian, place names people search for, numbers, currency symbols, emoji and punctuation as they are.
Keep each string short and natural for a website button, label or sentence.`

/** Translates UI strings into any language, once per string per language (cached for good in Netlify Blobs). */
export default handle(async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  if (rateLimited(`tr:${ctx.ip || "unknown"}`, 30)) return json({ error: "Slow down." }, 429)
  const b = await readBody<{ lang?: string; texts?: unknown }>(req)
  const lang = String(b?.lang || "")
  if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(lang) || lang === "en") return json({ error: "Bad language." }, 400)
  const texts = Array.isArray(b?.texts) ? [...new Set(b!.texts.filter((t): t is string => typeof t === "string" && t.length > 0 && t.length <= 500))].slice(0, 100) : []
  if (!texts.length) return json({ translations: {} })

  let store: ReturnType<typeof getStore> | null = null
  try { store = getStore("translations") } catch { store = null }
  const key = (t: string) => `${lang}:${hashKey(t)}`
  const known = await Promise.all(texts.map((t) => store?.get(key(t), { type: "text" }).catch(() => null) ?? null))
  const out: Record<string, string> = {}
  const missing: string[] = []
  texts.forEach((t, i) => (known[i] ? (out[t] = known[i] as string) : missing.push(t)))

  const configs = resolveConfigs(process.env)
  if (missing.length && configs.length) {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(lang) || lang
    const result = await completeJson<unknown>({
      configs, system: SYSTEM, maxTokens: 6000,
      prompt: `Translate each string in this JSON array from English into ${name}. Return a JSON array of the same length, in the same order.\n${JSON.stringify(missing)}`,
    })
    // Only trust the model's answer if it lines up one-to-one with what we sent.
    if (Array.isArray(result) && result.length === missing.length) {
      await Promise.all(missing.map(async (t, i) => {
        const tr = typeof result[i] === "string" && result[i] ? String(result[i]).slice(0, 1000) : t
        out[t] = tr
        try { await store?.set(key(t), tr) } catch { /* cache is best-effort */ }
      }))
    }
  }
  return json({ translations: out })
})
