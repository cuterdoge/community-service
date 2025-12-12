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
- Initial CSP (permissive to match current frontend):
  - default-src 'self'
  - script-src 'self' 'unsafe-inline'
  - style-src 'self' 'unsafe-inline'
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

Phase 5: Input validation (express-validator)
- Add validators per route:
  - Auth: email isEmail, password min length (>= 12 or chosen policy), trim
  - Donations/events: title/description length caps, numeric checks (amount, ids), strict allowlist
- Centralize validation error handling to return consistent 400 responses

Phase 6: Client-side XSS mitigation
- Immediate protection:
  - Use textContent for plain text insertions
  - When HTML is required, sanitize with DOMPurify before assigning to innerHTML
- Longer term:
  - Refactor to favor DOM APIs over innerHTML where feasible

Phase 7: Rate limiting
- Global limiter: e.g., 100 requests/min per IP
- Login limiter: e.g., 5 attempts/min per IP
- Optionally add modest limits to admin routes

Phase 8: HTTPS enforcement
- Rely on Render/Railway for TLS termination
- app.enable('trust proxy') so secure cookies are set correctly behind proxy
- Add HSTS via Helmet only after confirming HTTPS-only traffic in prod

Phase 9: Database TLS hardening
- Current: keep existing SSL config due to lack of CA bundle
- Future: attempt ssl.rejectUnauthorized = true with provider CA when available
- If Railway supports a secure connection string with SSL mode, prefer that verbatim

Phase 10: Secrets handling (deferred)
- Continue using .env for now (risk acknowledged)
- Ensure ADMIN_PASSWORD is strong (non-default)
- Later: remove .env from repo, rotate DB/admin credentials, and rely on platform env vars

Configuration checklist (env vars)
- ADMIN_EMAIL
- ADMIN_PASSWORD (plaintext per decision)
- SESSION_SECRET (strong, random)
- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (Railway MySQL)
- NODE_ENV=production (in prod)
- ENABLE_HSTS (set to true in production only after verifying HTTPS-only traffic)

Rollout plan
- Implement Phase 1–2 in a branch, along with minimal unit/integration tests for login/logout and auth gating
- Add Helmet + initial CSP and CORS restrictions (Phases 3–4)
- Add express-validator and rate limiting (Phases 5 & 7)
- Introduce DOMPurify to critical client rendering points (Phase 6)
- Verify secure cookies behind proxy in staging; then enable HSTS
- Plan DB TLS tightening when CA is available

Notes
- We will avoid breaking the current client flows by initially keeping CSP permissive ('unsafe-inline') and tightening after refactors.
- CORS will be restricted to 'self' and the production domain. Local dev origins will be allowed in development only.
