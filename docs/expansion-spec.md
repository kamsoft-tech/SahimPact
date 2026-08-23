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

RULES: keep the ledger append-only; nullable FK so standalone partnerships are unaffected;
match existing code style; tests for the allocation + loss/profit math (esp. loss-by-capital);
strict typing; small commits. Print a PLAN first, then implement step 1 end-to-end and verify
before moving on. Flag anywhere the Shariah calculation is ambiguous for a scholar to confirm.
```
