/** Display currencies. Everything is stored and charged in INR; other currencies are for showing prices. */

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY", "THB"] as const
export type Currency = (typeof CURRENCIES)[number]

/** Units of each currency per 1 INR. */
export type Rates = Record<Currency, number>

// shortcut: rough Nov 2026 values, shown only until live ECB rates load or if the rates service is down.
export const FALLBACK_RATES: Rates = { INR: 1, USD: 0.0113, EUR: 0.0098, GBP: 0.0086, AED: 0.0415, SGD: 0.0147, AUD: 0.0172, CAD: 0.0157, JPY: 1.72, THB: 0.37 }

/** The dirham is pegged to the dollar, and the ECB does not publish it. */
export const AED_PER_USD = 3.6725

const BY_REGION: Record<string, Currency> = {
  IN: "INR", US: "USD", GB: "GBP", AE: "AED", SG: "SGD", AU: "AUD", CA: "CAD", JP: "JPY", TH: "THB",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", IE: "EUR", AT: "EUR", BE: "EUR", PT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR",
}
const BY_LANGUAGE: Record<string, Currency> = {
  hi: "INR", bn: "INR", ta: "INR", te: "INR", mr: "INR", gu: "INR", kn: "INR", ml: "INR", pa: "INR",
  fr: "EUR", de: "EUR", es: "EUR", it: "EUR", nl: "EUR", pt: "EUR", fi: "EUR", el: "EUR", ja: "JPY", th: "THB", ar: "AED",
}

/** Best guess from the browser: an Indian time zone wins, since many Indian browsers say en-US. */
export function currencyFor(locale: string, timeZone = ""): Currency {
  if (timeZone === "Asia/Kolkata" || timeZone === "Asia/Calcutta") return "INR"
  const [lang, region] = locale.split(/[-_]/)
  return BY_REGION[region?.toUpperCase() ?? ""] ?? BY_LANGUAGE[lang?.toLowerCase() ?? ""] ?? "USD"
}

export const fromInr = (inr: number, cur: Currency, rates: Rates) => inr * rates[cur]
export const toInr = (amount: number, cur: Currency, rates: Rates) => amount / rates[cur]

export function formatMoney(amount: number, cur: Currency, locale = "en-IN"): string {
  return new Intl.NumberFormat(cur === "INR" ? "en-IN" : locale, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(amount)
}

/** Two significant figures, so presets read 570 or 2,300 instead of 565.4. */
export function nice(x: number): number {
  if (x <= 0) return 0
  const step = 10 ** (Math.floor(Math.log10(x)) - 1)
  return Math.round(x / step) * step
}

const PRESETS_INR = [50_000, 100_000, 200_000, 300_000, 500_000]

/** Budget chips: value in INR plus the amount shown in the chosen currency. */
export function budgetPresets(cur: Currency, rates: Rates): { inr: number; shown: number }[] {
  return PRESETS_INR.map((inr) => {
    const shown = cur === "INR" ? inr : nice(fromInr(inr, cur, rates))
    return { inr: cur === "INR" ? inr : Math.round(toInr(shown, cur, rates)), shown }
  })
}
