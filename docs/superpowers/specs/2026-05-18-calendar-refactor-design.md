# Calendar Module Refactor — Design Spec

**Date:** 2026-05-18
**Scope:** Refactor dashboard calendar (frontend + backend) — fix logic bugs, redesign day cell + modal, split oversized components/services.
**Out of scope:** New views (week/agenda), filters by event type, drag-and-drop, notifications, calendar export.

---

## 1. Problem statement

The dashboard calendar module (`frontend/src/components/dashboard/BigCalendar.tsx` + `backend/src/modules/calendar/calendar.service.ts`) has accumulated issues across three dimensions:

- **Logic bugs** that mislead users (wrong event counts, lost overdue events, duplicate PAYMENT/INVOICE events, future months silently changing event labels)
- **UX friction** (counter shows event *types* instead of events, ten-color legend at the bottom, blank padding cells, must click to see anything)
- **Code structure** (258-line frontend component, 511-line backend service mixing three producers, hard-coded Vietnamese strings, magic dictionaries)

Goal: a calendar that surfaces real events accurately, reads cleanly at a glance, and is split into pieces small enough to be understood and modified independently.

---

## 2. Logic fixes

### 2.1 Day-cell counter counts events, not types

**Current:** `getEventsForDate` returns `Object.entries(dayData).filter(([, c]) => c > 0).map(([t]) => t)` — array of event *types*. `eventTypes.length` is the *type count*, not the event count.

**Fix:** Return both — type list (for rendering rows) and total count (for badge). Total = `Object.values(dayData).reduce((a, b) => a + b, 0)`.

### 2.2 PAYMENT_DUE / INVOICE_DUE deduplication

**Domain semantics (clarified during brainstorm):**

| Event | Meaning |
|---|---|
| `PAYMENT_DUE` | Workflow reminder: cycle reached, owner must create invoice and confirm with tenant |
| `INVOICE_DUE` | Concrete invoice waiting payment |

These are **different stages**, not duplicates. But once an invoice exists for a cycle, the PAYMENT_DUE reminder is stale and must be suppressed.

**Dedupe rule (in `payment-due.producer`):** for each candidate PAYMENT_DUE event with payment date `D`, suppress it if there exists any non-deleted invoice with:

```ts
{
  contractId: contract._id,
  billingPeriod: { month: D.getMonth() + 1, year: D.getFullYear() },
  isDeleted: { $ne: true },
}
```

Implementation: batch-load invoices for the (ownerId, contract list, range) up front, build a `Set<contractId:month:year>` lookup, then filter candidates.

### 2.3 Remove the 7-day window; collapse CONTRACT_START/END

**Current behavior:** For DRAFT contracts whose `startDate` is in the calendar range:
- `≤ 7 days away` → `DEPOSIT_CHECKIN_DUE` (warning, yellow)
- `> 7 days away` → `CONTRACT_START` (info, blue) — *different color, different label, same underlying event*
- `< today` → `DEPOSIT_CHECKIN_OVERDUE` (danger, red)

Same triple-branch for ACTIVE contracts (`ACTIVE_CHECKOUT_DUE` / `CONTRACT_END` / `ACTIVE_CHECKOUT_OVERDUE`).

This is confusing: scrolling to month +2 silently changes a "check-in" into a "contract start," even though the user's mental model is one event.

**Fix:**
- Drop `CONTRACT_START` and `CONTRACT_END` event types entirely.
- DRAFT contract with `startDate` in range → always `DEPOSIT_CHECKIN_DUE` with severity computed by proximity:
  - `daysUntilStart < 0` → severity `danger` (overdue)
  - `0 ≤ daysUntilStart ≤ 7` → severity `warning`
  - `daysUntilStart > 7` → severity `info`
- ACTIVE contract with `endDate` in range → same pattern for `ACTIVE_CHECKOUT_DUE`.
- Overdue is now an attribute (severity), not a separate event type — but for backward compat with backend DTOs, keep `*_OVERDUE` types to indicate "this severity is final, not a proximity-based info".

**Final event types (8):** `DEPOSIT_CHECKIN_DUE`, `DEPOSIT_CHECKIN_OVERDUE`, `ACTIVE_CHECKOUT_DUE`, `ACTIVE_CHECKOUT_OVERDUE`, `INVOICE_DUE`, `INVOICE_OVERDUE`, `PAYMENT_DUE`, `PAYMENT_DUE_OVERDUE`.

The internal severity field continues to drive coloring; the `*_OVERDUE` enum value is what backend stamps when overdue.

### 2.4 Overdue events: separate feed, not lost in the grid

**Current behavior:** When `getContractEvents` detects an overdue DRAFT contract from 3 months ago, it pushes the event with `date: contract.startDate` (3 months ago). The `getMonthSummary` aggregator then aggregates by `dateKey` — but the displayed grid only iterates days of the queried month, so old overdues never appear on screen.

