import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { currencyFor, FALLBACK_RATES, formatMoney, fromInr, toInr, type Currency, type Rates } from "@shared/currency"
import { setLanguage } from "./translate"

type Prefs = {
  currency: Currency
  setCurrency: (c: Currency) => void
  rates: Rates
  money: (inr: number) => string
  fromInr: (inr: number) => number
  toInr: (amount: number) => number
  lang: string // "auto" or a language code
  setLang: (l: string) => void
  locale: string
}

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    // Not saved; the choice still applies to this visit.
  }
}

const browserLocale = () => navigator.language || "en-IN"
const Ctx = createContext<Prefs | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const locale = browserLocale()
  const [currency, setCur] = useState<Currency>(() => (read("meridian.currency") as Currency) || currencyFor(locale, Intl.DateTimeFormat().resolvedOptions().timeZone))
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES)
  const [lang, setLangState] = useState(() => read("meridian.lang") || "auto")

  useEffect(() => {
    fetch("/api/rates").then((r) => (r.ok ? r.json() : null)).then((d) => d?.rates && setRates(d.rates)).catch(() => {})
  }, [])
  useEffect(() => setLanguage(lang === "auto" ? locale : lang), [lang, locale])

  const setCurrency = (c: Currency) => {
    setCur(c)
    write("meridian.currency", c)
  }
  const setLang = (l: string) => {
    setLangState(l)
    write("meridian.lang", l)
  }
  const money = useCallback((inr: number) => formatMoney(fromInr(inr, currency, rates), currency, locale), [currency, rates, locale])
  return (
    <Ctx.Provider value={{ currency, setCurrency, rates, money, fromInr: (x) => fromInr(x, currency, rates), toInr: (x) => toInr(x, currency, rates), lang, setLang, locale }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePrefs(): Prefs {
  const p = useContext(Ctx)
  if (!p) throw new Error("usePrefs outside PrefsProvider")
  return p
}

/** Languages in the switcher; "Auto" follows the browser, and the translator handles any language code. */
export const LANGUAGES = ["en", "hi", "bn", "ta", "te", "mr", "kn", "ml", "gu", "fr", "de", "es", "it", "pt", "ar", "ja", "zh", "ko", "ru", "th", "id"]
export const languageName = (code: string) => {
  try {
    return new Intl.DisplayNames([code], { type: "language" }).of(code) || code
  } catch {
    return code
  }
}
