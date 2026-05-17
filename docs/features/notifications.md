# Notifications Playbook

> **Vai trò trong domain**: Gửi và quản lý thông báo in-app cho User về các sự kiện quan trọng (hóa đơn, hợp đồng, thanh toán, hệ thống).
> **Code paths**: `backend/src/modules/notifications/`, `frontend/src/components/common/NotificationDropdown.tsx`, `frontend/src/hooks/useNotifications.ts`, `frontend/src/api/notifications.api.ts`

---

## 1. Purpose & Relations

Module Notifications cung cấp hệ thống thông báo nội bộ (in-app) cho người dùng. Các thông báo được thiết kế để:

- Cảnh báo hóa đơn quá hạn (`INVOICE` type)
- Thông báo hợp đồng sắp hết hạn hoặc vừa được kích hoạt (`CONTRACT` type)
- Xác nhận thanh toán được ghi nhận (`PAYMENT` type)
- Thông báo từ hệ thống quản trị (`SYSTEM` type)
- Dự phòng thông báo liên quan đến dịch vụ (`SERVICE` type — chưa có producer)

Module được khai báo `@Global()`, nghĩa là `NotificationsService` được inject vào bất kỳ module nào mà không cần import `NotificationsModule`.

**Quan hệ:**
- Module này **cần**: `User` (để scope theo `userId`)
- Module khác **cần** module này: Invoices, Contracts, Payments (để gọi `NotificationsService.create`)
- **TODO**: Hiện tại chưa có module nào gọi `notificationsService.create` — các producer chưa được implement (xem Section 6)

---

## 2. Data Model

### Schema — `notification.schema.ts`

| Field       | Type                        | Required | Default              | Mô tả                                                     |
|-------------|-----------------------------|----------|----------------------|-----------------------------------------------------------|
| `userId`    | `Types.ObjectId` (ref User) | Yes      | —                    | Owner của thông báo; được index để query nhanh             |
| `title`     | `string`                    | Yes      | —                    | Tiêu đề ngắn, hiển thị bold trong dropdown               |
| `message`   | `string`                    | Yes      | —                    | Nội dung chi tiết, tối đa 2 dòng trong UI                |
| `type`      | `NotificationType` (enum)   | No       | `SYSTEM`             | Phân loại thông báo; ảnh hưởng đến icon và màu sắc        |
| `isRead`    | `boolean`                   | No       | `false`              | Trạng thái đã đọc                                         |
| `metadata`  | `Record<string, any>`       | No       | `{}`                 | Dữ liệu bổ sung để navigate đến entity liên quan          |
| `createdAt` | `Date` (auto)               | —        | timestamps: true     | Thời điểm tạo; dùng để sort và hiển thị relative time    |
| `updatedAt` | `Date` (auto)               | —        | timestamps: true     | Cập nhật tự động                                          |

**MongoDB Indexes:**
```
{ userId: 1, createdAt: -1 }  // Compound index cho query list theo user
{ userId: 1 }                  // Index đơn (từ @Prop index: true)
```

### Enums

`NotificationType` được định nghĩa trong `backend/src/modules/notifications/schemas/notification.schema.ts` (không phải trong `backend/src/common/constants/enums.ts`):

| Value       | Mô tả                                          | Icon frontend             |
|-------------|------------------------------------------------|---------------------------|
| `SYSTEM`    | Thông báo từ hệ thống quản trị                  | `ShieldAlert` (bg-error)  |
| `INVOICE`   | Liên quan đến hóa đơn (overdue, created...)    | `Receipt` (bg-warning)    |
| `CONTRACT`  | Liên quan đến hợp đồng (expiring, activated)   | `FileText` (bg-info)      |
| `PAYMENT`   | Thanh toán được ghi nhận                        | `CreditCard` (bg-success) |
| `SERVICE`   | Liên quan đến dịch vụ (giá thay đổi...)        | `Info` (bg-muted) — fallback |

> **Lưu ý**: Frontend cũng tự định nghĩa lại enum `NotificationType` tại `frontend/src/api/notifications.api.ts` — giá trị string phải đồng bộ với backend.

