# Security Review and Recommendations

This document reviews the repository against the requested security areas and provides concrete recommendations.

Sections:
- User authentication
- File validation and sanitization
- Secure data storage practices
- HTTPS / server-side protections

---

## 1) User authentication

Current implementation (found in server.js and client JS):
- Registration and login endpoints exist:
  - POST /registerVolunteer hashes passwords with bcrypt (saltRounds=10) and stores password_hash in volunteers table.
  - POST /login verifies bcrypt hash.
- Admin login is a special case that compares credentials against config.app.admin values (config.js). Defaults are in .env and config.js.
- No server-side sessions or tokens are issued. On successful login, server responds with user object; the client stores it in sessionStorage or localStorage (docs/auth.js, docs/login.js) and uses that for subsequent actions.
- Authorization checks for admin endpoints rely on the caller providing adminEmail in the request body matching the configured admin email (e.g., /setUnavailableDate, /createDonationPackage, /events, etc.). There is no proof of identity or session binding.

Strengths:
- Passwords are hashed using bcrypt with per-password salt.
- Minimal error leakage (generic "Invalid email or password").

Gaps / Risks:
- No server-side session management (cookies) or token-based auth (JWT). Any client can call protected endpoints by passing adminEmail, which is trivial to spoof.
- No CSRF protection (since there are no cookies/tokens, but if sessions are added later it will be needed).
- No rate limiting or brute-force protection for /login.
- Admin credentials are configured in plaintext via environment/defaults; default password (password123) is insecure.
- No account lockout/2FA/password policy beyond length >= 6.
- CORS is enabled globally without restrictions (app.use(cors());) enabling browsers to make authenticated cross-origin calls if credentials are later added.

Recommendations:
- Implement server-side authentication with secure, httpOnly, SameSite cookies containing a signed session ID or JWT access+refresh tokens.
  - Use express-session with a secure store (e.g., Redis) or JWT with short-lived access tokens and rotating refresh tokens.
  - Set cookie flags: httpOnly, secure, SameSite=strict or lax; set domain/path appropriately.
- Replace adminEmail body checks with real authorization:
  - Maintain a users table column is_admin (or roles) and issue sessions/tokens embedding userId and roles.
  - Check req.user.role on protected routes via middleware.
- Add login protections:
  - Rate limit IP and user per endpoint (express-rate-limit), add incremental backoff.
  - Optional: CAPTCHA after several failures.
- Improve password policy: minimum length >= 12, complexity, and have server-side validation.
- Implement logout endpoint (server invalidates session/refresh token).
- Consider email verification and password reset flows (time-limited, signed tokens).

---

## 2) File validation and sanitization

