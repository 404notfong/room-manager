# Invoices Playbook

> **Vai trò trong domain**: Hóa đơn là chứng từ tài chính trung tâm, sinh ra từ Contract, ghi lại toàn bộ chi phí của một kỳ thuê (tiền phòng, điện, nước, dịch vụ, điều chỉnh) và là đối tượng mà Payment ghi nhận thanh toán lên.
> **Code paths**: `backend/src/modules/invoices/`, `frontend/src/pages/invoices/`, `frontend/src/components/CreateInvoiceModal.tsx`, `frontend/src/components/CreateShortTermInvoiceModal.tsx`, `frontend/src/components/InvoiceViewModal.tsx`

---

## 1. Purpose & Relations

- Invoice luôn thuộc về một Contract (`contractId`) đang ở trạng thái `ACTIVE`.
- Hai loại invoice:
  - **REGULAR** — hóa đơn định kỳ (hàng tháng / theo chu kỳ hợp đồng).
  - **FINAL** — hóa đơn thanh lý, tạo khi hợp đồng chấm dứt; có thể trừ tiền cọc tự động.
- Charge items phẳng (không có sub-document riêng): `rentAmount`, `electricityAmount`, `waterAmount`, `serviceCharges[]`, `adjustments[]`.
- Status machine: `PENDING → PARTIAL → PAID`, hoặc `→ OVERDUE`, hoặc `→ CANCELLED`.
- Payment module ghi nhận tiền lên invoice và tự động cập nhật `paidAmount`, `remainingAmount`, `status`.

---

## 2. Data Model

### Schema (`invoice.schema.ts`)

| Field | Type | Required | Default | Mô tả |
|---|---|---|---|---|
| `ownerId` | `Types.ObjectId` (ref: User) | Có | — | Multi-tenant key |
| `contractId` | `Types.ObjectId` (ref: Contract) | Có | — | Hợp đồng nguồn |
| `roomId` | `Types.ObjectId` (ref: Room) | Có | — | Phòng |
| `tenantId` | `Types.ObjectId` (ref: Tenant) | Có | — | Khách thuê |
| `invoiceNumber` | `string` | Có | — | Unique toàn collection |
| `invoiceType` | `string` (enum InvoiceType) | Không | `REGULAR` | REGULAR \| FINAL |
| `billingPeriod` | `{ month: number, year: number }` | Có | — | Kỳ thanh toán |
| `checkInTime` | `Date` | Không | — | Chỉ cho phòng ngắn hạn |
| `checkOutTime` | `Date` | Không | — | Chỉ cho phòng ngắn hạn |
| `totalHours` | `number` | Không | `0` | Số giờ (HOURLY) |
| `totalDays` | `number` | Không | `0` | Số ngày (DAILY) |
| `previousElectricIndex` | `number` | Không | `0` | Chỉ số điện kỳ trước |
| `currentElectricIndex` | `number` | Không | `0` | Chỉ số điện kỳ này |
| `electricityUsed` | `number` | Không | `0` | Số kWh tiêu thụ |
| `electricityPrice` | `number` | Không | `0` | Đơn giá điện tại thời điểm lập |
| `electricityAmount` | `number` | Không | `0` | Tiền điện |
| `previousWaterIndex` | `number` | Không | `0` | Chỉ số nước kỳ trước |
| `currentWaterIndex` | `number` | Không | `0` | Chỉ số nước kỳ này |
| `waterUsed` | `number` | Không | `0` | Số m³ tiêu thụ |
| `waterPrice` | `number` | Không | `0` | Đơn giá nước tại thời điểm lập |
| `waterAmount` | `number` | Không | `0` | Tiền nước |
| `rentAmount` | `number` | Không | `0` | Tiền thuê phòng |
| `serviceCharges` | `Array<{ name: string, amount: number }>` | Không | `[]` | Danh sách phí dịch vụ |
| `totalAmount` | `number` | Có | `0` | Tổng cộng |
| `paidAmount` | `number` | Không | `0` | Đã thanh toán |
| `remainingAmount` | `number` | Không | `0` | Còn lại |
| `status` | `string` (enum InvoiceStatus) | Không | `PENDING` | Trạng thái |
| `dueDate` | `Date` | Có | — | Hạn thanh toán |
| `paidDate` | `Date` | Không | — | Ngày thanh toán xong |
| `notes` | `string` | Không | — | Ghi chú |
| `adjustments` | `InvoiceAdjustment[]` | Không | `[]` | Khoản điều chỉnh (phụ thu / giảm giá) |
| `contractSnapshot` | `Record<string, any>` | Không | — | Snapshot hợp đồng tại lúc tạo |
| `isDeleted` | `boolean` | Không | `false` | Soft delete |

