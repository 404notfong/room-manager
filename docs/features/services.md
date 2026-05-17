# Services Playbook

> **Vai trò trong domain**: Services là catalog các dịch vụ tính phí (điện, nước, internet, giữ xe…) với pricing FIXED hoặc TABLE (bậc thang), được snapshot vào Contract và Invoice tại thời điểm tạo.
> **Code paths**: `backend/src/modules/services/`, `frontend/src/pages/services/`, `frontend/src/components/forms/ServiceForm.tsx`

---

## 1. Purpose & Relations

Module Services đóng vai trò **catalog tĩnh** — định nghĩa loại dịch vụ, đơn vị tính, và cách tính giá. Bản thân module không tự sinh hóa đơn hay tính toán; nó được tra cứu bởi Contract khi người dùng chọn dịch vụ áp dụng cho phòng.

Hai chiều phụ thuộc chính:

- **Services cần**: `User` (ownerId) và `Building` (khi buildingScope = SPECIFIC, để populate tên tòa nhà).
- **Module khác cần Services**:
  - `ContractsService.findOne(serviceId, ownerId)` — validate giá và tên khi tạo/cập nhật Contract với `serviceCharges`.
  - Khi Invoice được tạo từ Contract, `serviceCharges` từ Contract được **copy thẳng** (snapshot) vào Invoice — không tham chiếu ngược lại Service sau đó.

```
Services (catalog)
  ├── Contract.serviceCharges[] — snapshot { name, amount, quantity, isRecurring }
  │     └── Invoice.serviceCharges[] — copy từ Contract (name, amount)
  └── findByBuilding() — dùng để lọc dịch vụ theo tòa nhà khi chọn cho Contract
```

**Lưu ý snapshot**: Sau khi Contract/Invoice được tạo, thay đổi giá trên Service gốc **không ảnh hưởng** đến các Contract/Invoice đã tồn tại. Đây là thiết kế cố ý.

---

## 2. Data Model

### Schema (`backend/src/modules/services/schemas/service.schema.ts`)

| Field | Type | Required | Default | Mô tả |
|---|---|---|---|---|
| `ownerId` | `Types.ObjectId` ref `User` | Yes | — | Multi-tenant owner, indexed |
| `code` | `string` | Yes | auto-generated | Mã dịch vụ, `unique: true`, `index: true`, trim |
| `name` | `string` | Yes | — | Tên dịch vụ, trim |
| `nameNormalized` | `string` | No | — | Tên đã normalize (bỏ dấu), dùng để search, `index: true` |
| `unit` | `string` | Yes | — | Đơn vị tính (kWh, m³, người, xe, phòng…), trim |
| `priceType` | `'FIXED' \| 'TABLE'` | No | `'FIXED'` | Loại giá |
| `fixedPrice` | `number` | No | `0` | Giá cố định, dùng khi `priceType = FIXED` |
| `priceTiers` | `ServicePriceTier[]` | No | `[]` | Bảng giá bậc thang, dùng khi `priceType = TABLE` |
| `buildingScope` | `'ALL' \| 'SPECIFIC'` | No | `'ALL'` | Phạm vi áp dụng |
| `buildingIds` | `Types.ObjectId[]` ref `Building` | No | `[]` | Các tòa nhà áp dụng, dùng khi `buildingScope = SPECIFIC` |
| `isActive` | `boolean` | No | `true` | Trạng thái hoạt động |
| `isDeleted` | `boolean` | No | `false` | Soft delete |

**Compound indexes**:
```
{ ownerId: 1, isDeleted: 1, isActive: 1 }
{ code: 1 }
{ buildingIds: 1 }
```

### Sub-schema: `ServicePriceTier`

| Field | Type | Constraint | Mô tả |
|---|---|---|---|
| `fromValue` | `number` | `>= 0` | Ngưỡng bắt đầu của tier (tier đầu luôn = `0`) |
| `toValue` | `number` | `>= -1` | Ngưỡng kết thúc; `-1` nghĩa là "còn lại" (tier cuối) |
| `price` | `number` | `>= 0` | Giá áp dụng cho tier này |

