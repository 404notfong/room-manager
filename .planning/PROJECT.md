# Room Manager — Tenant History

## What This Is

A property/rental management system for building owners and managers in Vietnam. Manages buildings, rooms, tenants, contracts, invoices, and payments with bilingual support (EN/VI). The next milestone adds comprehensive tenant history tracking.

## Core Value

Property managers can instantly see a tenant's complete history — payments, contracts, and room changes — to make informed decisions about tenants and resolve disputes quickly.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — inferred from existing codebase. -->

- ✓ Building management (CRUD, multi-building support) — existing
- ✓ Room management (CRUD within buildings, room groups, drag-and-drop ordering) — existing
- ✓ Tenant management (CRUD, tenant information) — existing
- ✓ Contract management (create, view, link tenant to room) — existing
- ✓ Invoice generation and tracking (regular + short-term invoices) — existing
- ✓ Payment recording and tracking — existing
- ✓ Service management (electricity, water, internet rates) — existing
- ✓ JWT authentication (login, register, token refresh) — existing
- ✓ Bilingual support EN/VI (frontend + backend i18n) — existing
- ✓ Dashboard with room status overview and calendar — existing
- ✓ Notification system — existing
- ✓ PDF export for invoices — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Chronological tenant history timeline (payments, contracts, room changes)
- [ ] History tab in tenant view modal (quick preview)
- [ ] Full tenant history page with filtering and date range
- [ ] Payment history entries (amount, date, status, linked invoice)
- [ ] Contract history entries (start, end, renewals, term changes)
- [ ] Room history entries (move-in, move-out, room transfers)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Notes/comments on history entries — defer to v2, keep v1 simple and read-only
- Export history to PDF — defer to v2, existing PDF export covers invoices already
- Tenant rating/scoring — complex feature, not needed for history viewing
- Real-time history notifications — existing notification system sufficient

## Context

- Existing monorepo: NestJS backend + React frontend + MongoDB
- 12 backend modules already established with consistent patterns (module → controller → service → schema)
- Frontend uses shadcn/ui + Tailwind + Zustand + React Query
- Tenant data already linked to contracts, invoices, and payments via MongoDB references
- History data can be aggregated from existing collections — no new schema needed for v1
- Property managers need this to track problem tenants and resolve payment disputes

## Constraints

- **Tech stack**: Must use existing NestJS + React + MongoDB stack — no new dependencies
- **Data source**: Aggregate from existing collections (contracts, invoices, payments) — no separate history collection for v1
- **UI consistency**: Follow existing shadcn/ui + Tailwind patterns and bilingual support
- **API pattern**: Follow existing REST API conventions with JWT auth

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Aggregate from existing data, no new collection | History data already exists across contracts/invoices/payments | — Pending |
| View-only for v1, no edit/notes | Keep scope small, ship fast, validate usefulness first | — Pending |
| Both modal tab + full page | Quick glance in modal, deep dive on full page | — Pending |
| Timeline-style chronological display | Most intuitive for understanding tenant journey | — Pending |

---
*Last updated: 2026-03-10 after initialization*