**Indexes**: `ownerId+isDeleted`, `contractId`, `roomId`, `tenantId`, `invoiceNumber`, `billingPeriod.year+month`, `status+dueDate`.

### Sub-schema: `InvoiceAdjustment`

| Field | Type | Required | Default | Mô tả |
|---|---|---|---|---|
| `description` | `string` | Có | — | Mô tả khoản điều chỉnh |
| `amount` | `number` | Có | — | Số tiền |
| `isDiscount` | `boolean` | Không | `false` | `true` = giảm giá; `false` = phụ thu |

### Enums liên quan

```typescript
// backend/src/common/constants/enums.ts

enum InvoiceType {
    REGULAR = 'REGULAR',   // Hóa đơn định kỳ
    FINAL   = 'FINAL',     // Hóa đơn cuối (đóng hợp đồng)
}

enum InvoiceStatus {
    PENDING   = 'PENDING',
    PARTIAL   = 'PARTIAL',
    PAID      = 'PAID',
    OVERDUE   = 'OVERDUE',
    CANCELLED = 'CANCELLED',
}

// Enum phương thức thanh toán (dùng trong Payment, nhưng có liên quan đến deposit logic)
enum PaymentMethod {
    CASH               = 'CASH',
    BANK_TRANSFER      = 'BANK_TRANSFER',
    MOMO               = 'MOMO',
    ZALOPAY            = 'ZALOPAY',
    DEPOSIT_DEDUCTION  = 'DEPOSIT_DEDUCTION',  // Tự động khi FINAL + applyDeposit
    OTHER              = 'OTHER',
}
```

### DTO Validation

#### `CreateInvoiceDto`
| Field | Decorator(s) | Ghi chú |
|---|---|---|
| `contractId` | `@IsMongoId()`, `@IsNotEmpty()` | |
| `roomId` | `@IsMongoId()`, `@IsNotEmpty()` | |
| `tenantId` | `@IsMongoId()`, `@IsNotEmpty()` | |
| `invoiceType` | `@IsEnum(InvoiceType)`, `@IsOptional()` | Default: REGULAR |
| `month` | `@IsNumber()`, `@IsNotEmpty()` | 1–12 |
| `year` | `@IsNumber()`, `@IsNotEmpty()` | |
| `checkInTime` | `@IsDate()`, `@Type(() => Date)`, `@IsOptional()` | Short-term |
| `checkOutTime` | `@IsDate()`, `@Type(() => Date)`, `@IsOptional()` | Short-term |
| `totalHours` | `@IsNumber()`, `@IsOptional()` | |
| `totalDays` | `@IsNumber()`, `@IsOptional()` | |
| `previousElectricIndex` | `@IsNumber()`, `@IsOptional()` | |
| `currentElectricIndex` | `@IsNumber()`, `@IsOptional()` | |
| `initialElectricIndex` | `@IsNumber()`, `@IsOptional()` | Frontend preferred alias |
| `electricityPrice` | `@IsNumber()`, `@IsOptional()` | |
| `previousWaterIndex` | `@IsNumber()`, `@IsOptional()` | |
| `currentWaterIndex` | `@IsNumber()`, `@IsOptional()` | |
| `initialWaterIndex` | `@IsNumber()`, `@IsOptional()` | Frontend preferred alias |
| `waterPrice` | `@IsNumber()`, `@IsOptional()` | |
| `billingMonths` | `@IsNumber()`, `@IsOptional()` | Số tháng kỳ này; fallback `contract.paymentCycleMonths` |
| `rentAmount` | `@IsNumber()`, `@IsNotEmpty()` | |
| `serviceCharges` | `@IsArray()`, `@ValidateNested({ each: true })`, `@Type(() => ServiceChargeDto)`, `@IsOptional()` | |
| `adjustments` | `@IsArray()`, `@ValidateNested({ each: true })`, `@Type(() => AdjustmentDto)`, `@IsOptional()` | |
| `contractSnapshot` | `@IsOptional()` | Plain object |
| `dueDate` | `@IsDate()`, `@Type(() => Date)`, `@IsNotEmpty()` | |
| `applyDeposit` | `@IsBoolean()`, `@IsOptional()` | Chỉ dùng cho FINAL |
| `notes` | `@IsString()`, `@IsOptional()` | |