### `metadata` field — Navigation hints

Frontend đọc `metadata` để xác định route điều hướng khi click vào notification:

| Key trong `metadata`               | Route điều hướng                                           |
|------------------------------------|-------------------------------------------------------------|
| `invoiceId` hoặc `relatedInvoiceId`| `/invoices/:id`                                             |
| `contractId` hoặc `relatedContractId` | `/contracts/:id`                                        |
| `tenantId`                         | `/tenants/:id`                                              |
| `roomId`                           | `/rooms`                                                    |
| *(fallback theo type)*             | INVOICE/PAYMENT → `/invoices`; CONTRACT → `/contracts`; SYSTEM → `/` |

### DTO validation

Không có public Create DTO — notifications được tạo **internal only** thông qua method `NotificationsService.create()`. Caller trực tiếp truyền các tham số (`userId`, `title`, `message`, `type`, `metadata`), không qua HTTP endpoint.

---

## 3. API Endpoints

Tất cả endpoints yêu cầu JWT (`JwtAuthGuard`). User chỉ truy cập được notifications của chính mình (scope theo `user.userId` từ JWT token).

| Method  | Path                              | Auth | Mô tả                                         | Request                                      | Response                                                                                              |
|---------|-----------------------------------|------|-----------------------------------------------|----------------------------------------------|-------------------------------------------------------------------------------------------------------|
| `GET`   | `/api/notifications`              | JWT  | Lấy danh sách notifications của current user  | Query: `page` (int, default 1), `limit` (int, default 10) | `{ notifications: Notification[], total: number, page: number, totalPages: number }` |
| `GET`   | `/api/notifications/unread-count` | JWT  | Đếm số notification chưa đọc                  | —                                            | `number`                                                                                              |
| `PATCH` | `/api/notifications/read-all`     | JWT  | Đánh dấu tất cả notifications là đã đọc      | —                                            | `void` (204)                                                                                          |
| `PATCH` | `/api/notifications/:id/read`     | JWT  | Đánh dấu một notification là đã đọc           | Path param: `id` (MongoDB ObjectId)          | `Notification` object (updated)                                                                       |

> **Lưu ý thứ tự route**: `GET /unread-count` phải được khai báo TRƯỚC `GET /:id` trong controller để NestJS không nhầm `unread-count` với một ObjectId param. Hiện tại controller đúng thứ tự này.

---

## 4. Business Rules & State Machine

### Invariants

- **userId scoping**: Mọi query (`find`, `countDocuments`, `findOneAndUpdate`, `updateMany`) đều filter theo `userId` lấy từ JWT. Không có endpoint admin để xem notifications của user khác.
- **isRead default false**: Khi tạo mới, `isRead` luôn là `false`.
- **Soft/hard delete**: Hiện tại không có endpoint xóa notification. Notifications tồn tại vĩnh viễn (không có TTL index, không có `isDeleted` field).

### State machine của `isRead`

```
false (unread)
    │
    ├── PATCH /notifications/:id/read     → true
    │
    └── PATCH /notifications/read-all    → true (cho toàn bộ unread của user)
```

Trạng thái chỉ chuyển một chiều: `false → true`. Không có endpoint để unmark (đánh dấu chưa đọc lại).

### Phân trang

`findAll` hỗ trợ phân trang qua `page` và `limit`. Sort mặc định `createdAt: -1` (mới nhất trên đầu). Frontend hiện request `page=1, limit=10` từ dropdown.

### Tạo notification (internal)

```typescript
// Signature của NotificationsService.create()
async create(
    userId: string,
    title: string,
    message: string,
    type: NotificationType = NotificationType.SYSTEM,
    metadata: Record<string, any> = {},
): Promise<Notification>
```

`userId` được convert sang `Types.ObjectId` trong service trước khi lưu.

---

## 5. Frontend Touchpoints

### Không có trang riêng

Module Notifications **không có page riêng**. Toàn bộ UI được thực hiện qua `NotificationDropdown` trong top navigation bar. Không có route `/notifications` trong `App.tsx`.