Current implementation:
- There is no server-side file upload endpoint. Profile pictures are read client-side and stored as data URLs in localStorage (docs/register.js, docs/auth.js). The server does not accept arbitrary file uploads.
- Client-side validation checks profile picture MIME type (JPG/PNG) and size <= 1MB before previewing.
- SQL access uses parameterized queries everywhere (mysql2 placeholders), mitigating SQL injection.
- Client renders a lot of HTML via innerHTML from dynamic data (docs/*.js). Donation packages, events, and other content may originate from the database and could contain untrusted strings.

Strengths:
- Queries are parameterized, reducing SQL injection risk.
- No server-side upload surface currently.

Gaps / Risks:
- Stored XSS potential: Many places inject unescaped data into innerHTML (e.g., docs/donations.js, docs/events.js, docs/profile.js). If any stored text fields (name, description, impact_description, event.title/description/location) contain HTML/JS, they will be executed in clients.
- No systematic output encoding on the client, and no server-side output encoding or input sanitization for text fields.
- If a future file upload is implemented, there is no server-side validation pipeline yet.

Recommendations:
- Implement a small escaping utility and use textContent or attribute setters instead of innerHTML whenever possible. When HTML is needed, sanitize using a library (DOMPurify on client) or perform server-side sanitization/encoding.
- Validate and sanitize all user-provided text fields on the server (e.g., using a allowlist + length limits + express-validator). Reject strings containing disallowed HTML or control characters.
- Add Content Security Policy (see HTTPS section) to mitigate XSS impact.
- If adding file uploads in the future, use multer/busboy with:
  - MIME type and extension allowlists; magic number checks.
  - Size limits, upload to a non-executable storage path or object storage (S3/GCS) with private ACL and signed URL access.
  - Filename normalization, store outside webroot.

---

## 3) Secure data storage practices

Current implementation:
- Database credentials are loaded from environment variables via config.js, with SSL options for MySQL connection (rejectUnauthorized: false).
- Passwords are stored as bcrypt hashes.
- Donations store minimal payment details (cardLast4, expiry), not PAN/CVV. Good scope reduction.
- .env is committed in this repository with real-looking credentials and admin defaults.

Strengths:
- Use of bcrypt for password hashing.
- Avoids storing sensitive payment data.

Gaps / Risks:
- Sensitive secrets committed in .env file. This is a critical secret management issue.
- MySQL SSL uses rejectUnauthorized: false, which makes TLS susceptible to MITM if the transport is intercepted or if a malicious server is used. This is often necessary for some providers but should be tightened if possible by trusting the provider CA or using server certificate pinning.
- No encryption at rest at application layer (usually fine if the DB/storage provider encrypts at rest, but not documented).
- No PII data classification policy, data retention, or purging strategy.
- Admin credentials configured via environment with weak defaults.

Recommendations:
- Remove .env from source control. Rotate any exposed credentials immediately. Ensure .gitignore excludes .env and set secrets via deployment platform env vars.
- Strengthen DB TLS verification if provider supports it: set rejectUnauthorized: true and provide CA certificate bundle, or use the provider’s connection string with SSL mode configured.
- Establish a data retention policy for donations and logs. Purge or anonymize older records if not needed.
- Audit and minimize PII. Consider encrypting highly sensitive PII at the application level if present later (e.g., phone numbers) using libsodium/crypto.
- Use least-privilege DB user: create a dedicated DB account with only necessary permissions for this app.

---

## 4) HTTPS / server-side protections

Current implementation:
- Express is used without hardening middleware. CORS is fully open (app.use(cors())).
- Static assets served from docs/; default route sends volunteer.html.
- No HTTPS termination in this Node process. Deployment guides target Vercel/Railway, which provide HTTPS at the edge.
- No security headers like HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- Body size limit is increased to 10MB for JSON.
- Error handling returns JSON; some logs echo details to console.

Strengths:
- Likely benefits from managed HTTPS when deployed behind Vercel/Railway.

Gaps / Risks:
- No explicit enforcement of HTTPS (e.g., redirect from HTTP to HTTPS) when behind a proxy.
- No Helmet middleware to set baseline security headers.
- Open CORS with default settings can enable broader attack surface if credentials-based auth is added later.
- No centralized input validation; server trusts many request bodies beyond minimal checks.
- No global error handler or structured logging for security events; verbose DB keepalive logs in production may leak info.

Recommendations:
- Add Helmet and configure headers:
  - HSTS (strict-transport-security) with preload (when fully HTTPS): max-age=31536000; includeSubDomains; preload.
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY or Content-Security-Policy frame-ancestors 'none'
  - Referrer-Policy: no-referrer or strict-origin-when-cross-origin
  - Permissions-Policy: restrict powerful APIs
  - Content-Security-Policy: start with a strict policy (e.g., default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline' as needed; connect-src 'self') and iterate.
- Restrict CORS to known origins. Example: cors({ origin: ["https://your-domain"], credentials: true }) once cookies/sessions are used.
- Enforce HTTPS redirects when behind a proxy: app.enable('trust proxy'); and middleware to redirect if req.secure is false.
- Implement centralized input validation using express-validator or zod with schema per endpoint.
- Add a global error handler and sanitize error responses.
- Add request logging and audit logging for sensitive actions; ensure logs don’t contain secrets.
- Implement rate limiting and possibly request size limits per route instead of global 10MB, to reduce DoS surface.

---

## Priority remediation plan (actionable)

1) Secrets and config
- Remove .env from repo, rotate DB password and any tokens. Configure secrets via platform env vars. Enforce strong ADMIN_PASSWORD.

2) Authentication and authorization
- Introduce session-based auth (express-session + Redis) or JWT. Add auth middleware to set req.user and protect routes. Replace adminEmail checks with proper role checks. Add rate limiting for /login and sensitive routes.

3) XSS mitigation
- Replace innerHTML with textContent or sanitized HTML (DOMPurify) across docs/*.js where dynamic content is rendered. Escape all server-provided strings.
- Add Helmet with CSP and other headers.

4) Validation
- Add server-side validation for all endpoints using a schema library, with length and type constraints. Sanitize inputs.

5) Transport security
- Enforce HTTPS redirect and HSTS in production. Tighten DB TLS verification if feasible.

6) Observability and ops
- Add centralized error handler, structured logging, and audit logs for admin actions. Add minimal health endpoint without leaking details.

---

## Notes on what is already acceptable
- Password hashing (bcrypt) is implemented correctly.
- Payment handling avoids storing sensitive data (only last4 and expiry); no PAN/CVV processed.
- SQL is parameterized consistently, mitigating SQL injection.

With the above enhancements, the application will align with common best practices for authentication, input handling, data security, and transport protections.
