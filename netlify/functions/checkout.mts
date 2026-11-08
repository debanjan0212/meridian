import { randomBytes } from "node:crypto"
import { db, handle, json, paymentsMode, rateLimited, readBody, requireUser } from "../../shared/server"
import { createOrder } from "../../shared/travel"
import { planById, priceFor } from "../../shared/pricing"

export default handle(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const gate = await requireUser(req)
  if (gate instanceof Response) return gate
  if (paymentsMode() === "off") return json({ error: "Payments are off during the free beta." }, 400)
  if (rateLimited(`checkout:${gate.user.id}`, 5)) return json({ error: "Give it a minute." }, 429)

  const b = await readBody<{ plan?: string; phone?: string }>(req)
  const plan = planById(b?.plan || "")
  if (!plan) return json({ error: "Pick a plan." }, 400)
  const phone = String(b?.phone || "").replace(/\D/g, "").slice(-10)
  if (!/^[6-9]\d{9}$/.test(phone)) return json({ error: "Enter a 10-digit Indian mobile number." }, 400)

  // The amount always comes from the server's price list, never from the browser.
  const amount = priceFor(plan)
  const orderId = `mrd_${randomBytes(10).toString("hex")}`
  const { error } = await db().from("orders").insert({ order_id: orderId, user_id: gate.user.id, plan: plan.id, amount })
  if (error) throw new Error(`orders: ${error.message}`)

  const order = await createOrder({
    orderId,
    amount,
    customerId: gate.user.id.replace(/-/g, ""),
    phone,
    email: gate.user.email,
    returnUrl: `${new URL(req.url).origin}/pricing?order=${orderId}`,
    plan: plan.id,
  })
  if (!order.payment_session_id) throw new Error("Cashfree did not return a payment session.")
  return json({ orderId, sessionId: order.payment_session_id, mode: paymentsMode() === "live" ? "production" : "sandbox" })
})
