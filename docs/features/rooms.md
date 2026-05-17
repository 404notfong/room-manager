# Rooms Playbook

> **Vai trò trong domain**: Room là entity trung tâm của hệ thống — đơn vị vật lý được cho thuê, liên kết Building với Contract và sinh ra Invoice.
> **Code paths**: `backend/src/modules/rooms/`, `frontend/src/pages/rooms/`, `frontend/src/components/rooms/RoomBoardWorkspace.tsx`, `frontend/src/components/forms/RoomForm.tsx`

---

## 1. Purpose & Relations

- Room thuộc về một **Building** (bắt buộc, không thể đổi sau khi tạo).
- Room có thể thuộc về một **RoomGroup** (tuỳ chọn, có thể thay đổi; dùng để nhóm hiển thị trên board).
- Room là entity được cho thuê qua **Contract** (`roomId` reference); một phòng chỉ có một contract ACTIVE/DEPOSITED/DRAFT tại một thời điểm (enforced bởi aggregate lookup trong getDashboard).
- Contract → **Invoice** → **Payment**: chuỗi nghiệp vụ bắt đầu từ Room.
- **2 loại phòng** (field `roomType`):
  - `LONG_TERM` — trọ tháng (chung cư, phòng trọ): có giá điện/nước/phòng mặc định và chỉ số đồng hồ.
  - `SHORT_TERM` — ngắn hạn (homestay, nhà nghỉ, khách sạn): có 3 chế độ tính giá.

---

## 2. Data Model

### 2.1 Schema (`backend/src/modules/rooms/schemas/room.schema.ts`)

| Field | Type (Mongoose) | Required | Default | Mô tả |
|---|---|---|---|---|
| `buildingId` | `Types.ObjectId` ref `Building` | Yes | — | Tòa nhà chứa phòng; có index |
| `roomGroupId` | `Types.ObjectId` ref `RoomGroup` | No | — | Nhóm phòng (tuỳ chọn); có index |
| `ownerId` | `Types.ObjectId` ref `User` | Yes | — | Multi-tenant owner; có index |
| `roomCode` | `string` | Yes | auto-generated | Mã phòng duy nhất, format `R-{timestamp36}-{random4}`, unique + index |
| `roomName` | `string` | Yes | — | Tên phòng; có `trim` |
| `nameNormalized` | `string` | No | — | Tên phòng đã chuẩn hoá (bỏ dấu) dùng cho tìm kiếm; có index |
| `floor` | `number` | No | `1` | Số tầng |
| `area` | `number` | No | `0` | Diện tích (m²) |
| `maxOccupancy` | `number` | No | `0` | Số người tối đa |
| `roomType` | `enum RoomType` | Yes | `LONG_TERM` | Loại phòng |
| `status` | `enum RoomStatus` | No | `AVAILABLE` | Trạng thái hiện tại |
| `amenities` | `string[]` | No | `[]` | Tiện ích |
| `description` | `string` | No | — | Mô tả phòng |
| `images` | `string[]` | No | `[]` | URLs ảnh |
| `sortOrder` | `number` | No | `0` | Thứ tự hiển thị trên board (drag-and-drop) |
| `isDeleted` | `boolean` | No | `false` | Soft delete flag |

**Chỉ LONG_TERM:**

| Field | Type | Default | Mô tả |
|---|---|---|---|
| `defaultElectricPrice` | `number` | `0` | Giá điện mặc định (đ/số) |
| `defaultWaterPrice` | `number` | `0` | Giá nước mặc định (đ/số) |
| `defaultRoomPrice` | `number` | `0` | Giá phòng mặc định (đ/tháng) |
| `defaultTermMonths` | `number` | `1` | Kỳ hạn mặc định (tháng) |
| `currentElectricIndex` | `number` | `0` | Chỉ số đồng hồ điện hiện tại |
| `currentWaterIndex` | `number` | `0` | Chỉ số đồng hồ nước hiện tại |

**Chỉ SHORT_TERM:**

