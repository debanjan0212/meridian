import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import type { Me } from "@shared/types"
import { supabase } from "./supabase"
import { api } from "./api"

type Auth = { session: Session | null; me: Me | null; ready: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> }

const Ctx = createContext<Auth>({ session: null, me: null, ready: false, refresh: async () => {}, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(!supabase)

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>("me"))
    } catch {
      setMe(null)
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) refresh()
    else setMe(null)
  }, [session?.user.id, refresh])

  const signOut = async () => {
    await supabase?.auth.signOut()
  }
  return <Ctx.Provider value={{ session, me, ready, refresh, signOut }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
