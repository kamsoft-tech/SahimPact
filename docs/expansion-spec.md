# SahimPact — Expansion Spec: Master‑Fund Allocation

Extend SahimPact from **single‑partnership P&L** to a **master fund that allocates capital
into multiple ventures by rules**, consolidates their P&L, and distributes returns — the
master acting as capital provider (Rab‑ul‑Māl) across Musharakah/Mudarabah ventures.

> **Signing is deliberately out of scope here.** Contract e‑signature is a separate,
> pluggable layer — see [`signing-integration-spec.md`](./signing-integration-spec.md).

## Where SahimPact is today (baseline)

The existing model already provides the hard domain core:
- **`Company`** = one partnership; **`User`** with roles `SUPER_ADMIN / COMPANY_ADMIN / PARTNER`.
- **`PartnerShare`** — `capital_share_fixed` (amount) + `labour_share_variable` (% / time).
- **`GlobalSettings`** — `charity_percentage` (zakat, default 6%), `partnership_mode`
  (capital/labour/both), `labour_share_mode` (time/percentage), white‑label fields.
- Double‑entry ledger: **`Account` / `Transaction` / `JournalEntry`**; **`ExpenseReceipt`**.
- **`MonthlyReport`** — period P&L snapshots.
- **`Agreement` / `AgreementSignoff`** — proposal + sign‑off workflow
  (`AgreementType`: `PARAMETER_CHANGE`, `PERIOD_CLOSE`).

**The gap:** every `Company` is an island. There is no master entity that puts capital
into multiple ventures on a rules basis, nor a consolidated roll‑up.

## Proposed model (additive — existing single partnerships are untouched)

| New model | Purpose |
|---|---|
| **`MasterEntity`** | the fund/holding: name, owner, settings (zakat, distribution policy), status |
| **`CapitalPool`** (+ `FundLedger`) | the master's own ledger — capital in, allocations out, returns in, distributions out |
| **`AllocationRule`** | how the master allocates to ventures — `basis`: `FIXED_AMOUNT` \| `PERCENTAGE_OF_POOL` \| `CAPITAL_RATIO` \| `PERFORMANCE` \| `NEEDS_BASED` \| `MANUAL`; schedule (one‑off / periodic); caps/constraints |
| **`Allocation`** | an actual capital injection master → venture (amount, date, rule_id, status). Recorded **inside the venture as the master's capital contribution** via the existing `PartnerShare`/`Transaction` machinery |
| **`ConsolidatedReport`** | roll‑up P&L across ventures for the master (extends the `MonthlyReport` pattern) |

**Link:** add `Company.master_entity_id` (FK, **nullable**) so a partnership can belong to a
master. Nullable = existing standalone partnerships keep working with zero change.

## Flow

1. Master holds a **capital pool**.
2. **Allocation rules → allocations** inject capital into ventures **as the master's capital share** (the master appears as a capital partner in each venture).
3. Ventures run the **existing P&L engine**: revenue − expenses, capital vs labour shares, zakat.
4. **Returns flow back**: venture profit is split by the agreed profit ratio — the master receives its capital‑share of profit; partners receive theirs. **Loss is borne by capital providers in proportion to capital.**
5. Master **consolidates**: pool − allocations + returns − distributions, across all ventures.

## Shariah mechanics the engine MUST enforce

*(The engine enforces the mechanics; a qualified scholar certifies the contract validity —
see the signing spec.)*
- **Loss allocation strictly by capital ratio** (Musharakah) — never by the profit ratio.
- **Profit by the agreed ratio** (may differ from capital ratio) — configurable per venture.
- **Mudarabah case**: where the master provides capital and the venture provides labour, the
  master (Rab‑ul‑Māl) bears capital loss and the mudarib loses only effort — model this
  distinctly from Musharakah.
- **Zakat** computed at the configured rate on the correct base.
- Store the **contract type** (Musharakah / Mudarabah / Wakala) per venture so calculations
  and generated documents match.

## Governance

Reuse `Agreement` / `AgreementSignoff`: add `AgreementType.MASTER_ALLOCATION` so creating or
changing an allocation rule is **proposed and signed off by the affected partners** before it
takes effect (snapshot the proposed allocation in the existing `proposed_settings` JSON).
This keeps every capital movement consented — important both for trust and Shariah validity.

## API (new endpoints, matching the existing `app/api/endpoints` style)

- `master` (CRUD), `master/{id}/pool`, `allocation-rules` (CRUD),
  `allocations` (create / execute / list), `master/{id}/consolidated-report`.