| Field | Type | Default | Mô tả |
|---|---|---|---|
| `shortTermPricingType` | `enum ShortTermPricingType` | — | Chế độ tính giá: HOURLY / DAILY / FIXED |
| `hourlyPricingMode` | `string` enum `'PER_HOUR' \| 'TABLE'` | — | Chỉ khi HOURLY; cách tính giờ |
| `pricePerHour` | `number` | `0` | Chỉ khi HOURLY × PER_HOUR |
| `shortTermPrices` | `ShortTermPriceTier[]` | `[]` | Bảng giá tiers; dùng khi HOURLY × TABLE hoặc DAILY |
| `priceTableType` | `enum PriceTableType` | `PROGRESSIVE` | Cách tính bảng giá: PROGRESSIVE / FLAT |
| `fixedPrice` | `number` | `0` | Chỉ khi FIXED |

### 2.2 Sub-schema: `ShortTermPriceTier`

```typescript
// Định nghĩa tại room.schema.ts, @Schema({ _id: false })
{
    fromValue: number;  // Giờ/ngày bắt đầu (tier đầu = 1, KHÔNG phải 0)
    toValue: number;    // Giờ/ngày kết thúc (-1 = "còn lại" — bắt buộc cho tier cuối)
    price: number;      // Giá cho tier này
}
```

**Lưu ý quan trọng về tier đầu**: Backend `validateShortTermPrices()` yêu cầu `prices[0].fromValue === 1` (không phải 0). CLAUDE.md nói `fromValue = 0` nhưng code thực tế dùng `1`. Frontend default cũng khởi tạo `{ fromValue: 1, toValue: 1, price: 0 }`.

### 2.3 Enums liên quan (`backend/src/common/constants/enums.ts`)

```typescript
enum RoomType {
    LONG_TERM = 'LONG_TERM',   // Trọ
    SHORT_TERM = 'SHORT_TERM', // Ngắn hạn
}

enum RoomStatus {
    AVAILABLE = 'AVAILABLE',     // Trống
    OCCUPIED = 'OCCUPIED',       // Đã thuê (contract ACTIVE)
    MAINTENANCE = 'MAINTENANCE', // Bảo trì (set thủ công)
    DEPOSITED = 'DEPOSITED',     // Đã cọc (contract DEPOSITED)
}

enum ShortTermPricingType {
    HOURLY = 'HOURLY', // Theo giờ
    DAILY = 'DAILY',   // Theo ngày
    FIXED = 'FIXED',   // Giá cố định
}

enum PriceTableType {
    PROGRESSIVE = 'PROGRESSIVE', // Lũy tiến: cộng dồn từng mức
    FLAT = 'FLAT',               // Trọn gói: nhân giá mức cuối × số lượng
}
```

### 2.4 MongoDB Indexes

```typescript
RoomSchema.index({ buildingId: 1, isDeleted: 1 });
RoomSchema.index({ ownerId: 1, status: 1, isDeleted: 1 });
RoomSchema.index({ roomCode: 1 }); // + unique index trên field
// Thêm: buildingId (index), roomGroupId (index), ownerId (index), nameNormalized (index)
```

---

## 3. DTO Validation

### 3.1 `ShortTermPriceTierDto`
| Field | Decorators | Ghi chú |
|---|---|---|
| `fromValue` | `@IsNumber() @Min(0)` | Min(0) ở DTO nhưng business rule bắt đầu từ 1 |
| `toValue` | `@IsNumber() @Min(-1)` | -1 cho tier cuối |
| `price` | `@IsNumber() @Min(0)` | |

