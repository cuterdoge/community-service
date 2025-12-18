# Security Implementation Report

## 1. User Authentication
To ensure that only authorized users can access the application and their personal data, I implemented a robust, session-based authentication system. Instead of relying on vulnerable client-side storage, I utilized the **express-session** middleware to manage user sessions securely on the server. In our production environment, these sessions are backed by a MySQL database using **express-mysql-session**, ensuring that user login states are persistent and scalable.

For credential security, I strictly avoided storing plaintext passwords. I integrated **bcrypt** to hash all user passwords with a salt round of 10 before they are ever saved to the database. When a user logs in, the system securely compares the hashed version of the entered password against the stored hash. Additionally, I enforced strict cookie security policies—setting `httpOnly` to true to prevent Cross-Site Scripting (XSS) attacks from stealing session IDs, and configuring `SameSite` attributes to mitigate Cross-Site Request Forgery (CSRF) risks.

## 2. File Validation and Sanitization
I prioritized the integrity of the application by implementing comprehensive validation and sanitization layers. To protect against **SQL Injection**—one of the most common web vulnerabilities—I used parameterized queries for all database interactions via the `mysql2` library. This ensures that any user input is treated strictly as data, not as executable code.

For **Cross-Site Scripting (XSS)** prevention, I integrated **DOMPurify** on the client side to sanitize all dynamic content before it is rendered, stripping out any malicious scripts. Furthermore, I adopted **express-validator** to enforce strict data types and formats for all incoming requests, immediately rejecting any inputs that do not meet our criteria (such as valid email formats or date structures). To handle "file uploads" securely, the system accepts image data as Base64 strings within JSON payloads, protected by a strict 10MB payload limit to prevent Denial-of-Service (DoS) attacks via memory exhaustion.

## 3. Secure Data Storage Practices
Data security is managed through a combination of strict infrastructure controls and database best practices. Our MySQL database is hosted on Railway, shielded by platform-level access controls and not directly exposed to the public internet without authentication.

I implemented a role-based access control system within the database schema itself, distinguishing between regular volunteers and administrators using an `is_admin` flag. This ensures that privilege escalation is prevented at the data level. Crucially, all connections between our application server and the database are encrypted using **TLS/SSL**, preventing any potential attacker from intercepting sensitive user data or credentials while they are in transit across the network.

## 4. Server-Side Protections and HTTPS
To guarantee the confidentiality and integrity of data in transit, the entire application is served over **HTTPS**. This is enforced by our deployment platform which handles TLS termination, ensuring all client-server communication is encrypted. On the server side, I hardened the application security by implementing **HTTP Strict Transport Security (HSTS)** via the `Helmet` middleware. This forces browsers to only ever connect to our site using secure HTTPS, effectively mitigating protocol downgrade attacks.

To further protect the server availability and prevent abuse, I deployed a rate-limiting strategy using **express-rate-limit**. We enforce a global limit on all traffic and a specifically stricter limit on the login endpoint (20 attempts/minute) to defend against brute-force password guessing attacks. Finally, a centralized error-handling mechanism was built to ensure that while users receive helpful feedback for validation errors, no sensitive system details or stack traces are ever leaked during unexpected server failures.