- **RBAC**: add a `MASTER_ADMIN` role (or reuse `SUPER_ADMIN`); partners get read + sign‑off.

## Frontend (React/shadcn)

- **Master dashboard**: pool balance, list of ventures, allocations, consolidated P&L, zakat.
- **Allocation rule builder** (basis + schedule + constraints), with a preview of the split.
- Drill‑through to each venture's existing views.

## Migration & compatibility

- `Company.master_entity_id` nullable → existing data unaffected. Alembic migration.
- Keep the ledger **append‑only**; allocations and distributions are ledger entries, not edits.

## Contract clause library (scholar‑certified, composable)

Generated contracts are **assembled from a certified clause library**, never free text. Users
**compose** a contract by including/excluding *optional* clauses; the **must‑have sections are
locked** and always rendered.

**Model — `ContractClause`:** `key`, `category`, `title`, `body` (the *certified wording*),
`mandatory: bool`, `locked: bool`, `contract_type` (Musharakah / Mudarabah / Wakala),
`madhhab` (Hanafi…), `version`, `certification_ref`, `scholar`, `certified_on`, `active`.
A `ContractTemplate` is a composed set; a generated document **snapshots the exact clause
versions + certification refs it used**.

- **Mandatory (must‑have) clauses — cannot be edited or removed**, always rendered, visibly
  marked as locked. These are the Shariah + legal pillars of a valid contract: offer &
  acceptance, capital contributions, **profit ratio (fixed & known at contract)**, **loss
  strictly in proportion to capital**, contract type, management/authority basis, zakat
  treatment, dissolution & dispute resolution.
- **Optional clauses — users add/remove** from the certified menu (e.g. buy‑out terms,
  reporting cadence, specific authority limits). The **wording is fixed/certified** — users
  choose *inclusion*, not text.
- **No free‑text edit of certified wording.** If bespoke commercial terms are ever needed,
  put them in a clearly‑separated **"additional business terms (non‑Shariah)"** appendix that
  is **explicitly flagged as outside the scholar's certification** — never mixed into the
  Shariah core.
- **Governance & versioning:** only `SUPER_ADMIN` + the scholar can add/deprecate/version
  certified clauses; tenants compose from the *active certified set* only. Clauses are
  versioned — updating a clause does **not** alter already‑signed contracts (immutable); new
  contracts use the new version. This ties directly to `template_version` /
  `shariah_certification_ref` in [`signing-integration-spec.md`](./signing-integration-spec.md).

## Hanafi compliance — profit is a fixed agreed ratio, never a wage/time measure

> [!CAUTION]
> **The system must not distribute profit on the basis of hours/time worked.** Under Hanafi
> fiqh you **cannot combine ijārah (wage/employment) with shirkah (partnership)** — a partner's
> return must be a **share of profit by a ratio fixed and known at contract**, not pay for
> time (which is a wage and guarantees a risk‑free return). A working partner may take a
> **larger agreed *percentage* of profit "in lieu of extra work" — an increased profit %, not a
> fixed sum and not derived from hours.** Loss is always borne by capital in proportion.
> *(Confirm the exact ruling with your scholar; sources below.)*

**What the current code does that violates this** — in
`sahimpact-backend/app/services/distribution_service.py`:
- `labour_share_mode` defaults to **`"time"`** (≈ line 59), and the labour share is then
  computed from **hours logged**: `lab_pct = partner_logged_hours / total_hours` (≈ line 168).
  That is wage/time‑based profit → the impermissible ijārah‑in‑shirkah mixing.

**Remediation (required for a Hanafi‑compliant product):**
- **Remove the `"time"` mode and the hours‑based derivation.** Profit is shared **only by
  fixed pre‑agreed percentages** — the permissible path already present at ≈ line 166
  (`lab_pct = labor_share_variable / 100`). Make `"percentage"` the **only** mode; migrate any
  existing `"time"` settings to require an explicit agreed %.
- **Set the profit ratio at contract inception** (in the `Agreement`, signed off) — never
  derive it post‑hoc from activity (avoids *gharar* / an unknown ratio at contract time).
- **Keep the loss rule** — already correct: *"Loss Rule: Proportional to Capital Share ONLY.
  Labor share ignored for loss."* (≈ line 173).
- **`TimeEntry` / time tracking may remain** as an internal record of who contributed (useful
  when partners *agree* or renew the ratio), but it **must not feed distribution** — decouple
  it from `calculate_month_end_close`. Remove any UI implying "earn by hours."
