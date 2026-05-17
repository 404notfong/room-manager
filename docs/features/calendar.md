# Calendar Playbook

> **Vai trò trong domain**: View-only aggregate layer — tổng hợp sự kiện từ Contract, Invoice thành timeline lịch theo ngày/tháng.
> **Code paths**: `backend/src/modules/calendar/`, `frontend/src/components/dashboard/BigCalendar.tsx`, `frontend/src/api/calendar.ts`

---

## 1. Purpose & Relations

Calendar **không phải là entity độc lập** — không có collection MongoDB riêng. Đây là một query layer thuần túy, đọc dữ liệu từ 2 collections (`contracts`, `invoices`) rồi merge thành danh sách `CalendarEventDto` có kiểu và mức độ nghiêm trọng (severity).

**Luồng aggregate:**

```
Contract (DRAFT/ACTIVE) ──┐
                           ├──► CalendarService ──► CalendarEventDto[]
Invoice (PENDING/PARTIAL/OVERDUE) ──┘
```

Payment **không** được query trực tiếp. Các sự kiện liên quan đến thanh toán (`PAYMENT_DUE`, `PAYMENT_DUE_OVERDUE`) được **tính toán tự động** từ `paymentCycleMonths` và `paymentDueDay` trên Contract — không cần đọc Payment collection.

**Vai trò trong từng module:**
- **Contract** → nguồn sự kiện check-in (DRAFT) và checkout (ACTIVE)
- **Invoice** → nguồn sự kiện đến hạn / quá hạn hóa đơn
- **Payment** → không tham chiếu trực tiếp; chỉ dùng Contract fields để suy ra ngày thanh toán định kỳ

---

## 2. Data Model

### Schema

Module Calendar **không có schema Mongoose**. Service inject trực tiếp 2 model:

```typescript
// calendar.module.ts
MongooseModule.forFeature([
    { name: Contract.name, schema: ContractSchema },
    { name: Invoice.name, schema: InvoiceSchema },
])
```

### CalendarEventDto (output shape)

Định nghĩa tại `backend/src/modules/calendar/dto/calendar-event.dto.ts`:

```typescript
export class CalendarEventDto {
    _id: string;           // Synthetic ID, ví dụ: "contract-start-<contractId>"
    date: Date;
    type: CalendarEventType;
    title: string;
    description?: string;
    severity: CalendarEventSeverity;
    relatedId: string;     // ObjectId của contract hoặc invoice
    relatedType: 'contract' | 'invoice';
    roomName?: string;
    tenantName?: string;
    buildingName?: string;
    amount?: number;       // rentPrice (PAYMENT_DUE) hoặc remainingAmount (INVOICE_DUE)
}
```

> **Lưu ý**: `_id` là synthetic string — không phải MongoDB ObjectId. Format: `<prefix>-<contractId>` hoặc `<prefix>-<contractId>-<YYYY-MM-DD>` cho recurring payment events. Mục đích: tránh collision giữa các event type của cùng 1 contract.

### Enums

**CalendarEventType** (10 giá trị):

| Enum value | Nguồn dữ liệu | Điều kiện sinh sự kiện |
|---|---|---|
| `CONTRACT_START` | Contract | DRAFT, startDate trong range, còn > 7 ngày |
| `CONTRACT_END` | Contract | ACTIVE, endDate trong range, còn > 7 ngày |
| `DEPOSIT_CHECKIN_DUE` | Contract | DRAFT, startDate trong range, còn ≤ 7 ngày (chưa quá hạn) |
| `DEPOSIT_CHECKIN_OVERDUE` | Contract | DRAFT, startDate < now (đã qua nhưng chưa activate) |
| `ACTIVE_CHECKOUT_DUE` | Contract | ACTIVE, endDate trong range, còn ≤ 7 ngày (chưa quá hạn) |
| `ACTIVE_CHECKOUT_OVERDUE` | Contract | ACTIVE, endDate < now (đã qua nhưng vẫn ACTIVE) |
| `INVOICE_DUE` | Invoice | PENDING/PARTIAL/OVERDUE, dueDate trong range, dueDate ≥ today |
| `INVOICE_OVERDUE` | Invoice | PENDING/PARTIAL/OVERDUE, dueDate trong range, dueDate < today và remainingAmount > 0 |
| `PAYMENT_DUE` | Contract (computed) | ACTIVE LONG_TERM, ngày tính theo paymentCycleMonths + paymentDueDay, ≥ today |
| `PAYMENT_DUE_OVERDUE` | Contract (computed) | ACTIVE LONG_TERM, ngày tính theo paymentCycleMonths + paymentDueDay, < today |

