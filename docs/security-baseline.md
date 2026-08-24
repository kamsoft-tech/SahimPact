# SahimPact — Security Baseline (OWASP + NIST)

Security requirements + **gap analysis** for SahimPact as a production, multi‑tenant,
sold‑to‑clients **financial** product. Mapped to **OWASP Top 10 (2021)**, **OWASP ASVS**,
**NIST SP 800‑63B** (auth), **NIST SP 800‑53** (controls) and **NIST SP 800‑218 SSDF**
(secure SDLC). Evidence cites current code.

**Legend:** ✅ in place · ⚠️ partial · ❌ missing (must‑have) · 🔧 process control

## What's already good (credit where due)

- **Password storage** — `bcrypt` with per‑password salt (`core/security.py`). ✅
- **No auth backdoor** — the old `placeholder` bypass was removed; `verify_password` is clean. ✅
- **Secrets from env with a prod guard** — `SECRET_KEY` refuses the dev default when
  `APP_ENV=production` (`core/security.py`). ✅
- **JWT** — timezone‑aware expiry, HS256, `OAuth2PasswordBearer`. ✅
- **RBAC with live checks** — role dependencies re‑check `is_active` + company‑active on every
  request, not just at login (`require_*_role`). ✅
- **CORS** — env‑driven allow‑list, not wildcard‑with‑credentials (`main.py`). ✅
- **User‑enumeration‑safe login** — single "Incorrect username or password" message
  (`auth.py`). ✅
- **Some security headers** — `X‑Frame‑Options: DENY`, `X‑Content‑Type‑Options: nosniff`,
  `Referrer‑Policy` (`nginx.conf`). ✅
- **ORM everywhere** — SQLAlchemy parameterised queries (low SQL‑injection surface). ✅
- **Receipt filenames** — stored as `uuid4()` server‑side, not the client name (`expenses.py`). ✅

## OWASP Top 10 (2021) — status & gaps

| # | Category | Status | Evidence / gap |
|---|---|---|---|
| A01 | Broken access control (BOLA/IDOR, tenancy) | ⚠️ **must verify** | RBAC is good, but **every** query must be scoped by `company_id`, and every "get by id" must confirm the object belongs to the caller's company. A partner of company A must not fetch company B's transaction/expense/agreement by guessing an id. **Audit all endpoints for object‑level authorization.** |
| A02 | Cryptographic failures | ⚠️ | bcrypt ✅. **HSTS/TLS not enforced** (no `Strict‑Transport‑Security`); **no encryption‑at‑rest** requirement for DB/receipts; JWT secret rotation undefined. |
| A03 | Injection | ⚠️ | ORM ✅. **CSV formula injection** on any export not sanitised (`=,+,-,@` prefixes); receipt **extension is attacker‑controlled** (`filename.split(".")[-1]`, `expenses.py`) → validate. |
| A04 | Insecure design | ⚠️ | **No brute‑force/rate‑limit design** on `/api/token` (below); no lockout/backoff. |
| A05 | Security misconfiguration | ⚠️ | **No CSP**; `X‑XSS‑Protection` is deprecated; container **runs as root**, `chmod 777 /app/data` (`Dockerfile`); SQLite default in a financial app; `Base.metadata.create_all` instead of migrations. |
| A06 | Vulnerable & outdated components | ❌ 🔧 | Deps are pinned ✅ but **no SCA** (pip‑audit/Dependabot). `python-jose 3.5.0` is aging (algorithm‑confusion CVE history) + `ecdsa` timing issues — **prefer `PyJWT`**. |
| A07 | Identification & auth failures | ❌ | **No rate limiting / account lockout** on login; **no MFA** for local accounts (incl. Super Admin); **no forced password change on first login** (seed only prints a warning); min‑8 enforced only on self‑service change, **not** on `create_partner`; **no breach‑password check**. |
| A08 | Software & data integrity | ⚠️ | Ledger is append‑only ✅. **No integrity/tamper‑evidence** on the ledger (hash‑chaining); no signed releases/artifact integrity. |
| A09 | Logging & monitoring failures | ❌ | **No security audit log** (login success/failure, privilege change, password reset, settings/shares/agreement changes). Critical for a financial product (NIST 800‑53 AU family). |
| A10 | SSRF | ✅ (n/a‑ish) | No server‑side fetch of user‑supplied URLs found. Keep it that way. |

## NIST mapping (targets)

