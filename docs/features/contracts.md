# Contracts Playbook

> **Vai trò trong domain**: Contracts là trung tâm của toàn bộ vòng đời thuê phòng — liên kết Room với Tenant, xác định điều kiện tài chính, và điều phối sinh Invoices theo chu kỳ.
> **Code paths**: `backend/src/modules/contracts/`, `frontend/src/pages/contracts/`, `frontend/src/components/ActivateContractDialog.tsx`, `frontend/src/components/ContractViewModal.tsx`

---

## 1. Purpose & Relations

Contract đại diện cho thỏa thuận thuê phòng giữa một Tenant và một Room trong một khoảng thời gian xác định. Mỗi contract:

- Gắn **1 Room** với **1 Tenant** (quan hệ 1-1 tại một thời điểm cho phòng đang ACTIVE).
- Lưu snapshot giá tại thời điểm tạo: tiền thuê, điện, nước, dịch vụ (serviceCharges[]).
- Sinh **Invoices** theo paymentCycle (chỉ LONG_TERM); SHORT_TERM sinh Invoice thủ công khi check-out.
- Điều khiển trạng thái của Room (`AVAILABLE → DEPOSITED → OCCUPIED → AVAILABLE`) và Tenant (`ACTIVE → DEPOSITED → RENTING → ACTIVE | CLOSED`).

**Quan hệ module:**

```
Buildings ──→ Rooms ──→ Contracts ──→ Invoices ──→ Payments
                             │
                         Tenants
                             │
                         Services (snapshot vào serviceCharges[])
```

---

## 2. Data Model

### Schema (`backend/src/modules/contracts/schemas/contract.schema.ts`)

| Field | Type | Required | Default | Mô tả |
|---|---|---|---|---|
| `ownerId` | `Types.ObjectId` ref `User` | yes | — | Multi-tenant owner, indexed |
| `roomId` | `Types.ObjectId` ref `Room` | yes | — | Phòng thuê, indexed |
| `tenantId` | `Types.ObjectId` ref `Tenant` | yes | — | Khách thuê, indexed |
| `contractCode` | `string` | no (auto) | — | Mã hợp đồng unique sparse, format `HD-{timestamp_base36}-{random4}` |
| `contractType` | `enum ContractType` | no | `LONG_TERM` | Loại hợp đồng |
| `startDate` | `Date` | yes | — | Ngày bắt đầu |
| `endDate` | `Date` | no | — | Ngày kết thúc (undefined = không thời hạn) |
| `rentPrice` | `number` | yes | `0` | Giá thuê phòng (đơn vị VND) |
| `depositAmount` | `number` | no | `0` | Tiền đặt cọc |
| `electricityPrice` | `number` | no | `0` | Giá điện (VND/kWh), chỉ LONG_TERM |
| `waterPrice` | `number` | no | `0` | Giá nước (VND/m³), chỉ LONG_TERM |
| `roomType` | `enum RoomType` | no | `LONG_TERM` | Phản ánh loại phòng (`LONG_TERM` \| `SHORT_TERM`) |
| `shortTermPricingType` | `enum ShortTermPricingType` | no | — | Cách tính giá ngắn hạn |
| `hourlyPricingMode` | `'PER_HOUR' \| 'TABLE'` | no | — | Chế độ tính giờ |
| `pricePerHour` | `number` | no | `0` | Giá theo giờ khi `hourlyPricingMode = PER_HOUR` |
| `fixedPrice` | `number` | no | `0` | Giá cố định khi `shortTermPricingType = FIXED` |
| `shortTermPrices` | `ShortTermPriceTier[]` | no | `[]` | Bảng giá bậc thang (DAILY hoặc HOURLY/TABLE) |
| `priceTableType` | `enum PriceTableType` | no | `PROGRESSIVE` | Cách tính bảng giá: lũy tiến hoặc trọn gói |
| `serviceCharges` | `ServiceCharge[]` | no | `[]` | Snapshot dịch vụ tại thời điểm tạo |
| `paymentCycle` | `enum PaymentCycle` | no | `MONTHLY` | Chu kỳ thanh toán, chỉ LONG_TERM |
| `paymentCycleMonths` | `number` | no | `1` | Số tháng/chu kỳ (dùng khi `CUSTOM`) |
| `paymentDueDay` | `number` | no | `1` | Ngày thanh toán trong tháng (1–31) |
| `initialElectricIndex` | `number` | no | `0` | Chỉ số điện đầu kỳ |
| `initialWaterIndex` | `number` | no | `0` | Chỉ số nước đầu kỳ |
| `status` | `enum ContractStatus` | no | `ACTIVE` | Trạng thái hợp đồng |
| `terms` | `string` | no | — | Điều khoản văn bản |
| `notes` | `string` | no | — | Ghi chú |
| `nextPaymentDate` | `Date` | no | — | Ngày thanh toán kế tiếp (auto-calculated, chỉ LONG_TERM) |
| `terminatedAt` | `Date` | no | — | Thời điểm thực tế thanh lý hợp đồng |
| `isDeleted` | `boolean` | no | `false` | Soft delete |

