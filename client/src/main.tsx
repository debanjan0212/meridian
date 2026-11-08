import { StrictMode, lazy, Suspense, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { AuthProvider, useAuth } from "@/lib/auth"
import { PrefsProvider } from "@/lib/prefs"
import { Footer, Header } from "@/components/Header"
import Landing from "@/pages/Landing"
import "./styles.css"

// Everything past the landing page loads on demand, so the first screen is fast.
const SignIn = lazy(() => import("@/pages/SignIn"))
const Explore = lazy(() => import("@/pages/Explore"))
const Plan = lazy(() => import("@/pages/Plan"))
const Pricing = lazy(() => import("@/pages/Pricing"))
const Trip = lazy(() => import("@/pages/Trip"))
const Book = lazy(() => import("@/pages/Book"))
const Trips = lazy(() => import("@/pages/Trips"))
const Admin = lazy(() => import("@/pages/Admin"))
const Legal = lazy(() => import("@/pages/Legal"))

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return null
  return session ? <>{children}</> : <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <PrefsProvider>
      <AuthProvider>
        <Header />
        <main>
          <Suspense fallback={<div className="wrap" style={{ padding: 48 }}><div className="skeleton" style={{ height: 240 }} /></div>}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/legal" element={<Legal />} />
              <Route path="/trip" element={<RequireAuth><Trip /></RequireAuth>} />
              <Route path="/book" element={<RequireAuth><Book /></RequireAuth>} />
              <Route path="/trips" element={<RequireAuth><Trips /></RequireAuth>} />
              <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </AuthProvider>
      </PrefsProvider>
    </BrowserRouter>
  </StrictMode>,
)