#### `UpdateInvoiceDto`
| Field | Decorator(s) |
|---|---|
| `status` | `@IsEnum(InvoiceStatus)`, `@IsOptional()` |
| `paidAmount` | `@IsNumber()`, `@IsOptional()` |
| `paidDate` | `@IsDate()`, `@Type(() => Date)`, `@IsOptional()` |
| `notes` | `@IsString()`, `@IsOptional()` |
| `adjustments` | `@IsArray()`, `@ValidateNested({ each: true })`, `@Type(() => AdjustmentDto)`, `@IsOptional()` |

#### `InvoiceQueryDto` (extends `PaginationDto`)
| Field | Decorator(s) |
|---|---|
| `search` | `@IsOptional()`, `@IsString()` |
| `buildingId` | `@IsOptional()`, `@IsMongoId()` |
| `status` | `@IsOptional()`, `@IsEnum(InvoiceStatus)` |

---

## 3. API Endpoints

| Method | Path | Auth | Mô tả | Request | Response |
|---|---|---|---|---|---|
| `POST` | `/api/invoices` | JWT | Tạo invoice mới | `CreateInvoiceDto` (body) | Invoice document |
| `GET` | `/api/invoices` | JWT | Danh sách (paginated) | `InvoiceQueryDto` (query) | `{ data: Invoice[], meta: { total, page, limit, totalPages } }` |
| `GET` | `/api/invoices/contract/:contractId` | JWT | Tất cả invoices của 1 contract | — | `Invoice[]` (sort `billingPeriod` desc) |
| `GET` | `/api/invoices/:id` | JWT | Chi tiết 1 invoice | — | Invoice (populate contractId, tenantId, roomId → buildingId) |
| `PUT` | `/api/invoices/:id` | JWT | Cập nhật invoice | `UpdateInvoiceDto` (body) | Invoice updated |
| `DELETE` | `/api/invoices/:id` | JWT | Xóa invoice (soft) | — | void |

**Lưu ý route order**: Route `/api/invoices/contract/:contractId` phải được đăng ký **trước** `/api/invoices/:id` để NestJS không nhầm `"contract"` thành một ObjectId.

**Search** (GET `/api/invoices`) matching theo: `invoiceNumber`, `tenantId.fullName`, `roomId.roomCode`.

**Sort** hỗ trợ các field: `invoiceNumber`, `tenant`, `room`, `dueDate`, `totalAmount`, `paidAmount`, `remainingAmount`, `status`, `createdAt`. Default: `createdAt desc`.

---

## 4. Business Rules & State Machine

### InvoiceStatus State Machine

```
Tạo invoice
    │
    ▼
PENDING ──────────────────────────────────────────────────────┐
    │                                                          │
    ├──(Payment.create, amount < remaining)──▶ PARTIAL         │
    │       │                                     │            │
    │       └──(Payment.create, covers full)─▶ PAID           │
    │                                             ▲            │
    ├──(Payment.create, covers full)──────────────┘            │
    │                                                          │
    ├──(dueDate < now, frontend highlights; no auto-flip*)     │
    │                                                          │
    └──(manual UpdateInvoiceDto.status = CANCELLED)──▶ CANCELLED
```

