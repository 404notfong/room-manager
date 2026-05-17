# Room Manager — API Documentation

> Base URL: `http://localhost:3000/api`  
> Auth: `Authorization: Bearer <JWT_TOKEN>`  
> Language: `x-lang: vi` hoặc `Accept-Language: vi`

---

## Authentication (`/api/auth`)

| Method | Endpoint | Body | Mô tả |
|--------|----------|------|-------|
| POST | `/auth/register` | `{ fullName, email, password, phone }` | Đăng ký tài khoản mới |
| POST | `/auth/login` | `{ email, password }` | Đăng nhập, trả về `{ accessToken, refreshToken, user }` |
| POST | `/auth/logout` | `{ refreshToken }` | Đăng xuất, hủy refresh token |
| POST | `/auth/refresh` | `{ refreshToken }` | Lấy access token mới |

---

## Users (`/api/users`) 🔒

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/users/profile` | Lấy profile user hiện tại |
| PUT | `/users/profile` | Cập nhật profile |
| PUT | `/users/change-password` | Đổi mật khẩu (`{ currentPassword, newPassword }`) |
| GET | `/users` | Danh sách users (Admin only) |
| GET | `/users/:id` | Chi tiết user |
| PUT | `/users/:id` | Cập nhật user |
| DELETE | `/users/:id` | Xóa user |

---

## Buildings (`/api/buildings`) 🔒

| Method | Endpoint | Query Params | Mô tả |
|--------|----------|-------------|-------|
| POST | `/buildings` | — | Tạo tòa nhà mới |
| GET | `/buildings` | `page, limit, search` | Danh sách tòa nhà (paginated) |
| GET | `/buildings/:id` | — | Chi tiết tòa nhà |
| PUT | `/buildings/:id` | — | Cập nhật tòa nhà |
| DELETE | `/buildings/:id` | — | Xóa tòa nhà (soft delete) |

---

## Rooms (`/api/rooms`) 🔒

| Method | Endpoint | Query Params | Mô tả |
|--------|----------|-------------|-------|
| POST | `/rooms` | — | Tạo phòng mới (LONG_TERM/SHORT_TERM) |
| GET | `/rooms/dashboard` | `buildingId` | Thống kê phòng cho dashboard |
| GET | `/rooms` | `page, limit, search, buildingId, status, roomType` | Danh sách phòng (filtered, paginated) |
| GET | `/rooms/:id` | — | Chi tiết phòng |
| PUT | `/rooms/:id` | — | Cập nhật phòng |
| PUT | `/rooms/:id/indexes` | — | Cập nhật chỉ số điện/nước |
| PATCH | `/rooms/reorder` | — | Sắp xếp lại thứ tự phòng |
| DELETE | `/rooms/:id` | — | Xóa phòng (soft delete) |

---

## Room Groups (`/api/room-groups`) 🔒

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/room-groups` | Tạo nhóm phòng |
| GET | `/room-groups` | Danh sách nhóm phòng |
| GET | `/room-groups/:id` | Chi tiết nhóm phòng |
| PUT | `/room-groups/:id` | Cập nhật nhóm phòng |
| DELETE | `/room-groups/:id` | Xóa nhóm phòng |

---

## Tenants (`/api/tenants`) 🔒

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/tenants` | Tạo khách thuê |
| GET | `/tenants` | Danh sách khách thuê (paginated, searchable) |
| GET | `/tenants/:id` | Chi tiết khách thuê |
| GET | `/tenants/:id/history` | Lịch sử thuê (contracts, invoices, payments) |
| PUT | `/tenants/:id` | Cập nhật khách thuê |
| DELETE | `/tenants/:id` | Xóa khách thuê (soft delete) |

---

## Contracts (`/api/contracts`) 🔒

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/contracts` | Tạo hợp đồng (DRAFT) |
| GET | `/contracts` | Danh sách hợp đồng (filterable) |
| GET | `/contracts/:id` | Chi tiết hợp đồng |
| PUT | `/contracts/:id` | Cập nhật hợp đồng |
| PATCH | `/contracts/:id/activate` | Kích hoạt hợp đồng (DRAFT → ACTIVE) |
| PATCH | `/contracts/:id/terminate` | Chấm dứt hợp đồng |
| DELETE | `/contracts/:id` | Xóa hợp đồng |

---

## Invoices (`/api/invoices`) 🔒

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/invoices` | Tạo hóa đơn |
| GET | `/invoices` | Danh sách hóa đơn (filterable) |
| GET | `/invoices/contract/:contractId` | Hóa đơn theo hợp đồng |
| GET | `/invoices/:id` | Chi tiết hóa đơn |
| PUT | `/invoices/:id` | Cập nhật hóa đơn |
| DELETE | `/invoices/:id` | Xóa hóa đơn |

---

## Payments (`/api/payments`) 🔒

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/payments` | Ghi nhận thanh toán (tự đàng cập nhật invoice status) |
| GET | `/payments` | Danh sách thanh toán |
| GET | `/payments/:id` | Chi tiết thanh toán |
| PUT | `/payments/:id` | Cập nhật thanh toán |
| DELETE | `/payments/:id` | Xóa thanh toán |

> **Payment Methods**: `CASH`, `BANK_TRANSFER`, `MOMO`, `ZALOPAY`, `OTHER`

---

## Services (`/api/services`) 🔒

| Method | Endpoint | Query Params | Mô tả |
|--------|----------|-------------|-------|
| POST | `/services` | — | Tạo dịch vụ (điện, nước, internet...) |
| GET | `/services` | `search, page, limit, isActive` | Danh sách dịch vụ |
| GET | `/services/:id` | — | Chi tiết dịch vụ |
| PUT | `/services/:id` | — | Cập nhật dịch vụ |
| DELETE | `/services/:id` | — | Xóa dịch vụ |

> **Pricing types**: `FIXED` (giá cố định), `TABLE` (bậc thang — PROGRESSIVE hoặc FLAT)  
> **Building scope**: `ALL` (toàn bộ) hoặc `SPECIFIC` (theo tòa nhà cụ thể)

---

## Notifications (`/api/notifications`) 🔒

| Method | Endpoint | Query Params | Mô tả |
|--------|----------|-------------|-------|
| GET | `/notifications` | `page, limit` | Danh sách thông báo |
| GET | `/notifications/unread-count` | — | Số thông báo chưa đọc |
| PATCH | `/notifications/read-all` | — | Đánh dấu tất cả đã đọc |
| PATCH | `/notifications/:id/read` | — | Đánh dấu 1 thông báo đã đọc |

> **Types**: `SYSTEM`, `INVOICE`, `CONTRACT`, `PAYMENT`, `SERVICE`

---

## Calendar (`/api/calendar`) 🔒

| Method | Endpoint | Query Params | Mô tả |
|--------|----------|-------------|-------|
| GET | `/calendar/events` | `start, end, buildingId(?), type(?)` | Lấy events trong khoảng thời gian |
| GET | `/calendar/day` | `date, buildingId(?)` | Chi tiết events 1 ngày |
| GET | `/calendar/month-summary` | `year, month` | Tổng quan tháng (số events, invoices...) |

---

## Common Response Format

### Success
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

### Error
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Email is required" }
  ]
}
```

---

## Pagination

Tất cả list endpoints hỗ trợ:
- `page` (default: 1)
- `limit` (default: 10)
- `search` (tìm kiếm text)
- Specific filters per module (e.g., `status`, `buildingId`, `roomType`)