**Fix:**

- Grid stays accurate: only events with `date` in the queried month appear, at their original dates.
- Add `GET /calendar/overdue?buildingId=...` — returns all currently-overdue events regardless of date.
- Frontend `OverdueBanner` displays above the grid whenever the overdue feed is non-empty, with a CTA to open `OverdueListModal`.

---

## 3. UX changes

### 3.1 Day cell — Stacked bars (Google Calendar style)

Replace the current type-row layout with **per-event horizontal bars**:

- Each bar = one real event (not a type group)
- Tailwind: `text-xs px-1.5 py-0.5 rounded-sm border-l-[3px]` with severity-based bg/border (red-100/amber-100/blue-100 + red-500/amber-500/blue-500)
- Bar text: `{roomName} · {shortLabel}` truncated with `ellipsis whitespace-nowrap`
- Cap visible bars at 4 (responsive: 2-3 on mobile if needed); overflow → `+N nữa` chip
- Counter (top-right corner of cell): plain number (e.g. `4`), no "mục" suffix

### 3.2 Padding days

Show previous/next month days greyed (opacity `0.45`, no border-dashed) instead of empty placeholders. They are clickable and show events if any. Grid is always 5 or 6 full rows.

### 3.3 Remove the legend

The 10-chip legend below the grid is deleted. Severity colors (red = overdue, amber = due soon, blue = info) are universal enough to self-read with the bar's own label.

### 3.4 Modal day-detail — redesigned cards

- Header unchanged (`CalendarDays` icon + full date)
- Event cards:
  - Severity strip (3px) on the left edge
  - Pill chip with event-type label
  - Bold title (composed on the frontend from i18n key + room/tenant)
  - One-line description (tenant + amount)
  - Inline `flex flex-wrap gap-x-3 gap-y-1` meta row instead of `grid sm:grid-cols-2` — skips `N/A` values entirely
  - "Xem hợp đồng" / "Xem hóa đơn" CTA (existing nav behavior preserved)

### 3.5 Overdue banner (new)

- `<OverdueBanner />` rendered above the calendar grid in `BigCalendar.tsx`
- Visible only when `useCalendarData().overdue.length > 0`
- Layout: `bg-error/10 border border-error/30 rounded-2xl px-4 py-3 flex items-center justify-between`
  - Left: `AlertTriangle` icon + bold count text ("Bạn có N sự kiện quá hạn")
  - Right: outline button "Xem chi tiết →" opens `OverdueListModal`
- `OverdueListModal`: list of `CalendarEventCard` grouped by severity then by date descending. Uses the same event card component as day-detail modal.

---

## 4. Code structure

### 4.1 Frontend

Move calendar components into a dedicated folder:

```
frontend/src/components/dashboard/calendar/
├── BigCalendar.tsx              — orchestrator: month state, selectedDate state, composes children
├── CalendarHeader.tsx           — Today + Prev/Next + month label
├── CalendarGrid.tsx             — 7-col grid: weekday header + 35 or 42 day cells (with padding)
├── CalendarDayCell.tsx          — single cell (stacked-bars layout); props: day, events, isToday, isOutsideMonth, onClick
├── CalendarDayDetailModal.tsx   — day-detail modal
├── CalendarEventCard.tsx        — shared event card (used in day modal + overdue modal)
├── OverdueBanner.tsx            — strip above grid
├── OverdueListModal.tsx         — grouped overdue list
└── hooks/
    └── useCalendarData.ts       — wraps the three react-query calls (monthSummary, dayEvents, overdue)
```

Shared library code:

```
frontend/src/lib/calendar/
├── event-colors.ts              — EVENT_COLORS map + getSeverityClasses(severity)
├── event-display.ts             — getShortLabel(type), composeTitle(event, t), getRelatedPath(event)
└── grid-helpers.ts              — buildMonthGrid(date): { days, paddingBefore, paddingAfter }
```

Update the import in `frontend/src/pages/dashboard/DashboardPage.tsx` directly to `@/components/dashboard/calendar/BigCalendar` — single-line change, no barrel re-export needed.

### 4.2 Backend

```
backend/src/modules/calendar/
├── calendar.controller.ts        — existing endpoints + new GET /overdue
├── calendar.module.ts            — register producers as providers
├── calendar.service.ts           — orchestrator: getEventsInRange, getEventsByDay, getMonthSummary, getOverdue
├── producers/
│   ├── contract-events.producer.ts   — DRAFT check-in events + ACTIVE checkout events (severity by proximity)
│   ├── payment-due.producer.ts       — PAYMENT_DUE with invoice-existence dedupe
│   └── invoice-events.producer.ts    — INVOICE_DUE / INVOICE_OVERDUE
├── helpers/
│   ├── date-keys.ts              — toLocalDateKey, buildDayRange, isPastDay
│   └── severity.ts               — computeSeverity(daysUntil) → 'info' | 'warning' | 'danger'
└── dto/
    └── calendar-event.dto.ts     — clean enum (drop CONTRACT_START/END), keep CalendarEventDto / CalendarDayEventsDto / CalendarMonthSummaryDto
```