(*) **OVERDUE không tự flip**: Không có scheduled job / cron tự đổi status sang `OVERDUE`. Frontend (`InvoicesPage`) chỉ hiển thị cảnh báo thị giác khi `status === 'PENDING' && dueDate < now`. Status `OVERDUE` chỉ set được qua `PUT /api/invoices/:id` thủ công, hoặc khi `PaymentsService.update` điều chỉnh lại amount và `paidAmount === 0 && dueDate < now`.

**Transitions do `PaymentsService` điều khiển**:
- `Payment.create(amount)`: `paidAmount += amount` → nếu `remaining <= 0` → `PAID`; nếu `paidAmount > 0` → `PARTIAL`.
- `Payment.update(amount)`: tính lại diff → nếu `paidAmount >= total` → `PAID`; nếu `paidAmount > 0` → `PARTIAL`; nếu `paidAmount == 0 && dueDate < now` → `OVERDUE`; else → `PENDING`.
- Không có `Payment.delete` cập nhật invoice — **TODO**: xem phần Gotchas.

**Blocked transitions**:
- Không thể thêm payment vào invoice đã `PAID` hoặc `CANCELLED`.
- Không thể xóa invoice có `paidAmount > 0` (phải xóa payment trước).

### Invariants

- `totalAmount = rentAmount + electricityAmount + waterAmount + serviceTotal + adjustmentTotal`
- `adjustmentTotal = sum(charges) - sum(discounts)`
- `totalAmount >= 0` (clamped với `Math.max(0, ...)`)
- `remainingAmount = totalAmount - paidAmount`
- `invoiceNumber` unique toàn collection (không phải per-owner).

### REGULAR vs FINAL: Sự khác biệt cốt lõi

#### REGULAR
- Tạo **thủ công** từ `InvoiceCreatePage` — không có job tự động.
- Validation `billingPeriod` bắt buộc:
  1. Không được là tương lai (> tháng hiện tại).
  2. Phải lớn hơn kỳ của invoice cuối cùng đã tồn tại (chronological order).
- Sau khi tạo thành công: cập nhật `contract.nextPaymentDate` (chỉ khi `billingPeriod >= nextPaymentDate`).
- Cập nhật `room.currentElectricIndex` và `room.currentWaterIndex` (để làm `previousIndex` cho kỳ tiếp theo).

#### FINAL
- Flag: `invoiceType = FINAL` trong `CreateInvoiceDto`.
- **Bypass** cả hai validation billingPeriod trên (không cần sau kỳ cuối, không cần ≤ tháng hiện tại).
- Hỗ trợ `applyDeposit: true` → tự tạo Payment với `paymentMethod = DEPOSIT_DEDUCTION`:
  - Nếu `deposit >= total` → invoice chuyển `PAID` ngay + tạo payment refund âm nếu thừa.
  - Nếu `deposit < total` → invoice chuyển `PARTIAL`.
- **Không** cập nhật `contract.nextPaymentDate` (FINAL không advance chu kỳ).
- Vẫn cập nhật room meter readings.

### Short-term vs Long-term

| Khía cạnh | Long-term | Short-term |
|---|---|---|
| Form UI | `CreateInvoiceModal` | `CreateShortTermInvoiceModal` |
| rentAmount | Lấy từ `contract.rentPrice` (× billingMonths nếu pro-rate) | Tính theo `shortTermPricingType` (FIXED / HOURLY / DAILY) |
| Điện/nước | Có (nhập chỉ số cũ/mới) | Không |
| Trường đặc thù | `billingPeriod`, `billingMonths`, chỉ số điện/nước | `checkInTime`, `checkOutTime`, `totalHours`, `totalDays` |
| Sau khi tạo invoice | Advance `nextPaymentDate` | **Auto-terminate** contract, set room `AVAILABLE`, clear `tenant.currentRoomId` |
| Deposit | Tùy chọn (FINAL) | Auto-deduct `contract.depositAmount` thành `adjustments[isDiscount=true]` |