Sub-schema được khai báo với `_id: false`.

### Enums liên quan

Định nghĩa tại `backend/src/common/constants/enums.ts`:

```typescript
// Cách tính giá khi dùng bảng giá TABLE
enum PriceTableType {
    PROGRESSIVE = 'PROGRESSIVE',  // Lũy tiến: tính riêng từng tier, cộng dồn
    FLAT = 'FLAT',                // Trọn gói: nhân giá của tier khớp với tổng consumption
}
```

> **Quan trọng**: `PriceTableType` **không nằm trên Service schema**. Nó nằm trên **Contract** (`priceTableType` field) và quyết định cách áp dụng `shortTermPrices` của phòng ngắn hạn — không trực tiếp điều khiển `priceTiers` của Service. Xem phần 4 để biết cách tính phí dịch vụ TABLE thực tế.

### ServiceChargeDto (trong Contract/Invoice)

Khi Service được gắn vào Contract, dữ liệu được lưu dưới dạng:

```typescript
// Contract schema — serviceCharges[]
{
    name: string;        // Tên dịch vụ (phải khớp Service.name khi serviceId có)
    amount: number;      // Đơn giá (phải khớp Service.fixedPrice nếu FIXED)
    quantity: number;    // Số lượng, default 1 (có thể sửa)
    isRecurring: boolean;
    // serviceId và isPredefined chỉ tồn tại ở DTO, không lưu vào schema
}
```

---

## 3. API Endpoints

Base path: `/api/services`. Tất cả endpoints đều yêu cầu `JwtAuthGuard`.

| Method | Path | Mô tả | Request | Response |
|---|---|---|---|---|
| `POST` | `/services` | Tạo dịch vụ mới | `CreateServiceDto` | Service document |
| `GET` | `/services` | Danh sách có phân trang | `GetServicesDto` (query) | `{ data: Service[], meta: PaginationMeta }` |
| `GET` | `/services/:id` | Chi tiết một dịch vụ | — | Service document (populate buildingIds) |
| `PUT` | `/services/:id` | Cập nhật dịch vụ | `UpdateServiceDto` | Service document (populate buildingIds) |
| `DELETE` | `/services/:id` | Xóa mềm dịch vụ | — | `void` (204) |

### Query params của `GET /services` (`GetServicesDto`)

| Param | Type | Mô tả |
|---|---|---|
| `search` | `string` (optional) | Tìm theo name/nameNormalized/code (regex, case-insensitive) |
| `buildingId` | `MongoId` (optional) | Lọc: trả về ALL scope + SPECIFIC có buildingId trong buildingIds |
| `isActive` | `boolean` (optional) | Lọc theo trạng thái hoạt động |
| `page` | `number` | Trang (extends PaginationDto) |
| `limit` | `number` | Số lượng mỗi trang |
| `sortBy` | `'name' \| 'code' \| 'unit' \| 'status' \| 'createdAt'` | Trường sort |
| `sortOrder` | `'asc' \| 'desc'` | Chiều sort, default `'desc'` |

### DTO Validation

**`CreateServiceDto`** (`class-validator` decorators):

| Field | Decorators | Ghi chú |
|---|---|---|
| `name` | `@IsString()`, `@IsNotEmpty()` | Required |
| `unit` | `@IsString()`, `@IsNotEmpty()` | Required |
| `priceType` | `@IsEnum(['FIXED', 'TABLE'])`, `@IsOptional()` | Default schema: `'FIXED'` |
| `fixedPrice` | `@IsNumber()`, `@IsOptional()` | Dùng khi `priceType = FIXED` |
| `priceTiers` | `@ValidateNested({ each: true })`, `@Type(() => ServicePriceTierDto)`, `@IsOptional()` | Dùng khi `priceType = TABLE` |
| `buildingScope` | `@IsEnum(['ALL', 'SPECIFIC'])`, `@IsOptional()` | Default schema: `'ALL'` |
| `buildingIds` | `@IsArray()`, `@IsMongoId({ each: true })`, `@IsOptional()` | Dùng khi `buildingScope = SPECIFIC` |
| `isActive` | `@IsBoolean()`, `@IsOptional()` | — |

