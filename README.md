# Meridian

An AI trip planner: explore by season and hidden gems, pick your places, get flights, stays and transport priced, rearrange the route any way you like, check visa rules, then book on each provider's own site.

Web and mobile web, installable as an app (Add to Home Screen). Same Netlify setup as the portfolio: Vite + React, Netlify Functions under `/api/*`.

## How it fits together

| Part | Where | Uses |
|---|---|---|
| Screens | `client/src` | React, React Router |
| Login and saved trips | Supabase | Google, email link, password (admin) |
| Place ideas, transport between cities, concierge | `netlify/functions/places`, `legs`, `chat` | Gemini free tier (`shared/llm.ts`, same as the portfolio) |
| Flights and booking links | `netlify/functions/flights`, `booklink` | Ignav |
| Hotels | `netlify/functions/hotels` | liteAPI (Nuitee) |
| Photos | `netlify/functions/photo` | Your files in `client/public/images`, else Unsplash with credit |
| Passes and payments | `netlify/functions/checkout`, `verify` | Cashfree |
| Health checks | `/admin` → `netlify/functions/health` | Admins only |

Rules the code enforces:
- Every API call that costs money needs a signed-in user, is rate limited, and is cached in Netlify Blobs.
- When `PAYMENTS_MODE` is not `off`, plan-building calls need an active pass or an admin email (`ADMIN_EMAILS`).
- The price always comes from `shared/pricing.ts` on the server. A pass is granted only after the server asks Cashfree that the order is `PAID` and the amount matches.
- Visa rules come only from `shared/visa.ts`, which is checked by hand. Countries not listed there show "not checked yet", never an AI guess or an unchecked link.

## Set up (once)

1. **Supabase:** SQL Editor → paste `supabase/schema.sql` → Run.
2. **Supabase → Authentication → Users → Add user:** your admin email and password, with auto-confirm on.
3. **Netlify → Add new project → Import from GitHub → meridian.** Build settings come from `netlify.toml`.
4. **Netlify → Project configuration → Environment variables:** add everything in `.env.example`. Start with `PAYMENTS_MODE=off`.
5. **Supabase → Authentication → URL Configuration:**
   - **Site URL:** `https://<your-site>.netlify.app`
   - **Redirect URLs:** `https://<your-site>.netlify.app/**` and `https://*--<your-site>.netlify.app/**`. The second one covers PR previews.
6. Open `/admin` on the site, sign in with the admin password, and press **Run checks**. Every service should say OK.

## Payments mode

| `PAYMENTS_MODE` | What happens |
|---|---|
| `off` | Free beta. Everyone can plan; the pricing page says so. |
| `sandbox` | Pricing page takes Cashfree **test** payments. Admins skip payment but can still test checkout. |
| `live` | Real money through Cashfree production keys. Only after the go-live checklist below. |

## Local development

```bash
npm install
cp .env.example .env   # fill in values
npx netlify dev        # runs the site and the functions together
npm run check && npm test && npm run build
```

## Not built yet
- MCP server for Claude, ChatGPT and Gemini.
- Phone OTP login: SMS costs money and needs DLT registration in India.
- Offline mode (service worker) and push notifications.
- Payment webhook (verify-on-return covers the normal flow).
- Native iOS and Android apps.

## Before payments go live
- Full Terms, Privacy and Refund pages (the current `/legal` is a beta draft).
- Rate limits moved from per-instance memory to shared storage.
- A Content-Security-Policy header.
- An OWASP ZAP scan on a staging site.
- Playwright end-to-end tests run in CI.
- Cashfree KYC and production keys.
