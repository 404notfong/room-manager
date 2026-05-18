# Calendar Module Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the dashboard calendar to fix four logic bugs (counter, payment/invoice dedupe, future-month label drift, lost overdue events), redesign the day cell into Google-Calendar-style stacked bars with a redesigned modal, and split the oversized component/service into focused producer-style modules.

**Architecture:** Backend adopts a producer pattern — one producer per event source (contract / invoice / payment-due) plus a thin orchestrator service. Frontend splits `BigCalendar.tsx` into header + grid + day-cell + day-detail-modal + overdue banner + shared event card, backed by a `useCalendarData` hook and a `lib/calendar/` utilities folder. A new `GET /calendar/overdue` endpoint feeds a banner above the grid so old overdues stay visible regardless of viewed month.

**Tech Stack:** Backend — NestJS, Mongoose, Jest (`*.spec.ts`). Frontend — React 18 + TypeScript, Vite, TailwindCSS, TanStack Query, react-i18next, date-fns, Vitest + React Testing Library (already wired but no tests yet).

**Spec reference:** `docs/superpowers/specs/2026-05-18-calendar-refactor-design.md`

---

## File Structure Map

### Backend (new + modified)

```
backend/src/modules/calendar/
├── calendar.controller.ts            (modify — add /overdue)
├── calendar.module.ts                (modify — register producers)
├── calendar.service.ts               (rewrite — orchestrator only, ~80 lines)
├── calendar.service.spec.ts          (new)
├── dto/
│   └── calendar-event.dto.ts         (modify — drop enums, add daysOverdue)
├── producers/
│   ├── contract-events.producer.ts   (new)
│   ├── contract-events.producer.spec.ts (new)
│   ├── invoice-events.producer.ts    (new)
│   ├── invoice-events.producer.spec.ts (new)
│   ├── payment-due.producer.ts       (new)
│   └── payment-due.producer.spec.ts  (new)
└── helpers/
    ├── date-keys.ts                  (new)
    ├── date-keys.spec.ts             (new)
    ├── severity.ts                   (new)
    └── severity.spec.ts              (new)
```

### Frontend (new + modified)

```
frontend/src/api/calendar.ts          (modify — add overdue endpoint, drop CONTRACT_START/END types)

frontend/src/components/dashboard/calendar/
├── BigCalendar.tsx                   (new — orchestrator, ~80 lines)
├── CalendarHeader.tsx                (new)
├── CalendarGrid.tsx                  (new)
├── CalendarDayCell.tsx               (new)
├── CalendarDayDetailModal.tsx        (new)
├── CalendarEventCard.tsx             (new)
├── OverdueBanner.tsx                 (new)
├── OverdueListModal.tsx              (new)
└── hooks/
    └── useCalendarData.ts            (new)

frontend/src/lib/calendar/
├── event-colors.ts                   (new)
├── event-display.ts                  (new)
├── event-display.test.ts             (new)
├── grid-helpers.ts                   (new)
└── grid-helpers.test.ts              (new)

frontend/src/components/dashboard/BigCalendar.tsx    (DELETE after T15)
frontend/src/pages/dashboard/DashboardPage.tsx       (modify — update import path)
frontend/public/locales/{en,vi}/translation.json     (modify — drop CONTRACT_START/END, add overdue keys, retitle PAYMENT_DUE)
```

---

## Tasks

### Task 0: Backend helpers (severity + date-keys)

**Goal:** Pure utility functions extracted with unit tests, before any producer needs them.

**Files:**
- Create: `backend/src/modules/calendar/helpers/date-keys.ts`
- Create: `backend/src/modules/calendar/helpers/date-keys.spec.ts`
- Create: `backend/src/modules/calendar/helpers/severity.ts`
- Create: `backend/src/modules/calendar/helpers/severity.spec.ts`

**Acceptance Criteria:**
- [ ] `toLocalDateKey(date)` returns `YYYY-MM-DD` using local TZ (matches existing behavior in `calendar.service.ts:16-22`)
- [ ] `computeSeverity(daysUntil)` returns `'danger'` when `daysUntil < 0`, `'warning'` when `0 ≤ daysUntil ≤ 7`, `'info'` when `daysUntil > 7`
- [ ] `startOfLocalDay(date)` returns a Date with hours/minutes/seconds/ms zeroed in local TZ
- [ ] `daysBetween(from, to)` returns integer day delta using local-day boundaries (to - from)
- [ ] All four functions have at least one test covering each documented behavior branch

**Verify:** `cd backend && npx jest src/modules/calendar/helpers/ -v` → all tests PASS

**Steps:**

- [ ] **Step 1: Write `date-keys.spec.ts` first (RED)**

```typescript
import { toLocalDateKey, startOfLocalDay, daysBetween } from './date-keys';

describe('toLocalDateKey', () => {
    it('formats date as YYYY-MM-DD using local timezone', () => {
        expect(toLocalDateKey(new Date(2026, 4, 18))).toBe('2026-05-18');
        expect(toLocalDateKey(new Date(2026, 0, 1))).toBe('2026-01-01');
        expect(toLocalDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
    });
});

describe('startOfLocalDay', () => {
    it('zeros hours, minutes, seconds, ms', () => {
        const d = startOfLocalDay(new Date(2026, 4, 18, 23, 59, 59, 999));
        expect(d.getHours()).toBe(0);
        expect(d.getMinutes()).toBe(0);
        expect(d.getSeconds()).toBe(0);
        expect(d.getMilliseconds()).toBe(0);
        expect(d.getDate()).toBe(18);
    });
});

describe('daysBetween', () => {
    it('returns positive delta for future', () => {
        const today = new Date(2026, 4, 18);
        const future = new Date(2026, 4, 25);
        expect(daysBetween(today, future)).toBe(7);
    });
    it('returns negative delta for past', () => {
        const today = new Date(2026, 4, 18);
        const past = new Date(2026, 4, 11);
        expect(daysBetween(today, past)).toBe(-7);
    });
    it('returns 0 for same day even with different times', () => {
        expect(daysBetween(new Date(2026, 4, 18, 0, 0), new Date(2026, 4, 18, 23, 59))).toBe(0);
    });
});
```

- [ ] **Step 2: Implement `date-keys.ts` (GREEN)**

```typescript
/** Convert a Date to 'YYYY-MM-DD' in local timezone. */
export function toLocalDateKey(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Returns a new Date at the start of the local day (00:00:00.000). */
export function startOfLocalDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Returns integer day delta (to - from), using local-day boundaries. */
export function daysBetween(from: Date, to: Date): number {
    const fromDay = startOfLocalDay(from).getTime();
    const toDay = startOfLocalDay(to).getTime();
    return Math.round((toDay - fromDay) / (1000 * 60 * 60 * 24));
}
```

- [ ] **Step 3: Write `severity.spec.ts` (RED)**

```typescript
import { computeSeverity } from './severity';
import { CalendarEventSeverity } from '../dto/calendar-event.dto';

describe('computeSeverity', () => {
    it('returns danger when overdue', () => {
        expect(computeSeverity(-1)).toBe(CalendarEventSeverity.DANGER);
        expect(computeSeverity(-30)).toBe(CalendarEventSeverity.DANGER);
    });
    it('returns warning when within 7 days', () => {
        expect(computeSeverity(0)).toBe(CalendarEventSeverity.WARNING);
        expect(computeSeverity(3)).toBe(CalendarEventSeverity.WARNING);
        expect(computeSeverity(7)).toBe(CalendarEventSeverity.WARNING);
    });
    it('returns info when more than 7 days away', () => {
        expect(computeSeverity(8)).toBe(CalendarEventSeverity.INFO);
        expect(computeSeverity(30)).toBe(CalendarEventSeverity.INFO);
    });
});
```

- [ ] **Step 4: Implement `severity.ts` (GREEN)**

```typescript
import { CalendarEventSeverity } from '../dto/calendar-event.dto';

export function computeSeverity(daysUntil: number): CalendarEventSeverity {
    if (daysUntil < 0) return CalendarEventSeverity.DANGER;
    if (daysUntil <= 7) return CalendarEventSeverity.WARNING;
    return CalendarEventSeverity.INFO;
}
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest src/modules/calendar/helpers/ -v`
Expected: 8+ tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/calendar/helpers/
git commit -m "feat(calendar): add date and severity helper utilities"
```

---

### Task 1: Update CalendarEventDto

**Goal:** Add `daysOverdue?: number`, mark `title` and `description` as optional. Keep enum values for now (drop in T6 after producers stop emitting them).

**Files:**
- Modify: `backend/src/modules/calendar/dto/calendar-event.dto.ts`

**Acceptance Criteria:**
- [ ] `CalendarEventDto.daysOverdue?: number` exists
- [ ] `CalendarEventDto.title?: string` (optional)
- [ ] `CalendarEventDto.description?: string` (optional — already optional but verify)
- [ ] Enum still contains `CONTRACT_START` and `CONTRACT_END` (don't drop yet)
- [ ] `npm run build` in `backend/` succeeds with no type errors

**Verify:** `cd backend && npm run build` → exit 0

**Steps:**

- [ ] **Step 1: Modify the DTO**

Replace the `CalendarEventDto` class in `backend/src/modules/calendar/dto/calendar-event.dto.ts`:

```typescript
export class CalendarEventDto {
    _id: string;
    date: Date;
    type: CalendarEventType;
    title?: string;
    description?: string;
    severity: CalendarEventSeverity;
    relatedId: string;
    relatedType: 'contract' | 'invoice';
    roomName?: string;
    tenantName?: string;
    buildingName?: string;
    amount?: number;
    daysOverdue?: number;
}
```

- [ ] **Step 2: Build to confirm no compilation errors**

Run: `cd backend && npm run build`
Expected: exit 0, no errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/calendar/dto/calendar-event.dto.ts
git commit -m "refactor(calendar): mark title optional and add daysOverdue field"
```

---

### Task 2: Contract events producer

**Goal:** Extract DRAFT check-in + ACTIVE checkout event generation into a dedicated producer. No 7-day window — every in-range event emits the same type with severity computed from proximity. Skip emitting overdue events here (those come from the overdue endpoint in T5).

**Files:**
- Create: `backend/src/modules/calendar/producers/contract-events.producer.ts`
- Create: `backend/src/modules/calendar/producers/contract-events.producer.spec.ts`

**Acceptance Criteria:**
- [ ] `ContractEventsProducer.produce(ownerId, range, buildingId?)` returns `Promise<CalendarEventDto[]>`
- [ ] DRAFT contract with `startDate` in range → emits `DEPOSIT_CHECKIN_DUE` with severity by proximity (`info` >7d, `warning` ≤7d). If `startDate < today` → emits `DEPOSIT_CHECKIN_OVERDUE` only if `startDate` is in range
- [ ] ACTIVE contract with `endDate` in range → emits `ACTIVE_CHECKOUT_DUE` with severity by proximity. If overdue and `endDate` in range → emits `ACTIVE_CHECKOUT_OVERDUE`
- [ ] Filters by `buildingId` when provided
- [ ] Filters out `isDeleted: true` contracts
- [ ] Includes `daysOverdue` field on overdue events
- [ ] Does NOT emit `CONTRACT_START` or `CONTRACT_END`
- [ ] No hard-coded VN strings — populates `roomName`, `tenantName`, `buildingName`, raw data only (no `title` / `description`)

**Verify:** `cd backend && npx jest src/modules/calendar/producers/contract-events.producer.spec.ts -v` → all tests PASS

**Steps:**

- [ ] **Step 1: Write the spec first (RED)**