**`ServicePriceTierDto`** (sub-DTO, không export):

| Field | Decorators |
|---|---|
| `fromValue` | `@IsNumber()`, `@Min(0)` |
| `toValue` | `@IsNumber()`, `@Min(-1)` |
| `price` | `@IsNumber()`, `@Min(0)` |

**`UpdateServiceDto`**: Tất cả field của `CreateServiceDto` đều optional (`@IsOptional()`). `code` không thể update (không có trong DTO).

> **Lưu ý**: Backend DTO không enforce cross-field rules (ví dụ: `priceType=TABLE` phải có `priceTiers`, `buildingScope=SPECIFIC` phải có `buildingIds`). Validation cross-field chỉ thực hiện ở **frontend** qua Zod `superRefine`.

---

## 4. Business Rules & State Machine

### 4.1 Code Generation

`code` được **tự động sinh** khi tạo (`SV-<timestamp_base36>-<4_random_digits>`), không cho phép client truyền vào và không thể cập nhật. Nếu xảy ra trùng (hiếm), service thử lại tối đa 5 lần với suffix ngẫu nhiên thêm.

### 4.2 Scope Filtering

Khi query với `buildingId`:
```typescript
filter.$or = [
    { buildingScope: 'ALL' },
    { buildingScope: 'SPECIFIC', buildingIds: new Types.ObjectId(buildingId) }
]
```

`findByBuilding(buildingId, ownerId)` hoạt động theo cùng logic — dùng bởi các module khác (hiện tại được export từ `ServicesModule`).

### 4.3 Pricing Calculation với `priceType = TABLE`

Schema lưu `priceTiers[]` nhưng **không lưu `priceTableType`** (PROGRESSIVE/FLAT) trên Service — field này thuộc về Contract (cho phòng ngắn hạn). Do đó, cách tính phí dịch vụ TABLE trong Invoice được xác định theo logic sau:

**Kịch bản thực tế**: Khi Service `priceType = TABLE` được dùng trong Contract, `amount` được ghi vào `serviceCharges[].amount` tại thời điểm người dùng chọn (frontend tính toán hoặc nhập thủ công). Invoice sau đó dùng `amount * quantity` (quantity từ Contract, không tính lại từ tiers).

**TODO**: Không có công thức tính `amount` từ `priceTiers` + consumption value trong backend codebase hiện tại — frontend chịu trách nhiệm tính hoặc người dùng nhập tay khi tạo Contract. Cần xác nhận flow chính xác tại `frontend/src/components/CreateInvoiceModal.tsx` và form Contract. (TODO-SERVICES-01)

**Logic tier nếu cần tính thủ công** (dựa trên `PriceTableType` từ `enums.ts`):

```
// Ví dụ: priceTiers = [{0→50, 2000}, {50→100, 1800}, {100→-1, 1500}]
// Consumption = 75 đơn vị

// PROGRESSIVE (lũy tiến) — tính riêng từng bậc, cộng dồn
total = 0
tier 0: applies 0-50  → 50  * 2000 = 100,000
tier 1: applies 50-75 → 25  * 1800 =  45,000
tier 2: applies 75+   → skip (75 < 100)
total = 145,000 VND

// FLAT (trọn gói) — tìm tier khớp consumption, nhân toàn bộ
tier khớp: 50 <= 75 <= 100 → tier {50→100, 1800}
total = 75 * 1800 = 135,000 VND
```

```typescript
// Pseudo-code PROGRESSIVE
function calcProgressive(tiers: ServicePriceTier[], consumption: number): number {
    let total = 0;
    for (const tier of tiers) {
        if (consumption <= tier.fromValue) break;
        const ceiling = tier.toValue === -1 ? consumption : Math.min(consumption, tier.toValue);
        total += (ceiling - tier.fromValue) * tier.price;
    }
    return total;
}

// Pseudo-code FLAT
function calcFlat(tiers: ServicePriceTier[], consumption: number): number {
    const tier = tiers.find(t =>
        consumption >= t.fromValue && (t.toValue === -1 || consumption <= t.toValue)
    );
    return tier ? consumption * tier.price : 0;
}
```

