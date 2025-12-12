# Security Implementation Plan

This document captures our agreed security plan and choices, to guide upcoming implementation work. We will proceed in phases and keep changes small and reviewable. Coding has not started yet.

Decisions and environment
- Auth model: express-session
- Admin handling: both built-in admin (env-based, plaintext password) and DB-backed admins (is_admin flag)
- Platforms: Render (app) and Railway (MySQL). No Redis available.
- Production domain (for CORS): https://community-service-ahp0.onrender.com/
- Allow origin: self and the production domain above
- DB TLS CA: none available at this time; we’ll keep current behavior and revisit tightening
- Database reset: You will nuke the current Railway MySQL. The server boots with auto table creation (no migration step).

Phased plan

Phase 1: Authentication with express-session
- Session store:
  - Dev: MemoryStore (ok for local only)
  - Prod: express-mysql-session using the Railway MySQL instance
- Cookie configuration:
  - name: sid
  - httpOnly: true
  - sameSite: lax (can tighten later)
  - secure: true in production (requires app.enable('trust proxy'))
  - maxAge: ~7 days
- Login flow:
  - On success: req.session.regenerate(), then set req.session.user = { id, email, is_admin }
  - Logout: req.session.destroy() and clear cookie
- Built-in admin support:
  - If email === ADMIN_EMAIL (from env/config) and password === ADMIN_PASSWORD (plaintext), log in as is_admin = true with stable identifier (e.g., id: 'builtin-admin')
- DB-backed admin:
  - volunteers table will include is_admin TINYINT(1) DEFAULT 0

Phase 2: Authorization
- DB initialization: We will recreate the database from scratch (you will nuke the existing Railway DB). server.js auto-creates required tables on startup, so no explicit migration is needed.
- Middleware:
  - requireAuth: ensures req.session.user exists
  - requireAdmin: ensures req.session.user?.is_admin === true
- Routes:
  - Replace all adminEmail body checks with requireAdmin
  - Protect admin routes (donation packages CRUD, events admin/unavailable dates, etc.)
- Session hardening:
  - Rotate session ID at login and any privilege change

Phase 3: Security headers and CSP
- Helmet: enable defaults (frameguard, noSniff, hidePoweredBy, etc.)
- HSTS: enable after HTTPS-only behavior is confirmed in prod (toggle via ENABLE_HSTS=true in environment once verified)
- Initial CSP (permissive + CDNs):
  - default-src 'self'
  - script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com
  - style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net
  - img-src 'self' data:
  - connect-src 'self'
- Plan to tighten CSP once inline usage is reduced

Phase 4: CORS
- Development:
  - origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] as needed
  - credentials: true
- Production:
  - origin: ['https://community-service-ahp0.onrender.com']
  - credentials: true
- Client: use fetch(..., { credentials: 'include' }) when authentication is required
- Implemented:
  - Dynamic allowedOrigins based on NODE_ENV (development vs production)
  - CORS middleware with credentials enabled and optionsSuccessStatus=204
  - Requests with no Origin header (same-origin or curl) are allowed
  - Client helper docs/fetch.js defaults credentials: 'include'

Phase 5: Input validation (express-validator)
- Add validators per route:
  - Auth: email isEmail, password min length (>= 12), trim
  - Register: name (1-100), email, optional phone (3-20), password >= 12
  - Profile update: email, name (1-100), phone (3-20), currentPassword required, newPassword optional >= 12
  - Booking: email, slot (3-50), optional name (<= 100)
  - Unavailable dates: date must be ISO8601 (YYYY-MM-DD)
  - Donations: structured donationData/donorInfo/paymentInfo with numeric and format checks
  - Donation packages: package_id kebab-case, name (1-100), description (1-2000), price > 0, optional fields capped
  - Events: id slug (alnum-dash), title (1-200), description (1-5000), date ISO8601, location (1-200), optional poster
- Centralize validation error handling to return consistent 400 responses
- Implemented:
  - Introduced withValidation() helper using validationResult
  - Added express-validator rules to all critical POST/PUT/DELETE routes listed above

Phase 6: Client-side XSS mitigation
- Immediate protection:
  - Added DOMPurify (v3.0.6) CDN to all client-facing HTML pages
  - Refactored `innerHTML` usage in `profile.js`, `events.js`, `donations.js`, `donation-checkout.js`, and `app.js` to use `DOMPurify.sanitize()`
- Implemented:
  - All critical `innerHTML` assignments are now sanitized.
- Longer term:
  - Refactor to favor DOM APIs over innerHTML where feasible

Phase 7: Rate limiting
- Global limiter: 1000 requests/15min per IP (Relaxed from 100/min)
- Login limiter: 20 attempts/min per IP (Relaxed from 5/min)
- Optionally add modest limits to admin routes
- Implemented:
  - Added `express-rate-limit` middleware
  - Global limiter (1000 req/15min) applied to all routes
  - Login limiter (20 req/min) applied to `/login` endpoint

Phase 8: HTTPS enforcement
- Rely on Render/Railway for TLS termination
- app.enable('trust proxy') so secure cookies are set correctly behind proxy
- Add HSTS via Helmet only after confirming HTTPS-only traffic in prod
- Implemented:
  - `trust proxy` enabled in production
  - HSTS configured via `ENABLE_HSTS` env var (default false)

Phase 9: Database TLS hardening
- Current: keep existing SSL config due to lack of CA bundle
- Future: attempt ssl.rejectUnauthorized = true with provider CA when available
- If Railway supports a secure connection string with SSL mode, prefer that verbatim
- Implemented:
  - Validated `config.js` uses `ssl: { rejectUnauthorized: false }` as intended for now.

Phase 10: Secrets handling (deferred)
- Continue using .env for now (risk acknowledged)
- Ensure ADMIN_PASSWORD is strong (non-default)
- Later: remove .env from repo, rotate DB/admin credentials, and rely on platform env vars
- Implemented:
  - Continued use of `.env` verified.

Configuration checklist (env vars)
- ADMIN_EMAIL
- ADMIN_PASSWORD (plaintext per decision)
- SESSION_SECRET (strong, random)
- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (Railway MySQL)
- NODE_ENV=production (in prod)
- ENABLE_HSTS (set to true in production only after verifying HTTPS-only traffic) [Added to .env]

Rollout plan
- Implement Phase 1–2 in a branch, along with minimal unit/integration tests for login/logout and auth gating
- Add Helmet + initial CSP and CORS restrictions (Phases 3–4)
- Add express-validator and rate limiting (Phases 5 & 7)
- [x] Introduce DOMPurify to critical client rendering points (Phase 6)
- [x] Add express-validator and rate limiting (Phases 5 & 7)
- Verify secure cookies behind proxy in staging; then enable HSTS
- Plan DB TLS tightening when CA is available

Dependencies added
- express-validator ^7.0.1 (Phase 5)
- express-rate-limit ^7.x (Phase 7)

Notes
- We will avoid breaking the current client flows by initially keeping CSP permissive ('unsafe-inline') and tightening after refactors.
- CORS will be restricted to 'self' and the production domain. Local dev origins will be allowed in development only.