```typescript
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Contract } from '@modules/contracts/schemas/contract.schema';
import { ContractStatus, ContractType, RoomType } from '@common/constants/enums';
import { ContractEventsProducer } from './contract-events.producer';
import { CalendarEventType, CalendarEventSeverity } from '../dto/calendar-event.dto';

const ownerId = new Types.ObjectId().toString();

function makeContract(overrides: any) {
    return {
        _id: new Types.ObjectId(),
        ownerId: new Types.ObjectId(ownerId),
        status: ContractStatus.ACTIVE,
        contractType: ContractType.LONG_TERM,
        roomType: RoomType.LONG_TERM,
        startDate: new Date('2026-05-01'),
        endDate: new Date('2027-05-01'),
        roomId: { _id: new Types.ObjectId(), roomName: 'P101', buildingId: { _id: new Types.ObjectId(), name: 'Toa A' } },
        tenantId: { _id: new Types.ObjectId(), name: 'Khach 1' },
        ...overrides,
    };
}

describe('ContractEventsProducer', () => {
    let producer: ContractEventsProducer;
    let contractModel: any;

    beforeEach(async () => {
        contractModel = {
            find: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([]),
            }),
        };
        const moduleRef = await Test.createTestingModule({
            providers: [
                ContractEventsProducer,
                { provide: getModelToken(Contract.name), useValue: contractModel },
            ],
        }).compile();
        producer = moduleRef.get(ContractEventsProducer);
    });

    function setContracts(list: any[]) {
        contractModel.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(list),
        });
    }

    const range = { start: new Date('2026-05-01'), end: new Date('2026-05-31T23:59:59Z') };

    it('emits DEPOSIT_CHECKIN_DUE with info severity for DRAFT contract >7d away', async () => {
        const today = new Date('2026-05-01');
        jest.useFakeTimers().setSystemTime(today);

        setContracts([
            makeContract({ status: ContractStatus.DRAFT, startDate: new Date('2026-05-20') }), // 19 days away
        ]);

        const events = await producer.produce(ownerId, range);

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(CalendarEventType.DEPOSIT_CHECKIN_DUE);
        expect(events[0].severity).toBe(CalendarEventSeverity.INFO);
        expect(events[0].roomName).toBe('P101');
        expect(events[0].title).toBeUndefined();
        expect(events[0].description).toBeUndefined();

        jest.useRealTimers();
    });

    it('emits DEPOSIT_CHECKIN_DUE with warning severity for DRAFT contract within 7d', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        setContracts([
            makeContract({ status: ContractStatus.DRAFT, startDate: new Date('2026-05-05') }), // 4 days
        ]);
        const events = await producer.produce(ownerId, range);
        expect(events[0].severity).toBe(CalendarEventSeverity.WARNING);
        jest.useRealTimers();
    });

    it('emits DEPOSIT_CHECKIN_OVERDUE with danger for past DRAFT in range', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-20'));
        setContracts([
            makeContract({ status: ContractStatus.DRAFT, startDate: new Date('2026-05-10') }), // 10 days overdue
        ]);
        const events = await producer.produce(ownerId, range);
        expect(events[0].type).toBe(CalendarEventType.DEPOSIT_CHECKIN_OVERDUE);
        expect(events[0].severity).toBe(CalendarEventSeverity.DANGER);
        expect(events[0].daysOverdue).toBe(10);
        jest.useRealTimers();
    });

    it('does NOT emit CONTRACT_START or CONTRACT_END', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        setContracts([
            makeContract({ status: ContractStatus.DRAFT, startDate: new Date('2026-05-25') }),
            makeContract({ status: ContractStatus.ACTIVE, endDate: new Date('2026-05-30') }),
        ]);
        const events = await producer.produce(ownerId, range);
        const types = events.map(e => e.type);
        expect(types).not.toContain(CalendarEventType.CONTRACT_START);
        expect(types).not.toContain(CalendarEventType.CONTRACT_END);
        jest.useRealTimers();
    });

    it('emits ACTIVE_CHECKOUT_DUE with severity by proximity', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        setContracts([
            makeContract({ status: ContractStatus.ACTIVE, endDate: new Date('2026-05-25') }), // 24 days → info
        ]);
        const events = await producer.produce(ownerId, range);
        expect(events[0].type).toBe(CalendarEventType.ACTIVE_CHECKOUT_DUE);
        expect(events[0].severity).toBe(CalendarEventSeverity.INFO);
        jest.useRealTimers();
    });

    it('filters by buildingId when provided', async () => {
        const matchingBuildingId = new Types.ObjectId();
        const otherBuildingId = new Types.ObjectId();
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        setContracts([
            makeContract({
                status: ContractStatus.DRAFT,
                startDate: new Date('2026-05-10'),
                roomId: { _id: new Types.ObjectId(), roomName: 'P101', buildingId: { _id: matchingBuildingId, name: 'A' } },
            }),
            makeContract({
                status: ContractStatus.DRAFT,
                startDate: new Date('2026-05-10'),
                roomId: { _id: new Types.ObjectId(), roomName: 'P201', buildingId: { _id: otherBuildingId, name: 'B' } },
            }),
        ]);

        const events = await producer.produce(ownerId, range, matchingBuildingId.toString());
        expect(events).toHaveLength(1);
        expect(events[0].roomName).toBe('P101');
        jest.useRealTimers();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail (file doesn't exist yet)**

Run: `cd backend && npx jest src/modules/calendar/producers/contract-events.producer.spec.ts -v`
Expected: All tests FAIL with module-not-found

- [ ] **Step 3: Implement `contract-events.producer.ts`**

```typescript
import { Contract, ContractDocument } from '@modules/contracts/schemas/contract.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContractStatus } from '@common/constants/enums';
import { CalendarEventDto, CalendarEventType, CalendarEventSeverity } from '../dto/calendar-event.dto';
import { startOfLocalDay, daysBetween } from '../helpers/date-keys';
import { computeSeverity } from '../helpers/severity';

@Injectable()
export class ContractEventsProducer {
    constructor(
        @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
    ) {}

    async produce(
        ownerId: string,
        range: { start: Date; end: Date },
        buildingId?: string,
    ): Promise<CalendarEventDto[]> {
        const today = startOfLocalDay(new Date());

        const contracts = await this.contractModel
            .find({
                ownerId: new Types.ObjectId(ownerId),
                isDeleted: { $ne: true },
                status: { $in: [ContractStatus.ACTIVE, ContractStatus.DRAFT] },
                $or: [
                    { startDate: { $gte: range.start, $lte: range.end } },
                    { endDate: { $gte: range.start, $lte: range.end } },
                ],
            })
            .populate({
                path: 'roomId',
                select: 'roomName buildingId',
                populate: { path: 'buildingId', select: 'name' },
            })
            .populate('tenantId', 'name phone')
            .lean();

        const filtered = buildingId
            ? contracts.filter((c: any) => c.roomId?.buildingId?._id?.toString() === buildingId)
            : contracts;

        const events: CalendarEventDto[] = [];

        for (const contract of filtered as any[]) {
            const room = contract.roomId;
            const tenant = contract.tenantId;
            const meta = {
                roomName: room?.roomName,
                tenantName: tenant?.name,
                buildingName: room?.buildingId?.name,
            };

            if (contract.status === ContractStatus.DRAFT && contract.startDate) {
                const startDate = new Date(contract.startDate);
                if (startDate >= range.start && startDate <= range.end) {
                    const days = daysBetween(today, startDate);
                    const isOverdue = days < 0;
                    events.push({
                        _id: isOverdue
                            ? `deposit-checkin-overdue-${contract._id}`
                            : `deposit-checkin-due-${contract._id}`,
                        date: startDate,
                        type: isOverdue
                            ? CalendarEventType.DEPOSIT_CHECKIN_OVERDUE
                            : CalendarEventType.DEPOSIT_CHECKIN_DUE,
                        severity: isOverdue ? CalendarEventSeverity.DANGER : computeSeverity(days),
                        relatedId: contract._id.toString(),
                        relatedType: 'contract',
                        ...(isOverdue ? { daysOverdue: Math.abs(days) } : {}),
                        ...meta,
                    });
                }
            }

            if (contract.status === ContractStatus.ACTIVE && contract.endDate) {
                const endDate = new Date(contract.endDate);
                if (endDate >= range.start && endDate <= range.end) {
                    const days = daysBetween(today, endDate);
                    const isOverdue = days < 0;
                    events.push({
                        _id: isOverdue
                            ? `active-checkout-overdue-${contract._id}`
                            : `active-checkout-due-${contract._id}`,
                        date: endDate,
                        type: isOverdue
                            ? CalendarEventType.ACTIVE_CHECKOUT_OVERDUE
                            : CalendarEventType.ACTIVE_CHECKOUT_DUE,
                        severity: isOverdue ? CalendarEventSeverity.DANGER : computeSeverity(days),
                        relatedId: contract._id.toString(),
                        relatedType: 'contract',
                        ...(isOverdue ? { daysOverdue: Math.abs(days) } : {}),
                        ...meta,
                    });
                }
            }
        }

        return events;
    }
}
```

- [ ] **Step 4: Run tests until they pass (GREEN)**

Run: `cd backend && npx jest src/modules/calendar/producers/contract-events.producer.spec.ts -v`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/calendar/producers/contract-events.producer.ts backend/src/modules/calendar/producers/contract-events.producer.spec.ts
git commit -m "feat(calendar): add ContractEventsProducer with severity by proximity"
```

---

### Task 3: Invoice events producer

**Goal:** Extract invoice due/overdue events into a dedicated producer.

**Files:**
- Create: `backend/src/modules/calendar/producers/invoice-events.producer.ts`
- Create: `backend/src/modules/calendar/producers/invoice-events.producer.spec.ts`

**Acceptance Criteria:**
- [ ] `InvoiceEventsProducer.produce(ownerId, range, buildingId?)` returns `Promise<CalendarEventDto[]>`
- [ ] Emits `INVOICE_DUE` when `dueDate >= today && remainingAmount > 0` and dueDate in range
- [ ] Emits `INVOICE_OVERDUE` when `dueDate < today && remainingAmount > 0` and dueDate in range
- [ ] Severity follows proximity rules from `computeSeverity` for INVOICE_DUE; DANGER for INVOICE_OVERDUE
- [ ] Filters by `buildingId` when provided; excludes `isDeleted`
- [ ] Only includes invoices with status `PENDING`, `PARTIAL`, or `OVERDUE`
- [ ] No hard-coded VN strings

**Verify:** `cd backend && npx jest src/modules/calendar/producers/invoice-events.producer.spec.ts -v` → all tests PASS

**Steps:**

- [ ] **Step 1: Write spec (RED)**

```typescript
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Invoice } from '@modules/invoices/schemas/invoice.schema';
import { InvoiceEventsProducer } from './invoice-events.producer';
import { CalendarEventType, CalendarEventSeverity } from '../dto/calendar-event.dto';

const ownerId = new Types.ObjectId().toString();

function makeInvoice(overrides: any) {
    return {
        _id: new Types.ObjectId(),
        dueDate: new Date('2026-05-10'),
        remainingAmount: 1500000,
        status: 'PENDING',
        roomId: { _id: new Types.ObjectId(), name: 'P101', buildingId: { _id: new Types.ObjectId(), name: 'Toa A' } },
        tenantId: { _id: new Types.ObjectId(), name: 'Khach 1' },
        ...overrides,
    };
}

describe('InvoiceEventsProducer', () => {
    let producer: InvoiceEventsProducer;
    let invoiceModel: any;

    beforeEach(async () => {
        invoiceModel = {
            find: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([]),
            }),
        };
        const moduleRef = await Test.createTestingModule({
            providers: [
                InvoiceEventsProducer,
                { provide: getModelToken(Invoice.name), useValue: invoiceModel },
            ],
        }).compile();
        producer = moduleRef.get(InvoiceEventsProducer);
    });

    function setInvoices(list: any[]) {
        invoiceModel.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(list),
        });
    }

    const range = { start: new Date('2026-05-01'), end: new Date('2026-05-31T23:59:59Z') };

    it('emits INVOICE_DUE for future dueDate in range', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-05'));
        setInvoices([makeInvoice({ dueDate: new Date('2026-05-20') })]);
        const events = await producer.produce(ownerId, range);
        expect(events[0].type).toBe(CalendarEventType.INVOICE_DUE);
        expect(events[0].severity).toBe(CalendarEventSeverity.INFO);
        expect(events[0].amount).toBe(1500000);
        jest.useRealTimers();
    });

    it('emits INVOICE_OVERDUE with daysOverdue for past dueDate', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-20'));
        setInvoices([makeInvoice({ dueDate: new Date('2026-05-10') })]);
        const events = await producer.produce(ownerId, range);
        expect(events[0].type).toBe(CalendarEventType.INVOICE_OVERDUE);
        expect(events[0].severity).toBe(CalendarEventSeverity.DANGER);
        expect(events[0].daysOverdue).toBe(10);
        jest.useRealTimers();
    });

    it('filters by buildingId', async () => {
        const target = new Types.ObjectId();
        const other = new Types.ObjectId();
        setInvoices([
            makeInvoice({ roomId: { _id: new Types.ObjectId(), name: 'P101', buildingId: { _id: target, name: 'A' } } }),
            makeInvoice({ roomId: { _id: new Types.ObjectId(), name: 'P201', buildingId: { _id: other, name: 'B' } } }),
        ]);
        const events = await producer.produce(ownerId, range, target.toString());
        expect(events).toHaveLength(1);
        expect(events[0].roomName).toBe('P101');
    });
});
```