### 4.4 Service Charge Validation trong Contract

Khi `ContractsService.create()` nhận `serviceCharges[]` có `serviceId`:

1. Gọi `servicesService.findOne(serviceId, ownerId)` — throw `NotFoundException` nếu không tồn tại.
2. Kiểm tra `sc.name === systemService.name` (trim) — throw `BadRequestException` nếu không khớp.
3. Nếu `systemService.priceType === 'FIXED'`: kiểm tra `|sc.amount - systemService.fixedPrice| <= 0.01` — throw `BadRequestException` nếu không khớp.
4. `quantity` được phép thay đổi tự do.
5. Nếu `serviceId` không có (custom service): chỉ validate `name` không rỗng và `amount >= 0`.

### 4.5 Soft Delete

- `remove()` set `isDeleted: true` — không xóa khỏi database.
- Tất cả query đều filter `isDeleted: false`.
- Soft delete Service **không ảnh hưởng** đến Contract/Invoice đã tồn tại (đã snapshot).
- Nếu Service bị xóa sau khi Contract còn dùng `serviceId`, validate lúc sửa Contract sẽ throw `NotFoundException`.

### 4.6 isActive vs isDeleted

- `isActive = false`: Service vẫn tồn tại, không hiện trong filter `isActive=true`, nhưng vẫn validate được nếu có `serviceId`. Phù hợp khi tạm ngừng dịch vụ mà không muốn mất lịch sử.
- `isDeleted = true`: Service biến mất khỏi tất cả query — kết quả của `DELETE /services/:id`.

Không có API để restore Service sau khi bị soft-delete (không có `PATCH /services/:id/restore`). Để phục hồi phải thao tác trực tiếp DB.

### 4.7 nameNormalized và Search

Khi tạo/sửa Service, `nameNormalized` được tính tự động bằng `normalizeString(name)` (utility tại `@common/utils/string.util`). Field này giúp search không dấu — ví dụ: tìm "dien" sẽ khớp "Điện".

Logic search trong `findAll`:
- Nếu `normalizeString(search)` trả về chuỗi có nghĩa: search trên `nameNormalized` (regex) + `code` (regex).
- Nếu không: fallback search trên `name` và `code` (regex thô, case-insensitive).
- **Lưu ý**: khi đã có `buildingId` filter và thêm `search`, `$or` của buildingId bị ghi đè (xem TODO-SERVICES-03).

---

## 5. Frontend Touchpoints

### Pages

| Route | Component | Mô tả |
|---|---|---|
| `/services` | `ServicesPage` | Danh sách với search, sort, filter status, column visibility, pagination |
| `/services/new` | `ServiceCreatePage` | Tạo mới — dùng `ServiceForm` trong Card |
| `/services/:id/edit` | `ServiceEditPage` | Sửa — load service qua `GET /services/:id`, hydrate form |

### Components

**`ServiceForm`** (`frontend/src/components/forms/ServiceForm.tsx`):
- Được dùng bởi cả Create và Edit page qua prop `formId="service-form"` (submit trigger từ header button).
- Zod schema được tạo trong `useMemo` (để reactive với `t()`).
- `priceType`: radio `FIXED` | `TABLE` — conditional render.
  - Khi `FIXED`: hiện `NumberInput` cho `fixedPrice`.
  - Khi `TABLE`: hiện tier editor với `useFieldArray`. Khi switch sang TABLE và `priceTiers` rỗng, tự điền 2 tier mặc định `[{0→0}, {0→-1}]`.
- `buildingScope`: radio `ALL` | `SPECIFIC` — conditional render.
  - Khi `SPECIFIC`: hiện dual-panel picker (Available / Selected buildings), gọi `GET /buildings?page=1&limit=100`.
- Tier editor: tier đầu (`fromValue`) luôn disabled; tier cuối hiển thị "còn lại" thay vì input `toValue`; thay đổi `toValue` tại index `i` tự động cập nhật `fromValue` của index `i+1`.
- `COMMON_UNITS` quick-select: người, item, phòng, xe, tháng, lần.