- **SP 800‑63B (auth, aim AAL2 for admins):** min‑8 passwords ✅ (partial); **throttle failed
  attempts** ❌ (§5.2.2); **check against breached‑password list** ❌ (§5.1.1.2); **MFA for
  privileged users** ❌; no composition/rotation rules required (don't add them).
- **SP 800‑53:** **AU** (audit) ❌, **AC** (access control) ⚠️ verify tenancy, **IA**
  (identification/auth) ⚠️, **SC** (transport/at‑rest crypto) ⚠️, **CP** (backup/DR) — define,
  **SI** (input validation/integrity) ⚠️.
- **SP 800‑218 SSDF 🔧:** add **SAST** (bandit/semgrep), **secret scanning** (gitleaks),
  **SCA** (pip‑audit/Dependabot), mandatory code review, dependency pinning ✅.
- **UK GDPR / DPA 2018:** PII + financial data → **encryption at rest**, retention policy,
  right‑to‑erasure, a DPA with clients, breach‑notification process. Must‑have to sell in the UK.

## Must‑have gaps to close before client rollout

1. **Rate‑limit + lockout on authentication** — throttle `/api/token` (e.g. `slowapi` or at the
   reverse proxy) + exponential backoff / temporary lockout after N failures. *(A07, 800‑63B §5.2.2)*
2. **Tenant isolation audit (BOLA)** — verify every endpoint filters by `company_id` and every
   by‑id fetch checks ownership; add regression tests that company A cannot read company B. *(A01)*
3. **Security audit log** — append‑only log of auth events, privilege changes, password resets,
   and settings/shares/agreement/distribution changes; ship to central logging + alert on
   repeated failures. *(A09, 800‑53 AU)*
4. **HSTS + CSP + TLS everywhere** — add `Strict‑Transport‑Security` and a `Content‑Security‑
   Policy`; drop the deprecated `X‑XSS‑Protection`; enforce HTTPS end‑to‑end. *(A02, A05)*
5. **Harden file uploads** — allow‑list receipt content types (pdf/jpg/png) by **magic bytes**,
   cap size, force `Content‑Disposition: attachment`, serve from outside the webroot; **size‑cap
   CSV** ingest (`await file.read()` currently reads the whole file → DoS) and **sanitise CSV
   formula prefixes** on export. *(A03, A04)*
6. **Dependency scanning + swap `python-jose`→`PyJWT`** — enable Dependabot + `pip-audit` in CI. *(A06)*
7. **Force password change on first login** + enforce min‑8 (and a **breached‑password check**)
   at **all** set points, incl. `create_partner` and admin reset. *(A07, 800‑63B)*
8. **Container hardening** — add a non‑root `USER`, drop `chmod 777` to least‑privilege, pin the
   base image by digest. *(A05)*
9. **Encryption at rest + backups/DR** — use PostgreSQL (already a dep) with encryption at rest;
   encrypt stored receipts; scheduled backups with **tested restores**; document RPO/RTO. *(A02, CP)*
10. **MFA for privileged local accounts** (at least Super/Company Admin) — TOTP is enough. *(A07, AAL2)*

## Should‑have (harden further)

- **Token lifecycle** — short access token + refresh with rotation, and a `jti` revocation
  list so logout/disable invalidates live tokens (today a stolen token is valid until expiry).
- **Ledger tamper‑evidence** — hash‑chain entries (each row hashes the previous) for
  verifiable integrity of financial records. *(A08)*
- **Secret management** — move from env files to a secret store/KMS in production; confirm the
  frontend `.env.production` contains **only the public API URL**, never secrets (it's bundled).
- **Generic error handling** — ensure FastAPI debug is off in prod; never leak stack traces.
- **Migrations** — replace `Base.metadata.create_all` with **Alembic** (also required by the
  master‑fund expansion) for controlled schema change.
- **Session storage** — if the JWT lives in `localStorage`, a strong CSP is essential (XSS
  exfiltration); prefer httpOnly cookies (then add CSRF protection given `allow_credentials`).

## Secure SDLC (process — do continuously) 🔧

- **CI gates:** `pip-audit` (SCA), `bandit`/`semgrep` (SAST), `gitleaks` (secret scan),
  Dependabot on. Pin deps (already ✅) and the Docker base image by digest.
- **Reviews:** mandatory PR review; the Shariah‑logic + auth/tenancy code get extra scrutiny.
- **Pre‑release:** a short pen‑test / ASVS L2 checklist before any client goes live.

---

*Scope: `sahimpact-backend` (FastAPI) + `sahimpact-frontend` (React/nginx). This baseline is a
living document — revisit each release. It complements the data‑security controls in
[`signing-integration-spec.md`](./signing-integration-spec.md) (envelope audit, encryption,
webhook verification) and the clause‑integrity model in [`expansion-spec.md`](./expansion-spec.md).*