- [ ] **Step 2: Implement `invoice-events.producer.ts`**

```typescript
import { Invoice, InvoiceDocument } from '@modules/invoices/schemas/invoice.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CalendarEventDto, CalendarEventType, CalendarEventSeverity } from '../dto/calendar-event.dto';
import { startOfLocalDay, daysBetween } from '../helpers/date-keys';
import { computeSeverity } from '../helpers/severity';

@Injectable()
export class InvoiceEventsProducer {
    constructor(
        @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    ) {}

    async produce(
        ownerId: string,
        range: { start: Date; end: Date },
        buildingId?: string,
    ): Promise<CalendarEventDto[]> {
        const today = startOfLocalDay(new Date());

        const invoices = await this.invoiceModel
            .find({
                ownerId: new Types.ObjectId(ownerId),
                isDeleted: { $ne: true },
                dueDate: { $gte: range.start, $lte: range.end },
                status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
            })
            .populate({
                path: 'roomId',
                select: 'name roomName buildingId',
                populate: { path: 'buildingId', select: 'name' },
            })
            .populate('tenantId', 'name phone')
            .lean();

        const filtered = buildingId
            ? invoices.filter((i: any) => i.roomId?.buildingId?._id?.toString() === buildingId)
            : invoices;

        return (filtered as any[])
            .filter((inv) => (inv.remainingAmount ?? 0) > 0)
            .map((invoice) => {
                const room = invoice.roomId;
                const tenant = invoice.tenantId;
                const dueDate = new Date(invoice.dueDate);
                const days = daysBetween(today, dueDate);
                const isOverdue = days < 0;

                return {
                    _id: `invoice-${invoice._id}`,
                    date: dueDate,
                    type: isOverdue ? CalendarEventType.INVOICE_OVERDUE : CalendarEventType.INVOICE_DUE,
                    severity: isOverdue ? CalendarEventSeverity.DANGER : computeSeverity(days),
                    relatedId: invoice._id.toString(),
                    relatedType: 'invoice' as const,
                    roomName: room?.roomName || room?.name,
                    tenantName: tenant?.name,
                    buildingName: room?.buildingId?.name,
                    amount: invoice.remainingAmount,
                    ...(isOverdue ? { daysOverdue: Math.abs(days) } : {}),
                };
            });
    }
}
```

- [ ] **Step 3: Run tests (GREEN)**

Run: `cd backend && npx jest src/modules/calendar/producers/invoice-events.producer.spec.ts -v`
Expected: All 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/calendar/producers/invoice-events.producer.ts backend/src/modules/calendar/producers/invoice-events.producer.spec.ts
git commit -m "feat(calendar): add InvoiceEventsProducer"
```

---

### Task 4: Payment-due producer with invoice dedupe

**Goal:** Generate `PAYMENT_DUE` reminders from ACTIVE long-term contracts, BUT suppress any candidate when a non-deleted invoice already exists for that (contractId, billingPeriod).

**Files:**
- Create: `backend/src/modules/calendar/producers/payment-due.producer.ts`
- Create: `backend/src/modules/calendar/producers/payment-due.producer.spec.ts`

**Acceptance Criteria:**
- [ ] `PaymentDueProducer.produce(ownerId, range, buildingId?)` returns `Promise<CalendarEventDto[]>`
- [ ] Generates payment dates from `contract.startDate + N * paymentCycleMonths`, clamping `paymentDueDay` to last day of month
- [ ] First payment date is `>= contractStart + paymentCycleMonths`
- [ ] For each candidate, looks up invoices with `{contractId, billingPeriod.month: paymentDate.month, billingPeriod.year: paymentDate.year}`. If found → suppress
- [ ] Emits `PAYMENT_DUE` (severity by proximity) for future / today candidates, `PAYMENT_DUE_OVERDUE` (DANGER) for past
- [ ] Uses a single batched invoice query (not N+1)
- [ ] Filters by `buildingId`; excludes `isDeleted` contracts

**Verify:** `cd backend && npx jest src/modules/calendar/producers/payment-due.producer.spec.ts -v` → all tests PASS

**Steps:**

- [ ] **Step 1: Write spec (RED)**

```typescript
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Contract } from '@modules/contracts/schemas/contract.schema';
import { Invoice } from '@modules/invoices/schemas/invoice.schema';
import { ContractStatus, ContractType, RoomType } from '@common/constants/enums';
import { PaymentDueProducer } from './payment-due.producer';
import { CalendarEventType, CalendarEventSeverity } from '../dto/calendar-event.dto';

const ownerId = new Types.ObjectId().toString();

function makeContract(overrides: any) {
    return {
        _id: new Types.ObjectId(),
        ownerId: new Types.ObjectId(ownerId),
        status: ContractStatus.ACTIVE,
        contractType: ContractType.LONG_TERM,
        roomType: RoomType.LONG_TERM,
        startDate: new Date('2026-01-01'),
        rentPrice: 3000000,
        paymentCycleMonths: 1,
        paymentDueDay: 5,
        roomId: { _id: new Types.ObjectId(), roomName: 'P101', buildingId: { _id: new Types.ObjectId(), name: 'A' } },
        tenantId: { _id: new Types.ObjectId(), name: 'Khach 1' },
        ...overrides,
    };
}

describe('PaymentDueProducer', () => {
    let producer: PaymentDueProducer;
    let contractModel: any;
    let invoiceModel: any;

    beforeEach(async () => {
        contractModel = {
            find: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([]),
            }),
        };
        invoiceModel = {
            find: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([]),
            }),
        };
        const moduleRef = await Test.createTestingModule({
            providers: [
                PaymentDueProducer,
                { provide: getModelToken(Contract.name), useValue: contractModel },
                { provide: getModelToken(Invoice.name), useValue: invoiceModel },
            ],
        }).compile();
        producer = moduleRef.get(PaymentDueProducer);
    });

    function setContracts(list: any[]) {
        contractModel.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(list),
        });
    }
    function setInvoices(list: any[]) {
        invoiceModel.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(list),
        });
    }

    const may = { start: new Date('2026-05-01'), end: new Date('2026-05-31T23:59:59Z') };

    it('emits PAYMENT_DUE on payDay of cycle months when no invoice exists', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        setContracts([makeContract({})]);
        const events = await producer.produce(ownerId, may);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(CalendarEventType.PAYMENT_DUE);
        expect(events[0].date.getDate()).toBe(5); // payDay
        expect(events[0].date.getMonth()).toBe(4); // May
        jest.useRealTimers();
    });

    it('suppresses PAYMENT_DUE when invoice exists for (contract, month, year)', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        const contract = makeContract({});
        setContracts([contract]);
        setInvoices([{ contractId: contract._id, billingPeriod: { month: 5, year: 2026 } }]);
        const events = await producer.produce(ownerId, may);
        expect(events).toHaveLength(0);
        jest.useRealTimers();
    });

    it('emits PAYMENT_DUE_OVERDUE with DANGER for past payDay still unpaid', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-20'));
        setContracts([makeContract({})]);
        const events = await producer.produce(ownerId, may);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(CalendarEventType.PAYMENT_DUE_OVERDUE);
        expect(events[0].severity).toBe(CalendarEventSeverity.DANGER);
        jest.useRealTimers();
    });

    it('respects multi-month cycle (cycleMonths=3 skips 2 months between dues)', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-01-01'));
        const contract = makeContract({
            startDate: new Date('2026-01-01'),
            paymentCycleMonths: 3,
            paymentDueDay: 1,
        });
        setContracts([contract]);
        const sixMonths = { start: new Date('2026-01-01'), end: new Date('2026-12-31T23:59:59Z') };
        const events = await producer.produce(ownerId, sixMonths);
        const dates = events.map(e => `${e.date.getFullYear()}-${e.date.getMonth() + 1}`);
        expect(dates).toEqual(['2026-4', '2026-7', '2026-10']);
        jest.useRealTimers();
    });

    it('clamps payDay to last day of month for short months', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-02-01'));
        setContracts([makeContract({
            startDate: new Date('2026-01-01'),
            paymentDueDay: 31,
        })]);
        const feb = { start: new Date('2026-02-01'), end: new Date('2026-02-28T23:59:59Z') };
        const events = await producer.produce(ownerId, feb);
        expect(events[0].date.getDate()).toBe(28);
        jest.useRealTimers();
    });
});
```

- [ ] **Step 2: Implement `payment-due.producer.ts`**

```typescript
import { Contract, ContractDocument } from '@modules/contracts/schemas/contract.schema';
import { Invoice, InvoiceDocument } from '@modules/invoices/schemas/invoice.schema';
import { ContractStatus, ContractType, RoomType } from '@common/constants/enums';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CalendarEventDto, CalendarEventType, CalendarEventSeverity } from '../dto/calendar-event.dto';
import { startOfLocalDay, daysBetween } from '../helpers/date-keys';
import { computeSeverity } from '../helpers/severity';

@Injectable()
export class PaymentDueProducer {
    constructor(
        @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
        @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    ) {}