**CalendarEventSeverity**:

| Giá trị | Áp dụng cho |
|---|---|
| `info` | CONTRACT_START, CONTRACT_END |
| `warning` | DEPOSIT_CHECKIN_DUE, ACTIVE_CHECKOUT_DUE, PAYMENT_DUE |
| `danger` | *_OVERDUE events (DEPOSIT_CHECKIN_OVERDUE, ACTIVE_CHECKOUT_OVERDUE, INVOICE_OVERDUE, PAYMENT_DUE_OVERDUE) |

### DTO Validation (Query Input)

**GetCalendarEventsDto** (dùng cho `GET /calendar/events`):

```typescript
export class GetCalendarEventsDto {
    @IsDateString()
    start: string;          // Bắt buộc, ISO 8601

    @IsDateString()
    end: string;            // Bắt buộc, ISO 8601

    @IsOptional()
    @IsMongoId()
    buildingId?: string;    // Filter theo tòa nhà

    @IsOptional()
    @IsEnum(CalendarEventType)
    type?: CalendarEventType; // Filter theo loại sự kiện
}
```

Các endpoint `GET /calendar/day` và `GET /calendar/month-summary` nhận query params thô (string), **không có DTO class riêng với validation decorators** — controller parse trực tiếp bằng `parseInt()` / `new Date()`.

---

## 3. API Endpoints

