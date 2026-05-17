# Buildings Playbook

> **Vai trò trong domain**: Building là đơn vị tổ chức cao nhất — mọi phòng, nhóm phòng, hợp đồng đều gắn vào một Building cụ thể thuộc một Owner.
> **Code paths**: `backend/src/modules/buildings/`, `frontend/src/pages/buildings/`, `frontend/src/components/BuildingSelector.tsx`, `frontend/src/stores/buildingStore.ts`

---

## 1. Purpose & Relations

Building đại diện cho một tòa nhà / bất động sản vật lý. Owner có thể quản lý nhiều Building. Mỗi Building chứa nhiều Rooms; Rooms lại có thể thuộc Room Groups. Services có thể được giới hạn phạm vi theo `buildingId` (xem module Services).

```
Owner (User)
  └── Building  ──────────────────────────── code (unique, auto-gen)
        ├── Room[]       (buildingId FK)
        └── RoomGroup[]  (buildingId FK)
              └── Contract → Tenant → Invoice → Payment
```

`totalRooms` là trường denormalized — phản ánh số Room chưa bị xóa của Building, được đồng bộ thủ công qua `POST /buildings/sync-counts`.

---

## 2. Data Model

### Schema — `building.schema.ts`

| Field           | Type                              | Required | Default | Mô tả                                            |
|-----------------|-----------------------------------|----------|---------|--------------------------------------------------|
| `ownerId`       | `Types.ObjectId` (ref: `User`)    | Yes      | —       | Multi-tenant key; index: `{ ownerId, isDeleted }` |
| `name`          | `String`                          | Yes      | —       | Tên hiển thị; trimmed                            |
| `nameNormalized`| `String`                          | No       | —       | Tên đã normalize (bỏ dấu) để tìm kiếm fuzzy     |
| `code`          | `String`                          | Yes      | —       | Unique; format `B-{base36ts}-{4digit}`; auto-gen  |
| `address.street`| `String`                          | Yes      | —       | Số nhà, đường                                    |
| `address.ward`  | `String`                          | Yes      | —       | Phường / Xã                                      |
| `address.district`| `String`                        | Yes      | —       | Quận / Huyện                                     |
| `address.city`  | `String`                          | Yes      | —       | Tỉnh / Thành phố                                 |
| `description`   | `String`                          | No       | —       | Mô tả tùy chọn; trimmed                          |
| `totalRooms`    | `Number`                          | No       | `0`     | Denormalized count; đồng bộ qua sync-counts       |
| `isDeleted`     | `Boolean`                         | No       | `false` | Soft-delete flag                                  |
| `createdAt`     | `Date`                            | —        | auto    | Mongoose timestamps                              |
| `updatedAt`     | `Date`                            | —        | auto    | Mongoose timestamps                              |

**Indexes** (ngoài `_id`):
- Compound: `{ ownerId: 1, isDeleted: 1 }`
- Single: `{ code: 1 }` — unique constraint từ `@Prop({ unique: true })`

### Enums liên quan

Building không dùng enum nội tại. Các enum ảnh hưởng gián tiếp qua Room cascade:

| Enum         | Values                                        | Liên quan                                     |
|--------------|-----------------------------------------------|-----------------------------------------------|
| `RoomStatus` | `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`, `DEPOSITED` | Kiểm tra khi xóa Building (chặn OCCUPIED/DEPOSITED) |

### DTO Validation

**`CreateBuildingDto`** — các trường được chấp nhận từ client:

| Field             | Decorator                        | Ghi chú                           |
|-------------------|----------------------------------|-----------------------------------|
| `name`            | `@IsString()` `@IsNotEmpty()`    | Required                          |
| `address`         | `@ValidateNested()` `@Type(() => AddressDto)` | Nested object bắt buộc |
| `address.street`  | `@IsString()` `@IsNotEmpty()`    | Required                          |
| `address.ward`    | `@IsString()` `@IsNotEmpty()`    | Required                          |
| `address.district`| `@IsString()` `@IsNotEmpty()`    | Required                          |
| `address.city`    | `@IsString()` `@IsNotEmpty()`    | Required                          |
| `description`     | `@IsString()` `@IsOptional()`    | Optional                          |

> `code` **không** có trong DTO — backend tự sinh, client không được truyền. Frontend cũng strip `code` trước khi POST (xem `BuildingForm.handleFormSubmit`).

**`UpdateBuildingDto`** — tất cả trường đều `@IsOptional()`:

| Field       | Decorator                                              |
|-------------|--------------------------------------------------------|
| `name`      | `@IsString()` `@IsOptional()`                          |
| `address`   | `@ValidateNested()` `@Type(() => AddressDto)` `@IsOptional()` |
| `description`| `@IsString()` `@IsOptional()`                         |

**`BuildingQueryDto`** extends `PaginationDto`:

| Field      | Decorator                   | Ghi chú                            |
|------------|-----------------------------|------------------------------------|
| `page`     | `@IsOptional()` `@IsInt()` `@Min(1)` | Default `1`               |
| `limit`    | `@IsOptional()` `@IsInt()` `@Min(1)` | Default `10`              |
| `sortBy`   | `@IsOptional()` `@IsString()` | `name`, `code`, `totalRooms`, `createdAt` |
| `sortOrder`| `@IsOptional()` `@IsIn(['asc','desc'])` | Transform lowercase      |
| `search`   | `@IsOptional()` `@IsString()` | Full-text search qua regex        |

---

## 3. API Endpoints

Tất cả endpoints đều require `JwtAuthGuard`. Controller prefix: `buildings`. Base path: `/api/buildings`.

| Method   | Path                      | Auth | Mô tả                             | Request Body           | Response Shape                       |
|----------|---------------------------|------|-----------------------------------|------------------------|--------------------------------------|
| `POST`   | `/buildings/sync-counts`  | JWT  | Đồng bộ `totalRooms` cho tất cả building của owner | — | `{ updated: number }` |
| `POST`   | `/buildings`              | JWT  | Tạo building mới                 | `CreateBuildingDto`    | `Building` document                  |
| `GET`    | `/buildings`              | JWT  | Danh sách có phân trang + tìm kiếm | Query: `BuildingQueryDto` | `{ data: Building[], meta: { total, page, limit, totalPages } }` |
| `GET`    | `/buildings/:id`          | JWT  | Lấy chi tiết một building        | —                      | `Building` document                  |
| `PUT`    | `/buildings/:id`          | JWT  | Cập nhật building                | `UpdateBuildingDto`    | `Building` document (updated)        |
| `DELETE` | `/buildings/:id`          | JWT  | Xóa mềm building (+ cascade)    | —                      | `void` (HTTP 200)                    |

> **Thứ tự route**: `POST /buildings/sync-counts` phải được khai báo **trước** `POST /buildings` trong controller để NestJS không nhầm `sync-counts` thành `:id`. Thứ tự này đã đúng trong code hiện tại.

**Sortable fields** (map trong service `getListSort`):

| `sortBy` value | MongoDB sort keys                            |
|----------------|----------------------------------------------|
| `name`         | `{ nameNormalized: dir, name: dir }`         |
| `code`         | `{ code: dir }`                              |
| `totalRooms`   | `{ totalRooms: dir, nameNormalized: 1 }`     |
| `createdAt`    | `{ createdAt: dir }` *(default khi không có sortBy)* |

---

## 4. Business Rules & State Machine

Building không có state machine rõ ràng (không có trạng thái như Room). Các business rules quan trọng:

### Code generation
Format: `B-{timestamp base36 uppercase}-{4 random digits}`. Kiểm tra unique tối đa 5 lần thử; mỗi lần retry append thêm 1 digit ngẫu nhiên.

### Multi-tenant isolation
Mọi query đều filter `{ ownerId: new Types.ObjectId(ownerId), isDeleted: false }`. `ownerId` lấy từ JWT payload (`user.userId`) — không nhận từ request body.

### Tìm kiếm (search)
Khi có `search`:
1. Normalize chuỗi tìm kiếm (bỏ dấu) → match với `nameNormalized`.
2. Đồng thời match raw string với `code`, `address.street`, `address.ward`, `address.district`, `address.city`.
3. Tất cả dùng `RegExp` case-insensitive với `escapeRegExp` để tránh injection.

### Xóa building — logic cascade
1. Kiểm tra tồn tại + ownership.
2. **Chặn xóa** nếu có bất kỳ Room nào có `status` là `OCCUPIED` hoặc `DEPOSITED` → throw `BadRequestException`.
3. Soft-delete tất cả Rooms thuộc building (`isDeleted: true`).
4. Soft-delete tất cả RoomGroups thuộc building (`isDeleted: true`).
5. Soft-delete Building (`isDeleted: true`).

> Cascade chỉ là soft-delete. Contracts, Invoices, Payments gắn với Rooms đã xóa vẫn còn trong database (orphaned). Đây là TODO tiềm năng.