- **Do not implement partner salaries.** *(A contemporary minority Hanafi view permits a
  partner to also be employed under a fully **independent** employment contract at market wage
  — ujrah al‑mithl — separate from the partnership. You've taken the strict position, so the
  system should not offer partner salaries at all; if ever added, it must be a wholly separate
  contract, never inside the profit engine.)*

**Sources (verify with your own scholar):**
- IslamQA (Hanafi) — [Receiving a Salary in a Partnership](https://islamqa.org/hanafi/askimam/127082/receiving-a-salary-in-a-partnership/)
- Kitaabun — [Can a business partner take a salary or extra profit?](https://kitaabun.com/shopping3/business-partner-take-salary-extra-profit-a-813.html) *("cannot combine employment (ijārah) and partnership (shirkah)… an increase in the percentage of the profits and not a fixed profit")*
- IslamQA — [Can a Business Partner Take Salary in Mudarabah?](https://islamqa.info/en/answers/122622)

## Master kickoff prompt (paste into your agentic coder)

```text
You are extending an existing FastAPI + SQLAlchemy backend and a React (Vite + shadcn/ui)
frontend called SahimPact — Shariah-compliant partnership P&L software. Read the current
model in sahimpact-backend/app/models/models.py (Company, User, PartnerShare,
GlobalSettings, Account/Transaction/JournalEntry, MonthlyReport, Agreement/AgreementSignoff)
before changing anything.

GOAL: add a "Master Fund" layer that allocates capital into multiple venture partnerships by
rules, consolidates their P&L, and distributes returns — the master acting as the capital
partner (Rab-ul-Mal). Do NOT touch e-signature (separate spec).

DELIVER (in additive, backward-compatible steps, each with an Alembic migration + tests):
1. Models: MasterEntity, CapitalPool/FundLedger, AllocationRule (basis: FIXED_AMOUNT,
   PERCENTAGE_OF_POOL, CAPITAL_RATIO, PERFORMANCE, NEEDS_BASED, MANUAL; schedule; caps),
   Allocation; add nullable Company.master_entity_id and a MASTER_ADMIN role.
2. Services: allocate capital master->venture as the master's PartnerShare capital via the
   EXISTING ledger; roll returns back; enforce Shariah rules — LOSS strictly by capital ratio,
   PROFIT by agreed ratio, Mudarabah vs Musharakah distinction, zakat at the configured rate.
3. Governance: extend AgreementType with MASTER_ALLOCATION so rule/allocation changes go
   through the existing Agreement + AgreementSignoff sign-off before taking effect.
4. API endpoints (mirror app/api/endpoints style): master, allocation-rules, allocations,
   consolidated-report; RBAC-guarded.
5. Frontend: master dashboard (pool, ventures, allocations, consolidated P&L, zakat),
   allocation-rule builder with split preview, drill-through to ventures.
6. HANAFI FIX (do this FIRST — it's a correctness bug): in
   app/services/distribution_service.py, REMOVE the "time" labour_share_mode and the
   hours-based labour share (lab_pct = partner_logged_hours / total_hours, ~line 168). Profit
   must be shared ONLY by fixed pre-agreed percentages (the labor_share_variable/100 path).
   Make "percentage" the only mode; migrate existing "time" settings. Keep the loss rule
   (loss by capital ONLY). Keep TimeEntry as an internal record but DECOUPLE it from
   distribution. Do NOT add partner salaries. Reason: Hanafi fiqh forbids combining ijarah
   (wage/time pay) with shirkah (partnership); profit must be a ratio fixed at contract.
7. Contract clause library: ContractClause model (key, category, title, body=certified
   wording, mandatory, locked, contract_type, madhhab, version, certification_ref, scholar,
   certified_on, active) + ContractTemplate composition. Mandatory/locked clauses are always
   rendered and CANNOT be edited or removed; optional clauses can be added/removed but their
   wording is fixed. No free-text edit of certified wording. Only SUPER_ADMIN + scholar manage
   clauses; generated docs snapshot the exact clause versions + certification_ref used.

RULES: keep the ledger append-only; nullable FK so standalone partnerships are unaffected;
match existing code style; tests for the allocation + loss/profit math (esp. loss-by-capital
AND that profit is NEVER derived from hours); strict typing; small commits. Print a PLAN
first, do the HANAFI FIX (step 6) first, then implement the rest. Flag anywhere the Shariah
calculation is ambiguous for a scholar to confirm — never invent contract wording or assert
Shariah compliance yourself.
```
