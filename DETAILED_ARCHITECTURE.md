# System Architecture: Technical Data Flow & Logic

This report provides a detailed technical breakdown of the "Joy Home Connect" system architecture, as illustrated in the provided diagrams.

## 1. Request Flow & Middleware Pipeline
Every incoming request follows a strict sequential pipeline within the Node.js/Express environment to ensure security, integrity, and performance.

### A. SSL Termination & Proxy Trust
- **SSL Termination**: Render's load balancer terminates the HTTPS connection. The internal traffic to the Node.js app is HTTP, but the `sid` cookie is still handled securely.
- **Trust Proxy**: The application is configured with `app.set('trust proxy', 1)`, which is critical for the `express-rate-limit` and `express-session` modules to identify the real user IP behind the proxy layers.

### B. Security Headers (Helmet & CSP)
- **Content Security Policy (CSP)**: Restricts resource loading to trusted domains (e.g., Bootstrap/FontAwesome CDNs).
- **Security Headers**: Automatically adds headers like `X-Content-Type-Options: nosniff` and `X-Frame-Options: SAMEORIGIN` to prevent clickjacking and MIME-type sniffing.

### C. Resource Policing (CORS & Rate Limiting)
- **CORS**: Enforces origin checks. Only the official Render production URL (and local dev environments) can execute credentialed requests.
- **Multi-Layered Rate Limiting**:
    - **Global**: Pre-emptively blocks volumetric attacks (1000 req/15min).
    - **Login-Specific**: Specifically targets brute-force on the `/api/auth/login` endpoint (20 attempts/min).

### D. Session & Presence Logic
- **Session Manager**: Interrogates the `sid` cookie. Unlike local memory storage, it queries the **MySQL Session Store** table to hydrate the `req.session` object, making the server stateless and horizontally scalable.

## 2. Server Logic & API Routing
Once a request passes the middleware gauntlet, it reaches the core logic.

- **Static Content Handler**: Serves pre-compiled HTML, CSS, and Client-Side JS from the `/docs` directory.
- **Request Router**: Directs traffic to specific controllers (Volunteers, Donations, Events). It uses the `withValidation` middleware to enforce schema checks on all incoming JSON payloads before they hit the database logic.

## 3. Database Layer: The Data Persistence Split
The Railway MySQL instance is strategically split into two logical domains:

- **Session Records**: A high-churn table used by `express-mysql-session`. It stores the serialized user state, allowing for persistent logins even during server restarts.
- **Application Entities**: Normalized tables containing the "Source of Truth" for the charity (Users, Event Logs, Donation Packages, and Schedule Slots). All interactions here use **Parameterized Queries** to prevent SQL Injection.

## 4. Configuration Feed (.env)
The entire system is governed by a centralized environment configuration. This injects secrets (DB passwords, Session Secrets) and toggles features (HSTS, Debug Logging) across both the Render and Railway clouds without modifying source code.