### Sync room counts — `POST /buildings/sync-counts`
Mục đích: khắc phục tình trạng `totalRooms` bị lệch do các thao tác ngoài luồng bình thường (seed, migration, lỗi). Cơ chế:
1. Aggregate tất cả Rooms chưa xóa của owner, group by `buildingId` → `countMap`.
2. Lặp qua tất cả Buildings của owner; nếu `building.totalRooms !== countMap[id]` thì cập nhật và tăng `updatedCount`.
3. Trả về `{ updated: number }` — số building đã được sửa.

> **Không** tự động trigger sau create/delete Room. Frontend hoặc admin phải gọi thủ công khi cần.

### nameNormalized
Tự động tính khi `create` và khi `update` có truyền `name`. Dùng hàm `normalizeString` từ `@common/utils/string.util` (loại bỏ dấu tiếng Việt). Không expose ra API response.

---

## 5. Frontend Touchpoints

### Pages

| Route                   | File                                      | Mô tả                                               |
|-------------------------|-------------------------------------------|-----------------------------------------------------|
| `/buildings`            | `BuildingsPage.tsx`                       | Danh sách; search, sort, phân trang; delete dialog  |
| `/buildings/new`        | `BuildingCreatePage.tsx`                  | Form tạo mới; navigate về `/buildings` sau khi thành công |
| `/buildings/:id/edit`   | `BuildingEditPage.tsx`                    | Form sửa; load data từ `GET /buildings/:id`; `NotFoundState` nếu 404 |

**Responsive pattern**: mobile (< md) hiển thị card layout với DropdownMenu actions; desktop (≥ md) hiển thị bảng với inline action buttons (`Pencil`, `Trash2` ghost buttons).

### BuildingForm component
`frontend/src/components/forms/BuildingForm.tsx` — dùng `react-hook-form` + `zodResolver`.

- Trường `code` chỉ hiển thị (disabled) khi `isEditing=true`, không bao giờ được gửi lên backend.
- `handleFormSubmit` strip `code` và `description` rỗng trước khi gọi `onSubmit`.
- Form có thể dùng standalone (với nút Submit bên trong) hoặc linked qua `formId` prop (Submit button nằm ngoài trong PageHeader).

Zod schema (i18n):
```
name: z.string().min(1)
address.street: z.string().min(1)
address.ward: z.string().min(1)
address.district: z.string().min(1)
address.city: z.string().min(1)
code: z.string().optional()
description: z.string().optional()
```

### BuildingSelector component
`frontend/src/components/BuildingSelector.tsx` — Popover + Command (Radix UI) với infinite scroll.

| Prop              | Type                       | Mô tả                                               |
|-------------------|----------------------------|-----------------------------------------------------|
| `value`           | `string \| null \| undefined` | Controlled mode; nếu undefined dùng store         |
| `onSelect`        | `(id: string \| null) => void` | Controlled callback; nếu không truyền dùng store |
| `showAllOption`   | `boolean`                  | Default `true`; hiển thị option "Tất cả tòa nhà"   |
| `disabled`        | `boolean`                  | —                                                   |
| `error`           | `boolean`                  | Highlight đỏ khi lỗi                               |
| `compact`         | `boolean`                  | Default `false`; h-9 vs h-10                        |
| `fullWidth`       | `boolean`                  | Default `false`                                     |

Fetch: `GET /buildings?page={n}&limit=10&search={q}` với `useInfiniteQuery`. Intersection Observer tự động load trang tiếp khi scroll đến cuối list.

Khi `selectedBuildingId` tồn tại nhưng không có trong danh sách hiện tại (ví dụ khi mới mở), component gọi `GET /buildings/:id` riêng để lấy tên hiển thị (staleTime 5 phút). Nếu 404, tự động clear store.

### buildingStore (Zustand)
`frontend/src/stores/buildingStore.ts` — persist vào `localStorage` key `building-storage`.

```typescript
selectedBuildingId: string | null  // null = "Tất cả tòa nhà"
setSelectedBuildingId: (id: string | null) => void
```

Được dùng như global filter: các trang Rooms, RoomGroups, Contracts, Invoices lọc theo `selectedBuildingId` từ store.

### i18n keys (`buildings.*`)

| Key                   | VI                                                     |
|-----------------------|--------------------------------------------------------|
| `buildings.title`     | Quản lý tòa nhà                                        |
| `buildings.name`      | Tên tòa nhà                                            |
| `buildings.code`      | Mã tòa nhà                                             |
| `buildings.address`   | Địa chỉ                                                |
| `buildings.street`    | Số nhà, đường                                          |
| `buildings.ward`      | Phường/Xã                                              |
| `buildings.district`  | Quận/Huyện                                             |
| `buildings.city`      | Tỉnh/Thành phố                                         |
| `buildings.totalRooms`| Số phòng                                               |
| `buildings.description`| Mô tả                                                 |
| `buildings.codeAutoGenerated` | Tự động tạo                                  |
| `buildings.deleteErrorHasRooms` | Không thể xóa tòa nhà đang có phòng đã thuê |
| `buildings.notFoundDesc` | Không tìm thấy tòa nhà hoặc dữ liệu đã bị xóa    |