**`PriceTablePopover`** (`frontend/src/components/PriceTablePopover.tsx`):
- Dùng trong `ServicesPage` table cell để hiển thị bảng tier khi `priceType = TABLE`.
- Prop `shortTermPrices` nhận `priceTiers[]` của Service (tên prop giống phòng ngắn hạn nhưng reuse cùng component).
- Prop `variant="amount"` cho phép hiển thị dạng inline amount cell.
- `unitLabel` hiển thị đơn vị tính bên cạnh từng tier.

### Sort fields

`getListSort()` trong `ServicesService` map `sortBy` string sang MongoDB sort object:

| `sortBy` value | MongoDB sort |
|---|---|
| `name` | `{ nameNormalized: dir, name: dir }` |
| `code` | `{ code: dir }` |
| `unit` | `{ unit: dir, nameNormalized: 1 }` |
| `status` | `{ isActive: dir, nameNormalized: 1 }` |
| `createdAt` (default) | `{ createdAt: -1 }` (luôn desc, bỏ qua sortOrder) |

Frontend sort labels tương ứng: `name`, `code`, `unit`, `status` (hiển thị trong `WorkspaceSortChip`). Không có sort theo `price`.

### Key i18n keys (VI)

| Key | Giá trị |
|---|---|
| `services.title` | Dịch vụ |
| `services.subtitle` | Quản lý các dịch vụ cho thuê phòng |
| `services.name` | Tên dịch vụ |
| `services.code` | Mã dịch vụ |
| `services.unit` | Đơn vị tính |
| `services.price` | Giá |
| `services.priceType` | Loại giá |
| `services.fixedPrice` | Giá cố định |
| `services.priceTable` | Bảng giá |
| `services.addTier` | Thêm mức giá |
| `services.from` | Từ |
| `services.to` | Đến |
| `services.scope` | Phạm vi áp dụng |
| `services.allBuildings` | Tất cả tòa nhà |
| `services.specificBuildings` | Chọn tòa nhà |
| `services.isActive` | Đang hoạt động |
| `services.tablePrice` | Bảng giá |
| `services.createSuccess` | Tạo dịch vụ thành công |
| `services.updateSuccess` | Cập nhật dịch vụ thành công |
| `services.deleteSuccess` | Xóa dịch vụ thành công |

### Query Keys (React Query)

| Key | Scope |
|---|---|
| `['services', { page, limit, search, status, sortBy, sortOrder }]` | List trong `ServicesPage` |
| `['service', id]` | Detail trong `ServiceEditPage` |
| `['buildings', 'lookup']` | Building lookup cho scope display trong `ServicesPage` |
| `['buildings']` | Building list cho picker trong `ServiceForm` |

---

## 6. Cross-Module Dependencies

### Module này CẦN

| Module | Lý do |
|---|---|
| `User` | `ownerId` multi-tenant, extract từ JWT qua `@CurrentUser()` |
| `BuildingsModule` | Import vào `ServicesModule` để Mongoose có thể populate `buildingIds` (ref `Building`) |

### Module khác CẦN Services

| Module | Cách dùng | Method |
|---|---|---|
| `ContractsModule` | Validate serviceCharges khi tạo/sửa Contract | `servicesService.findOne(id, ownerId)` |
| `InvoicesModule` | Không gọi trực tiếp — lấy serviceCharges từ Contract đã được snapshot | — |

`ServicesModule` export `ServicesService` để `ContractsModule` inject.

---

## 7. Gotchas & Testing Notes

### Pitfalls

1. **`code` unique là global** (không phải per-owner): Schema đánh `unique: true` trên `code` mà không có `ownerId`. Nếu hai owner tạo cùng lúc có thể conflict. (TODO-SERVICES-02: cân nhắc unique compound `{ code: 1, ownerId: 1 }`)

2. **Cross-field validation thiếu ở backend DTO**: Backend không ép buộc `priceType=TABLE → priceTiers required` hoặc `buildingScope=SPECIFIC → buildingIds required`. Validation chỉ ở frontend Zod. Gọi API trực tiếp có thể lưu Service không hợp lệ.

