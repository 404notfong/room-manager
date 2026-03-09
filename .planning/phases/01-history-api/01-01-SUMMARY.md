# Phase 01 — Plan 01 Summary: Tenant History API

**Status:** Complete
**Commit:** `feat(01-01): add tenant history API endpoint`

## What Was Built

GET `/tenants/:id/history` endpoint that aggregates contracts, invoices, and payments into a unified chronological timeline.

## Files Changed

| File | Action |
|------|--------|
| `dto/tenant-history.dto.ts` | **NEW** — DTO + response interfaces |
| `tenants.module.ts` | **MODIFIED** — Registered Contract/Invoice/Payment models |
| `tenants.service.ts` | **MODIFIED** — Added `getHistory()` aggregation method |
| `tenants.controller.ts` | **MODIFIED** — Added `GET :id/history` endpoint |

## Key Decisions

- Used in-memory aggregation (parallel queries + merge + sort) instead of MongoDB `$unionWith` — simpler, leverages existing indexes
- Payments filtered by `paymentDate` (not `createdAt`) for accurate date range filtering
- Route placed BEFORE `:id` route to prevent NestJS matching `history` as an ID
- Extends `PaginationDto` for consistent pagination pattern

## Verification

- ✅ TypeScript compiles with zero errors
- ✅ All existing tests unaffected
- ✅ Route ordering correct (`:id/history` before `:id`)

## Requirements Covered

HIST-01 ✓, HIST-02 ✓, HIST-03 ✓, HIST-04 ✓, HIST-05 ✓, HIST-15 ✓, HIST-16 ✓, HIST-17 ✓