Tất cả endpoints dưới prefix `/api/calendar`, yêu cầu JWT auth (`JwtAuthGuard`). `ownerId` được lấy từ JWT token (`req.user.userId`), không truyền qua query param.

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/calendar/events` | JWT | Tất cả events trong date range |
| GET | `/api/calendar/day` | JWT | Events của 1 ngày cụ thể |
| GET | `/api/calendar/month-summary` | JWT | Thống kê event count theo ngày trong tháng |

### GET /api/calendar/events

**Query params:**

| Param | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `start` | ISO date string | Có | Ngày bắt đầu range |
| `end` | ISO date string | Có | Ngày kết thúc range |
| `buildingId` | MongoId string | Không | Lọc theo tòa nhà |
| `type` | CalendarEventType | Không | Lọc theo loại sự kiện |

**Response**: `CalendarEventDto[]` — sorted ascending theo `date`.

**Ví dụ request:**

```
GET /api/calendar/events?start=2026-05-01T00:00:00Z&end=2026-05-31T23:59:59Z&buildingId=6634abc...
```

### GET /api/calendar/day

**Query params:**

| Param | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `date` | ISO date string | Có | Ngày cụ thể |
| `buildingId` | MongoId string | Không | Lọc theo tòa nhà |

**Response**: `CalendarDayEventsDto`

```typescript
{
    date: string;           // "YYYY-MM-DD" (local timezone)
    events: CalendarEventDto[];
}
```

Internally gọi `getEventsInRange()` với `startOfDay(date)` đến `endOfDay(date)` (00:00:00.000 – 23:59:59.999).

### GET /api/calendar/month-summary

**Query params:**

| Param | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `year` | number (string) | Có | Năm, ví dụ: 2026 |
| `month` | number (string) | Có | Tháng 1–12 |
| `buildingId` | MongoId string | Không | Lọc theo tòa nhà |

**Response**: `CalendarMonthSummaryDto`

```typescript
{
    days: Record<string, Record<CalendarEventType, number>>;
    // Key ngoài: "YYYY-MM-DD"
    // Key trong: CalendarEventType — chỉ có ngày có events mới xuất hiện
    totalEvents: number;
}
```

**Ví dụ response:**

```json
{
    "days": {
        "2026-05-10": {
            "INVOICE_DUE": 2,
            "PAYMENT_DUE": 1,
            "CONTRACT_START": 0,
            ...
        }
    },
    "totalEvents": 3
}
```

> Endpoint này được frontend dùng cho month view — chỉ fetch một lần khi đổi tháng, sau đó render dots/badges trên calendar grid mà không cần biết chi tiết event.

---

## 4. Business Rules & Aggregation Logic

### Invariants

- **ownerId filter bắt buộc**: Mọi query đều filter `{ ownerId: new Types.ObjectId(ownerId) }`. ownerId lấy từ JWT, không bao giờ từ query param.
- **isDeleted filter**: `{ isDeleted: { $ne: true } }` áp dụng cho cả Contract và Invoice query.
- **Read-only**: Module không có endpoint write. Không có POST/PUT/DELETE.
- **buildingId filter dùng in-memory**: Database query lấy tất cả theo ownerId, sau đó filter `c.roomId?.buildingId?._id?.toString() === buildingId` trong application layer (không phải $match trong MongoDB). Lý do: buildingId nằm trong populated field của roomId.

### Contract Events — Logic Chi Tiết

**Nguồn query**: Contracts có `status: { $in: [ACTIVE, DRAFT] }`.

MongoDB query dùng `$or` để lấy:
1. `startDate` nằm trong range → DRAFT check-in events
2. `endDate` nằm trong range → ACTIVE checkout events
3. DRAFT contracts với `startDate < today` (quá hạn check-in, không phụ thuộc range)

**Phân loại event từ contract:**

Mỗi contract tạo ra **tối đa 1 event** dựa trên status + thời gian:

```
DRAFT contract:
  startDate đã qua now     → DEPOSIT_CHECKIN_OVERDUE (severity: danger)
  startDate còn ≤ 7 ngày   → DEPOSIT_CHECKIN_DUE (severity: warning)
  startDate còn > 7 ngày   → CONTRACT_START (severity: info)

ACTIVE contract:
  endDate đã qua now       → ACTIVE_CHECKOUT_OVERDUE (severity: danger)
  endDate còn ≤ 7 ngày     → ACTIVE_CHECKOUT_DUE (severity: warning)
  endDate còn > 7 ngày     → CONTRACT_END (severity: info)
```

**Xử lý short-term vs long-term precision:**

- **SHORT_TERM** (contractType hoặc roomType): so sánh timestamp full (hours/minutes) — `now.getTime()`
- **LONG_TERM**: so sánh day-level — `today.setHours(0,0,0,0)` — tránh false positive trong ngày

### Payment Due Events — Logic Chi Tiết

**Chỉ áp dụng** cho `ACTIVE` contracts có `contractType: LONG_TERM` hoặc `roomType: LONG_TERM`.

**Thuật toán tính ngày thanh toán định kỳ:**

```
cycle = contract.paymentCycleMonths (default: 1)
payDay = contract.paymentDueDay (default: 1)

minFirstPayment = contractStart + cycle months (ngày 1 của tháng đó)
startFrom = minFirstPayment

Vòng lặp (max 120 iterations = 10 năm):
  paymentDate = ngày `payDay` của tháng `current`
               (clamp về lastDayOfMonth nếu payDay > số ngày trong tháng)
  
  Nếu paymentDate ∈ [rangeStart, rangeEnd]:
    isOverdue = paymentDate < today
    emit PAYMENT_DUE hoặc PAYMENT_DUE_OVERDUE
  
  current += cycle months