**MongoDB Indexes:**
- `{ ownerId: 1, isDeleted: 1 }` — query chính
- `{ roomId: 1, status: 1 }` — kiểm tra phòng có đang active contract không
- `{ tenantId: 1 }`
- `{ startDate: 1, endDate: 1 }`
- `contractCode` — unique sparse

### Enums liên quan (`backend/src/common/constants/enums.ts`)

**ContractType** — Loại hợp đồng:
| Value | Ý nghĩa |
|---|---|
| `LONG_TERM` | Thuê dài hạn (theo tháng, có chu kỳ) |
| `SHORT_TERM` | Thuê ngắn hạn (theo giờ/ngày/cố định) |
| `DAILY` | Legacy (giữ lại cho tương thích) |
| `MONTHLY` | Legacy (giữ lại cho tương thích) |

**ContractStatus** — Trạng thái:
| Value | Ý nghĩa |
|---|---|
| `DRAFT` | Đã đặt cọc, chờ kích hoạt |
| `ACTIVE` | Đang hiệu lực |
| `EXPIRED` | Hết hạn (endDate đã qua) |
| `TERMINATED` | Đã thanh lý (kết thúc sớm) |

**PaymentCycle** — Chu kỳ thanh toán (chỉ áp dụng LONG_TERM):
| Value | Số tháng | Nhãn VI |
|---|---|---|
| `MONTHLY` | 1 | Hàng tháng |
| `MONTHLY_2` | 2 | Mỗi 2 tháng |
| `QUARTERLY` | 3 | Hàng quý |
| `MONTHLY_6` | 6 | Mỗi 6 tháng |
| `MONTHLY_12` | 12 | Hàng năm |
| `CUSTOM` | `paymentCycleMonths` | Tùy chỉnh |

**RoomType** (dùng trong contract để phân biệt giá):
`LONG_TERM` | `SHORT_TERM`

**ShortTermPricingType**: `HOURLY` | `DAILY` | `FIXED`

**PriceTableType**: `PROGRESSIVE` (lũy tiến — cộng dồn) | `FLAT` (trọn gói — nhân toàn bộ)

### Sub-schema `ServiceCharge` (snapshot)

Lưu trong `serviceCharges[]` trên contract — đây là **snapshot** tại thời điểm tạo, không còn liên kết live với Service catalog:

```typescript
{
    name: string;       // Tên dịch vụ (snapshot)
    amount: number;     // Giá tại thời điểm ký hợp đồng
    quantity?: number;  // Số lượng (default 1)
    isRecurring: boolean; // Tính định kỳ hay một lần
    // Lưu ý: serviceId và isPredefined không persist vào schema,
    // chỉ dùng trong DTO để validate
}
```

> **TODO**: Schema không persist `serviceId` hay `isPredefined` — validation trong `validateCreateContract` tham chiếu `serviceId` từ DTO nhưng sau khi lưu không còn truy vết được nguồn gốc dịch vụ từ catalog.

### DTO Validation (`backend/src/modules/contracts/dto/contract.dto.ts`)

**`CreateContractDto`** — các field quan trọng:

| Field | Decorator | Ghi chú |
|---|---|---|
| `roomId` | `@IsMongoId() @IsNotEmpty()` | Bắt buộc |
| `buildingId` | `@IsMongoId() @IsNotEmpty()` | Bắt buộc, dùng để validate room scope |
| `tenantId` | `@IsMongoId() @IsOptional()` | Hoặc `newTenant` |
| `newTenant` | `@ValidateNested() @Type(() => CreateTenantDto) @IsOptional()` | Tạo tenant mới inline |
| `contractType` | `@IsEnum(ContractType) @IsNotEmpty()` | Bắt buộc |
| `startDate` | `@Type(() => Date) @IsDate() @IsNotEmpty()` | Bắt buộc |
| `endDate` | `@Type(() => Date) @IsDate() @IsOptional()` | Tùy chọn |
| `rentPrice` | `@IsNumber()` | Bắt buộc (không có `@IsNotEmpty()`, nhưng service validate >= 0) |
| `depositAmount` | `@IsNumber()` | Service validate >= 0 |
| `electricityPrice` | `@IsNumber() @IsOptional()` | Bắt buộc với LONG_TERM (service-level) |
| `paymentCycle` | `@IsEnum(PaymentCycle) @IsOptional()` | Bắt buộc với LONG_TERM (service-level) |
| `serviceCharges` | `@IsArray() @ValidateNested({ each: true }) @Type(() => ServiceChargeDto)` | |
| `shortTermPrices` | `@IsArray() @ValidateNested({ each: true }) @Type(() => ShortTermPriceTierDto)` | |
| `status` | `@IsEnum(ContractStatus) @IsOptional()` | Cho phép tạo thẳng ACTIVE hoặc DRAFT |

**`UpdateContractDto`** — tất cả field đều `@IsOptional()`. Đặc biệt:
- Cho phép truyền `_id`, `__v`, `createdAt`, `updatedAt` (bị ignore ở service).
- `roomId`, `tenantId`, `buildingId` nhận decorator nhưng **bị xóa trong service** trước khi update.

**`ActivateContractDto`:**
| Field | Decorator |
|---|---|
| `startDate` | `@Type(() => Date) @IsDate() @IsNotEmpty()` |
| `endDate` | `@Type(() => Date) @IsDate() @IsOptional()` |

**`TerminateContractDto`:**
| Field | Decorator | Ghi chú |
|---|---|---|
| `endDate` | `@Type(() => Date) @IsDate() @IsNotEmpty()` | Ngày kết thúc |
| `createFinalInvoice` | `@IsBoolean() @IsOptional()` | Flag; logic tạo invoice xử lý ở frontend |
| `invoiceData` | `@IsOptional()` | Dữ liệu hóa đơn cuối (raw, không validate) |

**`GetContractsDto`** extends `PaginationDto`:
| Field | Decorator |
|---|---|
| `search` | `@IsOptional() @IsString()` |
| `buildingId` | `@IsOptional() @IsMongoId()` |
| `status` | `@IsOptional() @IsEnum(ContractStatus)` |

---

## 3. API Endpoints

Tất cả endpoints yêu cầu `JwtAuthGuard`. `@CurrentUser()` inject `user.userId` (ownerId).

| Method | Path | HTTP verb | Mô tả | Body / Query | Response |
|---|---|---|---|---|---|
| POST | `/api/contracts` | `@Post()` | Tạo hợp đồng mới | `CreateContractDto` | `Contract` |
| GET | `/api/contracts` | `@Get()` | Lấy danh sách (paginated + populated) | `GetContractsDto` query | `{ data, meta }` |
| GET | `/api/contracts/:id` | `@Get(':id')` | Chi tiết một hợp đồng (populated) | — | `Contract` (populated roomId→buildingId, tenantId) |
| PUT | `/api/contracts/:id` | `@Put(':id')` | Cập nhật DRAFT hoặc ACTIVE | `UpdateContractDto` | `Contract` |
| PUT | `/api/contracts/:id/activate` | `@Put(':id/activate')` | Kích hoạt hợp đồng DRAFT | `ActivateContractDto` | `Contract` |
| PATCH | `/api/contracts/:id/terminate` | `@Patch(':id/terminate')` | Thanh lý hợp đồng ACTIVE | `TerminateContractDto` + `?closeTenant=true\|false` | `Contract` |
| DELETE | `/api/contracts/:id` | `@Delete(':id')` | Xóa hợp đồng DRAFT (soft delete) | — | `void` |

**Lưu ý:** `terminate` nhận `closeTenant` qua **query string** (`@Query('closeTenant')`), so sánh chuỗi `=== 'true'` để cast boolean.