### Component: `NotificationDropdown`

**File**: `frontend/src/components/common/NotificationDropdown.tsx`
**Vị trí**: Mount tại `DashboardLayout.tsx` (line 296), trong top navbar, với prop `compact={true}`

**Props**:
```typescript
{ compact?: boolean }  // compact=true → button h-9 w-9, false → h-10 w-10
```

**Chức năng UI:**
- Bell icon với badge số lượng unread (hiển thị `9+` nếu > 9)
- Filter tab: "Tất cả" / "Chưa đọc" (filter hoạt động client-side trên 10 items đã load)
- Mỗi item hiển thị: icon type, title (1 dòng), message (2 dòng), relative time (`date-fns/formatDistanceToNow`), type label
- Click item: đánh dấu đã đọc + navigate đến entity liên quan (dựa vào `metadata`)
- Button "Đánh dấu đã đọc" inline trên từng item chưa đọc (stopPropagation để không navigate)
- Button "Đọc tất cả" ở header dropdown
- Button "Mở mục mới nhất" ở footer (navigate đến notification đầu tiên trong danh sách hiện tại)

### Hooks

**File**: `frontend/src/hooks/useNotifications.ts`

| Hook                          | Mô tả                                              | React Query key                     |
|-------------------------------|-----------------------------------------------------|-------------------------------------|
| `useNotifications(params)`    | Fetch list, tự poll mỗi 30 giây                    | `['notifications', params]`         |
| `useUnreadCount()`            | Fetch số unread, tự poll mỗi 30 giây              | `['notifications', 'unread-count']` |
| `useMarkNotificationRead()`   | Mutation PATCH /:id/read; invalidate tất cả queries | —                                   |
| `useMarkAllNotificationsRead()` | Mutation PATCH /read-all; invalidate tất cả queries | —                                  |

### Polling — không có WebSocket

Hiện tại **không dùng WebSocket hay SSE**. Cả `useNotifications` và `useUnreadCount` đều dùng `refetchInterval: 30000` (30 giây). Đây là polling thụ động — không có real-time push.

### API client

**File**: `frontend/src/api/notifications.api.ts`

Định nghĩa interface `Notification` (frontend type), `GetNotificationsParams`, `GetNotificationsResponse`, và object `notificationsApi` với 4 method: `getAll`, `getUnreadCount`, `markAsRead`, `markAllAsRead`.

### i18n keys (frontend)

Namespace `notifications.*` trong `frontend/public/locales/vi/translation.json`:

| Key                              | Giá trị VI                          |
|----------------------------------|-------------------------------------|
| `notifications.title`            | Thông báo                           |
| `notifications.empty`            | Không có thông báo mới              |
| `notifications.emptyStateTitle`  | Mọi thứ đang yên ổn                 |
| `notifications.viewAll`          | Xem tất cả                          |
| `notifications.markAllRead`      | Đọc tất cả                          |
| `notifications.markRead`         | Đánh dấu đã đọc                     |
| `notifications.read`             | Đã đọc                              |
| `notifications.unreadCount`      | `{{count}} mục chưa đọc`            |
| `notifications.filterAll`        | Tất cả                              |
| `notifications.filterUnread`     | Chưa đọc                            |
| `notifications.loading`          | Đang tải thông báo                  |
| `notifications.openLatest`       | Mở mục mới nhất                     |
| `notifications.types.invoice`    | Hóa đơn                             |
| `notifications.types.contract`   | Hợp đồng                            |
| `notifications.types.payment`    | Thanh toán                          |
| `notifications.types.system`     | Hệ thống                            |
| `notifications.types.general`    | Thông báo (fallback cho SERVICE)    |

> **Lưu ý**: `notifications.types.service` không tồn tại — type `SERVICE` fallback về `types.general`.

---

## 6. Cross-Module Dependencies

### Module này cần

| Module | Mục đích |
|--------|----------|
| `User` | `userId` là foreign key; `@CurrentUser()` decorator extract `userId` từ JWT |

### Module này cung cấp

