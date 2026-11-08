import { handle, json, rateLimited, readBody, requireUser } from "../../shared/server"
import { completeWithFallback, resolveConfigs, type Msg } from "../../shared/llm"

const SYSTEM = `You are the Meridian concierge for a traveller from India.
Answer in plain, short sentences. Use the trip context when it helps.
For visa or entry rules, say what is commonly reported and always tell them to confirm on the official government portal.
Never ask for passport numbers, card details or passwords.`

export default handle(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const gate = await requireUser(req)
  if (gate instanceof Response) return gate
  if (rateLimited(`chat:${gate.user.id}`, 12)) return json({ error: "Too many questions at once. Give it a minute." }, 429)

  const b = await readBody<{ messages?: Msg[]; context?: string; lang?: string }>(req)
  const messages = (b?.messages || [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
  if (!messages.length || messages.at(-1)!.role !== "user") return json({ error: "Ask a question." }, 400)

  const configs = resolveConfigs(process.env)
  if (!configs.length) return json({ error: "The concierge is not configured yet." }, 503)
  const context = typeof b?.context === "string" ? b.context.slice(0, 4000) : ""
  const lang = /^[a-z]{2,3}$/.test(String(b?.lang || "")) ? String(b!.lang) : "en"
  const language = lang === "en" ? "" : `\nReply in ${new Intl.DisplayNames(["en"], { type: "language" }).of(lang) || lang}.`
  const reply = await completeWithFallback({ configs, system: `${SYSTEM}${language}\n\nTrip context:\n${context || "none yet"}`, messages, maxTokens: 600 })
  return json({ reply })
})