**`findAll` pipeline** (MongoDB aggregation):
1. Match `{ ownerId, isDeleted: false }`
2. `$lookup` rooms → unwind
3. `$lookup` buildings (qua `roomId.buildingId`) → unwind preserveNull
4. `$lookup` tenants → unwind preserveNull
5. Optional `$match` thêm buildingId filter
6. Optional `$match` status filter
7. Optional `$match` search regex (contractCode, tenantId.fullName, roomId.roomName, roomId.roomCode)
8. `$facet` với sort + skip + limit và count

---

## 4. Business Rules & State Machine

### State Machine đầy đủ

```
                ┌─────────────────────────────────────┐
                │                                     │
                ▼                                     │
           [DRAFT] ──── activate (PUT /activate) ──▶ [ACTIVE] ──── endDate passed ──▶ [EXPIRED]
              │                                          │
              │                                          └─── terminate (PATCH /terminate) ──▶ [TERMINATED]
              │
              └─── delete (DELETE /:id) ──▶ (gone / isDeleted=true)
```

**Điều kiện chuyển trạng thái:**

| Transition | Điều kiện tiên quyết | Side effects |
|---|---|---|
| `→ DRAFT` (create) | Tenant phải có status `ACTIVE` | Room → `DEPOSITED`; Tenant → `DEPOSITED` |
| `→ ACTIVE` (create direct) | Tenant phải có status `ACTIVE` | Room → `OCCUPIED`; Tenant → `RENTING`; `nextPaymentDate` tính |
| `DRAFT → ACTIVE` (activate) | Contract phải đang `DRAFT` | Room → `OCCUPIED`; Tenant → `RENTING`; `nextPaymentDate` tính |
| `ACTIVE → TERMINATED` | Contract phải đang `ACTIVE` | Room → `AVAILABLE`; Tenant → `ACTIVE` hoặc `CLOSED` (tùy `closeTenant` flag) |
| `DRAFT → (gone)` (delete) | Contract phải đang `DRAFT` | Room → `AVAILABLE`; Tenant → `ACTIVE`, xóa `currentRoomId` |
| `ACTIVE → EXPIRED` | endDate đã qua (TODO: cần job tự động) | — |
| `TERMINATED/EXPIRED → *` | Không thể chuyển (read-only) | — |

**Invariants:**
- Một Room chỉ được có **1 ACTIVE contract** tại một thời điểm (kiểm tra gián tiếp qua Room.status=OCCUPIED).
- Hệ thống hiện tại **chưa enforce** rule "1 room, 1 active" ở database level — chỉ dựa vào trạng thái Room.
- Tenant phải là `ACTIVE` khi tạo contract mới (skip check khi `isUpdate=true`).
- `tenantId` hoặc `newTenant` phải có ít nhất một.
- Với `newTenant`: bắt buộc `fullName`, `phone`, `idCard`.

### Activate Flow (chi tiết)

**Endpoint:** `PUT /api/contracts/:id/activate` với `ActivateContractDto`

**Bước thực thi trong `activate()`:**
1. Tìm contract theo `_id + ownerId + isDeleted=false`; throw `NotFoundException` nếu không có.
2. Kiểm tra `status === DRAFT`; throw `BadRequestException` nếu không phải.
3. Set `status = ACTIVE`, cập nhật `startDate`, `endDate` (validate `end > start`).
4. Tính `nextPaymentDate` cho LONG_TERM: `addMonths(startDate, cycleMonths)` rồi set `dueDay` (xử lý tháng ngắn như tháng 2).
5. Lưu contract.
6. `roomsService.updateStatus(roomId, ownerId, RoomStatus.OCCUPIED)`
7. `tenantsService.update(tenantId, ownerId, { status: RENTING, currentRoomId, moveInDate })`

> **Lưu ý:** Activate **không** tự động sinh Invoice đầu tiên. Invoice phải được tạo thủ công từ `ContractDetailPage` hoặc `ContractViewModal`.

**Snapshot Services:** Không xảy ra tại activate. Services đã được snapshot vào `serviceCharges[]` tại thời điểm **tạo contract** (create). Trường `serviceCharges` là mảng plain objects, không còn live reference đến Service catalog.

### Terminate Flow (chi tiết)

**Endpoint:** `PATCH /api/contracts/:id/terminate?closeTenant=true|false` với `TerminateContractDto`