```

`_id` của payment event: `payment-<contractId>-<YYYY-MM-DD>` — đảm bảo unique kể cả khi cùng contract có nhiều payment dates trong range.

### Invoice Events — Logic Chi Tiết

Query Invoice với:
- `dueDate: { $gte: startDate, $lte: endDate }` — filter ngày trực tiếp trong database
- `status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }` — bỏ qua PAID và CANCELLED

Phân loại:
- `dueDate < today && remainingAmount > 0` → `INVOICE_OVERDUE`
- Còn lại → `INVOICE_DUE`

> **Lưu ý**: `amount` trong event là `invoice.remainingAmount` (số tiền còn thiếu), không phải tổng hóa đơn.

---

## 5. Timezone Handling

Service dùng `toLocalDateKey()` để convert `Date` → `"YYYY-MM-DD"` theo **local timezone của server** (không dùng `toISOString()` để tránh UTC shift):

```typescript
function toLocalDateKey(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
```

Frontend (BigCalendar) dùng `date-fns` `format(date, 'yyyy-MM-dd')` — cũng theo local timezone của browser. Nếu server và client khác timezone, date keys có thể lệch nhau 1 ngày ở biên tháng.

---

## 6. Frontend Touchpoints

### Không có trang Calendar riêng

Không tồn tại `frontend/src/pages/*/Calendar*.tsx`. BigCalendar được nhúng trực tiếp vào **Dashboard page** (`frontend/src/pages/dashboard/DashboardPage.tsx`) trong một `DataPanel` widget.

### BigCalendar Component

`frontend/src/components/dashboard/BigCalendar.tsx`

**Props:**

```typescript
interface BigCalendarProps {
    buildingId?: string; // Lấy từ buildingStore của dashboard
}
```

**State nội bộ:**

| State | Mô tả |
|---|---|
| `currentMonth: Date` | Tháng đang hiển thị |
| `selectedDate: Date \| null` | Ngày được click |
| `isModalOpen: boolean` | Hiển thị day-detail modal |

**React Query:**

| Query key | Endpoint | Trigger |
|---|---|---|
| `['calendar-summary', year, month, buildingId]` | `GET /calendar/month-summary` | Mỗi khi đổi tháng hoặc buildingId |
| `['calendar-day', date.toISOString(), buildingId]` | `GET /calendar/day` | Chỉ khi `selectedDate && isModalOpen` |

**Rendering logic:**

1. **Month grid**: Dùng `date-fns` (`startOfMonth`, `endOfMonth`, `eachDayOfInterval`). Padding ô trống ở đầu tháng tính bằng `(getDay(monthStart) + 6) % 7` — bắt đầu từ thứ Hai (Mon-first).
2. **Event dots per cell**: Đọc từ `monthSummary.days["YYYY-MM-DD"]`, lấy các type có count > 0. Hiển thị tối đa 3 dots + badge "+N nữa".
3. **Day detail modal**: Khi click vào ô ngày, mở Dialog, fetch `getDayEvents()`, render từng event với badge màu theo `EVENT_COLORS`.

**Color mapping** (`EVENT_COLORS`):

| Event type | Shell class | Dot class |
|---|---|---|
| CONTRACT_START | `bg-success/12 text-success` | `bg-success` |
| CONTRACT_END | `bg-warning/12 text-warning` | `bg-warning` |
| DEPOSIT_CHECKIN_DUE | `bg-info/12 text-info` | `bg-info` |
| DEPOSIT_CHECKIN_OVERDUE | `bg-error/12 text-error` | `bg-error` |
| ACTIVE_CHECKOUT_DUE | `bg-warning/12 text-warning` | `bg-warning` |
| ACTIVE_CHECKOUT_OVERDUE | `bg-error/12 text-error` | `bg-error` |
| INVOICE_DUE | `bg-info/12 text-info` | `bg-info` |
| INVOICE_OVERDUE | `bg-error/12 text-error` | `bg-error` |
| PAYMENT_DUE | `bg-success/12 text-success` | `bg-success` |
| PAYMENT_DUE_OVERDUE | `bg-error/12 text-error` | `bg-error` |

**Navigation từ event**: Click "Xem hợp đồng" → `navigate('/contracts/<relatedId>')`. Click "Xem hóa đơn" → `navigate('/invoices/<relatedId>')`.

### UI Component `calendar.tsx`

`frontend/src/components/ui/calendar.tsx` là Radix UI / shadcn calendar component dùng `react-day-picker` — được dùng cho **date picker inputs** trong các form (ví dụ DatePicker trong TenantHistory). Không liên quan đến BigCalendar hay calendar API.

### i18n Keys (vi)

Tất cả keys dưới namespace `calendar`:

| Key | Giá trị tiếng Việt |
|---|---|
| `calendar.title` | Lịch |
| `calendar.subtitle` | Xem lịch các sự kiện quan trọng |
| `calendar.noEvents` | Không có sự kiện |
| `calendar.eventsCount` | `{{count}} sự kiện` |
| `calendar.today` | Hôm nay |
| `calendar.viewDay` | Xem chi tiết |
| `calendar.viewContract` | Xem hợp đồng |
| `calendar.viewInvoice` | Xem hóa đơn |
| `calendar.eventTypes.CONTRACT_START` | Hợp đồng bắt đầu |
| `calendar.eventTypes.CONTRACT_END` | Hợp đồng kết thúc |
| `calendar.eventTypes.DEPOSIT_CHECKIN_DUE` | Sắp check-in |
| `calendar.eventTypes.DEPOSIT_CHECKIN_OVERDUE` | Quá hạn check-in |
| `calendar.eventTypes.ACTIVE_CHECKOUT_DUE` | Sắp checkout |
| `calendar.eventTypes.ACTIVE_CHECKOUT_OVERDUE` | Quá hạn checkout |
| `calendar.eventTypes.INVOICE_DUE` | Hóa đơn đến hạn |
| `calendar.eventTypes.INVOICE_OVERDUE` | Hóa đơn quá hạn |
| `calendar.eventTypes.PAYMENT_DUE` | Nhắc thanh toán |
| `calendar.eventTypes.PAYMENT_DUE_OVERDUE` | Quá hạn thanh toán |
| `calendar.daysLeft` | `Còn {{days}} ngày` |
| `calendar.overdueDays` | `Quá hạn {{days}} ngày` |
| `calendar.amount` | Số tiền |
| `calendar.loadingEvents` | Đang tải sự kiện |
| `calendar.noEventsShort` | Không có lịch |
| `calendar.noEventsTitle` | Không có sự kiện |

> **TODO**: Các key `calendar.daysLeft` và `calendar.overdueDays` được định nghĩa trong translation file nhưng **không thấy được dùng** trong BigCalendar.tsx (description text được hardcode bằng template literal tiếng Việt trực tiếp trong service — ví dụ: `` `Còn ${daysUntilStart} ngày - ${tenantName}` ``). Xem xét chuyển description sang frontend để tận dụng i18n.

---

## 7. Cross-Module Dependencies

### Module này CẦN:

| Module | Lý do |
|---|---|
| `ContractsModule` | Schema `Contract` — nguồn contract events và payment due events |
| `InvoicesModule` | Schema `Invoice` — nguồn invoice events |
| `AuthModule` | `JwtAuthGuard` — tất cả endpoints yêu cầu auth |

Khai báo trong `CalendarModule.imports`:

```typescript
MongooseModule.forFeature([
    { name: Contract.name, schema: ContractSchema },
    { name: Invoice.name, schema: InvoiceSchema },
])
```

### Module khác CẦN calendar:

Không có module nào import `CalendarModule` hoặc `CalendarService`. Calendar là **leaf node** — chỉ đọc từ các module khác, không cung cấp service cho bên nào.

`CalendarModule` có `exports: [CalendarService]` nhưng hiện tại chưa có module nào import.

---

## 8. Performance & Indexes

### Queries được thực thi mỗi request `month-summary`

Mỗi lần gọi `getMonthSummary()` thực hiện **3 database queries** song song (sequential, không phải Promise.all):

1. `contractModel.find()` cho contract events (DRAFT + ACTIVE)
2. `contractModel.find()` cho payment due events (ACTIVE LONG_TERM)
3. `invoiceModel.find()` cho invoice events

Tổng: 2 lần query contracts + 1 lần query invoices mỗi request.

### Indexes liên quan

Từ `contract.schema.ts`:

```typescript
ContractSchema.index({ ownerId: 1 });
ContractSchema.index({ roomId: 1 });
ContractSchema.index({ tenantId: 1 });
ContractSchema.index({ startDate: 1, endDate: 1 });
```

Index `{ startDate: 1, endDate: 1 }` hỗ trợ range query của contract events. Tuy nhiên query filter đầu tiên là `ownerId`, vậy compound index `{ ownerId: 1, startDate: 1, endDate: 1 }` sẽ hiệu quả hơn cho use case này.

Invoice query dùng `dueDate` range — cần xác nhận index tồn tại trên `invoices` collection.

### Pagination

Không có pagination. Tất cả events trong range được trả về toàn bộ. Với hệ thống lớn (nhiều contracts ACTIVE), `getPaymentDueEvents()` có thể generate nhiều events (max 120 iterations per contract × số contracts ACTIVE).

---

## 9. Gotchas & Testing Notes

### Pitfalls

1. **Timezone mismatch**: `toLocalDateKey()` dùng server local time. Frontend dùng browser local time. Nếu server deploy UTC+0 và user ở UTC+7, ngày key có thể lệch ở ranh giới ngày (23:00–00:00 UTC+0 = 06:00–07:00 UTC+7 ngày hôm sau). Hiện tại project deploy local nên không phát sinh, nhưng cần chú ý khi deploy lên cloud.

2. **buildingId filter in-memory**: Filter buildingId không phải database-level. Nếu owner có nhiều tòa nhà với nhiều contracts, query sẽ load toàn bộ rồi mới lọc. Với scale lớn nên xem xét thêm join/lookup trong pipeline.

3. **OVERDUE check-in events không bị giới hạn bởi date range**: Contracts DRAFT với `startDate < today` luôn được include trong query (clause thứ 3 trong `$or`) bất kể date range của request. Event OVERDUE sẽ xuất hiện trong mọi request, kể cả khi range là tháng tương lai.

4. **relatedType chỉ có 'contract' | 'invoice'**: Không có 'payment' vì payment events được derive từ Contract (không phải Payment collection).

5. **roomName field inconsistency**: Contract query populate `roomId` với `select: 'roomName buildingId'`, fallback `room?.roomName || room?.name`. Invoice query populate với `select: 'name buildingId'` (không có `roomName`). Hai source dùng field name khác nhau.

6. **Month summary cấu trúc khởi tạo đủ 10 keys**: Khi khởi tạo `days[dateKey]`, object được khởi tạo với đủ 10 `CalendarEventType` key đặt về 0. Tuy nhiên khi JSON serialize, các field có giá trị 0 vẫn được gửi về frontend (không strip).

### Test Scenarios

| Scenario | Điều cần kiểm tra |
|---|---|
| Tháng không có event | `days` object rỗng `{}`, `totalEvents: 0` |
| Tháng đầy event (nhiều contracts) | Sort ascending, không duplicate `_id` |
| Contract DRAFT quá hạn check-in | Xuất hiện trong mọi month-summary request, `severity: danger` |
| LONG_TERM contract với payDay 31 | Clamp về lastDay tháng Feb, Apr, Jun, Sep, Nov |
| Invoice PAID không xuất hiện | Status filter loại `PAID` và `CANCELLED` |
| Building filter | Chỉ events thuộc rooms trong building đó |
| Date range 1 ngày (`/day` endpoint) | `startOfDay` = 00:00:00.000, `endOfDay` = 23:59:59.999 |
| SHORT_TERM contract checkout | So sánh full timestamp, không chỉ ngày |
| Tháng có nhiều payment cycles | Iterator đúng, không infinite loop (max 120 iterations) |
| `type` filter trên `/events` | Chỉ trả về events của type đó |