### 3.2 `CreateRoomDto`
| Field | Decorators | Ghi chú |
|---|---|---|
| `buildingId` | `@IsMongoId() @IsNotEmpty()` | Bắt buộc |
| `roomGroupId` | `@IsMongoId() @IsOptional()` | |
| `roomName` | `@IsString() @IsNotEmpty()` | Bắt buộc |
| `floor` | `@IsNumber() @IsNotEmpty() @Min(1)` | Bắt buộc, tối thiểu 1 |
| `area` | `@IsNumber() @IsOptional()` | |
| `roomType` | `@IsEnum(RoomType) @IsNotEmpty()` | Bắt buộc |
| `defaultElectricPrice` | `@IsNumber() @IsOptional() @Min(1)` | LONG_TERM |
| `defaultWaterPrice` | `@IsNumber() @IsOptional() @Min(1)` | LONG_TERM |
| `defaultRoomPrice` | `@IsNumber() @IsOptional() @Min(1)` | LONG_TERM |
| `defaultTermMonths` | `@IsNumber() @IsOptional() @Min(1)` | LONG_TERM |
| `shortTermPricingType` | `@IsEnum(ShortTermPricingType) @IsOptional()` | SHORT_TERM |
| `hourlyPricingMode` | `@IsString() @IsOptional()` | `'PER_HOUR' \| 'TABLE'` |
| `pricePerHour` | `@IsNumber() @IsOptional() @Min(1)` | |
| `shortTermPrices` | `@IsArray() @ValidateNested({ each: true }) @Type(() => ShortTermPriceTierDto) @IsOptional()` | |
| `priceTableType` | `@IsEnum(PriceTableType) @IsOptional()` | |
| `fixedPrice` | `@IsNumber() @IsOptional() @Min(1)` | |
| `maxOccupancy` | `@IsNumber() @IsOptional()` | |
| `status` | `@IsEnum(RoomStatus) @IsOptional()` | Bị override về AVAILABLE khi tạo |
| `amenities` | `@IsArray() @IsOptional()` | |
| `description` | `@IsString() @IsOptional()` | |
| `currentElectricIndex` | `@IsNumber() @IsOptional() @Min(0)` | Chỉ số ban đầu |
| `currentWaterIndex` | `@IsNumber() @IsOptional() @Min(0)` | |

> **Lưu ý**: DTO không có `buildingId`-level conditional validation — việc check cross-field (LONG_TERM có giá, SHORT_TERM có đúng mode) hoàn toàn nằm ở service (`validateShortTermPrices`) và frontend Zod (`superRefine`).

### 3.3 `UpdateRoomDto`
- Tất cả fields đều `@IsOptional()`.
- `defaultElectricPrice / defaultWaterPrice / defaultRoomPrice` dùng `@Min(0)` (không phải `@Min(1)` như CreateRoomDto).
- `buildingId` bị strip trong service (`delete dto.buildingId`) — không thể đổi building sau khi tạo.

### 3.4 `UpdateIndexesDto`
```typescript
{ currentElectricIndex?: number; currentWaterIndex?: number; }
```
Cả hai field `@IsNumber() @IsOptional()` — dùng riêng cho endpoint cập nhật chỉ số đồng hồ.

### 3.5 `ReorderRoomsDto` / `ReorderRoomItemDto`
```typescript
// ReorderRoomItemDto
{
    roomId: string;           // @IsMongoId() @IsNotEmpty()
    roomGroupId?: string | null; // @IsMongoId() @IsOptional()
    sortOrder: number;        // @IsNumber() @Min(0)
}
// ReorderRoomsDto
{ items: ReorderRoomItemDto[] } // @IsArray() @ValidateNested @Type
```

### 3.6 `GetRoomsDto` / `DashboardRoomsDto`
- `GetRoomsDto` extends `PaginationDto` (có `page`, `limit`, `sortBy`, `sortOrder`), thêm `search`, `buildingId`, `status`.
- `DashboardRoomsDto` (không paginate): `search`, `buildingId`, `status`, `roomGroupIds` (comma-separated string cho multi-select).

### 3.7 Frontend Zod (`useRoomSchema` — `frontend/src/lib/validations.ts`)

`superRefine` rules:
- `LONG_TERM`: `defaultRoomPrice > 0`, `defaultElectricPrice > 0`, `defaultWaterPrice > 0` (tất cả bắt buộc > 0).
- `SHORT_TERM`: `shortTermPricingType` bắt buộc.
  - `FIXED`: `fixedPrice > 0`.
  - `HOURLY`: `hourlyPricingMode` bắt buộc.
    - `PER_HOUR`: `pricePerHour > 0`.
    - `TABLE`: `shortTermPrices` không rỗng; mỗi tier `price > 0`, `toValue >= fromValue` (trừ -1); sequence continuity (`tier[i].fromValue === tier[i-1].toValue + 1`); tier cuối `toValue === -1`.
  - `DAILY`: tương tự TABLE (cùng `shortTermPrices` validation).

---

## 4. API Endpoints

