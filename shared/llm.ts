/**
 * Provider-agnostic LLM call.
 *
 * The orchestrator does not care who serves the model. Set one key and the
 * provider is picked automatically:
 *
 *   GEMINI_API_KEY     -> Google Gemini      (genuinely free tier, no card)
 *   GROQ_API_KEY       -> Groq               (free tier, very fast)
 *   OPENAI_API_KEY     -> OpenAI             (no free tier, paid only)
 *   ANTHROPIC_API_KEY  -> Anthropic          (no free tier, paid only)
 *
 * Set LLM_PROVIDER explicitly to override the order.
 */

export type Provider = "gemini" | "groq" | "openai" | "anthropic"

export type LlmConfig = { provider: Provider; apiKey: string; model: string }

const DEFAULT_MODEL: Record<Provider, string> = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.1-8b-instant",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
}

/** Free tiers first, so an unconfigured site costs nothing by default. */
const ORDER: Provider[] = ["gemini", "groq", "openai", "anthropic"]

const KEY_ENV: Record<Provider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
}

/**
 * Every provider with a key present, in preference order.
 *
 * More than one can be configured at once, and that is deliberate: a stale or
 * revoked key should not take the assistant down when a working key is sitting
 * right next to it.
 */
export function resolveConfigs(env: Record<string, string | undefined>): LlmConfig[] {
  const forced = env.LLM_PROVIDER as Provider | undefined
  const order = forced && ORDER.includes(forced) ? [forced] : ORDER

  return order
    .filter((provider) => env[KEY_ENV[provider]])
    .map((provider) => ({
      provider,
      apiKey: env[KEY_ENV[provider]] as string,
      model: env.AGENT_MODEL || DEFAULT_MODEL[provider],
    }))
}

export function resolveConfig(env: Record<string, string | undefined>): LlmConfig | null {
  return resolveConfigs(env)[0] ?? null
}

/** Auth and quota failures are worth trying the next provider for. */
function isProviderFailure(message: string): boolean {
  return /\b(400|401|403|429)\b/.test(message)
}

/**
 * Try each configured provider in turn. Anything that looks like a bad key or
 * an exhausted quota moves on to the next; a genuine bug does not.
 */
export async function completeWithFallback(args: {
  configs: LlmConfig[]
  system: string
  messages: Msg[]
  maxTokens?: number
}): Promise<string> {
  const { configs, ...rest } = args
  let last: unknown

  for (const config of configs) {
    try {
      return await complete({ config, ...rest })
    } catch (err) {
      last = err
      const message = err instanceof Error ? err.message : String(err)
      if (!isProviderFailure(message)) throw err
      console.error(`provider ${config.provider} unusable, trying next:`, message.slice(0, 200))
    }
  }

  throw last instanceof Error ? last : new Error("No usable LLM provider configured.")
}

export type Msg = { role: "user" | "assistant"; content: string }

/**
 * One text completion. Returns the model's reply as a plain string - streaming
 * is handled by the orchestrator, which needs the whole reply anyway so it can
 * check for NEEDS_DEBANJAN before showing anything.
 */
export async function complete({
  config,
  system,
  messages,
  maxTokens = 700,
}: {
  config: LlmConfig
  system: string
  messages: Msg[]
  maxTokens?: number
}): Promise<string> {
  switch (config.provider) {
    case "gemini":
      return gemini(config, system, messages, maxTokens)
    case "anthropic":
      return anthropic(config, system, messages, maxTokens)
    case "groq":
    case "openai":
      return openaiCompatible(config, system, messages, maxTokens)
  }
}

async function fail(res: Response, provider: string): Promise<never> {
  const detail = await res.text().catch(() => "")
  throw new Error(`${provider} ${res.status}: ${detail.slice(0, 300)}`)
}

