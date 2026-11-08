export default function Legal() {
  return (
    <div className="wrap stack" style={{ padding: "48px 24px", gap: 16, maxWidth: 820 }}>
      <p className="kicker">Beta terms &amp; privacy</p>
      <h1 className="h1" style={{ fontSize: 48 }}>The short version</h1>
      {[
        ["What Meridian does", "Meridian suggests places and shows prices from partners. You book and pay on the airline, hotel or railway site. Prices are estimates until you book there."],
        ["Visas", "Visa notes are a planning summary, not legal advice. The official government portal always has the final word."],
        ["Your data", "We store your email, saved trips and payment records (never card or UPI details). We do not sell data. Ask us to delete your account and we will."],
        ["Payments and refunds", "Passes are one-time and do not auto-renew. If a pass was charged by mistake, write to us within 7 days for a refund."],
        ["Contact", "itsme.deb1995@gmail.com"],
      ].map(([h, p]) => (
        <section key={h} className="stack" style={{ gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{h}</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>{p}</p>
        </section>
      ))}
      <p className="dim" style={{ fontSize: 13 }}>Draft for the beta. Full terms, privacy and refund pages are needed before payments go live.</p>
    </div>
  )
}
