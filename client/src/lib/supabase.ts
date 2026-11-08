import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Null until the two VITE_SUPABASE_* variables are set; the UI shows a setup notice instead of crashing. */
export const supabase = url && key ? createClient(url, key) : null
