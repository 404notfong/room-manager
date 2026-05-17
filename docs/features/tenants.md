# Tenants Playbook

> **Vai trò trong domain**: Tenant (khách thuê) là hồ sơ cá nhân của người thuê phòng; được liên kết với Room thông qua Contract và là nguồn gốc của mọi Invoice và Payment trong hệ thống.
> **Code paths**: `backend/src/modules/tenants/`, `frontend/src/pages/tenants/`, `frontend/src/components/TenantHistoryTimeline.tsx`, `frontend/src/components/TenantSelector.tsx`, `frontend/src/components/forms/TenantForm.tsx`

---

## 1. Purpose & Relations

Tenant lưu trữ thông tin định danh (CMND/CCCD, SĐT, DOB...) và trạng thái hiện tại của khách thuê. Một Tenant có thể có nhiều Contracts theo thời gian, từ đó phát sinh Invoices và Payments.

```
User (ownerId)
  └── Tenant
        └── Contract (tenantId)
              └── Invoice (tenantId)
                    └── Payment (tenantId)
```

Tenant KHÔNG tham chiếu trực tiếp đến Building — quan hệ đó được thiết lập qua `Contract.roomId → Room.buildingId`.

---

## 2. Data Model

### Schema (`backend/src/modules/tenants/schemas/tenant.schema.ts`)

| Field | Type | Required | Default | Mô tả |
|---|---|---|---|---|
| `ownerId` | `Types.ObjectId` (ref: User) | Yes | — | Multi-tenant: chủ sở hữu dữ liệu |
| `fullName` | `string` | Yes | — | Họ và tên, trim |
| `fullNameNormalized` | `string` | No | auto | Không dấu, dùng cho tìm kiếm |
| `code` | `string` | Yes | auto | Unique toàn hệ thống; format `T-{timestamp36}-{rand4}` |
| `idCard` | `string` | Yes | — | CMND/CCCD; unique per owner (partial index `isDeleted=false`) |
| `phone` | `string` | Yes | — | SĐT; unique per owner (partial index `isDeleted=false`) |
| `email` | `string` | No | — | Email, trim |
| `occupation` | `string` | No | — | Nghề nghiệp |
| `dateOfBirth` | `Date` | No | — | Ngày sinh |
| `gender` | `string` (enum) | No | — | `MALE` \| `FEMALE` \| `OTHER` |
| `permanentAddress` | `string` | No | — | Địa chỉ thường trú |
| `currentRoomId` | `Types.ObjectId` (ref: Room) | No | — | Phòng hiện đang thuê (set bởi contract flow) |
| `moveInDate` | `Date` | No | — | Ngày vào ở |
| `moveOutDate` | `Date` | No | — | Ngày rời đi |
| `status` | `TenantStatus` | No | `ACTIVE` | Xem state machine bên dưới |
| `emergencyContact` | `{ name, phone, relationship }` | No | — | Liên hệ khẩn cấp |
| `notes` | `string` | No | — | Ghi chú nội bộ |
| `isDeleted` | `boolean` | No | `false` | Soft delete |

**Compound unique indexes** (MongoDB `partialFilterExpression: { isDeleted: false }`):
- `{ ownerId, phone, isDeleted }` — phone unique per owner, chỉ khi chưa xóa
- `{ ownerId, idCard, isDeleted }` — idCard unique per owner, chỉ khi chưa xóa

### Enums liên quan (`backend/src/common/constants/enums.ts`)

```typescript
enum TenantStatus {
    RENTING    = 'RENTING',    // Đang có active contract
    ACTIVE     = 'ACTIVE',     // Không có contract nhưng hồ sơ còn hoạt động
    CLOSED     = 'CLOSED',     // Đã ngừng thuê
    DEPOSITED  = 'DEPOSITED',  // Đã đặt cọc giữ chỗ (contract DRAFT)
}

enum Gender {
    MALE   = 'MALE',
    FEMALE = 'FEMALE',
    OTHER  = 'OTHER',
}
```

**Lưu ý**: `gender` trong schema được định nghĩa là `string` với inline enum `['MALE', 'FEMALE', 'OTHER']` thay vì dùng `Gender` enum — không import từ enums.ts.

### DTO Validation (`backend/src/modules/tenants/dto/tenant.dto.ts`)

**`CreateTenantDto`** — decorators chính xác:

| Field | Decorators | Ghi chú |
|---|---|---|
| `fullName` | `@IsString() @IsNotEmpty()` | Required |
| `idCard` | `@IsString() @IsNotEmpty()` | Required; không có regex — backend không validate format CMND |
| `phone` | `@IsString() @IsNotEmpty()` | Required; không có regex — validate format chỉ ở frontend |
| `email` | `@IsEmail() @IsOptional()` | Optional |
| `dateOfBirth` | `@IsDateString() @IsOptional()` | ISO date string |
| `gender` | `@IsString() @IsOptional()` | Không có `@IsEnum(Gender)` |
| `permanentAddress` | `@IsString() @IsOptional()` | |
| `emergencyContact` | `@ValidateNested() @Type(() => EmergencyContactDto) @IsOptional()` | Nested object |
| `notes` | `@IsString() @IsOptional()` | |
| `occupation` | `@IsString() @IsOptional()` | |
| `status` | `@IsEnum(TenantStatus) @IsIn([ACTIVE, CLOSED]) @IsOptional()` | RENTING bị chặn explicitly |

**`UpdateTenantDto`** — toàn bộ fields là optional, bổ sung:
- `currentRoomId?: string | Types.ObjectId | null` — không có `@IsMongoId()` decorator
- `moveInDate`, `moveOutDate`: `@IsDateString() @IsOptional()`

**`GetTenantsDto`** (list query):
- `search?: string` — tìm fullName, code, phone, idCard
- `status?: TenantStatus`
- `currentRoomId?: string` với `@IsMongoId()`
- Kế thừa `PaginationDto`: `page`, `limit`, `sortBy`, `sortOrder`

**`GetTenantHistoryDto`** (`dto/tenant-history.dto.ts`):
- `type?: HistoryEventType` — `'contract' | 'invoice' | 'payment'`
- `startDate?`, `endDate?`: `@IsDateString()`

---

## 3. API Endpoints

Tất cả routes đều yêu cầu `JwtAuthGuard`. `ownerId` được lấy từ JWT token (`@CurrentUser()`).

| Method | Path | Mô tả | Request body / Query | Response shape |
|---|---|---|---|---|
| `POST` | `/api/tenants` | Tạo khách thuê mới | `CreateTenantDto` | `Tenant` document |
| `GET` | `/api/tenants` | Danh sách có phân trang | `GetTenantsDto` (query) | `{ data: Tenant[], meta: { total, page, limit, totalPages } }` |
| `GET` | `/api/tenants/:id` | Chi tiết một tenant; populate `currentRoomId` không — trả raw | — | `Tenant` document |
| `GET` | `/api/tenants/:id/history` | Lịch sử thuê (aggregate) | `GetTenantHistoryDto` (query) | `{ data: TenantHistoryEvent[], meta }` |
| `PUT` | `/api/tenants/:id` | Cập nhật thông tin | `UpdateTenantDto` | `Tenant` document updated |
| `DELETE` | `/api/tenants/:id` | Soft delete (isDeleted=true) | — | void |

**GET `/api/tenants`** — sort fields hỗ trợ: `fullName`, `code`, `status`, `createdAt` (default `createdAt: -1`).
Khi sort `fullName`, service dùng `{ fullNameNormalized, fullName }` để sort đúng tiếng Việt có dấu.

**GET `/api/tenants`** — `findAll` populate: `.populate('currentRoomId', 'roomName roomCode')`.

---

## 4. Business Rules & State Machine

### TenantStatus State Machine

```
                    [Contract DRAFT created]
ACTIVE ────────────────────────────────────────► DEPOSITED
  ▲                                                   │
  │                                  [Contract ACTIVE]│
  │         [Contract TERMINATED/EXPIRED]             ▼
CLOSED ◄──────────────────────────────────────── RENTING
  ▲                                                   │
  │              [Contract TERMINATED/EXPIRED]        │
  └───────────────────────────────────────────────────┘
```

- **RENTING**: Tenant đang có contract active. **KHÔNG THỂ set thủ công** — cả `create` lẫn `update` public API đều ném `ForbiddenException` nếu client gửi `status=RENTING`. Chỉ `tenantsService.update(..., isInternal=true)` (gọi từ contracts service) mới được phép.
- **DEPOSITED**: Tenant đã cọc (contract ở trạng thái DRAFT). Cũng managed bởi contracts flow, không set thủ công.
- **ACTIVE**: Default khi tạo mới. Có thể set thủ công (ACTIVE hoặc CLOSED) qua API.
- **CLOSED**: Hồ sơ đã đóng. Không thể xóa tenant khi `status=RENTING` — service kiểm tra trước khi soft delete.

### Invariants