Tất cả endpoints đều yêu cầu `JwtAuthGuard`. Controller prefix: `@Controller('rooms')`.

| Method | Path | Body / Query | Response | Mô tả |
|---|---|---|---|---|
| `POST` | `/api/rooms` | `CreateRoomDto` | `Room` | Tạo phòng mới; auto-gen `roomCode`; force `status=AVAILABLE`; tăng `building.totalRooms` |
| `GET` | `/api/rooms/dashboard` | `DashboardRoomsDto` (query) | `{ groups, ungrouped }` | Board view — aggregate lookup contracts + tenants; group by RoomGroup; sort by `roomGroup.sortOrder, sortOrder, roomName` |
| `GET` | `/api/rooms` | `GetRoomsDto` (query) | `{ data, meta }` | Danh sách phân trang; populate `buildingId roomGroupId`; search trên `nameNormalized`, `roomCode`, `roomName` |
| `GET` | `/api/rooms/:id` | — | `Room` | Chi tiết một phòng |
| `PUT` | `/api/rooms/:id` | `UpdateRoomDto` | `Room` | Cập nhật; không đổi được `buildingId`; kiểm tra status lock; validate price tiers nếu cần |
| `PUT` | `/api/rooms/:id/indexes` | `UpdateIndexesDto` | `Room` | Cập nhật chỉ số điện/nước |
| `PATCH` | `/api/rooms/reorder` | `ReorderRoomsDto` | `{ success, updated }` | Bulk update `sortOrder` + `roomGroupId` qua `bulkWrite` |
| `DELETE` | `/api/rooms/:id` | — | `void` | Soft delete; chặn nếu status `OCCUPIED`; giảm `building.totalRooms` |

### Dashboard Response Shape
```typescript
{
    groups: Array<{
        _id: ObjectId;
        name: string;
        color: string;
        rooms: RoomWithActiveContract[];
    }>;
    ungrouped: RoomWithActiveContract[];
}
// RoomWithActiveContract.activeContract gồm đầy đủ pricing fields + tenant { _id, fullName, phone }
```

---

## 5. Business Rules & State Machine

### 5.1 Invariants
- `ownerId` filter trên mọi query — không ai thấy phòng của người khác.
- `buildingId` không thể thay đổi sau khi tạo (service strip `dto.buildingId` trong update).
- `roomCode` auto-generated, unique, immutable — không có trong form.
- Khi tạo, status luôn bị force về `AVAILABLE` bất kể body gửi lên.
- Soft delete: `isDeleted: true`; không xoá thật. Queries luôn kèm `isDeleted: false`.

### 5.2 Status Machine

```
                    [contract DEPOSITED]
AVAILABLE ──────────────────────────────► DEPOSITED
    ▲                                         │
    │   [contract terminated/expired]         │ [contract ACTIVE]
    │◄────────────────────────────────────────┘
    │
    │   [contract ACTIVE]
    └───────────────────────► OCCUPIED
    ▲                              │
    │   [contract terminated]      │
    └──────────────────────────────┘
    
AVAILABLE ◄──── (thủ công, UI) ────► MAINTENANCE
```

**Các transition:**
- `AVAILABLE → OCCUPIED`: contract được activate (gọi `updateStatus` từ ContractsService).
- `AVAILABLE → DEPOSITED`: contract DEPOSITED được tạo.
- `OCCUPIED → AVAILABLE`: contract bị terminate/expire.
- `DEPOSITED → AVAILABLE` hoặc `DEPOSITED → OCCUPIED`: khi contract chuyển trạng thái.
- `AVAILABLE ↔ MAINTENANCE`: thủ công qua UI (click badge trong RoomsPage).
- **Status lock**: service từ chối `PUT /:id` nếu `status OCCUPIED hoặc DEPOSITED` và body muốn đổi status. Thông báo: `'Cannot manually change status of an OCCUPIED or DEPOSITED room'`.
- **Xóa**: không cho xóa nếu `status === 'OCCUPIED'`.

### 5.3 RoomCode Generation
```typescript
// Format: R-{Date.now().toString(36).toUpperCase()}-{1000-9999}
// Retry tối đa 5 lần nếu collision
generateRoomCode() → string
```