async function gemini(
  cfg: LlmConfig,
  system: string,
  messages: Msg[],
  maxTokens: number,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`
  const body = JSON.stringify({
    // Gemini keeps the system prompt separate, like Anthropic does.
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.3,
      // Thinking eats the output budget and adds seconds; plans need speed, not deliberation.
      ...(cfg.model.includes("2.5-flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  })

  /*
    Google is migrating Gemini keys from the old `AIza` format to a new `AQ.`
    auth-key format. The two authenticate differently: `AIza` keys go in the
    x-goog-api-key header, while `AQ.` keys are bearer tokens and are rejected
    with ACCESS_TOKEN_TYPE_UNSUPPORTED if sent as an API key.

    Rather than sniff the prefix - which is exactly the brittle assumption that
    broke everyone else's tooling - try the header that matches the key shape,
    then fall back to the other on an auth failure.
  */
  const looksLikeAuthKey = cfg.apiKey.startsWith("AQ.")
  const attempts: Record<string, string>[] = looksLikeAuthKey
    ? [{ authorization: `Bearer ${cfg.apiKey}` }, { "x-goog-api-key": cfg.apiKey }]
    : [{ "x-goog-api-key": cfg.apiKey }, { authorization: `Bearer ${cfg.apiKey}` }]

  let last: Response | null = null
  for (const auth of attempts) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...auth },
      body,
    })
    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      return (
        data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || ""
      ).trim()
    }
    // Only an auth failure is worth retrying with the other scheme.
    if (res.status !== 401 && res.status !== 403) return fail(res, "gemini")
    last = res
  }

  return fail(last as Response, "gemini")
}

async function anthropic(
  cfg: LlmConfig,
  system: string,
  messages: Msg[],
  maxTokens: number,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system, messages }),
  })
  if (!res.ok) await fail(res, "anthropic")

  const data = (await res.json()) as { content?: { text?: string }[] }
  return (data.content?.[0]?.text || "").trim()
}

/**
 * Models to fall back through when the configured one is not available to this
 * account. Groq gates some models by tier, so a name that appears in the public
 * docs can still 404 for a free key. Ordered cheapest/most-available first.
 */
const FALLBACK_MODELS: Partial<Record<Provider, string[]>> = {
  groq: ["llama-3.1-8b-instant", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"],
  openai: ["gpt-4o-mini"],
}

/** Remembered for the life of the process, so we only discover this once. */
const resolvedModel = new Map<Provider, string>()

/** Groq and OpenAI both speak the OpenAI chat-completions shape. */
async function openaiCompatible(
  cfg: LlmConfig,
  system: string,
  messages: Msg[],
  maxTokens: number,
): Promise<string> {
  const url =
    cfg.provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions"

  const known = resolvedModel.get(cfg.provider)
  const candidates = known
    ? [known]
    : [cfg.model, ...(FALLBACK_MODELS[cfg.provider] ?? []).filter((m) => m !== cfg.model)]

  let last: Response | null = null

  for (const model of candidates) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.3,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    })

    if (res.ok) {
      resolvedModel.set(cfg.provider, model)
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      return (data.choices?.[0]?.message?.content || "").trim()
    }

    // 404 here means "this account cannot use that model" - worth trying the
    // next one. Anything else is a real error and should surface immediately.
    if (res.status !== 404) return fail(res, cfg.provider)
    last = res
  }

  return fail(last as Response, cfg.provider)
}

/** Ask for JSON and parse it. Models sometimes wrap JSON in prose or code fences. */
export async function completeJson<T>(args: {
  configs: LlmConfig[]
  system: string
  prompt: string
  maxTokens?: number
}): Promise<T> {
  const text = await completeWithFallback({
    configs: args.configs,
    system: `${args.system}\nReply with JSON only: no prose, no code fences.`,
    messages: [{ role: "user", content: args.prompt }],
    maxTokens: args.maxTokens ?? 3000,
  })
  return parseJson<T>(text)
}

export function parseJson<T>(text: string): T {
  const start = text.search(/[[{]/)
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"))
  if (start < 0 || end < start) throw new Error("The model did not return JSON.")
  return JSON.parse(text.slice(start, end + 1)) as T
}