    async produce(
        ownerId: string,
        range: { start: Date; end: Date },
        buildingId?: string,
    ): Promise<CalendarEventDto[]> {
        const today = startOfLocalDay(new Date());

        const contracts = await this.contractModel
            .find({
                ownerId: new Types.ObjectId(ownerId),
                isDeleted: { $ne: true },
                status: ContractStatus.ACTIVE,
                $or: [
                    { contractType: ContractType.LONG_TERM },
                    { roomType: RoomType.LONG_TERM },
                ],
            })
            .populate({
                path: 'roomId',
                select: 'roomName buildingId',
                populate: { path: 'buildingId', select: 'name' },
            })
            .populate('tenantId', 'name phone')
            .lean();

        const filteredContracts = buildingId
            ? contracts.filter((c: any) => c.roomId?.buildingId?._id?.toString() === buildingId)
            : contracts;

        if (filteredContracts.length === 0) return [];

        const contractIds = filteredContracts.map((c: any) => c._id);
        const existingInvoices = await this.invoiceModel
            .find({
                contractId: { $in: contractIds },
                isDeleted: { $ne: true },
            })
            .select('contractId billingPeriod')
            .lean();

        const invoiceKeys = new Set<string>();
        for (const inv of existingInvoices as any[]) {
            invoiceKeys.add(`${inv.contractId}:${inv.billingPeriod.year}:${inv.billingPeriod.month}`);
        }

        const events: CalendarEventDto[] = [];

        for (const contract of filteredContracts as any[]) {
            const room = contract.roomId;
            const tenant = contract.tenantId;
            const cycleMonths = contract.paymentCycleMonths || 1;
            const payDay = contract.paymentDueDay || 1;
            const contractStart = new Date(contract.startDate);

            const firstYear = contractStart.getFullYear();
            const firstMonth = contractStart.getMonth() + cycleMonths;
            const cursor = new Date(firstYear, firstMonth, 1);

            const maxIterations = 240;
            let i = 0;

            while (cursor <= range.end && i < maxIterations) {
                i++;
                const year = cursor.getFullYear();
                const month = cursor.getMonth();
                const lastDay = new Date(year, month + 1, 0).getDate();
                const clampedDay = Math.min(payDay, lastDay);
                const paymentDate = new Date(year, month, clampedDay);

                if (paymentDate >= range.start && paymentDate <= range.end) {
                    const billingMonth = month + 1;
                    const key = `${contract._id}:${year}:${billingMonth}`;
                    const invoiceExists = invoiceKeys.has(key);

                    if (!invoiceExists) {
                        const days = daysBetween(today, paymentDate);
                        const isOverdue = days < 0;
                        events.push({
                            _id: `payment-${contract._id}-${year}-${billingMonth}`,
                            date: paymentDate,
                            type: isOverdue ? CalendarEventType.PAYMENT_DUE_OVERDUE : CalendarEventType.PAYMENT_DUE,
                            severity: isOverdue ? CalendarEventSeverity.DANGER : computeSeverity(days),
                            relatedId: contract._id.toString(),
                            relatedType: 'contract',
                            roomName: room?.roomName,
                            tenantName: tenant?.name,
                            buildingName: room?.buildingId?.name,
                            amount: contract.rentPrice,
                            ...(isOverdue ? { daysOverdue: Math.abs(days) } : {}),
                        });
                    }
                }

                cursor.setMonth(cursor.getMonth() + cycleMonths);
            }
        }

        return events;
    }
}
```

- [ ] **Step 3: Run tests until GREEN**

Run: `cd backend && npx jest src/modules/calendar/producers/payment-due.producer.spec.ts -v`
Expected: All 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/calendar/producers/payment-due.producer.ts backend/src/modules/calendar/producers/payment-due.producer.spec.ts
git commit -m "feat(calendar): add PaymentDueProducer with invoice-existence dedupe"
```

---

### Task 5: Calendar service orchestrator + module wiring + overdue endpoint

**Goal:** Replace the 511-line `calendar.service.ts` with a thin orchestrator that calls the three producers. Add `getOverdue` method. Wire producers into the module. Add `/overdue` endpoint to the controller.

**Files:**
- Modify: `backend/src/modules/calendar/calendar.service.ts` (rewrite)
- Modify: `backend/src/modules/calendar/calendar.module.ts`
- Modify: `backend/src/modules/calendar/calendar.controller.ts`
- Create: `backend/src/modules/calendar/calendar.service.spec.ts`

**Acceptance Criteria:**
- [ ] `calendar.service.ts` is < 120 lines
- [ ] `CalendarService` has methods `getEventsInRange`, `getEventsByDay`, `getMonthSummary`, `getOverdue` — all sorted by date asc except getOverdue (by date desc)
- [ ] `getOverdue` queries all producers with an open-ended range from `new Date(0)` to `today` and returns only events with `severity === DANGER` (i.e., the *_OVERDUE types)
- [ ] `getMonthSummary` aggregates counts per day per type, with the SAME shape as before (backward-compatible)
- [ ] `CalendarController` exposes `GET /calendar/overdue?buildingId=...`
- [ ] `CalendarModule` registers `ContractEventsProducer`, `InvoiceEventsProducer`, `PaymentDueProducer` as providers
- [ ] `npm run build` succeeds
- [ ] All existing calendar tests still pass

**Verify:** `cd backend && npm run build && npx jest src/modules/calendar/ -v` → exit 0, all PASS

**Steps:**

- [ ] **Step 1: Write spec for new orchestrator**

Create `backend/src/modules/calendar/calendar.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { ContractEventsProducer } from './producers/contract-events.producer';
import { InvoiceEventsProducer } from './producers/invoice-events.producer';
import { PaymentDueProducer } from './producers/payment-due.producer';
import { CalendarEventType, CalendarEventSeverity } from './dto/calendar-event.dto';

describe('CalendarService', () => {
    let service: CalendarService;
    let contractProducer: jest.Mocked<ContractEventsProducer>;
    let invoiceProducer: jest.Mocked<InvoiceEventsProducer>;
    let paymentProducer: jest.Mocked<PaymentDueProducer>;

    beforeEach(async () => {
        contractProducer = { produce: jest.fn().mockResolvedValue([]) } as any;
        invoiceProducer = { produce: jest.fn().mockResolvedValue([]) } as any;
        paymentProducer = { produce: jest.fn().mockResolvedValue([]) } as any;

        const moduleRef = await Test.createTestingModule({
            providers: [
                CalendarService,
                { provide: ContractEventsProducer, useValue: contractProducer },
                { provide: InvoiceEventsProducer, useValue: invoiceProducer },
                { provide: PaymentDueProducer, useValue: paymentProducer },
            ],
        }).compile();
        service = moduleRef.get(CalendarService);
    });

    it('aggregates events from all three producers sorted by date asc', async () => {
        contractProducer.produce.mockResolvedValue([
            { _id: 'c1', date: new Date('2026-05-20'), type: CalendarEventType.DEPOSIT_CHECKIN_DUE, severity: CalendarEventSeverity.INFO } as any,
        ]);
        invoiceProducer.produce.mockResolvedValue([
            { _id: 'i1', date: new Date('2026-05-10'), type: CalendarEventType.INVOICE_DUE, severity: CalendarEventSeverity.INFO } as any,
        ]);
        paymentProducer.produce.mockResolvedValue([
            { _id: 'p1', date: new Date('2026-05-15'), type: CalendarEventType.PAYMENT_DUE, severity: CalendarEventSeverity.INFO } as any,
        ]);

        const events = await service.getEventsInRange('o1', new Date('2026-05-01'), new Date('2026-05-31'));
        expect(events.map(e => e._id)).toEqual(['i1', 'p1', 'c1']);
    });

    it('getOverdue returns only DANGER events sorted by date desc', async () => {
        contractProducer.produce.mockResolvedValue([
            { _id: 'a', date: new Date('2026-03-01'), severity: CalendarEventSeverity.DANGER } as any,
            { _id: 'b', date: new Date('2026-04-01'), severity: CalendarEventSeverity.INFO } as any,
        ]);
        invoiceProducer.produce.mockResolvedValue([
            { _id: 'c', date: new Date('2026-01-01'), severity: CalendarEventSeverity.DANGER } as any,
        ]);
        paymentProducer.produce.mockResolvedValue([]);

        const events = await service.getOverdue('o1');
        expect(events.map(e => e._id)).toEqual(['a', 'c']);
    });

    it('getMonthSummary returns day-keyed counts per type', async () => {
        invoiceProducer.produce.mockResolvedValue([
            { _id: 'i1', date: new Date(2026, 4, 15), type: CalendarEventType.INVOICE_DUE, severity: CalendarEventSeverity.INFO } as any,
            { _id: 'i2', date: new Date(2026, 4, 15), type: CalendarEventType.INVOICE_DUE, severity: CalendarEventSeverity.INFO } as any,
        ]);

        const summary = await service.getMonthSummary('o1', 2026, 5);
        expect(summary.totalEvents).toBe(2);
        expect(summary.days['2026-05-15'][CalendarEventType.INVOICE_DUE]).toBe(2);
    });
});
```

- [ ] **Step 2: Rewrite `calendar.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import {
    CalendarDayEventsDto,
    CalendarEventDto,
    CalendarEventSeverity,
    CalendarEventType,
    CalendarMonthSummaryDto,
} from './dto/calendar-event.dto';
import { ContractEventsProducer } from './producers/contract-events.producer';
import { InvoiceEventsProducer } from './producers/invoice-events.producer';
import { PaymentDueProducer } from './producers/payment-due.producer';
import { toLocalDateKey } from './helpers/date-keys';

const ALL_EVENT_TYPES: CalendarEventType[] = [
    CalendarEventType.DEPOSIT_CHECKIN_DUE,
    CalendarEventType.DEPOSIT_CHECKIN_OVERDUE,
    CalendarEventType.ACTIVE_CHECKOUT_DUE,
    CalendarEventType.ACTIVE_CHECKOUT_OVERDUE,
    CalendarEventType.INVOICE_DUE,
    CalendarEventType.INVOICE_OVERDUE,
    CalendarEventType.PAYMENT_DUE,
    CalendarEventType.PAYMENT_DUE_OVERDUE,
];

@Injectable()
export class CalendarService {
    constructor(
        private readonly contractProducer: ContractEventsProducer,
        private readonly invoiceProducer: InvoiceEventsProducer,
        private readonly paymentProducer: PaymentDueProducer,
    ) {}

    async getEventsInRange(
        ownerId: string,
        start: Date,
        end: Date,
        buildingId?: string,
    ): Promise<CalendarEventDto[]> {
        const range = { start, end };
        const [contractEvents, invoiceEvents, paymentEvents] = await Promise.all([
            this.contractProducer.produce(ownerId, range, buildingId),
            this.invoiceProducer.produce(ownerId, range, buildingId),
            this.paymentProducer.produce(ownerId, range, buildingId),
        ]);

        const events = [...contractEvents, ...invoiceEvents, ...paymentEvents];
        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return events;
    }

    async getEventsByDay(
        ownerId: string,
        date: Date,
        buildingId?: string,
    ): Promise<CalendarDayEventsDto> {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        const events = await this.getEventsInRange(ownerId, start, end, buildingId);
        return { date: toLocalDateKey(date), events };
    }

    async getMonthSummary(
        ownerId: string,
        year: number,
        month: number,
        buildingId?: string,
    ): Promise<CalendarMonthSummaryDto> {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        const events = await this.getEventsInRange(ownerId, start, end, buildingId);

        const days: Record<string, Record<CalendarEventType, number>> = {};
        for (const event of events) {
            const key = toLocalDateKey(new Date(event.date));
            if (!days[key]) {
                days[key] = ALL_EVENT_TYPES.reduce(
                    (acc, t) => ({ ...acc, [t]: 0 }),
                    {} as Record<CalendarEventType, number>,
                );
            }
            days[key][event.type]++;
        }
        return { days, totalEvents: events.length };
    }

    async getOverdue(ownerId: string, buildingId?: string): Promise<CalendarEventDto[]> {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const wideRange = { start: new Date(0), end: today };

        const [contractEvents, invoiceEvents, paymentEvents] = await Promise.all([
            this.contractProducer.produce(ownerId, wideRange, buildingId),
            this.invoiceProducer.produce(ownerId, wideRange, buildingId),
            this.paymentProducer.produce(ownerId, wideRange, buildingId),
        ]);

        const all = [...contractEvents, ...invoiceEvents, ...paymentEvents]
            .filter((e) => e.severity === CalendarEventSeverity.DANGER);
        all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return all;
    }
}
```

- [ ] **Step 3: Wire module**

Replace `backend/src/modules/calendar/calendar.module.ts`:

```typescript
import { Contract, ContractSchema } from '@modules/contracts/schemas/contract.schema';
import { Invoice, InvoiceSchema } from '@modules/invoices/schemas/invoice.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { ContractEventsProducer } from './producers/contract-events.producer';
import { InvoiceEventsProducer } from './producers/invoice-events.producer';
import { PaymentDueProducer } from './producers/payment-due.producer';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Contract.name, schema: ContractSchema },
            { name: Invoice.name, schema: InvoiceSchema },
        ]),
    ],
    controllers: [CalendarController],
    providers: [
        CalendarService,
        ContractEventsProducer,
        InvoiceEventsProducer,
        PaymentDueProducer,
    ],
    exports: [CalendarService],
})
export class CalendarModule {}
```

- [ ] **Step 4: Add /overdue endpoint to controller**