### 5.4 Building Counter Sync
- Tạo phòng: `building.totalRooms += 1`.
- Xóa phòng (soft delete): `building.totalRooms -= 1` (chỉ giảm nếu > 0).

### 5.5 Search Logic
- Chuẩn hoá tìm kiếm: `normalizeString(search)` (bỏ dấu tiếng Việt) → search trên `nameNormalized`.
- Đồng thời search raw trên `roomCode` và `roomName` với regex escape.
- Nếu chuỗi sau normalize rỗng (input là ký tự đặc biệt): fallback search raw regex.

---

## 6. Pricing Logic Detail

### 6.1 Ma trận pricing theo roomType

| `roomType` | `shortTermPricingType` | `hourlyPricingMode` | Field được dùng |
|---|---|---|---|
| `LONG_TERM` | — | — | `defaultRoomPrice`, `defaultElectricPrice`, `defaultWaterPrice`, `defaultTermMonths` |
| `SHORT_TERM` | `FIXED` | — | `fixedPrice` |
| `SHORT_TERM` | `HOURLY` | `PER_HOUR` | `pricePerHour` |
| `SHORT_TERM` | `HOURLY` | `TABLE` | `shortTermPrices[]`, `priceTableType` |
| `SHORT_TERM` | `DAILY` | — (không có mode) | `shortTermPrices[]`, `priceTableType` |

### 6.2 `PriceTableType` — Cách tính

- **`PROGRESSIVE` (Lũy tiến)**: Cộng dồn từng mức.
  - VD bảng giờ `[1-2: 50k, 3-4: 40k, 5+: 30k]`, 5 giờ = 50k + 50k + 40k + 40k + 30k = 210k.
- **`FLAT` (Trọn gói)**: Lấy giá của mức cuối cùng nhân với tổng số lượng.
  - VD 5 giờ → rơi vào mức `5+: 30k` → 30k × 5 = 150k.

> TODO: Logic tính toán thực tế (PROGRESSIVE/FLAT) không có trong rooms.service.ts — chỉ lưu config. Tính toán xảy ra trong InvoicesService/ContractsService khi tạo hóa đơn. Cần verify cross-reference với `backend/src/modules/invoices/invoices.service.ts`.

### 6.3 `cleanRoomData` (Frontend)
Trước khi gọi API, RoomCreatePage và RoomEditPage chạy hàm `cleanRoomData()` để strip các field không liên quan theo type:
- `LONG_TERM`: xóa tất cả `shortTermPricingType, hourlyPricingMode, pricePerHour, shortTermPrices, fixedPrice`.
- `SHORT_TERM`: xóa tất cả `defaultElectricPrice, defaultWaterPrice, defaultRoomPrice, defaultTermMonths`; strip thêm theo sub-mode.

---

## 7. Frontend Touchpoints

### 7.1 Pages

| Route | Component | File |
|---|---|---|
| `/rooms` | `RoomsPage` | `frontend/src/pages/rooms/RoomsPage.tsx` |
| `/room-board` | `RoomBoardPage` | `frontend/src/pages/rooms/RoomBoardPage.tsx` |
| `/rooms/new` | `RoomCreatePage` | `frontend/src/pages/rooms/RoomCreatePage.tsx` |
| `/rooms/new?duplicate=:id` | `RoomCreatePage` | Duplicate: load source, copy tất cả fields, đổi tên ` - copy`, reset status về `AVAILABLE` |
| `/rooms/:id/edit` | `RoomEditPage` | `frontend/src/pages/rooms/RoomEditPage.tsx` |

### 7.2 Components

| Component | File | Mục đích |
|---|---|---|
| `RoomForm` | `frontend/src/components/forms/RoomForm.tsx` | Form thêm/sửa phòng — conditional render theo `roomType` và `shortTermPricingType` |
| `RoomBoardWorkspace` | `frontend/src/components/rooms/RoomBoardWorkspace.tsx` | Wrapper cho board view; xử lý contract activation flow |
| `RoomStatusOverview` | `frontend/src/components/dashboard/RoomStatusOverview.tsx` | Render danh sách phòng dạng board (grouped/ungrouped); DnD via `@dnd-kit` |
| `PriceTablePopover` | `frontend/src/components/PriceTablePopover.tsx` | Hiển thị bảng giá tiers dạng popover; props: `shortTermPrices`, `pricingType` (`'HOURLY' \| 'DAILY'`), `priceTableType`, `variant` (`'inline' \| 'amount'`) |
| `RoomSelector` | `frontend/src/components/RoomSelector.tsx` | Combobox chọn phòng; infinite scroll (page 10); filter theo `buildingId` + `status`; separate query để luôn hiện tên phòng đang chọn |