**Bước thực thi trong `terminate()`:**
1. Tìm contract; throw nếu không tồn tại.
2. Kiểm tra `status === ACTIVE`; throw nếu không phải.
3. Set `status = TERMINATED`, `endDate = terminateDto.endDate`, `terminatedAt = new Date()`.
4. Lưu contract.
5. `roomsService.updateStatus(roomId, ownerId, RoomStatus.AVAILABLE)`
6. Nếu `closeTenant = true`: Tenant → `CLOSED`, `currentRoomId = null`, `moveOutDate = endDate`
   Nếu `closeTenant = false`: Tenant → `ACTIVE`, `currentRoomId = null`, `moveOutDate = endDate`

**FINAL Invoice:** Logic tạo invoice cuối **không nằm trong `terminate()`** — được xử lý ở **frontend** (`TerminateContractPage`):
- Nếu `createFinalInvoice = true` và `contractType === 'LONG_TERM'`: mở `CreateInvoiceModal` với `isFinal=true`, gọi `/api/invoices` để tạo invoice trước.
- Sau khi invoice được tạo (hoặc người dùng bỏ qua), gọi `PATCH /terminate` với `createFinalInvoice: false`.
- SHORT_TERM: không hỗ trợ checkbox tạo final invoice qua UI.

**Deposit refund logic:** Không có logic hoàn cọc tự động. `depositAmount` chỉ là thông tin lưu trữ, việc hoàn trả thực hiện qua Payment thủ công với `paymentMethod = DEPOSIT_DEDUCTION`.

### nextPaymentDate Calculation

Dùng `date-fns`:
```typescript
private calculateNextPaymentDate(startDate: Date, cycleMonths: number, dueDay: number): Date {
    const targetMonth = addMonths(startDate, cycleMonths);
    const daysInTargetMonth = getDaysInMonth(targetMonth);
    const actualDueDay = Math.min(dueDay, daysInTargetMonth);
    return setDate(targetMonth, actualDueDay);
}
```

Ví dụ: `startDate=2025-01-31`, `cycleMonths=1`, `dueDay=31` → `targetMonth=Feb` → `daysInFeb=28` → `nextPaymentDate=2025-02-28`.

---

## 5. ContractType — Sự khác biệt theo loại

### LONG_TERM

- Requires: `rentPrice`, `electricityPrice`, `waterPrice`, `initialElectricIndex`, `initialWaterIndex`, `paymentCycle`.
- `paymentCycle` xác định tần suất invoice: MONTHLY (1 tháng), MONTHLY_2 (2 tháng), QUARTERLY (3), MONTHLY_6 (6), MONTHLY_12 (12), CUSTOM (`paymentCycleMonths`).
- `nextPaymentDate` được tính và cập nhật.
- Hỗ trợ tạo Invoice định kỳ qua `CreateInvoiceModal`.
- `endDate` nếu có: phải > `startDate + 1 cycle`.
- `initialElectricIndex` + `initialWaterIndex` được sync xuống Room.currentElectricIndex / Room.currentWaterIndex khi tạo.

### SHORT_TERM

- Không yêu cầu `electricityPrice`, `waterPrice`, `paymentCycle`.
- `shortTermPricingType` bắt buộc: `HOURLY` | `DAILY` | `FIXED`.
  - **HOURLY/PER_HOUR**: `hourlyPricingMode='PER_HOUR'`, `pricePerHour > 0`.
  - **HOURLY/TABLE**: `hourlyPricingMode='TABLE'`, `shortTermPrices` ≥ 2 tiers.
  - **DAILY**: `shortTermPrices` ≥ 2 tiers (bảng giá theo ngày).
  - **FIXED**: `fixedPrice > 0`.
- Hỗ trợ tạo Invoice qua `CreateShortTermInvoiceModal` (ghi check-in/check-out thủ công).
- `nextPaymentDate` không được tính.
- `ActivateContractDialog`: dùng `DateTimePicker` (có giờ phút) thay vì `DatePicker` chỉ ngày.

### ShortTermPrices Tier Validation

Khi `DAILY` hoặc `HOURLY/TABLE`:
- Ít nhất 2 tiers.
- Tier đầu: `fromValue = 1` (bắt buộc, không phải 0 — khác với Service priceTiers).
- Tier cuối: `toValue = -1` (remaining/vô hạn).
- Mỗi tier: `price > 0`.
- Các tier phải liên tục: `tier[i].fromValue = tier[i-1].toValue + 1`.

