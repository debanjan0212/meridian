import { useState, type FormEvent } from "react"
import { api, ApiError } from "@/lib/api"
import { Icon } from "./Icon"

type Msg = { role: "user" | "assistant"; content: string }
const STARTERS = ["Is this route too rushed?", "What should I pack for this weather?", "How do I get from the airport to the city?"]

export function Concierge({ context }: { context: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: "Hi, I know your route. Ask me anything about it." }])
  const [busy, setBusy] = useState(false)

  const ask = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    const next = [...messages, { role: "user" as const, content: q }]
    setMessages(next)
    setBusy(true)
    try {
      const { reply } = await api<{ reply: string }>("chat", { messages: next.slice(1), context })
      setMessages([...next, { role: "assistant", content: reply }])
    } catch (err) {
      setMessages([...next, { role: "assistant", content: err instanceof ApiError ? err.message : "I could not answer that just now." }])
    } finally {
      setBusy(false)
    }
  }
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement
    ask(input.value)
    input.value = ""
  }

  if (!open) {
    return (
      <div className="chat" style={{ width: "auto" }}>
        <button className="btn primary" style={{ boxShadow: "0 20px 40px rgba(0,0,0,.5)" }} onClick={() => setOpen(true)}><Icon name="chat" /> Ask the concierge</button>
      </div>
    )
  }
  return (
    <div className="chat card chat-box" role="dialog" aria-label="Concierge" style={{ boxShadow: "0 30px 60px rgba(0,0,0,.6)" }}>
      <div className="row" style={{ justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
        <b>Concierge</b>
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close concierge"><Icon name="x" size={14} /></button>
      </div>
      <div className="chat-log" aria-live="polite">
        {messages.map((m, i) => <div key={i} className={`bubble ${m.role === "user" ? "me" : "ai"}`}>{m.content}</div>)}
        {busy && <div className="bubble ai dim">Thinking…</div>}
        {messages.length === 1 && STARTERS.map((s) => <button key={s} className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => ask(s)}>{s}</button>)}
      </div>
      <form onSubmit={submit} className="row" style={{ padding: 10, borderTop: "1px solid var(--line)", flexWrap: "nowrap" }}>
        <input name="q" className="input" placeholder="Ask about your trip" aria-label="Your question" autoComplete="off" />
        <button className="btn primary small" disabled={busy}>Send</button>
      </form>
    </div>
  )
}
