# CALLOS — Security & Privacy Plan

CALLOS processes sensitive employee and customer data (phone numbers, contacts, call recordings, transcripts). Security and privacy are first-class requirements, not add-ons.

> This document lists controls to implement. It does **not** claim legal compliance — several items (call-recording consent, data retention, GDPR/India DPDP) require review by a qualified legal professional.

---

## 1. Authentication
- JWT **access** (short-lived) + **refresh** tokens. Rotate refresh tokens; revoke on logout.
- Passwords hashed with a strong adaptive hash (bcrypt/argon2). Never store plaintext.
- Account status checks (active/suspended). Rate-limit login + lockout on repeated failures.
- Employee join flow: company code + invitation/registration + secure login. Company code is org **data**, never hardcoded in logic.
- Prefer httpOnly, Secure, SameSite cookies for web tokens over `localStorage` where the architecture allows.

## 2. Authorization (RBAC)
- Roles: `SUPER_ADMIN, ADMIN, MANAGER, TEAM_LEAD, EMPLOYEE`.
- **Enforced server-side** on every endpoint. Frontend route guards are UX only, never the security boundary.
- Managers/team-leads scoped to assigned teams; employees scoped to their own data.

## 3. Multi-tenant isolation
- Every org-owned query filtered by `organization_id` derived from the authenticated token — never from client input.
- Add automated tests that attempt cross-org access and assert `403/404`.

## 4. Recordings & transcripts (most sensitive)
- Store in **private object storage** — never a public folder/bucket.
- Access only via **short-lived signed URLs**, gated by RBAC + org check.
- **Access-log every recording view** (who, when, which call) in `audit_logs`.
- Retention policy + deletion workflow; support data export and account deletion.

## 5. Transport & headers
- HTTPS everywhere (HSTS). Nginx TLS termination.
- Security headers: CSP, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy.
- Strict CORS allow-list (web origin only). Secure cookies.

## 6. Input & injection
- Validate all input with Pydantic schemas. Parameterized queries via SQLAlchemy (no string SQL).
- Escape/encode output; the web app avoids `dangerouslySetInnerHTML`.
- CSRF protection for cookie-based flows.

## 7. Secrets & config
- No secrets in source. `.env` + `.env.example`; secrets out of Git.
- Separate dev/staging/prod configs. Production: debug off, no mock credentials, no dev DB/URLs.

## 8. Logging & audit
- Structured request logs: request, status, latency, user, org, error.
- **Never log** passwords, JWT secrets, API keys, full recordings, or unnecessary PII.
- `audit_logs` append-only; not modifiable by normal users.

## 9. Privacy / consent (LEGAL REVIEW REQUIRED)
- Call recording consent depends on jurisdiction; implement consent workflows where required.
- Provide data export + deletion. Document what is collected and why.
- Treat contacts/recordings as personal data of third parties (the called customers), not just the employee.

## 10. Areas explicitly needing legal sign-off
- Call recording legality per region.
- Data retention periods.
- Cross-border data transfer.
- Play Store policy for call-log/recording apps (declared use + user disclosure).

## 11. Current status
- None of the above is implemented yet (frontends are mock-only). This plan governs Phases 2+ (backend, auth, recordings).
