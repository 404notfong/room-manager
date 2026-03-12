# Room Manager

## What This Is

A property/rental management system for building owners and managers in Vietnam. Manages buildings, rooms, tenants, contracts, invoices, and payments with bilingual support (EN/VI).

## Core Value

Property managers can instantly see a tenant's complete history — payments, contracts, and room changes — to make informed decisions about tenants and resolve disputes quickly.

## Current State (v1.1 shipped)

### Shipped Features
- ✓ Building management (CRUD, multi-building support)
- ✓ Room management (CRUD within buildings, room groups, drag-and-drop ordering)
- ✓ Tenant management (CRUD, tenant information)
- ✓ Contract management (create, view, link tenant to room)
- ✓ Invoice generation and tracking (regular + short-term invoices)
- ✓ Payment recording and tracking
- ✓ Service management (electricity, water, internet rates)
- ✓ JWT authentication (login, register, token refresh)
- ✓ Bilingual support EN/VI (frontend + backend i18n)
- ✓ Dashboard with room status overview and calendar
- ✓ Notification system
- ✓ PDF export for invoices
- ✓ **Tenant history API** — unified timeline of contracts, invoices, payments (v1.1)
- ✓ **Tenant history modal tab** — quick preview with color-coded timeline (v1.1)
- ✓ **Full tenant history page** — filters, expandable cards, pagination (v1.1)

## Context

- Existing monorepo: NestJS backend + React frontend + MongoDB
- 12 backend modules with consistent patterns (module → controller → service → schema)
- Frontend uses shadcn/ui + Tailwind + Zustand + React Query
- History data aggregated from existing collections — no separate history collection

## Constraints

- **Tech stack**: Must use existing NestJS + React + MongoDB stack
- **UI consistency**: Follow existing shadcn/ui + Tailwind patterns and bilingual support
- **API pattern**: Follow existing REST API conventions with JWT auth

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Aggregate from existing data, no new collection | History data already exists across contracts/invoices/payments | ✅ Validated |
| View-only for v1, no edit/notes | Keep scope small, ship fast, validate usefulness first | ✅ Validated |
| Both modal tab + full page | Quick glance in modal, deep dive on full page | ✅ Validated |
| Timeline-style chronological display | Most intuitive for understanding tenant journey | ✅ Validated |

<details>
<summary>Milestone History</summary>

### v1.1 — Tenant History (2026-03-10 → 2026-03-12)
- 3 phases, 17 requirements, 23 UAT tests
- [Roadmap Archive](milestones/v1.1-ROADMAP.md) | [Requirements Archive](milestones/v1.1-REQUIREMENTS.md)

</details>

---
*Last updated: 2026-03-12 after v1.1 milestone completion*
