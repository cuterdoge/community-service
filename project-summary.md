# Project Summary

This document summarizes the current architecture and main implementation choices for the project at a medium level of detail (without enumerating every endpoint).

Sections:
- Overview
- Server-side architecture
- Data model (inferred)
- Client-side architecture
- Configuration and deployment
- Known limitations and design trade-offs

---

## Overview

- Stack: Node.js + Express server, MySQL database (mysql2), static frontend served from `docs/`.
- Purpose: Support volunteer registration/login/profile, donations/packages/checkout flow, events listing and administration, and general site content.
- Security posture (high level): Passwords hashed via bcrypt. No server-issued sessions or tokens; client keeps auth state in web storage. Admin access checks rely on email matching in requests. CORS is open; security headers not yet hardened. See `answer-security.md` for deeper analysis and recommendations.

High-level data flow:
- Browser loads static pages and JS from `docs/`.
- Client JS calls Express JSON APIs for auth, volunteers, donations, and events.
- Server queries MySQL using parameterized statements and returns JSON.

---

## Server-side architecture

- Entry point: `server.js`
- Configuration: `config.js` aggregates environment variables (DB credentials, app/admin defaults). `.env` exists in repo (should be moved to env vars at deploy time).
- Core middleware:
  - CORS enabled globally.
  - JSON body parsing with increased size limit (e.g., 10MB).
  - Static file serving from `docs/` for public assets and pages.
- Routing (grouped, non-exhaustive):
  - Auth: registration and login endpoints; bcrypt used for password hashing and verification.
  - Volunteers: create/read/update volunteer profiles; profile image is handled client-side (data URLs), not uploaded to server.
  - Donations: donation packages CRUD (admin) and donation submissions; stores non-sensitive card metadata (e.g., last4/expiry), avoids PAN/CVV.
  - Events: CRUD endpoints for events and availability/unavailable dates (admin operations identified via admin email in requests).
- Auth model:
  - Users authenticate via email + password (volunteers table with `password_hash`).
  - Successful login returns a user object; client stores it in `sessionStorage`/`localStorage`.
  - No server-managed sessions, cookies, or JWT; authorization on admin routes is based on matching a configured admin email provided by the client.
- Error handling and logging:
  - Errors are generally returned as JSON with generic messages; server logs operational details to console. No global error boundary/structured logging yet.

---

## Data model (inferred)

Note: exact schemas are inferred from usage in code and may differ from the actual database definition.
- volunteers
  - id, name, email (unique), phone, password_hash, and profile-related fields used by the UI
- donation_packages
  - id, name/title, description, amount, image, active/availability flags
- donations
  - id, user/volunteer id (nullable), package id, donor info (name/email), amount, and card metadata (e.g., last4, expiry); no PAN/CVV stored
- events
  - id, title, description, date/time, location, capacity/status and optional unavailable dates administered by an "admin" role

---

## Client-side architecture

- Public assets and pages in `docs/` with JS modules per feature:
  - Auth and profile flows: `auth.js`, `login.js`, `register.js`, `profile.js`
  - Site and shared UI: `app.js`, `header.js`
  - Donations: `donations.js`, `donation-checkout.js`, `poster-download.js`
  - Events: `events.js`
- State & navigation:
  - Auth state stored in `sessionStorage`/`localStorage` and read by multiple pages.
  - Navigation handled via standard links and dynamic DOM updates.
- Rendering:
  - Data is fetched from the server and rendered into the DOM. Many views update via `innerHTML` with interpolated strings; some user-facing text comes from server-side data.
- Network:
  - Fetch API used for JSON endpoints on the same origin as the server.

---

## Configuration and deployment

- Environment/config:
  - `.env` provides DB and admin defaults; `config.js` reads and normalizes configuration for the app.
  - Sensitive values should be provided by the deployment platform and not committed to source control.
- Deployment targets:
  - Guides and scripts suggest deploying to Vercel and/or Railway.
  - HTTPS is typically terminated by the platform; Express does not perform TLS termination itself.

---

## Known limitations and design trade-offs

- Authentication and authorization:
  - No server-side session/token; client-side storage is the source of "logged-in" state.
  - Admin authorization is based on a client-supplied email matching configured admin email, which is easy to spoof.
- Browser security and XSS:
  - Multiple views use `innerHTML` with unescaped data, creating a risk of stored/reflective XSS if untrusted content reaches the UI.
  - No CSP/Helmet headers are set; CORS is wide open.
- Secrets and transport:
  - `.env` is present in the repo; DB TLS is configured with relaxed verification in some environments.
- Validation:
  - Server-side input validation is minimal and varies by route; no centralized schema validation.

These constraints keep the system simple but pose security and robustness risks. See `answer-security.md` for prioritized hardening steps (sessions/roles, CSP/Helmet, validation, and secret management).
