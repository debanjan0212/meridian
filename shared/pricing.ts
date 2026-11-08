/**
 * One-time passes, no auto-renew. The server reads amounts from here, never from the browser.
 * The struck-out price is the real regular price that applies after the launch offer ends.
 */
export type PlanId = "week" | "month" | "year"

export type Plan = { id: PlanId; name: string; days: number; regular: number; launch: number; note: string }

export const LAUNCH_ENDS = new Date("2027-03-31T23:59:59+05:30")

export const PLANS: Plan[] = [
  { id: "week", name: "Week Pass", days: 7, regular: 99, launch: 79, note: "One trip, planned and priced" },
  { id: "month", name: "Month", days: 30, regular: 249, launch: 199, note: "For a season of weekend trips" },
  { id: "year", name: "Year", days: 365, regular: 1499, launch: 1199, note: "Every trip for a year" },
]

export function planById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id)
}

/** Price in rupees, inclusive of all taxes. */
export function priceFor(plan: Plan, now = new Date()): number {
  return now <= LAUNCH_ENDS ? plan.launch : plan.regular
}

/** What the same time costs as smaller passes at today's prices, for an honest "save X%". */
export function comparison(plan: Plan, now = new Date()): { label: string; amount: number } | null {
  if (plan.id === "month") return { label: "4 week passes", amount: 4 * priceFor(PLANS[0], now) }
  if (plan.id === "year") return { label: "12 months", amount: 12 * priceFor(PLANS[1], now) }
  return null
}

/** A new pass starts when the current one ends, so buying early never loses days. */
export function extendPass(currentEnd: Date | null, plan: Plan, now = new Date()): Date {
  const start = currentEnd && currentEnd > now ? currentEnd : now
  return new Date(start.getTime() + plan.days * 86_400_000)
}