**Short-term pricing calculation** (backend `calculateShortTermAmount`):
- `FIXED` → `contract.fixedPrice`.
- `HOURLY + PER_HOUR` → `totalHours × contract.pricePerHour`.
- `HOURLY + TABLE` → price table theo `totalHours`, mode `PROGRESSIVE` hoặc `FLAT`.
- `DAILY` → price table theo `totalDays`.

**FLAT table**: Tìm tier chứa quantity, nhân `quantity × tier.price`.
**PROGRESSIVE table**: Cộng dồn từng tier; tier với `toValue = -1` = "còn lại".

### invoiceNumber Generation

```typescript
const invoiceNumber = `INV-${Date.now()}`;
```

- Format: `INV-<unix-milliseconds>`, ví dụ `INV-1716000000000`.
- Unique nhờ timestamp milliseconds; không có prefix theo owner hay building.
- **TODO (format)**: Không có sequence number hay prefix owner — hai owner tạo cùng ms sẽ collision (xác suất thấp nhưng không zero). Xem phần Gotchas.

---

## 5. Frontend Touchpoints

### Pages

| File | Route | Mô tả |
|---|---|---|
| `frontend/src/pages/invoices/InvoicesPage.tsx` | `/invoices` | Danh sách, filter status, search, sort, delete, quick-pay |
| `frontend/src/pages/invoices/InvoiceCreatePage.tsx` | `/invoices/new` | Luồng 2 bước: chọn contract → form tạo |
| `frontend/src/pages/invoices/InvoiceDetailPage.tsx` | `/invoices/:id` | Receipt view (in / xuất PDF), record payment |

### Components

| File | Mô tả |
|---|---|
| `frontend/src/components/CreateInvoiceModal.tsx` | Form tạo invoice dài hạn; hỗ trợ `isFinal=true` cho FINAL invoice; `renderAsPage=true` để nhúng trong `InvoiceCreatePage` |
| `frontend/src/components/CreateShortTermInvoiceModal.tsx` | Form tạo invoice ngắn hạn; nhập check-in/out, tính tự động; có confirm dialog trước khi submit |
| `frontend/src/components/InvoiceViewModal.tsx` | Modal xem invoice (dùng ở màn hình khác, ví dụ từ contract detail) |
| `frontend/src/components/RecordPaymentModal.tsx` | Modal ghi nhận thanh toán; accessible từ `InvoicesPage` và `InvoiceDetailPage` |

### Billing Period Logic (CreateInvoiceModal)

1. Fetch `GET /invoices/contract/:id` để tìm kỳ cuối đã có.
2. `minDate` = tháng tiếp theo sau kỳ cuối (hoặc tháng bắt đầu hợp đồng nếu chưa có invoice nào).
3. `maxDate` = tháng hiện tại.
4. Nếu `minDate > maxDate` → thông báo "Chưa đến kỳ thanh toán" và disable nút submit (`onNoBillingPeriods` callback).
5. Suggested period = `contract.nextPaymentDate` (hoặc tháng hiện tại nếu không có).

### Key i18n Keys (VI)