- `phone` và `idCard` unique per owner — duplicate trả `ConflictException` với message `'PHONE_EXISTS'` hoặc `'ID_CARD_EXISTS'` (không phải HTTP status text).
- `code` auto-generated format `T-{timestamp_base36}-{rand4}`, unique toàn bộ collection (retry tối đa 5 lần).
- `fullNameNormalized` được tự động cập nhật khi `fullName` thay đổi (qua `normalizeString()`).
- Soft delete bị chặn khi `status === RENTING`.

### History Aggregation

Endpoint `GET /api/tenants/:id/history` **aggregate thực sự từ 3 collection riêng biệt** — không dùng MongoDB aggregation pipeline, mà dùng `Promise.all()` query song song:

1. `contractModel.find({ tenantId, isDeleted: false })` — populate `roomId → roomName, roomCode`; filter date dùng `createdAt`
2. `invoiceModel.find({ tenantId, isDeleted: false })` — filter date dùng `createdAt`
3. `paymentModel.find({ tenantId, isDeleted: false })` — filter date dùng `paymentDate` (khác createdAt)

Kết quả được map sang `TenantHistoryEvent[]`, sort theo date descending **in-memory**, sau đó paginate in-memory bằng `Array.slice()`. Đây là điểm cần lưu ý về performance khi history lớn.

**Response shape mỗi event**:
```typescript
interface TenantHistoryEvent {
    type: 'contract' | 'invoice' | 'payment';
    date: Date;
    title: string;  // 'Contract created' | 'Contract terminated' | 'Contract expired' | 'Invoice #XXX' | 'Payment received'
    data: ContractHistoryData | InvoiceHistoryData | PaymentHistoryData;
}
```

---

## 5. Frontend Touchpoints

### Routes & Pages

| Route | Component | Mô tả |
|---|---|---|
| `/tenants` | `TenantsPage` | Danh sách, search, filter theo status, sort, delete |
| `/tenants/new` | `TenantCreatePage` | Form tạo mới |
| `/tenants/:id` | `TenantDetailPage` | Xem chi tiết + tab lịch sử (preview 50 events) |
| `/tenants/:id/edit` | `TenantEditPage` | Form chỉnh sửa |
| `/tenants/:id/history` | `TenantHistoryPage` | Lịch sử đầy đủ với filter, phân trang |

### Components

**`TenantForm`** (`frontend/src/components/forms/TenantForm.tsx`):
- Dùng `react-hook-form` + `zodResolver(useTenantSchema())`
- `dateOfBirth` dùng `<DatePicker>` component (fix commit `4b17623` — thay thế native `<input type="date">`)
- Frontend field `idNumber` map thành backend field `idCard` tại lớp page (create/edit page đều thực hiện mapping này)
- Frontend field `address` map thành backend field `permanentAddress`
- Status `RENTING` và `DEPOSITED` bị disable trong select (UI-level guard); form handler strip status trước khi submit nếu là system-managed status

**`TenantHistoryTimeline`** (`frontend/src/components/TenantHistoryTimeline.tsx`):
- Dùng trong `TenantDetailPage` tab "Lịch sử" — preview tối đa 50 events (hard-coded `limit=50`)
- Hiển thị timeline dọc, mỗi event theo màu: contract=blue, invoice=orange, payment=green
- Không có filter; link "Xem toàn bộ lịch sử" chuyển sang `TenantHistoryPage`

**`TenantSelector`** (`frontend/src/components/TenantSelector.tsx`):
- Combobox với infinite scroll (incremental loading, 10 items/page)
- Chỉ query tenants với `status=ACTIVE` — tenants RENTING/CLOSED/DEPOSITED không xuất hiện
- Dùng trong `ContractSelectModal` và form tạo contract

**`TenantHistoryPage`** (`frontend/src/pages/tenants/TenantHistoryPage.tsx`):
- Filter: type (contract/invoice/payment/all), startDate, endDate — tất cả qua URL search params
- Date filter dùng `<DatePicker>` component (không phải native input)
- Mỗi event có thể expand/collapse để xem chi tiết

### Validation Frontend (`frontend/src/lib/validations.ts` — `useTenantSchema`)

```typescript
phone: z.string()
    .min(1, ...)
    .refine((val) => isValidVietnamesePhone(val), { message: t('validation.phone') })
```

```typescript
// Regex thực tế (line 7, validations.ts)
const vietnamesePhoneRegex = /^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-46-9])[0-9]{7}$/;
// Whitespace được strip trước khi test: phone.replace(/\s/g, '')
```

Backend (`CreateTenantDto`) **không** có phone regex validation — chỉ `@IsString() @IsNotEmpty()`. Đây là TODO tiềm năng.