`NotificationsModule` được khai báo `@Global()` và export `NotificationsService`, sẵn sàng được inject vào các module sau **mà không cần import `NotificationsModule`**:

| Module dự kiến là Producer | Loại notification | Trigger dự kiến |
|---------------------------|-------------------|-----------------|
| `InvoicesModule`          | `INVOICE`         | Invoice chuyển sang `OVERDUE`; invoice mới được tạo |
| `ContractsModule`         | `CONTRACT`        | Contract sắp hết hạn (N ngày trước `endDate`); contract được activate |
| `PaymentsModule`          | `PAYMENT`         | Thanh toán được ghi nhận thành công |
| `ServicesModule`          | `SERVICE`         | Giá dịch vụ thay đổi (nếu cần thông báo) |

> **TODO (chưa implement)**: Tính đến ngày code được review, không có module nào inject hay gọi `NotificationsService.create()`. `NotificationsModule` được đăng ký trong `app.module.ts` và `@Global()` nhưng chưa có producer thực sự. Đây là gap lớn nhất của module này.

---

## 7. Gotchas & Testing Notes

### Pitfalls

1. **userId scoping là tuyệt đối**: Tất cả 4 service methods đều convert `userId` sang `new Types.ObjectId(userId)` trước khi query. Nếu gọi `NotificationsService.create()` với `userId` là string rỗng hoặc invalid ObjectId sẽ throw mongoose `CastError`.

2. **Client-side filter "Chưa đọc"**: Filter tab trong UI hoạt động trên `limit=10` items đã load về. Nếu user có nhiều hơn 10 notifications chưa đọc nhưng các cái đó nằm ở trang sau, tab "Chưa đọc" sẽ hiển thị ít hơn thực tế. Không có pagination riêng cho unread filter.

3. **Polling 30 giây — không phải real-time**: Unread badge có thể lag tối đa 30 giây so với thực tế. Nếu cần near-realtime, phải thêm WebSocket (e.g., `socket.io`) hoặc SSE.

4. **Không có TTL/cleanup**: Database sẽ tích lũy notifications vô hạn. Cần xem xét thêm TTL index (ví dụ: xóa sau 90 ngày) hoặc endpoint archive/delete cho production.

5. **`type: SERVICE` không có i18n label riêng**: Frontend fallback về `notifications.types.general`. Nếu thêm producer cho SERVICE, cần bổ sung key `notifications.types.service` vào cả `en` và `vi` translation.

6. **`NotificationType` enum bị định nghĩa hai lần**: Một lần trong schema backend (`notification.schema.ts`), một lần trong frontend API (`notifications.api.ts`). Cần đảm bảo đồng bộ khi thêm value mới. Enum này cũng **không có trong** `backend/src/common/constants/enums.ts` (chỉ nằm trong schema).

7. **`readAt` field không tồn tại**: Schema không có field `readAt` (timestamp khi đọc) — chỉ có `isRead: boolean`. Nếu cần audit log thời điểm đọc, phải thêm field này.

### Test Scenarios

| Scenario | Cách test |
|----------|-----------|
| Tạo notification và hiện trong dropdown | Gọi `NotificationsService.create()` trực tiếp qua unit test hoặc seed script; mở UI kiểm tra dropdown |
| Unread badge hiển thị đúng | Tạo N notifications, gọi `GET /notifications/unread-count`, verify = N |
| Mark single read | `PATCH /notifications/:id/read` với id hợp lệ; verify `isRead: true` trong response; verify `unread-count` giảm 1 |
| Mark all read | Tạo 3 unread; `PATCH /notifications/read-all`; verify `countUnread = 0` |
| userId isolation | Tạo notification cho userA; đăng nhập userB; verify `GET /notifications` trả về danh sách rỗng |
| Type fallback icon | Tạo notification type `SERVICE`; mở dropdown; verify icon fallback `Info` hiển thị đúng |
| Polling interval | Tạo notification từ ngoài; chờ 30 giây; verify badge tự cập nhật mà không reload page |
| Pagination | Tạo > 10 notifications; verify `totalPages > 1`; verify `page` và `total` đúng |
