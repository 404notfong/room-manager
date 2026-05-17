# Room Groups Playbook

> **Vai trò trong domain**: RoomGroup là nhãn phân loại tùy chọn gắn lên Room, giúp owner nhóm các phòng trong cùng một tòa nhà (VD: "Dãy A", "Phòng VIP", "Tầng 2") để lọc và sắp xếp hiển thị trên dashboard.
> **Code paths**: `backend/src/modules/room-groups/`, `frontend/src/pages/room-groups/`

---

## 1. Purpose & Relations

- RoomGroup phân loại phòng theo nhóm tùy định nghĩa (VIP, thường, theo dãy, theo tầng…) trong phạm vi một Building.
- Một Room tham chiếu đến **tối đa một** RoomGroup qua `roomGroupId` (nullable — phòng có thể không thuộc nhóm nào).
- RoomGroup **không chứa danh sách phòng** — quan hệ được duy trì phía Room.
- Trên dashboard, phòng được render theo `roomGroup.sortOrder` → `room.sortOrder` để phản ánh bố cục thực tế.

```
User (owner)
  └── Building
        └── RoomGroup   ←── Room (roomGroupId, optional)
```

---

## 2. Data Model

### Schema — `room-group.schema.ts`

| Field           | Type         | Required | Default | Mô tả                                              |
|-----------------|--------------|----------|---------|----------------------------------------------------|
| `ownerId`       | `ObjectId`   | Có       | —       | Multi-tenant: tham chiếu `User._id`, có index      |
| `buildingId`    | `ObjectId`   | Có       | —       | Tham chiếu `Building._id`, required, có index      |
| `name`          | `string`     | Có       | —       | Tên nhóm, tối đa 100 ký tự, trim                  |
| `nameNormalized`| `string`     | Không    | —       | Tên chuẩn hóa (lowercase, bỏ dấu), dùng để search |
| `code`          | `string`     | Có       | auto    | Mã định danh, **unique toàn collection**, trim     |
| `description`   | `string`     | Không    | —       | Mô tả, tối đa 500 ký tự, trim                     |
| `color`         | `string`     | Không    | —       | Màu badge UI (ví dụ: `"blue"`, `"red"`), trim      |
| `sortOrder`     | `number`     | Không    | `0`     | Thứ tự hiển thị trên dashboard                     |
| `isActive`      | `boolean`    | Không    | `true`  | Trạng thái hoạt động                               |
| `isDeleted`     | `boolean`    | Không    | `false` | Soft delete flag                                   |
| `createdAt`     | `Date`       | —        | auto    | Mongoose `timestamps`                              |
| `updatedAt`     | `Date`       | —        | auto    | Mongoose `timestamps`                              |

**Indexes được khai báo tường minh:**
```
{ ownerId: 1, buildingId: 1, isDeleted: 1 }   // compound — query chính
{ buildingId: 1, isDeleted: 1 }
{ name: 1 }
{ nameNormalized: 1 }   // index từ @Prop
{ code: 1 }             // unique constraint từ schema
```

### Enums liên quan

Module này **không dùng enum riêng**. Các giá trị `color` là string tự do; frontend hardcode danh sách 8 màu hợp lệ:

```
red | blue | green | yellow | purple | pink | orange | gray
```

### DTO Validation

**`CreateRoomGroupDto`** — POST `/room-groups`

| Field         | Decorators                              | Ghi chú                   |
|---------------|-----------------------------------------|---------------------------|
| `buildingId`  | `@IsMongoId()` `@IsNotEmpty()`          | Bắt buộc                  |
| `name`        | `@IsNotEmpty()` `@IsString()` `@MaxLength(100)` | Bắt buộc          |
| `description` | `@IsOptional()` `@IsString()` `@MaxLength(500)` | Tùy chọn         |
| `color`       | `@IsOptional()` `@IsString()` `@MaxLength(20)`  | Tùy chọn         |
| `sortOrder`   | `@IsOptional()` `@IsNumber()`           | Tùy chọn, mặc định `0`   |
| `isActive`    | `@IsOptional()` `@IsBoolean()`          | Tùy chọn, mặc định `true`|

> `code` **không có trong DTO** — được sinh tự động phía service.

**`UpdateRoomGroupDto`** — PUT `/room-groups/:id`

