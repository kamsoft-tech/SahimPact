# SahimPact — Signing Integration Spec: pluggable e‑signature

Partnership agreements (terms, allocation changes) must be **legally signed**. This is a
**pluggable provider layer**, not a hard wire to any one platform. A client can choose:

1. **KamSoft‑hosted Documenso** — we run it; they just use it.
2. **Their own signing platform** — DocuSign, or their own Documenso, via an adapter.
3. **SahimPact built‑in signing** — a self‑contained library coupled into the workflow, so
   documents never leave the client's instance.

Never assume a client wants our Documenso. Provider is **per‑tenant configuration**.

> Domain context (the *what* being signed) lives in
> [`expansion-spec.md`](./expansion-spec.md). This spec is only the *signing* mechanism.

## Architecture — a provider abstraction

One interface, several implementations. The workflow only ever talks to the interface.

```python
class SigningProvider(Protocol):
    def create_envelope(self, document: bytes, signers: list[Signer],
                        metadata: dict) -> EnvelopeRef: ...
    def get_status(self, ref: EnvelopeRef) -> EnvelopeStatus: ...
    def download_signed(self, ref: EnvelopeRef) -> bytes: ...
    def handle_webhook(self, payload: bytes, signature: str) -> list[SigningEvent]: ...
    def cancel(self, ref: EnvelopeRef) -> None: ...
```

- **`DocumensoProvider`** — Documenso API: create/upload document, add recipients, send;
  webhook or poll for completion; download the signed PDF. Config: base URL + API token.
- **`DocuSignProvider`** — DocuSign eSignature REST API: create envelope, recipients + tabs,
  send; **DocuSign Connect** webhooks; retrieve completed. OAuth (JWT/auth‑code) per tenant.
- **`BuiltInProvider`** — self‑contained (below).

**Common status vocabulary** every adapter maps to:
`DRAFT · SENT · PARTIALLY_SIGNED · COMPLETED · DECLINED · VOIDED`.

**Per‑tenant selection:** a `SigningConfig` per company/master picks the provider + holds its
(encrypted) credentials. `SUPER_ADMIN` can also offer "use KamSoft's hosted Documenso" as a
turnkey option so small clients need no setup.

## Built‑in signing library (the coupled option)

For clients who want everything inside SahimPact — no third party in the loop:

- **Document generation** — render the agreement PDF from a template + agreed terms
  (`weasyprint` from HTML, or `reportlab`).
- **Signature capture** — drawn / typed / uploaded signature in the React UI, placed on the
  document at defined anchor fields.
- **Cryptographic seal** — apply a **PAdES digital signature** with a PKCS#12 certificate
  using **`pyHanko`** (or `endesive`) → the final PDF is **tamper‑evident and verifiable**.
  Optional **RFC‑3161 trusted timestamp** for long‑term validity.
- **Signer authentication** — email one‑time code, SSO, or a signed expiring access link,
  before the signer can view/sign.
- **Audit trail** — immutable log of every event (see security below).

This gives a DocuSign‑like experience with **zero external dependency and full data
residency** — a genuine selling point for privacy‑sensitive or Shariah‑governance clients.

## Security & safety — non‑negotiables

- **Encrypt documents at rest**; serve only via signed, **expiring** links; strict RBAC —
  only invited signers and authorised staff can view an envelope.
- **Immutable, append‑only audit log** per envelope: signer identity, email, IP, user‑agent,
  timestamps, consent, and the **document hash at each event** — so any post‑signature tamper
  is detectable. The completed PDF is cryptographically sealed.
- **Explicit consent to sign electronically** captured and recorded (ESIGN / eIDAS style).
- **Secrets** (Documenso token, DocuSign keys, the built‑in signing cert + passphrase) live in
  a secret store / KMS — **encrypted, never in code or plaintext DB**, never in the repo.
- **Verify inbound webhooks** (provider signature) and handle them **idempotently**; never
  trust a status transition that isn't provider‑authenticated.
- **Certificate lifecycle** for the built‑in provider — track expiry, support rotation
  (the same class of footgun as the Documenso seal cert and the Apple MDM push cert).
- **Data residency** — built‑in and client‑hosted providers keep documents in the client's
  own instance. Make this explicit in the product's security story.

## Workflow integration

Add a `SigningEnvelope` model — `provider`, `provider_ref`, `status`,
`signed_document_ref`, `audit`, `template_version`, `shariah_certification_ref` — linked to
the existing `Agreement` / `AgreementSignoff`.

```
Agreement APPROVED (internal sign-off)
        │
        ▼
generate contract PDF (scholar-certified template + agreed terms)
        │
        ▼
tenant's chosen SigningProvider.create_envelope(...)
        │
        ▼
track status on SigningEnvelope  ──► webhook/poll ──► COMPLETED
        │
        ▼
store signed PDF + mark Agreement executed
```

## Shariah note

This layer is **provider‑agnostic plumbing** — it does not make a contract compliant. The
**wording and structure** (Musharakah / Mudarabah / Wakala, profit ratio, loss‑by‑capital,
zakat) must be **certified by a qualified Shariah scholar / board**. Store the scholar‑approved
**template version** and a **certification reference** on every envelope, so each signed
contract is traceable to an approved, certified template.

## Master kickoff prompt (paste into your agentic coder)

```text
You are adding a PLUGGABLE e-signature layer to SahimPact (FastAPI + SQLAlchemy backend,
React/Vite/shadcn frontend). Signing must NOT be hard-wired to any one platform. Read the
existing Agreement / AgreementSignoff models first.

GOAL: let each tenant choose their signing provider — KamSoft-hosted Documenso, their own
DocuSign or Documenso, or a built-in self-contained signer — behind one interface.

DELIVER (additive, each step with tests + an Alembic migration):
1. A SigningProvider interface (create_envelope, get_status, download_signed, handle_webhook,
   cancel) + a common status enum (DRAFT/SENT/PARTIALLY_SIGNED/COMPLETED/DECLINED/VOIDED).
2. Adapters: DocumensoProvider (Documenso API), DocuSignProvider (DocuSign eSignature REST +
   Connect webhooks, OAuth per tenant). Per-tenant SigningConfig holding the provider choice +
   ENCRYPTED credentials (KMS/secret store — never plaintext, never in the repo).
3. BuiltInProvider: PDF generation (weasyprint/reportlab), signature capture UI, PAdES seal
   via pyHanko with a PKCS#12 cert (+ optional RFC-3161 timestamp), email-OTP/link signer auth.
4. SigningEnvelope model (provider, provider_ref, status, signed_document_ref, audit,
   template_version, shariah_certification_ref) linked to Agreement; wire it so an APPROVED
   Agreement generates the contract PDF, creates an envelope via the tenant's provider, tracks
   status, and on COMPLETED stores the signed PDF + marks the Agreement executed.
5. Security (MANDATORY): encrypt documents at rest; expiring signed links; strict RBAC;
   immutable append-only audit log with per-event document hash; explicit e-sign consent
   capture; verify + idempotently handle webhooks; certificate lifecycle handling.

RULES: the workflow talks ONLY to the interface, never a concrete provider. No secrets in code
or DB plaintext. Match existing code style; strict typing; small commits. Print a PLAN first,
implement the interface + BuiltInProvider end-to-end and verify before adding DocuSign. Do NOT
generate or assert Shariah compliance of contract wording — leave a clearly-marked template
slot for a scholar-certified document + store its certification reference.
```