Add to `backend/src/modules/calendar/calendar.controller.ts` after the existing endpoints (before the closing `}`):

```typescript
    /**
     * Get all currently overdue events
     * GET /calendar/overdue?buildingId=
     */
    @Get('overdue')
    async getOverdue(
        @Query('buildingId') buildingId: string,
        @Req() req: any,
    ) {
        const ownerId = req.user.userId;
        return this.calendarService.getOverdue(ownerId, buildingId);
    }
```

- [ ] **Step 5: Run service spec + build**

Run: `cd backend && npx jest src/modules/calendar/calendar.service.spec.ts -v && npm run build`
Expected: tests PASS, build exit 0

- [ ] **Step 6: Run full calendar test suite**

Run: `cd backend && npx jest src/modules/calendar/ -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/calendar/
git commit -m "refactor(calendar): split service into producer pattern + add /overdue endpoint"
```

---

### Task 6: Drop CONTRACT_START / CONTRACT_END from enum + i18n

**Goal:** Now that no producer emits these types, remove them from the DTO enum and from both i18n locales. Also retitle `PAYMENT_DUE` per spec.

**Files:**
- Modify: `backend/src/modules/calendar/dto/calendar-event.dto.ts`
- Modify: `frontend/public/locales/vi/translation.json`
- Modify: `frontend/public/locales/en/translation.json`

**Acceptance Criteria:**
- [ ] `CalendarEventType` enum no longer contains `CONTRACT_START` or `CONTRACT_END`
- [ ] `calendar.eventTypes.CONTRACT_START` and `calendar.eventTypes.CONTRACT_END` removed from both locale files
- [ ] `calendar.eventTypes.PAYMENT_DUE` reworded: VN → "Tới kỳ thu — tạo hóa đơn", EN → "Collection cycle — create invoice"
- [ ] New i18n keys added (VN/EN):
  - `calendar.overdue.bannerCount` — "Bạn có {{count}} sự kiện quá hạn" / "You have {{count}} overdue events"
  - `calendar.overdue.viewAll` — "Xem chi tiết" / "View details"
  - `calendar.overdue.modalTitle` — "Sự kiện quá hạn" / "Overdue events"
  - `calendar.daysOverdueShort` — "Quá {{days}} ngày" / "{{days}} days overdue"
  - `calendar.eventCount` — "{{count}} sự kiện" / "{{count}} events"
  - `calendar.shortLabels.*` for each of the 8 remaining event types (short room-cell labels), e.g. `DEPOSIT_CHECKIN_DUE` → "Check-in", `INVOICE_OVERDUE` → "Hóa đơn quá hạn"
- [ ] `npm run build` (backend) succeeds
- [ ] `npm run build` (frontend) — only fails on uses of `CONTRACT_START/END` in `BigCalendar.tsx` / `calendar.ts` (fixed in T7-T15); document this is expected

**Verify:** `cd backend && npm run build` → exit 0. Frontend build skipped until T15.

**Steps:**

- [ ] **Step 1: Update DTO**

Edit `backend/src/modules/calendar/dto/calendar-event.dto.ts` — replace the enum:

```typescript
export enum CalendarEventType {
    DEPOSIT_CHECKIN_DUE = 'DEPOSIT_CHECKIN_DUE',
    DEPOSIT_CHECKIN_OVERDUE = 'DEPOSIT_CHECKIN_OVERDUE',
    ACTIVE_CHECKOUT_DUE = 'ACTIVE_CHECKOUT_DUE',
    ACTIVE_CHECKOUT_OVERDUE = 'ACTIVE_CHECKOUT_OVERDUE',
    INVOICE_DUE = 'INVOICE_DUE',
    INVOICE_OVERDUE = 'INVOICE_OVERDUE',
    PAYMENT_DUE = 'PAYMENT_DUE',
    PAYMENT_DUE_OVERDUE = 'PAYMENT_DUE_OVERDUE',
}
```

- [ ] **Step 2: Update VN locale**

Edit `frontend/public/locales/vi/translation.json` — replace the `calendar` block (lines 1074-1101) with:

```json
    "calendar": {
        "title": "Lịch",
        "subtitle": "Xem lịch các sự kiện quan trọng",
        "noEvents": "Không có sự kiện",
        "eventCount": "{{count}} sự kiện",
        "today": "Hôm nay",
        "viewDay": "Xem chi tiết",
        "viewContract": "Xem hợp đồng",
        "viewInvoice": "Xem hóa đơn",
        "eventTypes": {
            "DEPOSIT_CHECKIN_DUE": "Sắp check-in",
            "DEPOSIT_CHECKIN_OVERDUE": "Quá hạn check-in",
            "ACTIVE_CHECKOUT_DUE": "Sắp checkout",
            "ACTIVE_CHECKOUT_OVERDUE": "Quá hạn checkout",
            "INVOICE_DUE": "Hóa đơn đến hạn",
            "INVOICE_OVERDUE": "Hóa đơn quá hạn",
            "PAYMENT_DUE": "Tới kỳ thu — tạo hóa đơn",
            "PAYMENT_DUE_OVERDUE": "Quá hạn thanh toán"
        },
        "shortLabels": {
            "DEPOSIT_CHECKIN_DUE": "Check-in",
            "DEPOSIT_CHECKIN_OVERDUE": "Check-in quá hạn",
            "ACTIVE_CHECKOUT_DUE": "Checkout",
            "ACTIVE_CHECKOUT_OVERDUE": "Checkout quá hạn",
            "INVOICE_DUE": "Hóa đơn đến hạn",
            "INVOICE_OVERDUE": "Hóa đơn quá hạn",
            "PAYMENT_DUE": "Tới kỳ thu",
            "PAYMENT_DUE_OVERDUE": "Quá hạn thanh toán"
        },
        "daysLeft": "Còn {{days}} ngày",
        "overdueDays": "Quá hạn {{days}} ngày",
        "daysOverdueShort": "Quá {{days}} ngày",
        "amount": "Số tiền",
        "loadingEvents": "Đang tải sự kiện",
        "noEventsShort": "Không có lịch",
        "noEventsTitle": "Không có sự kiện",
        "overdue": {
            "bannerCount": "Bạn có {{count}} sự kiện quá hạn",
            "viewAll": "Xem chi tiết",
            "modalTitle": "Sự kiện quá hạn"
        }
    },
```

- [ ] **Step 3: Update EN locale**

Edit `frontend/public/locales/en/translation.json` — locate the `calendar` block and replace with the equivalent EN translations. Apply the same structure as VN with EN strings (e.g., `"DEPOSIT_CHECKIN_DUE": "Check-in upcoming"`, `"PAYMENT_DUE": "Collection cycle — create invoice"`, `"overdue.bannerCount": "You have {{count}} overdue events"`).

- [ ] **Step 4: Build backend**

Run: `cd backend && npm run build`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/calendar/dto/calendar-event.dto.ts frontend/public/locales/
git commit -m "refactor(calendar): drop CONTRACT_START/END enum + retitle PAYMENT_DUE"
```

---

### Task 7: Frontend lib utilities (event-colors, event-display, grid-helpers)

**Goal:** Centralize the EVENT_COLORS map, event-display label composition, and month-grid building logic into `lib/calendar/`. Unit-test the pure ones.

**Files:**
- Create: `frontend/src/lib/calendar/event-colors.ts`
- Create: `frontend/src/lib/calendar/event-display.ts`
- Create: `frontend/src/lib/calendar/event-display.test.ts`
- Create: `frontend/src/lib/calendar/grid-helpers.ts`
- Create: `frontend/src/lib/calendar/grid-helpers.test.ts`
- Modify: `frontend/src/api/calendar.ts` — drop `CONTRACT_START | CONTRACT_END` from the type union, add `daysOverdue?: number` and `getOverdue()` method

**Acceptance Criteria:**
- [ ] `EVENT_COLORS` exports a typed map with shell/dot/bar/border classes keyed by event type (8 entries, no CONTRACT_START/END)
- [ ] `getEventBarClasses(severity)` returns Tailwind classes for the stacked-bar layout (bg, text, border-left color)
- [ ] `composeEventTitle(event, t)` returns a string like "{{roomName}} · {{shortLabel}}", composed via i18n
- [ ] `getRelatedPath(event)` returns `/contracts/:id` or `/invoices/:id` based on `relatedType`
- [ ] `buildMonthGrid(date)` returns `{ days: Date[] }` of 35 or 42 entries (always full weeks): leading days from prev month, current month, trailing days from next month — week starts Monday
- [ ] All unit tests pass

**Verify:** `cd frontend && npx vitest run src/lib/calendar/` → all tests PASS

**Steps:**

- [ ] **Step 1: Update `frontend/src/api/calendar.ts`**

```typescript
import apiClient from './client';

export type CalendarEventType =
    | 'DEPOSIT_CHECKIN_DUE'
    | 'DEPOSIT_CHECKIN_OVERDUE'
    | 'ACTIVE_CHECKOUT_DUE'
    | 'ACTIVE_CHECKOUT_OVERDUE'
    | 'INVOICE_DUE'
    | 'INVOICE_OVERDUE'
    | 'PAYMENT_DUE'
    | 'PAYMENT_DUE_OVERDUE';

export type CalendarEventSeverity = 'info' | 'warning' | 'danger';

export interface CalendarEvent {
    _id: string;
    date: string;
    type: CalendarEventType;
    severity: CalendarEventSeverity;
    relatedId: string;
    relatedType: 'contract' | 'invoice';
    roomName?: string;
    tenantName?: string;
    buildingName?: string;
    amount?: number;
    daysOverdue?: number;
    title?: string;
    description?: string;
}

export interface CalendarDayEvents {
    date: string;
    events: CalendarEvent[];
}

export interface CalendarMonthSummary {
    days: Record<string, Partial<Record<CalendarEventType, number>>>;
    totalEvents: number;
}

export const calendarApi = {
    getEvents: async (start: string, end: string, buildingId?: string): Promise<CalendarEvent[]> => {
        const params = new URLSearchParams({ start, end });
        if (buildingId) params.append('buildingId', buildingId);
        const response = await apiClient.get(`/calendar/events?${params}`);
        return response.data;
    },

    getDayEvents: async (date: string, buildingId?: string): Promise<CalendarDayEvents> => {
        const params = new URLSearchParams({ date });
        if (buildingId) params.append('buildingId', buildingId);
        const response = await apiClient.get(`/calendar/day?${params}`);
        return response.data;
    },

    getMonthSummary: async (year: number, month: number, buildingId?: string): Promise<CalendarMonthSummary> => {
        const params = new URLSearchParams({ year: year.toString(), month: month.toString() });
        if (buildingId) params.append('buildingId', buildingId);
        const response = await apiClient.get(`/calendar/month-summary?${params}`);
        return response.data;
    },

    getOverdue: async (buildingId?: string): Promise<CalendarEvent[]> => {
        const params = new URLSearchParams();
        if (buildingId) params.append('buildingId', buildingId);
        const qs = params.toString();
        const response = await apiClient.get(`/calendar/overdue${qs ? `?${qs}` : ''}`);
        return response.data;
    },
};
```

- [ ] **Step 2: Create `frontend/src/lib/calendar/event-colors.ts`**

```typescript
import type { CalendarEventType, CalendarEventSeverity } from '@/api/calendar';

export interface EventColorSet {
    shell: string;      // chip background + text
    dot: string;        // small color dot
    bar: string;        // stacked bar background + text + border-left
}

