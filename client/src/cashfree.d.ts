declare module "@cashfreepayments/cashfree-js" {
  type CheckoutResult = { error?: { message?: string }; redirect?: boolean; paymentDetails?: unknown }
  type Cashfree = { checkout(o: { paymentSessionId: string; redirectTarget?: "_self" | "_blank" | "_modal" }): Promise<CheckoutResult> }
  export function load(o: { mode: "sandbox" | "production" }): Promise<Cashfree>
}