```
invoices.title               = "Hóa đơn"
invoices.statusPending       = "Chờ thanh toán"
invoices.statusPartial       = "Thanh toán một phần"
invoices.statusPaid          = "Đã thanh toán"
invoices.statusOverdue       = "Quá hạn"
invoices.statusCancelled     = "Đã hủy"
invoices.finalInvoice        = "Hóa đơn cuối"
invoices.finalBadge          = "Thanh lý"
invoices.applyDeposit        = "Trừ tiền cọc"
invoices.depositCoversAll    = "Cọc đủ thanh toán. Hoàn cọc: {{refund}}"
invoices.depositPartial      = "Cọc không đủ. Còn lại: {{remaining}}"
invoices.billingPeriod       = "Kỳ thanh toán"
invoices.noValidPeriodsTitle = "Chưa đến kỳ thanh toán"
invoices.checkInRequired     = "Vui lòng chọn thời gian nhận phòng"
invoices.checkOutRequired    = "Vui lòng chọn thời gian trả phòng"
invoices.checkOutAfterCheckIn = "Trả phòng phải sau nhận phòng"
invoices.electricIndexError  = "Chỉ số điện mới phải lớn hơn hoặc bằng chỉ số cũ"
invoices.waterIndexError     = "Chỉ số nước mới phải lớn hơn hoặc bằng chỉ số cũ"
invoices.confirmAutoTerminate = "Sau khi tạo, hệ thống sẽ tự động cập nhật:"
invoices.proRateLabel        = "Tính tiền thuê theo số tháng thực tế"
```

---

## 6. Cross-Module Dependencies

### Module này CẦN

| Module | Lý do |
|---|---|
| **Contract** | Nguồn gốc invoice; lấy `rentPrice`, `electricityPrice`, `waterPrice`, `serviceCharges`, `paymentCycleMonths`, `shortTermPricingType`, `depositAmount`; update `nextPaymentDate` sau khi tạo REGULAR |
| **Room** | Lấy `currentElectricIndex` / `currentWaterIndex` làm `previousIndex`; update meter readings sau khi tạo; set `status = AVAILABLE` sau short-term |
| **Tenant** | Gắn `tenantId`; update `status`, `currentRoomId`, `moveOutDate` sau short-term |
| **Payment** | `InvoicesModule` import `PaymentSchema` để tạo deposit payment tự động trong FINAL logic |
| **User** | `ownerId` cho multi-tenant isolation |

### Module khác CẦN module này

| Module | Lý do |
|---|---|
| **Payments** | `PaymentsService.create()` fetch invoice để validate và cập nhật `paidAmount` / `status` |
| **Contracts** (`InvoiceViewModal`, `ContractViewModal`) | Hiển thị danh sách invoice của contract via `GET /invoices/contract/:id` |

---

## 7. Gotchas & Testing Notes

### Pitfalls đã biết

1. **invoiceNumber collision**: `INV-${Date.now()}` không đảm bảo unique tuyệt đối nếu hai request đến trong cùng 1 millisecond. Không có retry/sequence. MongoDB unique index sẽ throw error, nhưng không có retry logic phía service.
   - **TODO**: Xem xét dùng `uuid` hoặc `owner-prefixed sequence` (ví dụ `INV-<ownerId-short>-<seq>`).

2. **OVERDUE không tự flip**: Không có cronjob. `OVERDUE` chỉ được set khi `PaymentsService.update` tính lại và `paidAmount === 0 && dueDate < now`. Nếu invoice `PENDING` quá hạn nhưng không có payment update nào, status vẫn là `PENDING` trong database — UI chỉ highlight màu đỏ phía client.
   - **TODO**: Implement cron job hoặc endpoint `POST /invoices/mark-overdue` để flip các invoice quá hạn.

3. **Payment delete không recalculate invoice**: `PaymentsService.remove()` (soft delete payment) không cập nhật ngược `invoice.paidAmount` / `status`. Chỉ `create` và `update` mới làm điều đó.
   - **TODO**: `remove()` cần recalculate invoice sau khi soft-delete payment.

4. **`initialElectricIndex` vs `currentElectricIndex`**: Frontend gửi meter reading mới qua `initialElectricIndex`, backend normalize sang `currentElectricIndex` khi lưu. InvoiceDetailPage render `invoice.initialElectricIndex` — field này không tồn tại trong schema (chỉ là DTO field), nên có thể hiển thị `undefined`.
   - **TODO**: Đồng nhất field name hoặc map trong response DTO.