Tất cả field giống Create nhưng đều `@IsOptional()`. **Không cho phép thay đổi `buildingId`** (frontend loại bỏ field này trước khi gọi API tại `RoomGroupEditPage.tsx:30`).

**`GetRoomGroupsDto`** — GET `/room-groups` (extends `PaginationDto`)

| Field        | Decorators                         | Ghi chú                        |
|--------------|------------------------------------|--------------------------------|
| `search`     | `@IsOptional()` `@IsString()`      | Tìm theo name / nameNormalized / code |
| `buildingId` | `@IsOptional()` `@IsMongoId()`     | Lọc theo tòa nhà               |
| `isActive`   | `@IsOptional()` `@IsBoolean()`     | Lọc theo trạng thái hoạt động  |

---

## 3. API Endpoints

Tất cả endpoint yêu cầu JWT (`JwtAuthGuard`). Base path: `/api/room-groups`.

| Method   | Path               | Auth | Mô tả                    | Request body            | Response shape                          |
|----------|--------------------|------|--------------------------|-------------------------|-----------------------------------------|
| `POST`   | `/room-groups`     | JWT  | Tạo nhóm mới             | `CreateRoomGroupDto`    | `RoomGroup` document                    |
| `GET`    | `/room-groups`     | JWT  | Danh sách có phân trang  | Query: `GetRoomGroupsDto` | `{ data: RoomGroup[], meta: { total, page, limit, totalPages } }` |
| `GET`    | `/room-groups/:id` | JWT  | Chi tiết một nhóm        | —                       | `RoomGroup` document                    |
| `PUT`    | `/room-groups/:id` | JWT  | Cập nhật nhóm            | `UpdateRoomGroupDto`    | `RoomGroup` document (updated)          |
| `DELETE` | `/room-groups/:id` | JWT  | Xóa mềm nhóm             | —                       | `void` (204 implicit)                   |

**Populate**: `GET /room-groups` populate `buildingId` — trả về object `{ _id, name, ... }` thay vì raw ObjectId.

**Sort options** (`sortBy` query param):

| Giá trị      | Mongo sort thực tế                         |
|--------------|--------------------------------------------|
| `name`       | `{ nameNormalized: dir, name: dir }`       |
| `code`       | `{ code: dir }`                            |
| `sortOrder`  | `{ sortOrder: dir, nameNormalized: 1 }`    |
| `status`     | `{ isActive: dir, nameNormalized: 1 }`     |
| `createdAt`  | `{ createdAt: dir }`                       |
| _(default)_  | `{ sortOrder: 1, nameNormalized: 1 }`      |

---

## 4. Business Rules & State Machine

### Invariants

1. **`ownerId` filter bắt buộc**: Mọi query (`findAll`, `findOne`, `update`, `remove`) đều filter `{ ownerId: new Types.ObjectId(ownerId) }` — không bao giờ trả dữ liệu chéo owner.
2. **`buildingId` required**: Mỗi nhóm phòng thuộc **đúng một tòa nhà**. Không có "global group" across buildings cho cùng owner. Frontend lock field này sau khi tạo.
3. **Soft delete**: `remove()` chỉ set `isDeleted: true` — không xóa document khỏi DB.
4. **`code` sinh tự động**: Pattern `GP-{timestamp_base36}-{4_digit_random}`, unique check trong vòng lặp tối đa 5 lần. `code` là unique trên **toàn collection** (không scope theo owner), không cho phép client cung cấp.
5. **`nameNormalized`**: Service tự compute từ `name` qua `normalizeString()` (bỏ dấu tiếng Việt, lowercase) trước khi lưu — dùng cho search không phân biệt dấu.

### Deletion & ảnh hưởng đến Room

- Khi RoomGroup bị soft-delete, **không có cascade** — Room giữ nguyên `roomGroupId` trỏ vào nhóm đã xóa.
- `rooms.service.ts` dùng `preserveNullAndEmptyArrays: true` khi lookup nên phòng không bị mất.
- **TODO**: Chưa có validation ngăn xóa nhóm khi còn phòng tham chiếu. Phòng có `roomGroupId` trỏ vào nhóm đã xóa sẽ vẫn hoạt động bình thường, chỉ không hiển thị tên nhóm trên UI. Cần xem xét thêm guard hoặc clear `roomGroupId` khi xóa nhóm.