Producer interface (consistent across the three):

```typescript
interface CalendarEventProducer {
  produce(
    ownerId: string,
    range: { start: Date; end: Date },
    buildingId?: string,
  ): Promise<CalendarEventDto[]>;
}
```

The orchestrator (`calendar.service.ts`) calls each producer, concatenates results, sorts by date. For the new overdue endpoint, it calls producers with a "now-anchored open range" (all events whose effective overdue trigger date `< today`) and filters to severity `danger`.

### 4.3 API contract

| Endpoint | Status | Notes |
|---|---|---|
| `GET /calendar/events?start&end&buildingId` | Unchanged | Same shape, internally fed by new producers |
| `GET /calendar/day?date&buildingId` | Unchanged | |
| `GET /calendar/month-summary?year&month&buildingId` | Unchanged shape | Reflects dedupe + new severity rules |
| `GET /calendar/overdue?buildingId` | **New** | Returns `CalendarEventDto[]` of currently overdue items |

The `CalendarEvent.type` enum on the frontend drops `CONTRACT_START` and `CONTRACT_END`. The frontend `EVENT_COLORS` map drops those entries. `CalendarEventDto` adds a new optional numeric field `daysOverdue` (set by producers when severity is `danger`); `title` and `description` become optional (frontend composes them via i18n keys).

### 4.4 i18n updates

Both `backend/src/i18n/{en,vi}/calendar.json` (where applicable) and `frontend/public/locales/{en,vi}/translation.json`:

- Drop keys `calendar.eventTypes.CONTRACT_START`, `calendar.eventTypes.CONTRACT_END`
- Reword `calendar.eventTypes.PAYMENT_DUE` for clarity: "Tới kỳ thu — tạo hóa đơn" / "Collection cycle reached — create invoice"
- Add `calendar.overdue.bannerCount` ("Bạn có {{count}} sự kiện quá hạn" / "You have {{count}} overdue events")
- Add `calendar.overdue.viewAll` ("Xem chi tiết" / "View details")
- Add `calendar.overdue.modalTitle` ("Sự kiện quá hạn" / "Overdue events")

### 4.5 Move user-visible strings from backend to frontend

Current backend hard-codes Vietnamese in `title`/`description` (e.g. `` `Quá hạn check-in - ${roomName}` ``). This bypasses i18n.

**Refactor:** Backend returns raw data only — `type`, `relatedId`, `roomName`, `tenantName`, `buildingName`, `amount`, `daysOverdue` (new numeric field), `severity`. Frontend composes title/description via `t()` with these as interpolation args, e.g.:

```ts
t('calendar.titles.DEPOSIT_CHECKIN_OVERDUE', { roomName })
// vi: "Quá hạn check-in - {{roomName}}"
// en: "Check-in overdue - {{roomName}}"
```

Benefit: language switch on the frontend no longer requires backend re-fetch.

---

## 5. Migration / rollout

This is a single feature branch — no DB schema changes, no flag, no phased rollout. After merge:
- Existing event IDs that referenced `contract-start-...` / `contract-end-...` won't be regenerated, but events are computed live (not persisted) — no orphan data.
- Frontend `react-query` cache for `calendar-summary` will refresh on next navigation.

---

## 6. Risks & open questions

| Risk | Mitigation |
|---|---|
| Dedupe rule `billingPeriod = (D.month, D.year)` assumes 1-month cycles align with calendar months — may miss for multi-month cycles | Tested in plan via fixture data with `paymentCycleMonths > 1`; if mismatch, fall back to "skip first N PAYMENT_DUE candidates where N = existing invoice count for contract" |
| Removing `CONTRACT_START/END` enum is a public API change | Backend DTO update + frontend type updates land together in same PR; no external API consumers |
| Backend → frontend i18n move increases frontend i18n surface area | Acceptable — backend still owns DTO validation messages |

---

## 7. Acceptance criteria

- Counter on each day cell equals the actual number of events in that day's modal (verified by clicking 5+ random busy days)
- Scrolling 3 months ahead shows the same color/label for a known check-in event as it would at 1 month ahead (no silent re-categorization)
- A contract with a 3-month-old DRAFT status appears in the overdue banner above the grid, regardless of which month the user is viewing
- After creating an invoice for cycle (May 2026) of contract X, the May PAYMENT_DUE event for contract X disappears from the calendar
- `BigCalendar.tsx` shrinks to under 100 lines; backend `calendar.service.ts` shrinks to under 120 lines
- No remaining hard-coded Vietnamese strings in `backend/src/modules/calendar/`
- All 8 event types render correctly in both VN and EN with the new title composition