export const EVENT_COLORS: Record<CalendarEventType, EventColorSet> = {
    DEPOSIT_CHECKIN_DUE:    { shell: 'bg-info/12 text-info',    dot: 'bg-info',    bar: 'bg-info/12 text-info border-l-[3px] border-info' },
    DEPOSIT_CHECKIN_OVERDUE:{ shell: 'bg-error/12 text-error',  dot: 'bg-error',   bar: 'bg-error/12 text-error border-l-[3px] border-error' },
    ACTIVE_CHECKOUT_DUE:    { shell: 'bg-warning/12 text-warning', dot: 'bg-warning', bar: 'bg-warning/12 text-warning border-l-[3px] border-warning' },
    ACTIVE_CHECKOUT_OVERDUE:{ shell: 'bg-error/12 text-error',  dot: 'bg-error',   bar: 'bg-error/12 text-error border-l-[3px] border-error' },
    INVOICE_DUE:            { shell: 'bg-warning/12 text-warning', dot: 'bg-warning', bar: 'bg-warning/12 text-warning border-l-[3px] border-warning' },
    INVOICE_OVERDUE:        { shell: 'bg-error/12 text-error',  dot: 'bg-error',   bar: 'bg-error/12 text-error border-l-[3px] border-error' },
    PAYMENT_DUE:            { shell: 'bg-success/12 text-success', dot: 'bg-success', bar: 'bg-success/12 text-success border-l-[3px] border-success' },
    PAYMENT_DUE_OVERDUE:    { shell: 'bg-error/12 text-error',  dot: 'bg-error',   bar: 'bg-error/12 text-error border-l-[3px] border-error' },
};

export function getSeverityClasses(severity: CalendarEventSeverity): string {
    switch (severity) {
        case 'danger':  return 'border-error text-error';
        case 'warning': return 'border-warning text-warning';
        default:        return 'border-info text-info';
    }
}
```

- [ ] **Step 3: Create `event-display.ts` + spec**

`frontend/src/lib/calendar/event-display.ts`:

```typescript
import type { CalendarEvent } from '@/api/calendar';

type Translator = (key: string, opts?: Record<string, unknown>) => string;

/** Build the room-cell short label: "{roomName} · {shortLabel}" */
export function composeEventBarLabel(event: CalendarEvent, t: Translator): string {
    const shortLabel = t(`calendar.shortLabels.${event.type}`);
    if (event.roomName && event.roomName !== 'N/A') {
        return `${event.roomName} · ${shortLabel}`;
    }
    return shortLabel;
}

/** Build the modal title: "{eventTypeLabel} - {roomName}" */
export function composeEventTitle(event: CalendarEvent, t: Translator): string {
    const typeLabel = t(`calendar.eventTypes.${event.type}`);
    if (event.roomName && event.roomName !== 'N/A') {
        return `${typeLabel} - ${event.roomName}`;
    }
    return typeLabel;
}

/** Build the modal one-line description: tenant + amount (skips N/A) */
export function composeEventDescription(event: CalendarEvent, locale: string): string {
    const parts: string[] = [];
    if (event.tenantName && event.tenantName !== 'N/A') parts.push(event.tenantName);
    if (event.amount && event.amount > 0) {
        parts.push(`${event.amount.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')} VND`);
    }
    return parts.join(' · ');
}

/** Returns the route to navigate to when CTA clicked. */
export function getRelatedPath(event: CalendarEvent): string {
    return event.relatedType === 'contract'
        ? `/contracts/${event.relatedId}`
        : `/invoices/${event.relatedId}`;
}
```

`frontend/src/lib/calendar/event-display.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { composeEventBarLabel, composeEventTitle, composeEventDescription, getRelatedPath } from './event-display';
import type { CalendarEvent } from '@/api/calendar';

const t = (key: string) => {
    const map: Record<string, string> = {
        'calendar.shortLabels.INVOICE_OVERDUE': 'Hóa đơn quá hạn',
        'calendar.shortLabels.DEPOSIT_CHECKIN_DUE': 'Check-in',
        'calendar.eventTypes.INVOICE_OVERDUE': 'Hóa đơn quá hạn',
    };
    return map[key] ?? key;
};

const baseEvent: CalendarEvent = {
    _id: 'e1',
    date: '2026-05-15T00:00:00Z',
    type: 'INVOICE_OVERDUE',
    severity: 'danger',
    relatedId: 'inv1',
    relatedType: 'invoice',
    roomName: 'P301',
    tenantName: 'Khach 1',
    amount: 1500000,
};

describe('event-display', () => {
    it('composes bar label with roomName', () => {
        expect(composeEventBarLabel(baseEvent, t)).toBe('P301 · Hóa đơn quá hạn');
    });

    it('omits roomName when N/A or absent', () => {
        expect(composeEventBarLabel({ ...baseEvent, roomName: 'N/A' }, t)).toBe('Hóa đơn quá hạn');
        expect(composeEventBarLabel({ ...baseEvent, roomName: undefined }, t)).toBe('Hóa đơn quá hạn');
    });

    it('composes title with room', () => {
        expect(composeEventTitle(baseEvent, t)).toBe('Hóa đơn quá hạn - P301');
    });

    it('composes description with tenant + amount (vi-VN locale)', () => {
        expect(composeEventDescription(baseEvent, 'vi')).toBe('Khach 1 · 1.500.000 VND');
    });

    it('skips N/A tenant in description', () => {
        expect(composeEventDescription({ ...baseEvent, tenantName: 'N/A' }, 'vi')).toBe('1.500.000 VND');
    });

    it('returns contract path for relatedType=contract', () => {
        expect(getRelatedPath({ ...baseEvent, relatedType: 'contract', relatedId: 'c1' })).toBe('/contracts/c1');
    });

    it('returns invoice path for relatedType=invoice', () => {
        expect(getRelatedPath(baseEvent)).toBe('/invoices/inv1');
    });
});
```

- [ ] **Step 4: Create `grid-helpers.ts` + spec**

`frontend/src/lib/calendar/grid-helpers.ts`:

```typescript
import { addDays, endOfMonth, getDay, startOfMonth } from 'date-fns';

export interface MonthGridCell {
    date: Date;
    isCurrentMonth: boolean;
}

/**
 * Build a 35 or 42-cell grid (5 or 6 full weeks starting Monday).
 * - Leading days from previous month fill the first row up to the month's first day
 * - Trailing days from next month fill the last row
 * - The grid is always 5 or 6 full weeks (never fewer than the days needed)
 */
export function buildMonthGrid(date: Date): MonthGridCell[] {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    // Monday=0, Tuesday=1, ..., Sunday=6 (getDay returns 0=Sun, so transform)
    const leadingDays = (getDay(monthStart) + 6) % 7;
    const totalDaysInMonth = monthEnd.getDate();

    const totalCells = Math.ceil((leadingDays + totalDaysInMonth) / 7) * 7;
    const cells: MonthGridCell[] = [];

    const firstCellDate = addDays(monthStart, -leadingDays);
    for (let i = 0; i < totalCells; i++) {
        const d = addDays(firstCellDate, i);
        cells.push({
            date: d,
            isCurrentMonth: d.getMonth() === monthStart.getMonth() && d.getFullYear() === monthStart.getFullYear(),
        });
    }
    return cells;
}
```

`frontend/src/lib/calendar/grid-helpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildMonthGrid } from './grid-helpers';

describe('buildMonthGrid', () => {
    it('returns 35 cells for a month that fits in 5 weeks', () => {
        // May 2026: starts Friday, has 31 days → needs 5 weeks (35 cells) or 6 (42 cells) depending on layout
        // Friday-Monday=4 leading days, 31 days → 35 cells total. But 4+31=35, exactly 5 weeks.
        const grid = buildMonthGrid(new Date(2026, 4, 1)); // May 2026
        expect(grid.length).toBe(35);
    });

    it('returns 42 cells when needed', () => {
        // Aug 2026 — Saturday start → 5 leading + 31 days = 36, ceil to 42
        const grid = buildMonthGrid(new Date(2026, 7, 1));
        expect(grid.length).toBe(42);
    });

    it('marks leading days as not in current month', () => {
        const grid = buildMonthGrid(new Date(2026, 4, 1)); // May 1 = Friday → 4 leading days from April
        expect(grid[0].isCurrentMonth).toBe(false);
        expect(grid[3].isCurrentMonth).toBe(false);
        expect(grid[4].isCurrentMonth).toBe(true); // first day of May
        expect(grid[4].date.getDate()).toBe(1);
    });

    it('starts on Monday', () => {
        const grid = buildMonthGrid(new Date(2026, 4, 1));
        // grid[0] should be a Monday — getDay() returns 1 for Monday
        expect(grid[0].date.getDay()).toBe(1);
    });
});
```

- [ ] **Step 5: Run tests**

Run: `cd frontend && npx vitest run src/lib/calendar/`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/calendar.ts frontend/src/lib/calendar/
git commit -m "feat(calendar): add lib utilities (colors, display, grid helpers)"
```

---

### Task 8: useCalendarData hook

**Goal:** A single hook that fetches all calendar data: events for the visible month (used to populate day cells), day events (for the open modal), and currently overdue events (for the banner). Derives `eventsByDay: Record<'yyyy-MM-dd', CalendarEvent[]>` for the grid.

**Note on data source:** We use `/calendar/events` (full events list) instead of `/calendar/month-summary` (counts only). Reason: the stacked-bars day cell needs real event rows; deriving them from one query is simpler than maintaining counts + content separately.

**Files:**
- Create: `frontend/src/components/dashboard/calendar/hooks/useCalendarData.ts`

**Acceptance Criteria:**
- [ ] Hook returns `{ eventsQuery, eventsByDay, dayEventsQuery, overdueQuery }`
- [ ] `eventsQuery` fetches `calendarApi.getEvents(startOfMonth, endOfMonth, buildingId)` keyed by `['calendar-events', startIso, endIso, buildingId]`
- [ ] `eventsByDay` is a memoized `Record<'yyyy-MM-dd', CalendarEvent[]>` derived from `eventsQuery.data`
- [ ] `dayEventsQuery` enabled only when `selectedDate && isDayModalOpen`
- [ ] `overdueQuery` uses `['calendar-overdue', buildingId]`
- [ ] No call to `monthSummary` (deprecated for this UI)

**Verify:** `cd frontend && npm run build` → exit 0 (TS check)

**Steps:**

- [ ] **Step 1: Create the hook**

```typescript
import type { CalendarEvent } from '@/api/calendar';
import { calendarApi } from '@/api/calendar';
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useMemo } from 'react';

interface UseCalendarDataArgs {
    currentMonth: Date;
    selectedDate: Date | null;
    buildingId?: string;
    isDayModalOpen?: boolean;
}

export function useCalendarData({ currentMonth, selectedDate, buildingId, isDayModalOpen }: UseCalendarDataArgs) {
    const start = useMemo(() => startOfMonth(currentMonth).toISOString(), [currentMonth]);
    const end = useMemo(() => endOfMonth(currentMonth).toISOString(), [currentMonth]);

    const eventsQuery = useQuery({
        queryKey: ['calendar-events', start, end, buildingId],
        queryFn: () => calendarApi.getEvents(start, end, buildingId),
    });

    const dayEventsQuery = useQuery({
        queryKey: ['calendar-day', selectedDate?.toISOString(), buildingId],
        queryFn: () => calendarApi.getDayEvents(selectedDate!.toISOString(), buildingId),
        enabled: !!selectedDate && !!isDayModalOpen,
    });

    const overdueQuery = useQuery({
        queryKey: ['calendar-overdue', buildingId],
        queryFn: () => calendarApi.getOverdue(buildingId),
    });

    const eventsByDay = useMemo(() => {
        const map: Record<string, CalendarEvent[]> = {};
        for (const event of eventsQuery.data ?? []) {
            const key = format(new Date(event.date), 'yyyy-MM-dd');
            if (!map[key]) map[key] = [];
            map[key].push(event);
        }
        return map;
    }, [eventsQuery.data]);

    return { eventsQuery, eventsByDay, dayEventsQuery, overdueQuery };
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/calendar/hooks/
git commit -m "feat(calendar): add useCalendarData hook with eventsByDay derivation"
```

---

### Task 9: CalendarHeader + CalendarDayCell components

**Goal:** The Today/Prev/Next/Month-label header and the stacked-bars day cell (Option B layout).