### isActive

- `isActive = false` chỉ ảnh hưởng đến filter danh sách (client có thể lọc `isActive=false`).
- Không có logic nghiệp vụ ngăn Room gán vào nhóm `isActive = false`.
- **TODO**: Cân nhắc ẩn nhóm inactive khỏi bộ lọc dashboard nếu cần.

---

## 5. Frontend Touchpoints

### Routes (App.tsx)

```
/room-groups           → RoomGroupsPage      (lazy)
/room-groups/new       → RoomGroupCreatePage (lazy)
/room-groups/:id/edit  → RoomGroupEditPage   (lazy)
```

### Pages

| File                                                       | Chức năng                                          |
|------------------------------------------------------------|----------------------------------------------------|
| `frontend/src/pages/room-groups/RoomGroupsPage.tsx`        | Danh sách, search, sort, filter building, xóa      |
| `frontend/src/pages/room-groups/RoomGroupCreatePage.tsx`   | Form tạo mới, pre-fill buildingId từ store         |
| `frontend/src/pages/room-groups/RoomGroupEditPage.tsx`     | Load nhóm qua GET, form sửa, lock buildingId       |

### Components

| File                                                       | Chức năng                                          |
|------------------------------------------------------------|----------------------------------------------------|
| `frontend/src/components/forms/RoomGroupForm.tsx`          | Form dùng chung cho Create & Edit (react-hook-form + Zod) |

**RoomGroupForm notes:**
- Khi `isEditing = true` hoặc `preselectedBuildingId` có giá trị → `buildingId` render dạng `Input disabled` + `<input type="hidden">` (không cho đổi tòa nhà sau khi tạo).
- Picker màu là 8 button tròn hardcode, không phải text input.
- `code` hiển thị read-only khi editing (`defaultValues.code` có giá trị).

### Zod Schema — `useRoomGroupSchema` (`frontend/src/lib/validations.ts:256`)

```typescript
z.object({
  code:        z.string().optional(),
  buildingId:  z.string().min(1, t('validation.required', { field: t('rooms.building') })),
  name:        z.string().min(1, t('validation.required', { field: t('roomGroups.name') })),
  description: z.string().optional(),
  color:       z.string().optional(),
  sortOrder:   z.number().optional(),
  isActive:    z.boolean().optional(),
})
```

### React Query Keys

| Key pattern                                                           | Dùng ở                           |
|-----------------------------------------------------------------------|----------------------------------|
| `['room-groups', { buildingId, page, limit, search, sortBy, sortOrder }]` | `RoomGroupsPage`             |
| `['room-group', id]`                                                  | `RoomGroupEditPage`              |
| Invalidate `['room-groups']`                                          | Sau create / update / delete     |

### i18n Keys (namespace `roomGroups.*`)

| Key                     | VI                                          |
|-------------------------|---------------------------------------------|
| `roomGroups.title`      | Nhóm phòng                                  |
| `roomGroups.subtitle`   | Tổ chức phòng theo nhóm để dễ dàng lọc     |
| `roomGroups.add`        | Thêm nhóm                                   |
| `roomGroups.addTitle`   | Thêm nhóm mới                               |
| `roomGroups.editTitle`  | Sửa nhóm                                    |
| `roomGroups.deleteTitle`| Xóa nhóm                                    |
| `roomGroups.deleteConfirm` | Bạn có chắc muốn xóa {{name}}?          |
| `roomGroups.code`       | Mã nhóm                                     |
| `roomGroups.name`       | Tên nhóm                                    |
| `roomGroups.description`| Mô tả                                       |
| `roomGroups.color`      | Màu sắc                                     |
| `roomGroups.sortOrder`  | Thứ tự sắp xếp                              |
| `roomGroups.noData`     | Chưa có nhóm phòng. Thêm nhóm đầu tiên!    |
| `roomGroups.emptyTitle` | Chưa có nhóm phòng nào                      |
| `roomGroups.createSuccess` | Tạo nhóm thành công                     |
| `roomGroups.updateSuccess` | Cập nhật nhóm thành công               |
| `roomGroups.deleteSuccess` | Xóa nhóm thành công                    |
| `roomGroups.notFoundDesc`  | Không tìm thấy nhóm phòng hoặc dữ liệu đã bị xóa. |