---

## 6. PaymentCycle — Cách tính Invoice

`paymentCycleMonths` mapping từ `paymentCycle`:

| PaymentCycle | paymentCycleMonths (default) | Hành vi invoice |
|---|---|---|
| `MONTHLY` | 1 | Invoice mỗi 1 tháng |
| `MONTHLY_2` | 2 | Invoice mỗi 2 tháng |
| `QUARTERLY` | 3 | Invoice mỗi quý |
| `MONTHLY_6` | 6 | Invoice mỗi 6 tháng |
| `MONTHLY_12` | 12 | Invoice mỗi năm |
| `CUSTOM` | `paymentCycleMonths` field | Invoice theo số tháng tùy chỉnh |

Invoice không được tự động sinh — người dùng tạo thủ công từ ContractDetailPage.

> **TODO**: Chưa có cron job / scheduler tự động sinh invoice định kỳ dựa trên `nextPaymentDate`. Hiện tại `nextPaymentDate` chỉ mang tính hiển thị và nhắc nhở.
> **TODO**: Chưa có cron job tự động chuyển ACTIVE → EXPIRED khi `endDate` qua.

---

## 7. Frontend Touchpoints

### Pages (`frontend/src/pages/contracts/`)

| Component | Route | Mô tả |
|---|---|---|
| `ContractsPage.tsx` | `/contracts` | Danh sách với filter status, search, sort, column visibility |
| `ContractCreatePage.tsx` | `/contracts/new` | Wrapper của `ContractForm`; nhận `?roomId=` query param để pre-select phòng |
| `ContractEditPage.tsx` | `/contracts/:id/edit` | Wrapper của `ContractForm` với contract existing |
| `ContractDetailPage.tsx` | `/contracts/:id` | Xem chi tiết dạng receipt/hoá đơn in được; action: tạo Invoice, Thanh lý |
| `TerminateContractPage.tsx` | `/contracts/:id/terminate` | Màn hình thanh lý: chọn ngày, createFinalInvoice, closeTenant |
| `ContractForm.tsx` | (shared) | Form tạo/sửa, schema Zod từ `useContractSchema()` |

**ContractForm** sử dụng:
- `BuildingSelector` → `RoomSelector` → `TenantSelector` (cascade select)
- Tab "Khách thuê có sẵn" / "Khách thuê mới"
- `isDraft` state: nếu người dùng bấm "Lưu nháp" → submit với `status=DRAFT`

**ContractsPage** actions theo status:
- `DRAFT`: Activate (mở `ActivateContractDialog`), Edit, Delete
- `ACTIVE`: View, Edit (hạn chế trường), Terminate
- `EXPIRED` / `TERMINATED`: View, Edit (có thể xem nhưng không thay đổi core fields)

### Components

| Component | File | Mô tả |
|---|---|---|
| `ActivateContractDialog` | `frontend/src/components/ActivateContractDialog.tsx` | Dialog xác nhận startDate/endDate khi kích hoạt; validate end > firstPaymentDueDate cho LONG_TERM; dùng `DateTimePicker` cho SHORT_TERM |
| `ContractViewModal` | `frontend/src/components/ContractViewModal.tsx` | Modal xem nhanh dạng receipt; có action tạo Invoice, Thanh lý |
| `ContractSelectModal` | `frontend/src/components/ContractSelectModal.tsx` | Modal chọn contract (dùng trong màn hình khác như Invoice) |

**ContractDetailPage** hỗ trợ xuất PDF (`PdfExportMenu`, `exportElementToPdf`) và In (`window.open`, collect CSS). Cả `ContractDetailPage` và `ContractViewModal` dùng cùng template receipt monospace font.

### Key i18n keys (`contracts.*` — `frontend/public/locales/vi/translation.json`)