5. **Deposit deduction cho short-term**: Backend tự động tạo `adjustments[isDiscount=true]` với `depositAmount` cho mọi short-term invoice — không check `applyDeposit` flag (chỉ FINAL mới check flag này). Nếu chủ nhà không muốn trừ cọc cho một lượt ngắn hạn, không có cách tắt.

6. **contractSnapshot**: Được serialize vào invoice lúc tạo để "đóng băng" giá. Field là `Record<string, any>` — không có type-safe schema. Nếu cấu trúc contract thay đổi, snapshot cũ vẫn có format cũ.

7. **`billingPeriod` validation cho FINAL**: FINAL bypass validation ngày tương lai, nên có thể tạo FINAL invoice với `month/year` tùy ý. Không có constraint ngăn tạo FINAL invoice cho tháng rất xa tương lai.

### Test Scenarios

| Scenario | Điểm kiểm tra |
|---|---|
| Tạo REGULAR tháng hiện tại (lần đầu) | `billingPeriod` hợp lệ; `invoiceNumber` unique; `contract.nextPaymentDate` tăng 1 cycle; `room.currentElectricIndex` cập nhật |
| Tạo REGULAR trùng kỳ | Phải throw `BadRequestException` "already exists" |
| Tạo REGULAR cho tháng tương lai | Phải throw `BadRequestException` "future period" |
| Tạo REGULAR kỳ bị skip (tháng 3 khi kỳ cuối là tháng 1) | Phải throw `BadRequestException` "must be after last invoiced period" |
| Tạo FINAL với `applyDeposit=true`, deposit < total | Invoice `PARTIAL`; payment `DEPOSIT_DEDUCTION` tạo ra; `remainingAmount > 0` |
| Tạo FINAL với `applyDeposit=true`, deposit >= total | Invoice `PAID` ngay; payment âm (refund) tạo ra nếu deposit > total |
| Tạo invoice ngắn hạn (HOURLY/TABLE) | `contract` auto-terminate; room → `AVAILABLE`; tenant `currentRoomId = null` |
| Ghi nhận payment đủ số | `invoice.status → PAID`, `paidDate` set |
| Ghi nhận payment một phần | `invoice.status → PARTIAL` |
| Ghi nhận payment vượt remaining | `BadRequestException` |
| Xóa invoice có payment | `BadRequestException` "Delete payments first" |
| Xóa invoice không có payment | Soft delete; room meter readings rollback về invoice trước hoặc `contract.initialElectricIndex` |
| Xóa invoice PAID/CANCELLED | **TODO**: Không có guard — có thể xóa nếu `paidAmount = 0` (sau khi xóa payments). Cần verify behavior này. |

---

## 8. Module Files Reference

```
backend/src/modules/invoices/
├── dto/
│   ├── invoice.dto.ts           # CreateInvoiceDto, UpdateInvoiceDto, ServiceChargeDto, AdjustmentDto
│   └── invoice-query.dto.ts     # InvoiceQueryDto extends PaginationDto
├── schemas/
│   └── invoice.schema.ts        # Invoice, InvoiceAdjustment, InvoiceDocument
├── invoices.controller.ts       # 6 endpoints (POST, GET, GET/contract/:id, GET/:id, PUT/:id, DELETE/:id)
├── invoices.service.ts          # Business logic, short-term calc, FINAL deposit logic
└── invoices.module.ts           # Imports: Invoice, Contract, Room, Tenant, Payment schemas

frontend/src/pages/invoices/
├── InvoicesPage.tsx             # List page với filter, sort, pagination, delete, quick-pay
├── InvoiceCreatePage.tsx        # 2-step: contract picker → CreateInvoiceModal / CreateShortTermInvoiceModal
└── InvoiceDetailPage.tsx        # Receipt view, print, PDF export, record payment

frontend/src/components/
├── CreateInvoiceModal.tsx       # Long-term + FINAL invoice form; billing period guard
├── CreateShortTermInvoiceModal.tsx  # Short-term form; check-in/out picker; confirm dialog
└── InvoiceViewModal.tsx         # Read-only invoice modal (dùng từ các màn hình khác)
```
