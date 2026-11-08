import { supabase } from "./supabase"

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/** Calls a Netlify function with the user's session token. POSTs when a body is given. */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status)
  return data as T
}