| Key | VI | Mô tả |
|---|---|---|
| `contracts.statusDraft` | "Đã cọc" | Lưu ý: DRAFT hiển thị là "Đã cọc" (đã đặt cọc), không phải "Nháp" |
| `contracts.statusActive` | "Đang hiệu lực" | |
| `contracts.statusExpired` | "Hết hạn" | |
| `contracts.statusTerminated` | "Đã chấm dứt" | |
| `contracts.activate` | "Kích hoạt" | |
| `contracts.activateTitle` | "Kích hoạt hợp đồng" | |
| `contracts.activateConfirm` | "Xác nhận kích hoạt" | |
| `contracts.terminate` | "Chấm dứt" | |
| `contracts.terminateWithInvoice` | "Tạo hóa đơn & Chấm dứt" | |
| `contracts.closeTenant` | "Đóng tài khoản khách thuê" | |
| `contracts.createFinalInvoice` | "Tạo hóa đơn cuối" | |
| `contracts.cycleMonthly` | "Hàng tháng (1 tháng)" | |
| `contracts.cycleQuarterly` | "Hàng quý (3 tháng)" | |
| `contracts.cycleCustom` | "Tùy chỉnh (tháng)" | |
| `contracts.endDateAfterFirstCycle` | "Ngày kết thúc phải sau ngày thanh toán chu kỳ đầu tiên" | |
| `contracts.saveAsDraft` | "Lưu nháp" | |
| `contracts.newTenant` | "Khách thuê mới" | |
| `contracts.predefinedServiceHint` | "Dịch vụ hệ thống chỉ có thể sửa số lượng" | |

---

## 8. Cross-Module Dependencies

### Contracts CẦN (imports/injects):

| Module | Lý do |
|---|---|
| `RoomsModule` | `RoomsService`: `findOne`, `updateStatus`, `updateIndexes` |
| `TenantsModule` | `TenantsService`: `findOne`, `create`, `update` |
| `ServicesModule` | `ServicesService`: `findOne` — để validate predefined serviceCharges |
| `Invoice` model (trực tiếp) | Đếm invoices trước khi cho phép đổi `initialElectricIndex`/`initialWaterIndex` |
| `Payment` model (import) | Import trong module nhưng chưa được dùng trong service |

### Modules khác CẦN contract:

| Module | Cách dùng |
|---|---|
| `InvoicesModule` | `contractId` FK — mỗi invoice thuộc về một contract; import `ContractSchema` trực tiếp |
| `PaymentsModule` | Qua Invoice (invoice có contractId); `ContractsModule` import `PaymentSchema` trực tiếp |
| `InvoicesService` | Dùng `ContractSchema` (import trực tiếp) để lấy contract info khi tạo invoice |
| `TenantsModule` | Import `ContractSchema` trực tiếp — query contract history trong `getHistory()` |
| `CalendarModule` | Import `ContractSchema` trực tiếp — đọc DRAFT/ACTIVE contracts để sinh contract events và payment due events |
| Dashboard | Thống kê hợp đồng theo trạng thái |

---

## 9. Update Restrictions cho ACTIVE Contracts

Khi contract đang `ACTIVE`, `update()` tự động **strip** các field immutable:
- `roomId` — không thể đổi phòng
- `buildingId`
- `contractType`
- `roomType`
- `startDate` — không thể đổi ngày bắt đầu

Riêng `initialElectricIndex` và `initialWaterIndex`: chỉ có thể thay đổi nếu **chưa có invoice nào** được tạo cho contract đó (kiểm tra qua `invoiceModel.countDocuments`).

Khi update có `status = ACTIVE` (tức activate qua update path): cũng kích hoạt side effects Room + Tenant tương tự `activate()`.

---

## 10. Gotchas & Testing Notes

### Pitfalls thường gặp

1. **DRAFT ≠ "Nháp" trong UI tiếng Việt** — `statusDraft` hiển thị là "Đã cọc" vì DRAFT nghĩa là khách đã đặt cọc, đang chờ vào phòng.

2. **Hai path activate** — có thể activate qua `PUT /:id/activate` (dùng `ActivateContractDto`) hoặc qua `PUT /:id` với `status=ACTIVE` trong body (`UpdateContractDto`). Cả hai đều trigger Room/Tenant status update.

3. **serviceCharges là snapshot** — nếu admin thay đổi giá Service catalog sau khi tạo contract, contract cũ không bị ảnh hưởng. Không có cơ chế re-sync.

4. **Validate service name/amount** — khi tạo contract với `serviceId`, backend kiểm tra `name` phải khớp và `amount` phải khớp với `fixedPrice` của service (dung sai 0.01). Người dùng **chỉ được sửa `quantity`** cho predefined services.