3. **Snapshot không tự cập nhật**: Sau khi sửa giá Service, các Contract/Invoice cũ giữ nguyên giá cũ. Đây là behavior đúng nhưng cần giải thích rõ cho user khi train.

4. **`ServiceEditPage` fallback field names**: Khi hydrate form, dùng `service.priceType || service.pricingType` và `service.fixedPrice || service.unitPrice` — legacy field aliases để tương thích data cũ.

5. **`findByBuilding` không expose qua REST**: Method `findByBuilding()` chỉ dùng nội bộ (được export qua `ServicesService`) nhưng không có endpoint riêng trên controller. Frontend gọi `GET /services?buildingId=xxx` thay thế.

6. **Search conflict khi có cả `search` và `buildingId`**: Trong `findAll()`, cả `buildingId` filter và `search` filter đều ghi vào `filter.$or` — filter sau ghi đè filter trước. Nếu query có cả hai params, `buildingId` filter bị mất. (TODO-SERVICES-03: dùng `$and` hoặc restructure filter)

### Test Scenarios Cần Cover

| Scenario | Combination | Test case |
|---|---|---|
| **FIXED × ALL** | `priceType=FIXED`, `buildingScope=ALL` | Tạo service, verify `findAll` trả về với mọi buildingId query |
| **FIXED × SPECIFIC** | `priceType=FIXED`, `buildingScope=SPECIFIC`, `buildingIds=[id1]` | `findAll?buildingId=id1` trả về; `findAll?buildingId=id2` không trả về |
| **TABLE × ALL** | `priceType=TABLE`, `priceTiers[...]`, `buildingScope=ALL` | Tạo với tiers, verify tiers được lưu đúng |
| **TABLE × SPECIFIC** | `priceType=TABLE`, `buildingScope=SPECIFIC` | Kết hợp cả hai điều kiện lọc |
| **Contract validation** | serviceId có, giá khớp | Pass validation |
| **Contract validation** | serviceId có, giá không khớp (FIXED) | Throw `BadRequestException` |
| **Contract validation** | serviceId có nhưng service bị xóa | Throw `NotFoundException` |
| **Soft delete** | Remove rồi query | Không xuất hiện trong list |
| **Search + buildingId** | Cả hai params | Kiểm tra behavior hiện tại (TODO-SERVICES-03) |
| **Code uniqueness** | Tạo 2 service cùng lúc | Race condition trên `code` unique |

---

## 8. Module Registration

`ServicesModule` được đăng ký trong `AppModule`. Nó export `ServicesService` và import `BuildingsModule` (để Mongoose biết `Building` model khi `populate('buildingIds')`).

`ContractsModule` import `ServicesModule` để inject `ServicesService` vào `ContractsService`. Không có circular dependency giữa hai module này vì `ServicesModule` không import `ContractsModule`.

---

## Appendix: ServiceChargeDto (Contract module)

```typescript
// backend/src/modules/contracts/dto/contract.dto.ts
class ServiceChargeDto {
    @IsString() name: string;
    @IsNumber() amount: number;
    @IsNumber() @IsOptional() quantity?: number;
    @IsBoolean() @IsOptional() isRecurring?: boolean;
    @IsMongoId() @IsOptional() serviceId?: string;   // Ref về Service._id
    @IsBoolean() @IsOptional() isPredefined?: boolean;
}
```

`serviceId` và `isPredefined` chỉ tồn tại ở DTO/validation layer — **không được persist** vào Contract schema. Contract schema chỉ lưu `{ name, amount, quantity, isRecurring }`.

Invoice schema còn đơn giản hơn: chỉ lưu `{ name, amount }` trong `serviceCharges[]` — `quantity` và `isRecurring` không được copy sang Invoice (xem `backend/src/modules/invoices/schemas/invoice.schema.ts` line 106–114). Tổng tiền dịch vụ trong Invoice được tính tại thời điểm tạo: `sum(charge.amount * (charge.quantity || 1))` dùng quantity từ DTO tạo Invoice.
