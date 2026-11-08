import { cached, handle } from "../../shared/server"
import { AED_PER_USD, CURRENCIES, FALLBACK_RATES, type Rates } from "../../shared/currency"

/** Live ECB reference rates against INR, cached for 12 hours. Public: no prices or user data in it. */
export default handle(async () => {
  const data = await cached("rates:inr", 12 * 3_600_000, async () => {
    try {
      const symbols = CURRENCIES.filter((c) => c !== "INR" && c !== "AED").join(",")
      const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=INR&symbols=${symbols}`, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new Error(`rates ${res.status}`)
      const body = (await res.json()) as { date: string; rates: Partial<Rates> }
      const rates = { ...FALLBACK_RATES, ...body.rates, INR: 1 } as Rates
      rates.AED = rates.USD * AED_PER_USD
      return { date: body.date, live: true, rates }
    } catch (err) {
      console.error("rates", err instanceof Error ? err.message : err)
      return { date: null, live: false, rates: FALLBACK_RATES }
    }
  })
  return new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } })
})