5. **`paymentDueDay` overflow** — nếu `dueDay=31` và tháng tiếp theo có 28 ngày, hệ thống dùng `Math.min(dueDay, daysInMonth)` → `nextPaymentDate = 28`. Xử lý đúng trong cả backend (`calculateNextPaymentDate`) lẫn frontend (`ActivateContractDialog`).

6. **ShortTermPrices tier `fromValue` bắt đầu từ 1** (không phải 0) — khác với Service priceTiers trong catalog.

7. **`closeTenant` query param** — là string `'true'`/`'false'`, không phải boolean. Service so sánh `=== 'true'`. Nếu thiếu param → `undefined !== 'true'` → false (Tenant về `ACTIVE`).

8. **Final invoice ở frontend** — `TerminateContractDto.createFinalInvoice` và `invoiceData` được serialize vào body nhưng backend không xử lý chúng; chỉ dùng `endDate`. Toàn bộ logic tạo final invoice nằm ở React component.

9. **EXPIRED status chưa có automation** — không có scheduler tự động set contract → EXPIRED khi `endDate` qua. Phải thực hiện thủ công hoặc thêm cron job.

10. **Populate trong `findOne` vs `findAll`** — `findOne` dùng Mongoose `.populate()` nested, `findAll` dùng MongoDB aggregation pipeline với `$lookup`. Cấu trúc response khác nhau đôi chút ở depth nesting.

### Test Scenarios (từ `contracts.service.spec.ts`)

File test tồn tại tại `backend/src/modules/contracts/contracts.service.spec.ts`. Các test helpers đã có:
- `createBaseLongTermDto()` — base DTO cho LONG_TERM
- `createBaseShortTermDto()` — base DTO cho SHORT_TERM (FIXED pricing)

**Scenarios cần cover:**

| Scenario | Type | Notes |
|---|---|---|
| Tạo LONG_TERM ACTIVE | create | Side effects: room=OCCUPIED, tenant=RENTING, nextPaymentDate |
| Tạo LONG_TERM DRAFT | create | Side effects: room=DEPOSITED, tenant=DEPOSITED |
| Tạo SHORT_TERM FIXED | create | fixedPrice > 0 |
| Tạo SHORT_TERM HOURLY/PER_HOUR | create | pricePerHour > 0 |
| Tạo SHORT_TERM DAILY với bảng giá | create | shortTermPrices validation |
| Activate DRAFT → ACTIVE | activate | nextPaymentDate cho LONG_TERM |
| Activate non-DRAFT → error | activate | BadRequestException |
| Update ACTIVE — strip immutable fields | update | roomId, startDate không thay đổi |
| Update ACTIVE — đổi meter khi đã có invoice | update | BadRequestException |
| Terminate ACTIVE với closeTenant=true | terminate | Tenant → CLOSED |
| Terminate ACTIVE với closeTenant=false | terminate | Tenant → ACTIVE |
| Terminate non-ACTIVE | terminate | BadRequestException |
| Delete DRAFT | remove | Room → AVAILABLE, Tenant → ACTIVE |
| Delete non-DRAFT | remove | BadRequestException |
| Tạo contract — tenant không ACTIVE | create | BadRequestException |
| EndDate ≤ startDate | create | BadRequestException |
| EndDate ≤ startDate + 1 cycle (LONG_TERM) | create | BadRequestException |
| Service name mismatch | create | BadRequestException |

---

## 11. Checklist khi thêm field mới vào Contract

1. Cập nhật `contract.schema.ts` với `@Prop()` decorator.
2. Cập nhật `CreateContractDto` với class-validator decorators.
3. Cập nhật `UpdateContractDto` nếu field có thể edit.
4. Cập nhật `validateCreateContract()` nếu cần business rule validation.
5. Nếu field là immutable khi ACTIVE: thêm `delete updateContractDto.field` trong `update()`.
6. Cập nhật `ContractForm.tsx` (defaultValues + form fields).
7. Cập nhật `useContractSchema()` trong `frontend/src/lib/validations.ts`.
8. Cập nhật i18n: `frontend/public/locales/en/translation.json` và `vi/translation.json`.
9. Cập nhật `ContractDetailPage.tsx` và `ContractViewModal.tsx` để hiển thị field mới.