---

## 6. Cross-Module Dependencies

### Module này CẦN

| Module     | Lý do                                                         |
|------------|---------------------------------------------------------------|
| **User**   | `ownerId` — mọi query filter theo owner để đảm bảo multi-tenant |
| **Building** | `buildingId` required — nhóm phòng phải thuộc một tòa nhà |

### Module khác CẦN room-groups

| Module   | Cách dùng                                                                     |
|----------|-------------------------------------------------------------------------------|
| **Room** | `roomGroupId: ObjectId` (optional, nullable ref) trên `room.schema.ts`       |
| **Room** | `rooms.service.ts` lookup & aggregate theo `roomGroupId` để group phòng trên dashboard |
| **Room** | `reorderRooms()` cho phép cập nhật `roomGroupId` khi kéo-thả phòng giữa nhóm |
| **Frontend Dashboard** | Filter phòng theo nhóm (`roomGroupIds` query param, comma-separated) |

`RoomGroupsModule` export `RoomGroupsService` — hiện tại chưa có module nào import trực tiếp service này (Room module không inject RoomGroupsService, chỉ dùng `roomGroupId` như plain reference).

---

## 7. Gotchas & Testing Notes

### Gotcha 1 — `buildingId` là required nhưng không phải "global scope"

Schema định nghĩa `buildingId` required. Không tồn tại khái niệm "nhóm phòng cho toàn bộ owner" — mỗi nhóm chỉ áp dụng cho đúng một tòa nhà. Nếu owner có nhiều tòa nhà và muốn nhóm cùng tên, họ phải tạo riêng cho từng tòa.

### Gotcha 2 — `code` unique toàn collection, không scope theo owner

`code` có constraint `unique: true` ở schema level. Trong service, vòng lặp check chỉ query `{ code, ownerId }` — nghĩa là hai owner **có thể** có cùng code. Tuy nhiên constraint MongoDB sẽ reject nếu trùng code giữa hai owner. **TODO**: Xem xét đổi unique constraint thành `{ code: 1, ownerId: 1 }` compound unique thay vì single-field.

### Gotcha 3 — Xóa nhóm không cleanup Room references

Soft-delete RoomGroup không set `roomGroupId = null` trên các Room đang tham chiếu. Phòng vẫn giữ ObjectId của nhóm đã xóa. Dashboard Room service dùng `preserveNullAndEmptyArrays: true` nên không bị lỗi, nhưng phòng sẽ không hiển thị tên nhóm. **Khuyến nghị**: Khi xóa nhóm, nên gọi `Room.updateMany({ roomGroupId: id }, { $unset: { roomGroupId: 1 } })` hoặc thêm warning UI.

### Gotcha 4 — `buildingId` không thể sửa sau khi tạo (chỉ enforce ở frontend)

`UpdateRoomGroupDto` không có field `buildingId`, và frontend loại bỏ nó trước khi PUT. Tuy nhiên backend service `update()` có đoạn xử lý `buildingId` nếu có trong payload (`updateData.buildingId = new Types.ObjectId(...)`), nghĩa là **backend không ngăn** đổi building nếu client gọi thẳng API. **TODO**: Thêm guard hoặc bỏ đoạn xử lý `buildingId` trong `update()` service.

### Testing Notes

- **Tạo nhóm**: Kiểm tra `code` được sinh đúng pattern `GP-*`, unique, không do client cung cấp.
- **Search**: Search có dấu tiếng Việt (VD: "Dãy A") phải match qua `nameNormalized`.
- **Filter buildingId**: `GET /room-groups?buildingId=X` chỉ trả nhóm của building X của owner đang đăng nhập.
- **Cross-tenant**: `GET /room-groups/:id` với id của owner khác phải trả 404.
- **Sort mặc định**: Không truyền `sortBy` → sort `{ sortOrder: 1, nameNormalized: 1 }`.
- **Soft delete**: Sau DELETE, `GET /room-groups/:id` trả 404; Room tham chiếu vẫn hoạt động bình thường.
- **Populate**: Response của `GET /room-groups` có `buildingId` là object `{ _id, name, ... }`, không phải string.
