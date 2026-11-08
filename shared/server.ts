/** Helpers for the Netlify functions. Server-only: imports the Supabase secret key. */
import { createHash } from "node:crypto"
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import { getStore } from "@netlify/blobs"
import type { Me } from "./types"

export const env = (key: string) => process.env[key] || ""

export const json = (data: unknown, status = 200) => Response.json(data, { status })

let client: SupabaseClient | null = null
export function db(): SupabaseClient {
  if (!client) {
    if (!env("VITE_SUPABASE_URL") || !env("SUPABASE_SECRET_KEY")) throw new Error("Supabase is not configured.")
    client = createClient(env("VITE_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

/** The signed-in user from the browser's Supabase access token, or null. */
export async function userFrom(req: Request): Promise<User | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) return null
  const { data, error } = await db().auth.getUser(token)
  return error ? null : data.user
}

export function isAdmin(user: Pick<User, "email" | "email_confirmed_at"> | null, list = env("ADMIN_EMAILS")): boolean {
  if (!user?.email || !user.email_confirmed_at) return false
  const admins = list.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  return admins.includes(user.email.toLowerCase())
}

export function paymentsMode(): Me["paymentsMode"] {
  const mode = env("PAYMENTS_MODE")
  return mode === "sandbox" || mode === "live" ? mode : "off"
}

export async function passUntil(userId: string): Promise<Date | null> {
  const { data, error } = await db()
    .from("passes")
    .select("valid_until")
    .eq("user_id", userId)
    .order("valid_until", { ascending: false })
    .limit(1)
  if (error) throw new Error(`passes: ${error.message}`)
  return data?.[0] ? new Date(data[0].valid_until) : null
}

export async function whoAmI(user: User): Promise<Me> {
  const admin = isAdmin(user)
  const mode = paymentsMode()
  const until = mode === "off" ? null : await passUntil(user.id)
  return {
    email: user.email ?? null,
    admin,
    paymentsMode: mode,
    passUntil: until?.toISOString() ?? null,
    canPlan: mode === "off" || admin || (!!until && until > new Date()),
  }
}

type Gate = { user: User } | Response

export async function requireUser(req: Request): Promise<Gate> {
  const user = await userFrom(req)
  return user ? { user } : json({ error: "Please sign in first." }, 401)
}

/** Every endpoint that spends paid API calls on a plan goes through this. */
export async function requirePlanAccess(req: Request): Promise<Gate> {
  const gate = await requireUser(req)
  if (gate instanceof Response) return gate
  const me = await whoAmI(gate.user)
  return me.canPlan ? gate : json({ error: "A pass is needed to build plans." }, 402)
}

export function hashKey(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32)
}

/** Netlify Blobs cache. Outside Netlify (local dev, tests) it just calls through. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  let store: ReturnType<typeof getStore> | null = null
  try {
    store = getStore("cache")
    const hit = (await store.get(key, { type: "json" })) as { at: number; value: T } | null
    if (hit && Date.now() - hit.at < ttlMs) return hit.value
  } catch {
    store = null
  }
  const value = await fn()
  try {
    await store?.setJSON(key, { at: Date.now(), value })
  } catch {
    // A failed cache write should never fail the request.
  }
  return value
}

const hits = new Map<string, number[]>()
// shortcut: per-instance memory, so limits reset on cold starts; move to Blobs or Redis before going live.
export function rateLimited(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs)
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > max
}

export async function readBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

/** Wrap a handler so upstream failures come back as a clean 502 instead of a crash. */
export function handle(fn: (req: Request, ctx: { ip?: string }) => Promise<Response>) {
  return async (req: Request, ctx: { ip?: string }) => {
    try {
      return await fn(req, ctx)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(new URL(req.url).pathname, message)
      return json({ error: message.slice(0, 300) }, 502)
    }
  }
}

export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)
export const isIata = (s: unknown): s is string => typeof s === "string" && /^[A-Z]{3}$/.test(s)

export { addDays } from "./route"

/** Returns an error message for a bad search, or null when it is fine. */
export function searchError(s: Partial<import("./types").Search> | null, today = new Date().toISOString().slice(0, 10)): string | null {
  if (!s) return "Missing search."
  const words = (v: unknown) => typeof v === "string" && v.trim().length >= 2 && v.length <= 60
  if (!words(s.from)) return "Tell us where you start from."
  if (!words(s.to)) return "Tell us where you want to go, or say anywhere."
  if (!isDate(s.start) || s.start < today) return "Pick a start date from today onwards."
  if (!Number.isInteger(s.nights) || s.nights! < 1 || s.nights! > 30) return "Nights must be between 1 and 30."
  if (!Number.isFinite(s.budget) || s.budget! < 1000 || s.budget! > 10_000_000) return "Budget must be between ₹1,000 and ₹1 crore."
  if (!Number.isInteger(s.adults) || s.adults! < 1 || s.adults! > 9) return "Travellers must be between 1 and 9."
  return null
}