### 7.3 RoomForm — Conditional Render Logic

```
roomType === 'LONG_TERM'
  └─ Section: defaultElectricPrice, defaultWaterPrice, defaultRoomPrice, defaultTermMonths
     └─ defaultTermMonths: select (1/2/3/6/12 tháng hoặc Custom) + NumberInput nếu custom
     └─ Section: currentElectricIndex, currentWaterIndex

roomType === 'SHORT_TERM'
  └─ shortTermPricingType select (HOURLY / DAILY / FIXED)
     ├─ FIXED → NumberInput fixedPrice
     ├─ HOURLY → hourlyPricingMode select (PER_HOUR / TABLE)
     │    ├─ PER_HOUR → NumberInput pricePerHour
     │    └─ TABLE → RadioGroup priceTableType + PriceTier grid (useFieldArray)
     └─ DAILY → RadioGroup priceTableType + PriceTier grid (useFieldArray)
```

### 7.4 PriceTier Grid (useFieldArray)

- Tier đầu (`index === 0`): `fromValue` disabled, `toValue` editable.
- Tier cuối (`isLast`): `fromValue` disabled, `toValue` hiển thị "còn lại" (literal text), không editable.
- Tier giữa: `fromValue` disabled (auto-calculated = prevTier.toValue + 1 via `handleToValueChange`), `toValue` editable, có nút xóa.
- Thêm tier: `handleAddPriceTier()` — insert trước tier cuối, auto-link `fromValue`.
- Xóa tier giữa: cập nhật `nextTier.fromValue = prevTier.toValue + 1`.

### 7.5 Status Badge (RoomsPage)

- `AVAILABLE` (variant `success`) — clickable → toggle sang `MAINTENANCE`.
- `OCCUPIED` (variant `info`) — không clickable.
- `MAINTENANCE` (variant `error`) — clickable → toggle về `AVAILABLE`.
- `DEPOSITED` (variant `warning`) — clickable → toggle về `AVAILABLE`.
- Toggle gọi `PUT /api/rooms/:id` với `{ status: newStatus }`.

### 7.6 Column Visibility

RoomsPage dùng `useColumnVisibility('rooms', columnConfig)` với các columns: `roomName`, `roomCode`, `building`, `roomType`, `floor`, `price`, `status`.

### 7.7 State Management & Queries

- React Query key cho list: `['rooms', { page, limit, search, buildingId, status, sortBy, sortOrder }]`.
- React Query key cho dashboard: `['rooms-dashboard']`.
- `useBuildingStore` (Zustand): `selectedBuildingId` dùng như global filter trên cả list và board.
- RoomSelector dùng `useInfiniteQuery` key: `['rooms', buildingId, search, status]`.

---

## 8. Cross-Module Dependencies

### Module này CẦN:
- **Building** (`buildingId`, sync `totalRooms`): `RoomsModule` import `BuildingSchema`.
- **RoomGroup** (`roomGroupId` reference): chỉ dùng trong aggregate lookup, không import schema trực tiếp vào module (lookup bằng tên collection `'roomgroups'`).
- **User** (`ownerId`): từ JWT token qua `@CurrentUser()`.

### Module khác CẦN Room:
- **Contracts**: `roomId` reference; ContractsService gọi `RoomsService.updateStatus()` khi activate/terminate. `RoomsModule` exports `RoomsService`.
- **Invoices**: `roomId` reference (qua contract); đọc `currentElectricIndex / currentWaterIndex` để tính tiêu thụ.
- **Dashboard/Board**: `GET /api/rooms/dashboard` — endpoint aggregate dùng trực tiếp bởi `RoomStatusOverview`.

---

## 9. Gotchas & Testing Notes

### 9.1 Pitfalls

