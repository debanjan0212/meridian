import { db, handle, json, passUntil, readBody, requireUser } from "../../shared/server"
import { getOrder } from "../../shared/travel"
import { extendPass, planById } from "../../shared/pricing"

/** Ask Cashfree whether an order is paid, then grant the pass once. Never trusts the browser. */
export default handle(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const gate = await requireUser(req)
  if (gate instanceof Response) return gate

  const b = await readBody<{ orderId?: string }>(req)
  const orderId = String(b?.orderId || "")
  if (!/^mrd_[a-f0-9]{20}$/.test(orderId)) return json({ error: "Bad order id." }, 400)

  const { data: row, error } = await db().from("orders").select("plan, amount").eq("order_id", orderId).eq("user_id", gate.user.id).maybeSingle()
  if (error) throw new Error(`orders: ${error.message}`)
  if (!row) return json({ error: "Order not found." }, 404)

  const order = await getOrder(orderId)
  const paid = order.order_status === "PAID" && Number(order.order_amount) === Number(row.amount)
  await db().from("orders").update({ status: order.order_status }).eq("order_id", orderId)
  if (!paid) return json({ status: order.order_status, passUntil: null })

  const existing = await db().from("passes").select("valid_until").eq("order_id", orderId).maybeSingle()
  if (existing.data) return json({ status: "PAID", passUntil: existing.data.valid_until })

  const plan = planById(row.plan)
  if (!plan) throw new Error(`Unknown plan on order ${orderId}`)
  const validUntil = extendPass(await passUntil(gate.user.id), plan).toISOString()
  const insert = await db().from("passes").insert({ order_id: orderId, user_id: gate.user.id, plan: plan.id, valid_until: validUntil })
  // 23505 = a parallel verify already granted this order's pass; read theirs.
  if (insert.error && insert.error.code !== "23505") throw new Error(`passes: ${insert.error.message}`)
  const granted = insert.error ? (await db().from("passes").select("valid_until").eq("order_id", orderId).single()).data?.valid_until : validUntil
  return json({ status: "PAID", passUntil: granted })
})