**Files:**
- Create: `frontend/src/components/dashboard/calendar/CalendarHeader.tsx`
- Create: `frontend/src/components/dashboard/calendar/CalendarDayCell.tsx`

**Acceptance Criteria:**
- [ ] `CalendarHeader` props: `{ currentMonth: Date, onPrev, onNext, onToday, locale }` — renders Today button + prev/next chevrons + month label
- [ ] `CalendarDayCell` props: `{ day: Date, events: CalendarEvent[], isToday: boolean, isOutsideMonth: boolean, onClick: () => void }`
- [ ] Day cell shows max 4 event bars (each = 1 real event), `+N nữa` chip if more
- [ ] Counter in top-right corner: plain number (no "mục" suffix)
- [ ] Today: `bg-primary/[0.08]`, day-number circle `bg-primary text-primary-foreground`
- [ ] Outside-month cells: `opacity-45`, otherwise behave like in-month cells
- [ ] Bar uses `EVENT_COLORS[type].bar` classes, label = `composeEventBarLabel(event, t)`, truncated with `truncate whitespace-nowrap`
- [ ] No legend chips rendered anywhere

**Verify:** `cd frontend && npm run build` → exit 0. Visual verification deferred to T15.

**Steps:**

- [ ] **Step 1: Create `CalendarHeader.tsx`**

```typescript
import { Button } from '@/components/ui/button';
import { format, type Locale } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CalendarHeaderProps {
    currentMonth: Date;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    locale: Locale;
}

export default function CalendarHeader({ currentMonth, onPrev, onNext, onToday, locale }: CalendarHeaderProps) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar sm:justify-end">
                <Button variant="outline" size="sm" onClick={onToday}>
                    {t('calendar.today', 'Hôm nay')}
                </Button>
                <div className="flex items-center rounded-2xl border border-border/70 bg-background/80 p-1 shadow-sm">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onPrev} aria-label={t('common.previousMonth', 'Tháng trước')}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[152px] px-3 text-center text-sm font-semibold capitalize text-foreground">
                        {format(currentMonth, 'MMMM yyyy', { locale })}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onNext} aria-label={t('common.nextMonth', 'Tháng sau')}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create `CalendarDayCell.tsx`**

```typescript
import type { CalendarEvent } from '@/api/calendar';
import { EVENT_COLORS } from '@/lib/calendar/event-colors';
import { composeEventBarLabel } from '@/lib/calendar/event-display';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface CalendarDayCellProps {
    day: Date;
    events: CalendarEvent[];
    isToday: boolean;
    isOutsideMonth: boolean;
    onClick: () => void;
}

const MAX_VISIBLE_BARS = 4;

export default function CalendarDayCell({ day, events, isToday, isOutsideMonth, onClick }: CalendarDayCellProps) {
    const { t } = useTranslation();
    const hasEvents = events.length > 0;
    const visible = events.slice(0, MAX_VISIBLE_BARS);
    const overflow = events.length - visible.length;

    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'min-h-[88px] rounded-2xl border border-border/70 p-2.5 text-left transition-colors lg:min-h-[92px] xl:min-h-[88px]',
                hasEvents ? 'hover:bg-accent/55' : 'hover:bg-muted/45',
                isToday ? 'bg-primary/[0.08]' : 'bg-background/88',
                isOutsideMonth ? 'opacity-45' : '',
            ].join(' ')}
        >
            <div className="flex items-center justify-between gap-2">
                <span className={[
                    'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                    isToday ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                ].join(' ')}>
                    {format(day, 'd')}
                </span>
                {hasEvents ? (
                    <span className="text-[11px] font-semibold text-muted-foreground">{events.length}</span>
                ) : null}
            </div>

            {hasEvents ? (
                <div className="mt-2 space-y-1">
                    {visible.map((event) => (
                        <span
                            key={event._id}
                            className={[
                                'block truncate whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-medium',
                                EVENT_COLORS[event.type].bar,
                            ].join(' ')}
                            title={composeEventBarLabel(event, t)}
                        >
                            {composeEventBarLabel(event, t)}
                        </span>
                    ))}
                    {overflow > 0 ? (
                        <span className="inline-flex rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            +{overflow} {t('common.more', 'nữa')}
                        </span>
                    ) : null}
                </div>
            ) : null}
        </button>
    );
}
```

- [ ] **Step 3: Build to verify**

Run: `cd frontend && npm run build`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/calendar/CalendarHeader.tsx frontend/src/components/dashboard/calendar/CalendarDayCell.tsx
git commit -m "feat(calendar): add CalendarHeader and CalendarDayCell (stacked bars)"
```

---

### Task 10: CalendarGrid component

**Goal:** Compose the 7-col weekday header + 35/42 day cells. Use `buildMonthGrid` + `CalendarDayCell`. Fetch events from a single events array (passed in as prop, not queried inside) keyed by day.

**Files:**
- Create: `frontend/src/components/dashboard/calendar/CalendarGrid.tsx`

**Acceptance Criteria:**
- [ ] Props: `{ currentMonth: Date, eventsByDay: Record<string, CalendarEvent[]>, onDayClick: (day: Date) => void, locale }`
- [ ] Weekday header has 7 cells (Mon-Sun), uppercase, muted color (matches existing styling at `BigCalendar.tsx:127-132`)
- [ ] Body renders a `CalendarDayCell` for every cell from `buildMonthGrid(currentMonth)`
- [ ] `isToday` and `isOutsideMonth` passed correctly
- [ ] Events for each cell looked up by `format(day, 'yyyy-MM-dd')` in `eventsByDay`

**Verify:** `cd frontend && npm run build` → exit 0

**Steps:**

- [ ] **Step 1: Create the file**

```typescript
import type { CalendarEvent } from '@/api/calendar';
import { buildMonthGrid } from '@/lib/calendar/grid-helpers';
import { format, isToday, type Locale } from 'date-fns';
import { useMemo } from 'react';
import CalendarDayCell from './CalendarDayCell';

interface CalendarGridProps {
    currentMonth: Date;
    eventsByDay: Record<string, CalendarEvent[]>;
    onDayClick: (day: Date) => void;
    locale: Locale;
}

export default function CalendarGrid({ currentMonth, eventsByDay, onDayClick, locale }: CalendarGridProps) {
    const weekdays = useMemo(
        () => Array.from({ length: 7 }, (_, i) => format(new Date(2026, 0, 5 + i), 'EEE', { locale })),
        [locale],
    );
    const cells = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

    return (
        <div className="overflow-x-auto hide-scrollbar">
            <div className="min-w-[680px] rounded-[1.35rem] border border-border/70 bg-background/65 p-3">
                <div className="mb-2 grid grid-cols-7 gap-2">
                    {weekdays.map((d) => (
                        <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {cells.map(({ date, isCurrentMonth }) => {
                        const key = format(date, 'yyyy-MM-dd');
                        const events = eventsByDay[key] ?? [];
                        return (
                            <CalendarDayCell
                                key={key}
                                day={date}
                                events={events}
                                isToday={isToday(date)}
                                isOutsideMonth={!isCurrentMonth}
                                onClick={() => onDayClick(date)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/calendar/CalendarGrid.tsx
git commit -m "feat(calendar): add CalendarGrid with padded month layout"
```

---

### Task 11: CalendarEventCard component (shared)

**Goal:** Single reusable event card used in both `CalendarDayDetailModal` and `OverdueListModal`.

**Files:**
- Create: `frontend/src/components/dashboard/calendar/CalendarEventCard.tsx`

**Acceptance Criteria:**
- [ ] Props: `{ event: CalendarEvent, onView?: (event: CalendarEvent) => void }`
- [ ] Renders: severity strip (3px left border), pill chip with event-type label, bold title (`composeEventTitle`), one-line description (`composeEventDescription`), inline meta (building/room/tenant — skips `N/A`), "Xem hợp đồng/hóa đơn" CTA
- [ ] Meta row uses `flex flex-wrap gap-x-3 gap-y-1` (not `grid sm:grid-cols-2`)

**Verify:** `cd frontend && npm run build` → exit 0

**Steps:**

- [ ] **Step 1: Create the file**

```typescript
import type { CalendarEvent } from '@/api/calendar';
import { Button } from '@/components/ui/button';
import { EVENT_COLORS } from '@/lib/calendar/event-colors';
import { composeEventTitle, composeEventDescription } from '@/lib/calendar/event-display';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CalendarEventCardProps {
    event: CalendarEvent;
    onView?: (event: CalendarEvent) => void;
}

export default function CalendarEventCard({ event, onView }: CalendarEventCardProps) {
    const { t, i18n } = useTranslation();
    const colors = EVENT_COLORS[event.type];
    const ctaLabel = event.relatedType === 'contract'
        ? t('calendar.viewContract', 'Xem hợp đồng')
        : t('calendar.viewInvoice', 'Xem hóa đơn');

    const metaItems: Array<{ label: string; value: string }> = [];
    if (event.buildingName && event.buildingName !== 'N/A') {
        metaItems.push({ label: t('buildings.label', 'Tòa nhà'), value: event.buildingName });
    }
    if (event.roomName && event.roomName !== 'N/A') {
        metaItems.push({ label: t('rooms.room', 'Phòng'), value: event.roomName });
    }
    if (event.tenantName && event.tenantName !== 'N/A') {
        metaItems.push({ label: t('dashboard.tenant', 'Khách thuê'), value: event.tenantName });
    }

    return (
        <div className="rounded-2xl border border-border/70 bg-background/80 p-4 border-l-[4px]" style={{ borderLeftColor: 'var(--border-strong, currentColor)' }}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                    <span className={['inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold', colors.shell].join(' ')}>
                        <span className={['h-2 w-2 rounded-full', colors.dot].join(' ')} />
                        {t(`calendar.eventTypes.${event.type}`)}
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-foreground">{composeEventTitle(event, t)}</p>
                        {composeEventDescription(event, i18n.language) ? (
                            <p className="mt-1 text-sm text-muted-foreground">{composeEventDescription(event, i18n.language)}</p>
                        ) : null}
                    </div>
                    {metaItems.length > 0 ? (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {metaItems.map((m) => (
                                <span key={m.label}>{m.label}: <strong className="text-foreground">{m.value}</strong></span>
                            ))}
                        </div>
                    ) : null}
                </div>
                {onView ? (
                    <Button variant="outline" size="sm" onClick={() => onView(event)}>
                        <ExternalLink className="mr-1 h-4 w-4" />
                        {ctaLabel}
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/calendar/CalendarEventCard.tsx
git commit -m "feat(calendar): add shared CalendarEventCard"
```

---

### Task 12: CalendarDayDetailModal component

**Goal:** Modal opened when user clicks a day cell. Shows events of that day using `CalendarEventCard`.

**Files:**
- Create: `frontend/src/components/dashboard/calendar/CalendarDayDetailModal.tsx`

**Acceptance Criteria:**
- [ ] Props: `{ isOpen, onClose, selectedDate, events, isLoading, onViewEvent, locale }`
- [ ] Header: `CalendarDays` icon + date formatted as "EEEE, dd/MM/yyyy"
- [ ] Body: `LoadingState` when isLoading; `CompactEmptyState` when no events; else list of `CalendarEventCard`
- [ ] Max height 420px with scroll
- [ ] Uses `Dialog` from `@/components/ui/dialog`

**Verify:** `cd frontend && npm run build` → exit 0

**Steps:**

- [ ] **Step 1: Create the file**