1. **PriceTier `fromValue` bắt đầu từ 1, không phải 0**: CLAUDE.md ghi `fromValue = 0` nhưng `validateShortTermPrices()` check `prices[0].fromValue !== 1` → throw error. Frontend default cũng `fromValue: 1`. TODO: Cập nhật CLAUDE.md cho nhất quán.

2. **ObjectId convert**: Mọi reference field phải convert sang `new Types.ObjectId(...)` trước khi query. `buildingId`, `ownerId`, `roomGroupId` đều làm điều này. Quên convert → không match.

3. **`buildingId` immutable**: Service xóa `dto.buildingId` trong update. Nếu cần chuyển phòng sang building khác → phải xóa + tạo lại.

4. **`shortTermPrices` validation chỉ trigger khi có TABLE mode**: Backend `validateShortTermPrices()` chỉ chạy nếu `DAILY` hoặc `HOURLY + TABLE`. `FIXED` và `HOURLY + PER_HOUR` không validate `shortTermPrices`.

5. **Status lock không chặn `MAINTENANCE`**: Chỉ `OCCUPIED` và `DEPOSITED` mới lock. `AVAILABLE ↔ MAINTENANCE` luôn cho phép thủ công.

6. **`priceTableType` có trên schema nhưng áp dụng chỉ khi dùng TABLE mode**: Field tồn tại cho cả `HOURLY × TABLE` và `DAILY`. Với `FIXED` và `PER_HOUR` thì bị ignore.

7. **Duplicate room**: Query param `?duplicate=roomId` trong `/rooms/new`. Load room gốc, copy tất cả pricing fields, đổi `roomName += ' - copy'`, reset `status = 'AVAILABLE'`, `roomCode` sẽ tự sinh mới.

8. **RoomBoardWorkspace delegate**: Board page chỉ wrap `RoomBoardWorkspace` → `RoomStatusOverview`. Logic DnD và rendering thực tế nằm ở `RoomStatusOverview.tsx` — không nằm trong rooms module.

### 9.2 Test Scenarios

| Scenario | Input | Expected |
|---|---|---|
| Tạo LONG_TERM thiếu `defaultRoomPrice` | `defaultRoomPrice: 0` | Frontend superRefine reject |
| Tạo SHORT_TERM HOURLY PER_HOUR | `pricePerHour: 50000` | Save OK; fields SHORT_TERM khác bị strip |
| Tạo SHORT_TERM HOURLY TABLE | 2+ tiers, tier cuối `toValue: -1` | Save OK |
| Tạo SHORT_TERM HOURLY TABLE tier cuối `toValue: 5` | | Backend throw `'Last price tier must have toValue = -1'` |
| Tạo SHORT_TERM DAILY | `shortTermPrices` hợp lệ | Save OK |
| Tạo SHORT_TERM FIXED | `fixedPrice: 200000` | Save OK |
| Cập nhật status OCCUPIED room | `{ status: 'AVAILABLE' }` | Backend throw `'Cannot manually change status of an OCCUPIED or DEPOSITED room'` |
| Xóa OCCUPIED room | DELETE | Backend throw `'Cannot delete room with OCCUPIED status'` |
| Reorder rooms | `{ items: [{ roomId, roomGroupId, sortOrder }] }` | bulkWrite; PATCH (không phải PUT) |
| Cập nhật chỉ số điện nước | `PUT /rooms/:id/indexes` | Chỉ update `currentElectricIndex / currentWaterIndex` |
| Tìm kiếm tiếng Việt có dấu | `search: 'phòng đôi'` | Tìm trên `nameNormalized` (không dấu) |

### 9.3 Known TODOs

- **TODO [pricing-calc]**: Logic tính tiền thực tế (PROGRESSIVE/FLAT) không có trong `rooms.service.ts` — verify implementation trong InvoicesService. Cần document cross-reference.
- **TODO [doc-mismatch]**: CLAUDE.md mô tả tier đầu `fromValue = 0` nhưng code dùng `fromValue = 1`. Cần cập nhật CLAUDE.md.
- **TODO [images]**: Field `images: string[]` tồn tại trong schema nhưng không có upload UI trong form hiện tại.
- **TODO [amenities]**: Field `amenities: string[]` trong schema nhưng không có UI input trong RoomForm.
