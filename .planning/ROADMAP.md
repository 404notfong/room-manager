# Roadmap: Room Manager — Tenant History

**Created:** 2026-03-10
**Milestone:** v1.1 — Tenant History
**Depth:** Quick (3 phases)

## Overview

| # | Phase | Goal | Requirements | Plans |
|---|-------|------|--------------|-------|
| 1 | History API | Backend endpoint for unified tenant timeline | HIST-01 to HIST-05, HIST-15 to HIST-17 | 1-3 |
| 2 | Modal History Tab | Quick history preview in tenant modal | HIST-06 to HIST-09 | 1-2 |
| 3 | Full History Page | Dedicated page with filters and pagination | HIST-10 to HIST-14 | 1-3 |

## Phase Details

### Phase 1: History API

**Goal:** Create backend API that aggregates tenant events from contracts, invoices, and payments into a unified chronological timeline.

**Requirements:** HIST-01, HIST-02, HIST-03, HIST-04, HIST-05, HIST-15, HIST-16, HIST-17

**Success Criteria:**
1. `GET /tenants/:id/history` returns merged timeline of contracts, invoices, payments
2. Events are sorted by date (newest first) with correct event details
3. Filter by type and date range works correctly
4. Pagination returns correct page sizes and total counts
5. Response time < 500ms for tenants with 100+ events

---

### Phase 2: Modal History Tab

**Goal:** Add a History tab to the existing tenant view modal showing a compact, color-coded timeline of recent events.

**Requirements:** HIST-06, HIST-07, HIST-08, HIST-09

**Success Criteria:**
1. History tab appears in tenant view modal
2. Shows last 10 events in a vertical timeline
3. Events are color-coded by type with appropriate icons
4. "View full history" link navigates to the full history page
5. Labels display correctly in both EN and VI

---

### Phase 3: Full History Page

**Goal:** Build a dedicated tenant history page with full filtering, expandable details, and pagination.

**Requirements:** HIST-10, HIST-11, HIST-12, HIST-13, HIST-14

**Success Criteria:**
1. Page loads at `/tenants/:id/history` with tenant name header
2. Timeline shows all events with expandable detail cards
3. Type filter and date range picker work correctly
4. Pagination navigates through large histories
5. All labels and content display correctly in EN and VI

---
*Roadmap created: 2026-03-10*
*Last updated: 2026-03-10 after initialization*