### Key i18n Keys (frontend `tenants.*`)

| Key | VI |
|---|---|
| `tenants.statusRenting` | Đang thuê |
| `tenants.statusActive` | Hoạt động |
| `tenants.statusDeposited` | Đã cọc |
| `tenants.statusClosed` | Đóng |
| `tenants.statusRentAutoHint` | Trạng thái này được cập nhật tự động qua hợp đồng |
| `tenants.phoneExistsError` | Số điện thoại đã tồn tại trong hệ thống |
| `tenants.idCardExistsError` | CMND/CCCD đã tồn tại trong hệ thống |
| `tenants.history.title` | Lịch sử |
| `tenants.history.viewAll` | Xem toàn bộ lịch sử |
| `tenants.history.eventsCount` | {{count}} sự kiện |
| `tenants.history.noHistory` | Chưa có lịch sử |

---

## 6. Cross-Module Dependencies

### Module này CẦN:
- **User** (`ownerId`): tất cả queries filter theo `ownerId`
- **Contract**, **Invoice**, **Payment**: import schema vào `TenantsModule` để query trong `getHistory()`

### Module khác CẦN Tenant:
- **Contracts**: `tenantId` trong contract schema; `tenantsService.update()` được gọi với `isInternal=true` để set `status=RENTING`, `currentRoomId`, `moveInDate` khi activate contract
- **Invoices**: `tenantId` stored trong invoice; snapshot tenant info có thể được lưu vào invoice document
- **Payments**: `tenantId` stored trong payment để query history
- **TenantSelector** component: dùng trong contract creation flow (chỉ query status=ACTIVE)

`TenantsModule` exports `TenantsService` — các module khác import để gọi `update()` với `isInternal=true`.

---

## 7. Gotchas & Testing Notes

### Pitfalls

1. **Field name mapping**: Frontend dùng `idNumber` (display) → backend nhận `idCard`. Mapping xảy ra tại lớp page (TenantCreatePage, TenantEditPage), không phải trong TenantForm. Tương tự `address` → `permanentAddress`. Nếu thêm field mới, nhớ map tại cả 2 page.

2. **Status RENTING không set được thủ công**: Backend `create()` và `update()` (public, `isInternal=false`) đều throw `ForbiddenException`. Frontend cũng guard ở UI level (select disabled + form strip). Khi test, đừng thử gửi `status=RENTING` trực tiếp.

3. **History pagination là in-memory**: Service load toàn bộ contracts + invoices + payments của tenant vào RAM, sort, rồi slice. Với tenant có nhiều năm lịch sử, đây có thể là bottleneck. TODO: chuyển sang cursor-based hoặc aggregation pipeline.

4. **History date filter không đồng nhất**: Contracts và Invoices filter theo `createdAt`, nhưng Payments filter theo `paymentDate`. Nếu một payment được record muộn, có thể bị lệch range khi filter.

5. **TenantSelector chỉ show status=ACTIVE**: Tenants đang RENTING hoặc DEPOSITED KHÔNG xuất hiện trong TenantSelector. Đây là thiết kế có chủ đích (chỉ chọn khách chưa có contract active), nhưng cần lưu ý khi debug "tại sao không tìm thấy tenant X trong selector".

6. **idCard uniqueness là per-owner, không global**: Hai owner khác nhau có thể có tenant với cùng CMND. Đây là multi-tenant design, không phải bug.

7. **Phone validation chỉ ở frontend**: Backend DTO không có regex validator cho `phone`. Nếu gọi API trực tiếp (Postman, seed script), có thể tạo tenant với SĐT sai format.

### Test Scenarios

- **Tạo tenant trùng phone/idCard**: Expect `ConflictException` với message `'PHONE_EXISTS'` hoặc `'ID_CARD_EXISTS'` (HTTP 409)
- **Xóa tenant đang RENTING**: Expect `BadRequestException` (HTTP 400) — không soft delete được
- **Set status=RENTING qua API**: Expect `ForbiddenException` (HTTP 403)
- **History filter theo type=contract**: Chỉ trả contract events, không có invoice/payment
- **History filter theo date range**: Payment dùng `paymentDate`, contract/invoice dùng `createdAt` — kiểm tra edge case payment ngày khác createdAt
- **Search bằng tên có dấu**: Service normalize search term trước khi regex match — "nguyen van a" phải tìm được "Nguyễn Văn A"
- **Sort theo fullName**: Phải sort theo `fullNameNormalized` (không dấu) để tránh lỗi collation tiếng Việt
