import { Link, NavLink } from "react-router-dom"
import { useAuth } from "@/lib/auth"

export function Header() {
  const { session, me, signOut } = useAuth()
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "")
  return (
    <header className="topbar">
      <div className="wrap">
        <Link to="/" className="brand">Meridian</Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/explore" className={link}>Explore</NavLink>
          <NavLink to="/plan" className={link}>Plan a trip</NavLink>
          <NavLink to="/pricing" className={link}>Pricing</NavLink>
          {session && <NavLink to="/trips" className={link}>My trips</NavLink>}
          {me?.admin && <NavLink to="/admin" className={link}>Admin</NavLink>}
        </nav>
        {session ? (
          <button className="btn small" onClick={signOut}>Sign out</button>
        ) : (
          <Link to="/signin" className="btn small gold">Sign in</Link>
        )}
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #1f262b", marginTop: 80 }}>
      <div className="wrap row" style={{ justifyContent: "space-between", padding: "32px 24px", fontSize: 13 }}>
        <span className="dim">Meridian beta · prices are estimates until you book with the provider.</span>
        <span className="row" style={{ gap: 16 }}>
          <Link to="/pricing">Pricing</Link>
          <Link to="/legal">Terms &amp; privacy</Link>
        </span>
      </div>
    </footer>
  )
}