```typescript
import type { CalendarEvent } from '@/api/calendar';
import { CompactEmptyState, LoadingState } from '@/components/layout/page-shell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, type Locale } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CalendarEventCard from './CalendarEventCard';

interface CalendarDayDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date | null;
    events: CalendarEvent[];
    isLoading: boolean;
    onViewEvent: (event: CalendarEvent) => void;
    locale: Locale;
}

export default function CalendarDayDetailModal({
    isOpen, onClose, selectedDate, events, isLoading, onViewEvent, locale,
}: CalendarDayDetailModalProps) {
    const { t } = useTranslation();
    return (
        <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-xl rounded-[1.5rem] border-border/70">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        {selectedDate && format(selectedDate, 'EEEE, dd/MM/yyyy', { locale })}
                    </DialogTitle>
                </DialogHeader>
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {isLoading ? (
                        <LoadingState compact description={t('calendar.loadingEvents', 'Đang tải sự kiện')} />
                    ) : events.length === 0 ? (
                        <CompactEmptyState
                            icon={CalendarDays}
                            title={t('calendar.noEventsTitle', 'Không có sự kiện')}
                            description={t('calendar.noEvents', 'Không có sự kiện')}
                            className="py-8"
                        />
                    ) : (
                        events.map((event) => (
                            <CalendarEventCard key={event._id} event={event} onView={onViewEvent} />
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/calendar/CalendarDayDetailModal.tsx
git commit -m "feat(calendar): add CalendarDayDetailModal"
```

---

### Task 13: OverdueBanner + OverdueListModal components

**Goal:** Banner above the grid + modal showing all currently-overdue events.

**Files:**
- Create: `frontend/src/components/dashboard/calendar/OverdueBanner.tsx`
- Create: `frontend/src/components/dashboard/calendar/OverdueListModal.tsx`

**Acceptance Criteria:**
- [ ] `OverdueBanner` props: `{ count, onOpen }` — visible only when count > 0; if `count === 0` returns null
- [ ] Banner layout: `bg-error/10 border border-error/30 rounded-2xl px-4 py-3 flex items-center justify-between` with `AlertTriangle` icon + bold text + outline button
- [ ] `OverdueListModal` props: `{ isOpen, onClose, events, onViewEvent }`
- [ ] Modal lists all events using `CalendarEventCard`, sorted by event date desc (already sorted by backend, but verify)

**Verify:** `cd frontend && npm run build` → exit 0

**Steps:**

- [ ] **Step 1: Create `OverdueBanner.tsx`**

```typescript
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OverdueBannerProps {
    count: number;
    onOpen: () => void;
}

export default function OverdueBanner({ count, onOpen }: OverdueBannerProps) {
    const { t } = useTranslation();
    if (count === 0) return null;
    return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-error/30 bg-error/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-error">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="font-semibold">{t('calendar.overdue.bannerCount', { count })}</span>
            </div>
            <Button variant="outline" size="sm" onClick={onOpen} className="border-error/40 text-error hover:bg-error/15">
                {t('calendar.overdue.viewAll', 'Xem chi tiết')}
                <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
        </div>
    );
}
```

- [ ] **Step 2: Create `OverdueListModal.tsx`**

```typescript
import type { CalendarEvent } from '@/api/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CalendarEventCard from './CalendarEventCard';

interface OverdueListModalProps {
    isOpen: boolean;
    onClose: () => void;
    events: CalendarEvent[];
    onViewEvent: (event: CalendarEvent) => void;
}

export default function OverdueListModal({ isOpen, onClose, events, onViewEvent }: OverdueListModalProps) {
    const { t } = useTranslation();
    return (
        <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl rounded-[1.5rem] border-border/70">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-error">
                        <AlertTriangle className="h-5 w-5" />
                        {t('calendar.overdue.modalTitle', 'Sự kiện quá hạn')}
                    </DialogTitle>
                </DialogHeader>
                <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                    {events.map((e) => (
                        <CalendarEventCard key={e._id} event={e} onView={onViewEvent} />
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/calendar/OverdueBanner.tsx frontend/src/components/dashboard/calendar/OverdueListModal.tsx
git commit -m "feat(calendar): add OverdueBanner and OverdueListModal"
```

---

### Task 14: New BigCalendar orchestrator + delete old file + update DashboardPage

**Goal:** Compose all the new components into a thin orchestrator, replace the old monolithic `BigCalendar.tsx`, and update the only importer (`DashboardPage.tsx`).

**Files:**
- Create: `frontend/src/components/dashboard/calendar/BigCalendar.tsx`
- Delete: `frontend/src/components/dashboard/BigCalendar.tsx`
- Modify: `frontend/src/pages/dashboard/DashboardPage.tsx` (line 2)

**Acceptance Criteria:**
- [ ] New `BigCalendar.tsx` is < 100 lines
- [ ] Composes: `OverdueBanner`, `CalendarHeader`, `CalendarGrid`, `CalendarDayDetailModal`, `OverdueListModal`
- [ ] Uses `useCalendarData` hook for all data fetching
- [ ] Uses `eventsByDay` from `useCalendarData` (already wired in T8)
- [ ] No direct `useQuery` calls in `BigCalendar.tsx` — all data flows through `useCalendarData`
- [ ] `DashboardPage.tsx:2` updated: `import BigCalendar from '@/components/dashboard/calendar/BigCalendar';`
- [ ] Old `frontend/src/components/dashboard/BigCalendar.tsx` removed
- [ ] No references to `CONTRACT_START` or `CONTRACT_END` anywhere in `frontend/src/`

**Verify:** `cd frontend && npm run build && npx vitest run` → exit 0, all tests PASS. Then manual browser check (next task).

**Steps:**

- [ ] **Step 1: Create new `BigCalendar.tsx`**

```typescript
import { addMonths, subMonths } from 'date-fns';
import { enUS, vi } from 'date-fns/locale';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent } from '@/api/calendar';
import { getRelatedPath } from '@/lib/calendar/event-display';
import CalendarDayDetailModal from './CalendarDayDetailModal';
import CalendarGrid from './CalendarGrid';
import CalendarHeader from './CalendarHeader';
import OverdueBanner from './OverdueBanner';
import OverdueListModal from './OverdueListModal';
import { useCalendarData } from './hooks/useCalendarData';

interface BigCalendarProps {
    buildingId?: string;
}

export default function BigCalendar({ buildingId }: BigCalendarProps) {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isDayModalOpen, setIsDayModalOpen] = useState(false);
    const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);

    const locale = i18n.language === 'en' ? enUS : vi;

    const { eventsByDay, dayEventsQuery, overdueQuery } = useCalendarData({
        currentMonth,
        selectedDate,
        buildingId,
        isDayModalOpen,
    });

    const handleDayClick = (day: Date) => {
        setSelectedDate(day);
        setIsDayModalOpen(true);
    };

    const handleViewEvent = (event: CalendarEvent) => {
        setIsDayModalOpen(false);
        setIsOverdueModalOpen(false);
        navigate(getRelatedPath(event));
    };

    return (
        <>
            <div className="space-y-4">
                <OverdueBanner
                    count={overdueQuery.data?.length ?? 0}
                    onOpen={() => setIsOverdueModalOpen(true)}
                />
                <CalendarHeader
                    currentMonth={currentMonth}
                    onPrev={() => setCurrentMonth((d) => subMonths(d, 1))}
                    onNext={() => setCurrentMonth((d) => addMonths(d, 1))}
                    onToday={() => setCurrentMonth(new Date())}
                    locale={locale}
                />
                <CalendarGrid
                    currentMonth={currentMonth}
                    eventsByDay={eventsByDay}
                    onDayClick={handleDayClick}
                    locale={locale}
                />
            </div>

            <CalendarDayDetailModal
                isOpen={isDayModalOpen}
                onClose={() => setIsDayModalOpen(false)}
                selectedDate={selectedDate}
                events={dayEventsQuery.data?.events ?? []}
                isLoading={dayEventsQuery.isLoading}
                onViewEvent={handleViewEvent}
                locale={locale}
            />

            <OverdueListModal
                isOpen={isOverdueModalOpen}
                onClose={() => setIsOverdueModalOpen(false)}
                events={overdueQuery.data ?? []}
                onViewEvent={handleViewEvent}
            />
        </>
    );
}
```

- [ ] **Step 2: Update DashboardPage import**

In `frontend/src/pages/dashboard/DashboardPage.tsx`, change line 2 from:

```typescript
import BigCalendar from '@/components/dashboard/BigCalendar';
```

to:

```typescript
import BigCalendar from '@/components/dashboard/calendar/BigCalendar';
```

- [ ] **Step 3: Delete old `BigCalendar.tsx`**

```bash
rm frontend/src/components/dashboard/BigCalendar.tsx
```

- [ ] **Step 4: Verify build + tests**

Run: `cd frontend && npm run build && npx vitest run`
Expected: exit 0, all tests PASS

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/
git commit -m "refactor(calendar): wire new BigCalendar orchestrator and delete legacy file"
```

---

### Task 15: Manual verification + screenshot evidence

**Goal:** Start the dev servers, exercise the full feature in a browser, capture evidence per the acceptance criteria.

**Files:**
- (no changes — verification only)

**Acceptance Criteria:**
- [ ] Backend server starts without errors (`npm run start:dev` in `backend/`)
- [ ] Frontend dev server starts without errors (`npm run dev` in `frontend/`)
- [ ] Dashboard loads, calendar renders with stacked event bars
- [ ] Counter on a day cell with multiple events matches the modal event count
- [ ] Padding days from prev/next month visible with reduced opacity, clickable
- [ ] No legend strip below the grid
- [ ] Clicking a day opens the redesigned modal with the new event card layout
- [ ] Clicking "Xem hợp đồng/hóa đơn" navigates to the right route
- [ ] If overdue events exist, banner shows above the grid; clicking "Xem chi tiết" opens OverdueListModal
- [ ] If no overdue events, banner is hidden
- [ ] Navigating to month +2 shows DEPOSIT_CHECKIN_DUE / ACTIVE_CHECKOUT_DUE with `info` severity (blue), NOT CONTRACT_START/END
- [ ] Backend `BigCalendar.tsx` final line count < 100; backend `calendar.service.ts` < 120 (verify with `wc -l`)
- [ ] Language switch VN ↔ EN updates all labels correctly

**Verify:**

```bash
wc -l frontend/src/components/dashboard/calendar/BigCalendar.tsx
wc -l backend/src/modules/calendar/calendar.service.ts
```

**Steps:**

- [ ] **Step 1: Start backend** (in a separate terminal or background)

```bash
cd backend && npm run start:dev
```

Expected: "Nest application successfully started" log line, no startup errors.

- [ ] **Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

Expected: Vite dev server starts on port 5173.

- [ ] **Step 3: Manual browser walkthrough**

Open `http://localhost:5173`, log in, navigate to the dashboard.

Walk through each acceptance criterion above. Document any failures inline as task notes; fix in a follow-up commit before marking the task complete.

- [ ] **Step 4: Verify line counts**

```bash
wc -l frontend/src/components/dashboard/calendar/BigCalendar.tsx backend/src/modules/calendar/calendar.service.ts
```

Expected: both files under their target thresholds (100 and 120 respectively).

- [ ] **Step 5: Final commit (only if any fixes applied during walkthrough)**

```bash
git add -A
git commit -m "fix(calendar): post-verification polish from manual QA"
```

---

## Plan Self-Review Checklist

- [x] **Spec coverage:** Every spec section (2.1-2.4, 3.1-3.5, 4.1-4.5) maps to at least one task — Logic 2.1 → T7+T14 (counter fix via eventsByDay derivation + day cell counter); 2.2 → T4; 2.3 → T2+T6; 2.4 → T2+T5+T13. UX 3.1 → T9; 3.2 → T7+T10; 3.3 → T9 (no legend rendered); 3.4 → T11+T12; 3.5 → T13+T14. Code 4.1 → T7-T14; 4.2 → T0-T5; 4.3 → T5+T7; 4.4 → T6; 4.5 → T2-T4 (raw data only) + T7 (compose helpers).
- [x] **Placeholder scan:** No TBD, no "implement later", code snippets included for every step that requires code.
- [x] **Type consistency:** `CalendarEvent` type is used identically across hooks/components/lib; `CalendarEventDto` on backend matches frontend type union; producer signature `produce(ownerId, range, buildingId?)` consistent across T2/T3/T4 and orchestrator usage in T5.

---