---

## 6. Cross-Module Dependencies

### Module này CẦN:
- **Users** (`ownerId`): mọi entity đều gắn với `User._id`. JWT guard inject `user.userId`.

### Modules khác CẦN buildings:
- **Rooms**: `buildingId` FK bắt buộc; BuildingsModule export `BuildingsService` (nhưng Rooms không import trực tiếp — chỉ dùng schema).
- **RoomGroups**: `buildingId` FK; bị cascade soft-delete khi Building bị xóa.
- **Services**: `buildingIds[]` khi `buildingScope = 'SPECIFIC'`.
- **Contracts**: gián tiếp qua Room.
- **BuildingSelector**: dùng trong navbar/header của hầu hết module pages làm global filter.

### Import schema chéo trong BuildingsModule:
`BuildingsModule` import cả `RoomSchema` và `RoomGroupSchema` trực tiếp để:
1. Kiểm tra OCCUPIED/DEPOSITED rooms trước khi xóa.
2. Cascade soft-delete rooms và room-groups.
3. Aggregate room count trong `syncRoomCounts`.

---

## 7. Gotchas & Testing Notes

**G1 — sync-counts phải gọi thủ công**
`totalRooms` không tự cập nhật khi Room được tạo/xóa. Sau khi seed hoặc bulk-import, phải gọi `POST /buildings/sync-counts` để đồng bộ. Frontend không có UI button cho thao tác này — chỉ có thể gọi qua API trực tiếp. TODO: tự động trigger từ RoomsService sau create/delete.

**G2 — code field: read-only sau khi tạo**
`code` được sinh một lần lúc create, không có endpoint để update. `UpdateBuildingDto` không chứa `code`. Frontend disable input này trong edit form. Nếu cần đổi code phải thao tác thẳng DB.

**G3 — Cascade xóa chỉ Rooms + RoomGroups, không xóa Contracts**
Contracts (và Invoices, Payments) gắn với Room ID — khi Room bị soft-delete, các Contracts orphan vẫn tồn tại trong DB. Query có filter `isDeleted: false` trên Room nên UI sẽ không hiển thị, nhưng dữ liệu vẫn còn. TODO: cần cascade thêm hoặc document rõ để tránh data leak.

**G4 — Chặn xóa chỉ dựa vào RoomStatus, không check Contract trực tiếp**
Logic chỉ đếm rooms có `status IN [OCCUPIED, DEPOSITED]`. Nếu có Room ở trạng thái AVAILABLE nhưng vẫn còn Contract ACTIVE (edge case sau terminate), Building vẫn bị xóa được và cascade Room đó.

**G5 — nameNormalized không expose ra API**
Field này chỉ dùng nội bộ để sort/search. Không có trong response DTO (Mongoose trả về raw document — field có thể lộ trong response nếu không dùng `select` hoặc transform). TODO: thêm `@Exclude()` hoặc response DTO nếu cần ẩn.

**G6 — BuildingSelector dùng infinite query, list page dùng paginated query**
`BuildingSelector` dùng `useInfiniteQuery(['buildings', search])` — cache key trùng prefix với `useQuery(['buildings', {...}])` của `BuildingsPage`. Gọi `queryClient.invalidateQueries({ queryKey: ['buildings'] })` sau create/update/delete sẽ invalidate cả hai.

**Testing checklist**:
- [ ] Tạo building: verify `code` được auto-gen, `nameNormalized` được set.
- [ ] Tìm kiếm: tìm bằng tên có dấu (vd "Tòa nhà A") → phải match qua `nameNormalized`.
- [ ] Xóa building có Room OCCUPIED → expect `BadRequestException`.
- [ ] Xóa building chỉ có Room AVAILABLE → cascade soft-delete rooms + room-groups.
- [ ] `sync-counts`: tạo building → tạo 3 rooms → gọi sync → verify `totalRooms = 3`.
- [ ] Multi-tenant: user A không thể GET/PUT/DELETE building của user B (trả về 404).
- [ ] BuildingSelector 404 auto-clear: xóa building đang được chọn trong store → reload page → store tự clear.
