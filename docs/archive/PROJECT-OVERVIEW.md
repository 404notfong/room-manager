# Room Manager — Project Overview (Rebuild Reference)

> **Mục đích**: Tài liệu spec đầy đủ về hệ thống Room Manager hiện tại. Dùng làm reference/prompt để xây dựng lại dự án từ đầu.
> **Phiên bản**: V1 snapshot — 2026-05-04
> **Ngôn ngữ chính**: Tiếng Việt (mặc định) + Tiếng Anh

---

## 1. Mục Tiêu Sản Phẩm

Hệ thống quản lý nhà trọ / phòng cho thuê toàn diện. **Multi-tenant**: mỗi user (chủ trọ) chỉ thấy data của mình. Hỗ trợ:

- Quản lý **nhiều tòa nhà** thuộc 1 chủ
- Quản lý **phòng** với 2 loại: **dài hạn** (trọ tháng) & **ngắn hạn** (giờ/ngày/cố định)
- Phân loại phòng theo **nhóm** (RoomGroup — VIP/thường/…)
- Quản lý **khách thuê** + lịch sử thuê
- Lập **hợp đồng** với nhiều kỳ thanh toán (1/2/3/6/12 tháng hoặc tùy chỉnh)
- Tự động & thủ công tạo **hóa đơn** (định kỳ + hóa đơn cuối khi đóng hợp đồng)
- Ghi nhận **thanh toán** với nhiều phương thức (CASH/BANK_TRANSFER/MOMO/ZALOPAY/DEPOSIT_DEDUCTION/OTHER)
- Catalog **dịch vụ** (điện/nước/internet/…) với giá cố định hoặc bậc thang
- **Notification** in-app, **calendar** events, **dashboard** kanban room board
- **Đa ngôn ngữ** VI/EN trên cả backend & frontend

---

## 2. Tech Stack

### Backend (`/backend`)

| Tech | Version | Mục đích |
|------|---------|----------|
| NestJS | 10.x | Framework |
| TypeScript | 5.x | Language |
| MongoDB + Mongoose | 8.x | Database + ODM |
| Passport + JWT | 10.x | Auth (access + refresh tokens) |
| class-validator + class-transformer | 0.14 / 0.5 | DTO validation |
| nestjs-i18n | 10.x | Backend i18n |
| Winston + nest-winston | 3.x | Structured logging |
| Helmet | 8.x | Security headers |
| @nestjs/throttler | 6.x | Rate limiting |
| bcrypt | 5.x | Password hashing |
| date-fns | 4.x | Date utilities |
| @faker-js/faker | dev | Seed data |

### Frontend (`/frontend`)

| Tech | Version | Mục đích |
|------|---------|----------|
| React | 18.x | UI |
| TypeScript | 5.x | Language |
| Vite | 5.x | Build tool |
| Tailwind CSS | 3.4 | Styling |
| Radix UI | various | Headless primitives (shadcn pattern) |
| Lucide React | 0.303 | Icons |
| Zustand | 4.x | Client state (auth/theme/building filter) |
| @tanstack/react-query | 5.x | Server state |
| react-hook-form | 7.x | Forms |
| Zod | 3.x | Schema validation |
| react-i18next + i18next | 14.x / 23.x | Frontend i18n |
| react-router-dom | 6.x | Routing |
| @dnd-kit | 6.x | Drag-and-drop (room board) |
| date-fns | 3.x | Dates |
| react-day-picker | 9.x | Calendar |
| react-number-format | 5.x | Number/currency input |
| jspdf + html2canvas | 4.x / 1.4 | PDF export |
| react-hot-toast | 2.x | Toast |

### Infrastructure
- **Docker Compose**: 3 services (mongo / nestjs-backend / nginx-frontend)
- **MongoDB**: 4.4 (compose), persistent volume

---

## 3. Domain Model & Quan Hệ

```
User (Owner/Staff)
 └── Building (tòa nhà)
      └── Room (phòng) ──── RoomGroup (nhóm phòng)
           │
           └── Contract (hợp đồng) ── Tenant (khách thuê)
                ├── Invoice (hóa đơn)
                │    └── Payment (thanh toán)
                └── serviceCharges[] (snapshot từ Service)

Service (catalog điện/nước/internet) — buildingScope: ALL | SPECIFIC
Notification — gắn với userId
Calendar — view tổng hợp events từ Contract/Invoice/Payment
```

**Multi-tenant rule**: mọi entity đều có `ownerId: ObjectId(User)`. Mọi query phải filter theo `ownerId` (convert `string → Types.ObjectId` trước).

---

## 4. Enums (`backend/src/common/constants/enums.ts`)

```ts
UserRole              = OWNER | STAFF
RoomType              = LONG_TERM | SHORT_TERM
RoomStatus            = AVAILABLE | OCCUPIED | MAINTENANCE | DEPOSITED
TenantStatus          = RENTING | ACTIVE | CLOSED | DEPOSITED
Gender                = MALE | FEMALE | OTHER
ContractType          = LONG_TERM | SHORT_TERM | DAILY | MONTHLY
ContractStatus        = DRAFT | ACTIVE | EXPIRED | TERMINATED
PaymentCycle          = MONTHLY | MONTHLY_2 | QUARTERLY | MONTHLY_6 | MONTHLY_12 | CUSTOM
InvoiceStatus         = PENDING | PARTIAL | PAID | OVERDUE | CANCELLED
InvoiceType           = REGULAR | FINAL
PaymentMethod         = CASH | BANK_TRANSFER | MOMO | ZALOPAY | DEPOSIT_DEDUCTION | OTHER
ShortTermPricingType  = HOURLY | DAILY | FIXED
PriceTableType        = PROGRESSIVE | FLAT  // lũy tiến / trọn gói
NotificationType      = SYSTEM | INVOICE | CONTRACT | PAYMENT | SERVICE

// Calendar event types (frontend + backend)
CalendarEventType     = CONTRACT_START | CONTRACT_END
                      | DEPOSIT_CHECKIN_DUE | DEPOSIT_CHECKIN_OVERDUE
                      | ACTIVE_CHECKOUT_DUE | ACTIVE_CHECKOUT_OVERDUE
                      | INVOICE_DUE | INVOICE_OVERDUE
                      | PAYMENT_DUE | PAYMENT_DUE_OVERDUE
CalendarEventSeverity = info | warning | danger
```

---

## 5. Database Schemas

> **Convention chung**: mọi schema có `@Schema({ timestamps: true })`, `isDeleted: boolean (default false)`, `ownerId: ObjectId(User) required indexed` (trừ User và Notification). Reference fields PHẢI dùng `Types.ObjectId` + `ref`.

### 5.1 `User` (`users`)
- `email: string` — required, unique, lowercase, trim
- `password: string` — required (bcrypt hash, salt rounds 10)
- `fullName: string` — required, trim
- `phone: string` — trim
- `role: UserRole` — default OWNER
- `isActive: boolean` — default true
- `isDeleted: boolean`
- `refreshToken?: string` — bcrypt hash của refresh token

Indexes: `{ email:1 }`, `{ isDeleted:1, isActive:1 }`.

### 5.2 `Building` (`buildings`)
- `ownerId: ObjectId(User)` required indexed
- `name: string` required, trim
- `nameNormalized: string` — Vietnamese tones stripped (cho search)
- `code: string` required, unique, auto-gen `B-{base36 ts}-{rand4}`
- `address: { street, ward, district, city }` — tất cả string required
- `description: string`
- `totalRooms: number` default 0 — auto-increment khi tạo room
- `isDeleted: boolean`

Indexes: `{ ownerId:1, isDeleted:1 }`, `{ code:1 }`.

### 5.3 `Room` (`rooms`)

**Sub-schema `ShortTermPriceTier`** (no `_id`):
```ts
{ fromValue: number, toValue: number, price: number }
// toValue = -1 → "còn lại" (vô hạn)
```

Fields:
- `buildingId: ObjectId(Building)` required indexed
- `roomGroupId: ObjectId(RoomGroup)` indexed
- `ownerId: ObjectId(User)` required indexed
- `roomCode: string` required, unique, auto-gen `R-{base36 ts}-{rand4}`
- `roomName: string` required, trim
- `nameNormalized: string` indexed
- `floor: number` default 1
- `area: number` default 0
- `maxOccupancy: number` default 0
- `roomType: RoomType` required, default LONG_TERM

**Long-term fields** (default 0, trừ `defaultTermMonths` default 1):
- `defaultElectricPrice: number` — giá điện/số
- `defaultWaterPrice: number` — giá nước/số
- `defaultRoomPrice: number` — giá phòng/tháng
- `defaultTermMonths: number` — kỳ hạn mặc định

**Short-term fields**:
- `shortTermPricingType: ShortTermPricingType` (HOURLY | DAILY | FIXED)
- `hourlyPricingMode: 'PER_HOUR' | 'TABLE'`
- `pricePerHour: number` default 0
- `shortTermPrices: ShortTermPriceTier[]` default []
- `priceTableType: PriceTableType` default PROGRESSIVE
- `fixedPrice: number` default 0

**Other**:
- `status: RoomStatus` default AVAILABLE
- `currentElectricIndex: number` default 0
- `currentWaterIndex: number` default 0
- `amenities: string[]` default []
- `description: string`
- `images: string[]` default []
- `sortOrder: number` default 0 (drag-and-drop dashboard)
- `isDeleted: boolean`

Indexes: `{ buildingId:1, isDeleted:1 }`, `{ ownerId:1, status:1, isDeleted:1 }`, `{ roomCode:1 }`.

### 5.4 `RoomGroup` (`roomgroups`)
- `ownerId: ObjectId(User)` required indexed
- `buildingId: ObjectId(Building)` required indexed
- `name: string` required
- `nameNormalized: string` indexed
- `code: string` required, unique, auto-gen `GP-{ts}-{rand}`
- `description: string`
- `color: string` — chip palette (red/blue/green/yellow/purple/pink/orange/gray)
- `sortOrder: number` default 0
- `isActive: boolean` default true
- `isDeleted: boolean`

Indexes: `{ ownerId:1, buildingId:1, isDeleted:1 }`, `{ buildingId:1, isDeleted:1 }`, `{ name:1 }`.

### 5.5 `Tenant` (`tenants`)
- `ownerId: ObjectId(User)` required indexed
- `fullName: string` required, trim
- `fullNameNormalized: string` indexed
- `code: string` required, unique, auto-gen `T-{ts}-{rand}`
- `idCard: string` required, trim, indexed (CMND/CCCD)
- `phone: string` required, trim, indexed
- `email: string` trim
- `occupation: string`
- `dateOfBirth: Date`
- `gender: Gender`
- `permanentAddress: string`
- `currentRoomId: ObjectId(Room)` indexed
- `moveInDate: Date`, `moveOutDate: Date`
- `status: TenantStatus` default ACTIVE
- `emergencyContact: { name, phone, relationship }`
- `notes: string`
- `isDeleted: boolean`

Indexes: `{ ownerId:1, isDeleted:1 }`, `{ idCard:1 }`, `{ phone:1 }`, `{ currentRoomId:1, status:1 }`. **Partial unique** (filter `isDeleted: false`): `{ ownerId:1, phone:1 }`, `{ ownerId:1, idCard:1 }`.

### 5.6 `Contract` (`contracts`)

Embeds `ShortTermPriceTier` từ Room schema.

- `ownerId, roomId, tenantId: ObjectId` required indexed
- `contractCode: string` unique, sparse, auto-gen `HD-{ts}-{rand}`
- `contractType: ContractType` default LONG_TERM
- `startDate: Date` required
- `endDate: Date`
- `rentPrice: number` default 0, required
- `depositAmount: number` default 0
- `electricityPrice: number` default 0
- `waterPrice: number` default 0

**Pricing override block** (mirror Room):
- `roomType: RoomType`
- `shortTermPricingType, hourlyPricingMode, pricePerHour, fixedPrice`
- `shortTermPrices: ShortTermPriceTier[]`
- `priceTableType: PriceTableType`

**Service charges (snapshot)**:
```ts
serviceCharges: Array<{
  name: string,
  amount: number,
  quantity: number (default 1),
  isRecurring: boolean,
}>
```

**Payment schedule**:
- `paymentCycle: PaymentCycle` default MONTHLY
- `paymentCycleMonths: number` default 1
- `paymentDueDay: number` default 1 (1–31)

**Meter readings (initial)**:
- `initialElectricIndex: number` default 0
- `initialWaterIndex: number` default 0

**Status & lifecycle**:
- `status: ContractStatus` default ACTIVE
- `terms: string`, `notes: string`
- `nextPaymentDate: Date` — auto-calc
- `terminatedAt: Date`
- `isDeleted: boolean`

Indexes: `{ ownerId:1, isDeleted:1 }`, `{ roomId:1, status:1 }`, `{ tenantId:1 }`, `{ startDate:1, endDate:1 }`.

### 5.7 `Invoice` (`invoices`)

**Sub-schema `InvoiceAdjustment`** (no `_id`):
```ts
{ description: string, amount: number, isDiscount: boolean (default false) }
```

Fields:
- `ownerId, contractId, roomId, tenantId: ObjectId` required indexed
- `invoiceNumber: string` required, unique, auto-gen `INV-{Date.now()}`
- `invoiceType: InvoiceType` default REGULAR
- `billingPeriod: { month: number, year: number }` required

**Short-term specific** (default 0):
- `checkInTime, checkOutTime: Date`
- `totalHours, totalDays: number`

**Electric** (default 0):
- `previousElectricIndex, currentElectricIndex, electricityUsed, electricityPrice, electricityAmount`

**Water** (default 0): same pattern.

**Charges**:
- `rentAmount: number` default 0
- `serviceCharges: Array<{ name, amount }>` default []

**Totals**:
- `totalAmount: number` required default 0
- `paidAmount: number` default 0
- `remainingAmount: number` default 0
- `status: InvoiceStatus` default PENDING
- `dueDate: Date` required
- `paidDate: Date`
- `notes: string`
- `adjustments: InvoiceAdjustment[]`
- `contractSnapshot: Record<string, any>` — frozen contract data tại thời điểm tạo invoice
- `isDeleted: boolean`

Indexes: `{ ownerId:1, isDeleted:1 }`, `{ contractId:1 }`, `{ roomId:1 }`, `{ tenantId:1 }`, `{ invoiceNumber:1 }`, `{ 'billingPeriod.year':1, 'billingPeriod.month':1 }`, `{ status:1, dueDate:1 }`.

### 5.8 `Payment` (`payments`)
- `ownerId, invoiceId, contractId, tenantId: ObjectId` required indexed
- `amount: number` required default 0 (**có thể âm** — refund hoàn cọc)
- `paymentMethod: PaymentMethod` default CASH
- `paymentDate: Date` required
- `transactionId: string`
- `notes: string`
- `receivedBy: ObjectId(User)` — user thu tiền
- `isDeleted: boolean`

Indexes: `{ ownerId:1, isDeleted:1 }`, `{ invoiceId:1 }`, `{ contractId:1 }`, `{ tenantId:1 }`, `{ paymentDate:1 }`.

### 5.9 `Service` (`services`)

**Sub-schema `ServicePriceTier`** (no `_id`): `{ fromValue, toValue, price }`.

- `ownerId: ObjectId(User)` required indexed
- `code: string` required, unique, auto-gen `SV-{ts}-{rand}`
- `name: string` required, trim
- `nameNormalized: string` indexed
- `unit: string` required (kWh, m3, tháng, người, phòng…)
- `priceType: 'FIXED' | 'TABLE'` default FIXED
- `fixedPrice: number` default 0
- `priceTiers: ServicePriceTier[]`
- `buildingScope: 'ALL' | 'SPECIFIC'` default ALL
- `buildingIds: ObjectId(Building)[]`
- `isActive: boolean` default true
- `isDeleted: boolean`

Indexes: `{ ownerId:1, isDeleted:1, isActive:1 }`, `{ code:1 }`, `{ buildingIds:1 }`.

### 5.10 `Notification` (`notifications`)
- `userId: ObjectId(User)` required indexed (lưu ý: dùng `userId` không phải `ownerId`)
- `title: string` required
- `message: string` required
- `type: NotificationType` default SYSTEM
- `isRead: boolean` default false
- `metadata: Record<string, any>` default {}

Index: `{ userId:1, createdAt:-1 }`.

> ⚠️ **Lưu ý**: `NotificationsService.create` tồn tại nhưng **chưa được gọi từ bất kỳ service nào khác** trong V1. Module hoàn chỉnh schema/UI nhưng cần wire-up event triggers (contract activated, invoice created, payment received…) khi rebuild.

---

## 6. Backend Architecture

### 6.1 Module pattern (chuẩn cho mọi feature module)

```
modules/{name}/
├── dto/
│   └── {name}.dto.ts        # CreateDto, UpdateDto + class-validator
├── schemas/
│   └── {name}.schema.ts     # Mongoose schema
├── {name}.controller.ts     # REST endpoints
├── {name}.service.ts        # Business logic
└── {name}.module.ts         # NestJS module
```

### 6.2 Common utilities (`backend/src/common/`)

**Decorators**:
- `@CurrentUser()` — pulls `request.user` (= `{ userId, email, role }` populated by JwtStrategy).
- `@Roles(...UserRole[])` — sets metadata cho `RolesGuard`.

**Guards**:
- `JwtAuthGuard` — extends `AuthGuard('jwt')`.
- `RolesGuard` — pass nếu không có metadata; ngược lại check `user.role ∈ roles`.
- Global `ThrottlerGuard` — default 100 req/60s, override per-route bằng `@Throttle`.

**Filters**:
- `AllExceptionsFilter` (registered as `APP_FILTER`) — wraps any exception, scrubs body password fields, returns `{ statusCode, timestamp, path, method, message, error, errors? }`.
- `I18nValidationExceptionFilter` — translates class-validator messages dùng `fields.json` cho property names + `validation.json` cho error templates.

**Interceptors**:
- `LoggingInterceptor` (registered) — log `[METHOD] URL - status - ms`.
- `TransformInterceptor` (defined, không register) — wrap `{ statusCode, message: 'Success', data }`.

**DTOs chung**:
- `PaginationDto`: `page (default 1)`, `limit (default 10)`, `sortBy?: string`, `sortOrder?: 'asc' | 'desc'` (lowercased).

**Utilities**:
- `removeVietnameseTones(str)` — strip dấu Vietnamese (incl. combining marks).
- `normalizeString(str)` — lowercase + strip tones.
- `escapeRegExp(str)` — escape regex metachars (cho `$regex`).

### 6.3 Auth & JWT

- **Access token**: `JWT_SECRET`, expiry `JWT_EXPIRES_IN` (default `7d` trong code, `7d` trong compose).
- **Refresh token**: `REFRESH_TOKEN_SECRET`, expiry `REFRESH_TOKEN_EXPIRES_IN` (default `30d` trong compose).
- **JWT payload**: `{ userId, email }`.
- **Refresh storage**: hash bằng bcrypt (salt 10) → lưu vào `user.refreshToken`. Logout clear field này.
- **Password hashing**: bcrypt salt rounds 10.
- **JwtStrategy.validate**: re-load user → trả về `{ userId, email, role }` → controllers reference `user.userId` (không phải `user._id`).
- **Endpoints**: `POST /auth/register`, `/auth/login`, `/auth/logout` (JwtAuthGuard), `/auth/refresh`. Throttle 10 req/15s cho login + register.

### 6.4 Conventions chung

1. **Multi-tenant**: mọi service filter `ownerId` + convert `string → Types.ObjectId`.
2. **Soft delete**: mọi entity (trừ Notification) có `isDeleted`; query luôn filter `isDeleted: false`.
3. **Default sort**: `createdAt: -1`. RoomGroups mặc định `sortOrder asc`.
4. **Auto-generated codes**: Building `B-{ts}-{rand}`, Room `R-…`, RoomGroup `GP-…`, Tenant `T-…`, Contract `HD-…`, Service `SV-…`, Invoice `INV-{Date.now()}`.
5. **Search**: kết hợp 2 regex — `escapeRegExp(raw)` (case-insensitive) + `normalizeString(search)` match `nameNormalized` (Vietnamese-tone-insensitive).
6. **Pagination response**: `{ data, meta: { total, page, limit, totalPages } }`.
7. **Reference fields**: PHẢI là `Types.ObjectId` + `ref` ở schema; service convert string sang ObjectId trước khi query/save.

---

## 7. API Endpoints

> Base: `/api`. Auth header: `Authorization: Bearer <accessToken>`. Language: `Accept-Language: vi|en` hoặc `x-lang: vi|en`.

### 7.1 Auth (`/auth`)
| Method | Path | Body / Note |
|--------|------|-------------|
| POST | `/auth/register` | `{ email, password (≥8, chữ hoa+thường+số), confirmPassword, fullName, phone }`. Throttle 10/15s. Returns `{ user, accessToken, refreshToken }` |
| POST | `/auth/login` | `{ email, password }`. Throttle 10/15s |
| POST | `/auth/logout` | JwtAuthGuard. Clear refresh token |
| POST | `/auth/refresh` | `{ refreshToken }`. Verify + bcrypt compare → issue new pair |

### 7.2 Users (`/users`) — JwtAuthGuard
| Method | Path | Note |
|--------|------|------|
| GET | `/users/profile` | Current user |
| PUT | `/users/profile` | `UpdateUserDto { fullName, phone, isActive }` |
| PUT | `/users/change-password` | `{ currentPassword, newPassword (≥8 mixed) }` |
| GET | `/users` | `@Roles(OWNER)` |
| GET/PUT/DELETE | `/users/:id` | `@Roles(OWNER)` |

### 7.3 Buildings (`/buildings`)
| Method | Path | Note |
|--------|------|------|
| POST | `/buildings/sync-counts` | Recompute `totalRooms` cho mọi building |
| POST | `/buildings` | `CreateBuildingDto { name, address {street, ward, district, city}, description? }` |
| GET | `/buildings` | `?page&limit&search&sortBy&sortOrder` |
| GET/PUT/DELETE | `/buildings/:id` | DELETE: refuse nếu có room OCCUPIED/DEPOSITED; cascade soft-delete rooms + room groups |

### 7.4 Rooms (`/rooms`)
| Method | Path | Note |
|--------|------|------|
| POST | `/rooms` | `CreateRoomDto` (xem Section 5.3 + 10.2). Force status AVAILABLE; auto-increment `building.totalRooms` |
| GET | `/rooms/dashboard` | `?buildingId&status&roomGroupIds&search` → `{ groups: [{ _id, name, color, rooms[] }], ungrouped: rooms[] }`. Each room có `activeContract` (lookup) |
| GET | `/rooms` | `?page&limit&search&buildingId&status&sortBy&sortOrder` |
| GET | `/rooms/:id` | |
| PUT | `/rooms/:id` | Refuse status change cho OCCUPIED/DEPOSITED. Strip `buildingId` |
| PUT | `/rooms/:id/indexes` | `{ currentElectricIndex, currentWaterIndex }` |
| PATCH | `/rooms/reorder` | `{ items: { roomId, roomGroupId?, sortOrder }[] }`. bulkWrite |
| DELETE | `/rooms/:id` | Refuse OCCUPIED; soft-delete + decrement totalRooms |

### 7.5 Room Groups (`/room-groups`)
- Standard CRUD + `?page&limit&search&buildingId&isActive&sortBy&sortOrder`. Default sort `sortOrder asc`, then nameNormalized.

### 7.6 Tenants (`/tenants`)
| Method | Path | Note |
|--------|------|------|
| POST | `/tenants` | `CreateTenantDto`. Cannot manually set status `RENTING`. Validates phone+idCard unique per owner |
| GET | `/tenants` | `?page&limit&search&status&currentRoomId&sortBy&sortOrder` |
| GET | `/tenants/:id/history` | `?type&startDate&endDate&page&limit` → unified timeline (contracts/invoices/payments) |
| GET/PUT/DELETE | `/tenants/:id` | DELETE: refuse nếu status RENTING |

### 7.7 Contracts (`/contracts`)
| Method | Path | Note |
|--------|------|------|
| POST | `/contracts` | `CreateContractDto` (xem 8.3). Tenant: chọn `tenantId` HOẶC nested `newTenant` |
| GET | `/contracts` | `?page&limit&search&buildingId&status&sortBy&sortOrder` |
| GET | `/contracts/:id` | |
| PUT | `/contracts/:id` | ACTIVE strip immutable: roomId, buildingId, contractType, roomType, startDate. Refuse initial-meter change after invoices exist |
| PUT | `/contracts/:id/activate` | `{ startDate, endDate? }`. DRAFT → ACTIVE; recompute nextPaymentDate; room→OCCUPIED, tenant→RENTING |
| PATCH | `/contracts/:id/terminate?closeTenant=true\|false` | `{ endDate, createFinalInvoice?, invoiceData? }`. ACTIVE → TERMINATED; room→AVAILABLE; tenant→CLOSED hoặc ACTIVE |
| DELETE | `/contracts/:id` | Only DRAFT; revert room→AVAILABLE, tenant→ACTIVE |

### 7.8 Invoices (`/invoices`)
| Method | Path | Note |
|--------|------|------|
| POST | `/invoices` | `CreateInvoiceDto` (xem 8.1). Auto compute amounts, prevent duplicates, advance nextPaymentDate, auto-terminate short-term contract, deposit deduction cho FINAL |
| GET | `/invoices` | `?page&limit&search&buildingId&status&sortBy&sortOrder` |
| GET | `/invoices/contract/:contractId` | List invoices theo contract |
| GET | `/invoices/:id` | |
| PUT | `/invoices/:id` | `{ status, paidAmount, paidDate, notes, adjustments }`. Recompute totalAmount khi adjustments đổi |
| DELETE | `/invoices/:id` | Refuse nếu có payments. Restore room meter readings từ invoice trước |

### 7.9 Payments (`/payments`)
| Method | Path | Note |
|--------|------|------|
| POST | `/payments` | `CreatePaymentDto { invoiceId, contractId, tenantId, amount, paymentMethod?, paymentDate, transactionId?, notes? }`. Validates `amount ≤ remainingAmount`. Updates invoice status |
| GET | `/payments` | `?page&limit&search&buildingId&sortBy&sortOrder` |
| GET | `/payments/:id` | |
| PUT | `/payments/:id` | `{ amount, paymentMethod, notes }`. Recompute invoice |
| DELETE | `/payments/:id` | Soft-delete + recompute invoice |

### 7.10 Services (`/services`)
| Method | Path | Note |
|--------|------|------|
| POST | `/services` | `{ name, unit, priceType?, fixedPrice?, priceTiers?, buildingScope?, buildingIds?, isActive? }` |
| GET | `/services` | `?page&limit&search&buildingId&isActive&sortBy&sortOrder`. Building filter resolves cả `buildingScope=ALL` + `SPECIFIC` |
| GET/PUT/DELETE | `/services/:id` | |

### 7.11 Notifications (`/notifications`)
| Method | Path | Note |
|--------|------|------|
| GET | `/notifications` | `?page&limit` |
| GET | `/notifications/unread-count` | Trả về number |
| PATCH | `/notifications/read-all` | |
| PATCH | `/notifications/:id/read` | |

### 7.12 Calendar (`/calendar`)
| Method | Path | Note |
|--------|------|------|
| GET | `/calendar/events` | `?start&end&buildingId?&type?` → `CalendarEventDto[]` |
| GET | `/calendar/day` | `?date&buildingId?` → `{ date, events[] }` |
| GET | `/calendar/month-summary` | `?year&month&buildingId?` → `{ days: { 'YYYY-MM-DD': Record<EventType, number> }, totalEvents }` |

**Tổng cộng ~70 endpoints.**

---

## 8. Critical Business Logic

### 8.1 Invoice Creation (`InvoicesService.create`)

**Steps**:

1. **Duplicate check**: cùng `contractId + month + year + invoiceType` → reject. (`invoiceType` default `REGULAR`).
2. **Period validation cho REGULAR**:
   - Reject nếu period > tháng hiện tại.
   - Reject nếu period ≤ kỳ hóa đơn cuối của contract.
   - **`FINAL` invoices skip** cả 2 check này.
3. Load contract → reject nếu status ≠ `ACTIVE`.
4. **Amount computation**:
   - **Long-term**:
     - `electricityUsed = max(0, currentElectricIndex - previousElectricIndex)`
     - `electricityAmount = used * electricityPrice`
     - Same logic cho water.
     - `rentAmount = dto.rentAmount ?? contract.rentPrice`
   - **Short-term**: gọi `calculateShortTermAmount(contract, totalHours, totalDays)`:
     - `FIXED` → `contract.fixedPrice`
     - `HOURLY + PER_HOUR` → `totalHours * pricePerHour`
     - `HOURLY + TABLE` → `calculateFromPriceTable(shortTermPrices, totalHours, priceTableType, 'hours')`
     - `DAILY` → `calculateFromPriceTable(shortTermPrices, totalDays, priceTableType, 'days')`
   - `serviceTotal = Σ(charge.amount × (charge.quantity ?? 1))`
   - **Adjustments**:
     - Bắt đầu từ `dto.adjustments[]`.
     - **Auto-push** cho SHORT_TERM với `depositAmount > 0`: `{ description: 'Deposit deduction', amount: depositAmount, isDiscount: true }`.
     - `adjustmentTotal = Σ(isDiscount ? -amount : +amount)`
   - `totalAmount = max(0, rentAmount + electricityAmount + waterAmount + serviceTotal + adjustmentTotal)`
5. **Build `contractSnapshot`**: snapshot pricing fields, deposit, paymentCycle, calc details của contract.
6. **Create invoice**: `invoiceNumber = INV-{Date.now()}`, `remainingAmount = totalAmount`, status `PENDING`.
7. **Long-term post-processing**:
   - Update room meter readings (`currentElectricIndex/currentWaterIndex`).
   - Cho non-FINAL invoices: advance `contract.nextPaymentDate` ONLY khi billing period ≥ current next-payment month. Tính: `addMonths(currentNext, cycleMonths)` rồi clamp `paymentDueDay` ≤ days-in-month.
8. **Short-term auto-termination**: contract → TERMINATED (`endDate=now`, `terminatedAt=now`); room → AVAILABLE; tenant → ACTIVE (`currentRoomId=null`, `moveOutDate=now`).
9. **FINAL với `applyDeposit`**:
   - `deposit ≥ total` → tạo `DEPOSIT_DEDUCTION` payment cho `total`; invoice fully PAID. Nếu dư → **negative payment** `-(deposit - total)` (refund hoàn cọc).
   - `deposit < total` → `DEPOSIT_DEDUCTION` payment cho deposit; invoice PARTIAL; `remaining = total - deposit`.

### 8.2 Price Table Calculation (`calculateFromPriceTable`)

```
Input: tiers (sorted by fromValue asc), quantity, type (PROGRESSIVE | FLAT), unit
```

- **FLAT (trọn gói)**:
  - Pick tier where `quantity ∈ [fromValue, toValue]` (hoặc `toValue === -1` = còn lại).
  - `amount = quantity × tier.price`.
  - Nếu vượt mọi tier → dùng tier cuối: `amount = quantity × lastTier.price`.

- **PROGRESSIVE (lũy tiến)**:
  - Walk tiers theo thứ tự. Mỗi tier:
    - `qtyInTier = (toValue === -1) ? remaining : (toValue - fromValue + 1)`
    - `consumed = min(remaining, qtyInTier)`
    - `amount += consumed × tier.price`
    - `remaining -= consumed`
  - Overflow → dùng `lastTier.price` × remaining.

### 8.3 Contract Lifecycle

**Create** (`POST /contracts`):
1. **Validation** (`validateCreateContract`):
   - Verify room exists.
   - Tenant: hoặc tồn tại + ACTIVE, hoặc nested `newTenant` đầy đủ `fullName/phone/idCard`.
   - **LONG_TERM**: `rentPrice ≥ 0`, electricity/water ≥ 0, paymentCycle required. End-date (nếu có) phải `> startDate + paymentCycleMonths` tháng.
   - **SHORT_TERM**: `shortTermPricingType` required.
     - HOURLY → `hourlyPricingMode` required; `PER_HOUR` cần `pricePerHour > 0`.
     - FIXED → `fixedPrice > 0`.
     - DAILY hoặc HOURLY-TABLE → `shortTermPrices[]` ≥ 2 tiers; first tier `fromValue=1`; last tier `toValue=-1`; mỗi `price > 0`; tier ranges valid; consecutive `fromValue = prevToValue + 1`.
   - `depositAmount ≥ 0`, `startDate` required.
   - **Per-service-charge validation**: nếu `serviceId` → reload system service; reject name mismatch; reject price mismatch (>0.01) cho FIXED.
2. Nếu `newTenant` → tạo tenant trước.
3. **LONG_TERM**: compute `nextPaymentDate = setDate(addMonths(startDate, cycleMonths), min(dueDay, daysInMonth))`.
4. Auto-gen `contractCode = HD-{base36 ts}-{rand4}`.
5. Sync meter indexes vào room.
6. **Status transitions**:
   - DRAFT → room `DEPOSITED`, tenant `DEPOSITED`.
   - ACTIVE → room `OCCUPIED`, tenant `RENTING`.
   - Set `tenant.moveInDate=startDate`, `tenant.currentRoomId=roomId`.

**Activate** (`PUT /contracts/:id/activate`):
- Only DRAFT. Update startDate (validates endDate > startDate). Recompute `nextPaymentDate` cho LONG_TERM. Room → OCCUPIED, tenant → RENTING.

**Update** (`PUT /contracts/:id`):
- DRAFT hoặc ACTIVE only.
- ACTIVE strip immutable: `roomId, buildingId, contractType, roomType, startDate`.
- Refuse `initialElectricIndex/initialWaterIndex` change once invoices exist.
- Re-run `validateCreateContract(..., isUpdate=true)`.
- Nếu status flipping DRAFT → ACTIVE → perform state transitions.

**Terminate** (`PATCH /contracts/:id/terminate`):
- ACTIVE only.
- Status → TERMINATED, `endDate=dto.endDate`, `terminatedAt=now`.
- Room → AVAILABLE.
- Tenant → CLOSED (nếu `closeTenant=true`) hoặc ACTIVE; clear `currentRoomId`; `moveOutDate=dto.endDate`.

**Remove** (`DELETE /contracts/:id`):
- DRAFT only. Revert room → AVAILABLE, tenant → ACTIVE (clear currentRoomId, moveInDate). Soft delete.

### 8.4 Payment Flow

**Create** (`POST /payments`):
1. Load invoice → reject nếu PAID/CANCELLED.
2. `currentRemaining = totalAmount - (paidAmount || 0)`. Reject nếu `dto.amount > currentRemaining`.
3. Insert payment (auto-fill `contractId`, `tenantId` từ invoice; `receivedBy = current userId`).
4. Update invoice:
   - `newPaidAmount = oldPaid + amount`
   - `remaining = totalAmount - newPaid`
   - Status:
     - `PAID` nếu `remaining ≤ 0` (set `paidDate = now`)
     - `PARTIAL` nếu `newPaid > 0`
     - Else: keep PENDING

**Update**: recompute với `amountDiff = newAmount - oldAmount`. Status: PAID/PARTIAL/PENDING (hoặc OVERDUE nếu `dueDate < now` && paid==0).

**Delete**: soft-delete + subtract amount → recompute invoice status.

### 8.5 Tenant History (`GET /tenants/:id/history`)

1. Verify tenant ownership.
2. Build `dateFilter` từ `startDate/endDate`. Payments dùng `paymentDate`, contracts/invoices dùng `createdAt`.
3. Parallel queries: contracts (populate roomId), invoices, payments (populate invoiceId).
4. Build unified `TenantHistoryEvent[]`:
   - **Contract**: titles `Contract created` / `Contract terminated` / `Contract expired`.
   - **Invoice**: title `Invoice #{invoiceNumber}`.
   - **Payment**: title `Payment received`.
5. Sort events desc by date. Paginate in-memory.

### 8.6 Calendar Events (`CalendarService`)

`getEventsInRange` aggregates:
- **Contracts**:
  - DRAFT → `DEPOSIT_CHECKIN_DUE` (hoặc OVERDUE nếu quá hạn) tại `startDate`.
  - ACTIVE → `ACTIVE_CHECKOUT_DUE` (hoặc OVERDUE) tại `endDate`.
  - `CONTRACT_START` / `CONTRACT_END` markers.
- **Payments due** (cho ACTIVE long-term): recurring on `paymentCycleMonths × paymentDueDay` trong range.
- **Invoices** (PENDING/PARTIAL/OVERDUE): `INVOICE_DUE` hoặc `INVOICE_OVERDUE` tại `dueDate`.

Severity: `info | warning | danger`.

`getEventsByDay` và `getMonthSummary` dùng lại `getEventsInRange`.

### 8.7 Room Dashboard (`GET /rooms/dashboard`)

Aggregation pipeline:
1. Match owner + filters (buildingId/status/roomGroupIds/search).
2. Lookup `roomgroups`.
3. Lookup `contracts` (chỉ ACTIVE/DEPOSITED/DRAFT, not deleted) với sub-lookup `tenant`.
4. Project flat shape:
   - `roomGroupId: { _id, name, color }`
   - `activeContract: { ...pricing, ...schedule, tenantId: { _id, fullName, phone } }`
5. Sort: `roomGroup.sortOrder` → `room.sortOrder` → `roomName`.
6. Returns `{ groups: [{ _id, name, color, rooms[] }], ungrouped: rooms[] }`.

### 8.8 Service Pricing

- `FIXED` → `fixedPrice`.
- `TABLE` → cùng thuật toán PROGRESSIVE/FLAT như Room (8.2).

> Lưu ý: tại invoice creation, `serviceCharges` đã là **snapshot** (`{name, amount, quantity}`) trên contract. `Service.priceTiers` chỉ là reference catalog, không apply trực tiếp.

---

## 9. Frontend Structure

### 9.1 Pages (`frontend/src/pages/`)

```
auth/
  LoginPage.tsx
  RegisterPage.tsx
dashboard/
  DashboardPage.tsx
buildings/
  BuildingsPage.tsx
  BuildingCreatePage.tsx
  BuildingEditPage.tsx
rooms/
  RoomsPage.tsx
  RoomBoardPage.tsx          # kanban board with drag-and-drop
  RoomCreatePage.tsx
  RoomEditPage.tsx
room-groups/
  RoomGroupsPage.tsx
  RoomGroupCreatePage.tsx
  RoomGroupEditPage.tsx
tenants/
  TenantsPage.tsx
  TenantCreatePage.tsx
  TenantEditPage.tsx
  TenantDetailPage.tsx
  TenantHistoryPage.tsx
contracts/
  ContractsPage.tsx
  ContractCreatePage.tsx
  ContractEditPage.tsx
  ContractDetailPage.tsx
  TerminateContractPage.tsx
  ContractForm.tsx           # shared form (page-level)
invoices/
  InvoicesPage.tsx
  InvoiceCreatePage.tsx
  InvoiceDetailPage.tsx
payments/
  PaymentsPage.tsx
services/
  ServicesPage.tsx
  ServiceCreatePage.tsx
  ServiceEditPage.tsx
```

### 9.2 Routes (`frontend/src/App.tsx`)

**Public**: `/login`, `/register`.

**Protected** (wrapped in `<DashboardLayout />`):
- `/` — DashboardPage
- `/buildings`, `/buildings/new`, `/buildings/:id/edit`
- `/rooms`, `/room-board`, `/rooms/new`, `/rooms/:id/edit`
- `/tenants`, `/tenants/new`, `/tenants/:id`, `/tenants/:id/edit`, `/tenants/:id/history`
- `/contracts`, `/contracts/new`, `/contracts/:id`, `/contracts/:id/edit`, `/contracts/:id/terminate`
- `/invoices`, `/invoices/new`, `/invoices/:id`
- `/payments`
- `/room-groups`, `/room-groups/new`, `/room-groups/:id/edit`
- `/services`, `/services/new`, `/services/:id/edit`

Lazy-loaded với `<Suspense>` + translated loading fallback. `<ProtectedRoute>` redirect `/login` nếu không có token.

### 9.3 Layout (`DashboardLayout.tsx`)

**Sidebar** (collapsible 280px ↔ 92px):
- **Dashboard**: Dashboard (`/`), Bảng phòng (`/room-board`)
- **Vận hành**: Buildings (`/buildings`), Rooms (`/rooms`), Room Groups (`/room-groups`), Services (`/services`)
- **Hồ sơ**: Tenants (`/tenants`), Contracts (`/contracts`)
- **Tài chính**: Invoices (`/invoices`), Payments (`/payments`)

**Header**:
- Sidebar collapse toggle
- `BuildingSelector` (compact, lọc data theo building hiện chọn — null = tất cả)
- **Quick Create dropdown** (Plus icon): Buildings / Rooms / Tenants / Contracts / Invoices
- `NotificationDropdown` (poll 30s)
- User avatar dropdown: Theme toggle (light/dark/system) + Language toggle (vi/en) + Logout

**Mobile**: bottom nav 4 items + center FAB cho quick-create.

**Branding**: `common.appName` = `Nhà Trọ Số`. Logo `/logo.png`. Fonts: **Be Vietnam Pro** (sans), **Plus Jakarta Sans** (display).

### 9.4 Components Inventory

**Top-level** (`frontend/src/components/`):
- `ActivateContractDialog.tsx`, `BuildingSelector.tsx`, `ColumnVisibilityToggle.tsx`
- `ContractSelectModal.tsx`, `ContractViewModal.tsx`
- `CreateInvoiceModal.tsx`, `CreateShortTermInvoiceModal.tsx`, `InvoiceViewModal.tsx`
- `LanguageSwitcher.tsx`, `Pagination.tsx`, `PriceTablePopover.tsx`
- `RecordPaymentModal.tsx`, `RoomSelector.tsx`, `TenantSelector.tsx`
- `TenantHistoryTimeline.tsx`, `TerminateContractModal.tsx`, `ThemeToggle.tsx`

**Forms** (`forms/`): `BuildingForm`, `RoomForm`, `RoomGroupForm`, `ServiceForm`, `TenantForm`.

**Common** (`common/`): `NotificationDropdown`, `PdfExportMenu`.

**Dashboard** (`dashboard/`): `BigCalendar`, `DraggableRoomCard`, `RoomCard`, `RoomGroupCollapse`, `RoomStatusOverview`.

**Rooms** (`rooms/`): `RoomBoardWorkspace`.

**Layout** (`layout/`): `auth-shell`, `page-shell`.

**UI primitives** (`ui/`, shadcn-style trên Radix): `avatar`, `badge`, `button`, `calendar`, `card`, `checkbox`, `collapsible`, `command`, `date-picker`, `datetime-picker`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `month-year-picker`, `number-input`, `password-input`, `popover`, `radio-group`, `select`, `separator`, `skeleton`, `tabs`, `table`, `textarea`, `toast`, `toaster`, `tooltip`. Plus `ui/skeletons/CardSkeleton.tsx`, `ui/skeletons/TableSkeleton.tsx`.

### 9.5 Hooks (`frontend/src/hooks/`)

- `useDebounce<T>(value, delay)` — generic debounce.
- `useColumnVisibility(tableId, columns)` — Zustand-persisted (`column-visibility-storage`) toggle column show/hide per table. API: `isVisible/toggle/reset/showAll/hideAll`.
- `useNotifications`, `useUnreadCount`, `useMarkNotificationRead`, `useMarkAllNotificationsRead` — React Query hooks (poll 30s).
- `use-toast.ts` — shadcn toast.
- `useListSearchParams({ defaultPage, defaultPageSize, defaultSortBy, defaultSortOrder, searchKey, pageKey, pageSizeKey, sortByKey, sortOrderKey })` — sync list state ↔ URL `?q=&page=&pageSize=&sortBy=&sortOrder=`. Exposes setters + `toggleSort`, `getAriaSort`.

### 9.6 Stores (Zustand persisted)

- **`authStore`** — key `auth-storage`. Fields: `user`, `token`. Mirror token ra plain `localStorage.token` cho axios interceptor. `setAuth`, `logout`.
- **`buildingStore`** — key `building-storage`. Field: `selectedBuildingId | null` (null = all).
- **`themeStore`** — key `theme-storage`. Field: `'light' | 'dark' | 'system'`. Apply class lên `<html>`. Listen system `prefers-color-scheme`.

### 9.7 API Client (`frontend/src/api/`)

- **`client.ts`** — axios instance:
  - `baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'`
  - Request interceptor: gắn `Authorization: Bearer <token>`, `Accept-Language`, `x-lang`.
  - Response interceptor: 429 → translated message; 401 (ngoài /login,/register) → clear auth + redirect `/login`.
- **`auth.api.ts`** — `login`, `register`, `logout`.
- **`notifications.api.ts`** — `getAll`, `getUnreadCount`, `markAsRead`, `markAllAsRead`.
- **`calendar.ts`** — `getEvents`, `getDayEvents`, `getMonthSummary`.

> Đa số CRUD calls khác được làm inline trong page components dùng `apiClient` + React Query. Chưa có per-feature API module structure.

---

## 10. Frontend Forms (Conditional Logic)

### 10.1 `BuildingForm`
Fields: `name*`, `code` (read-only on edit), `address.street*`, `address.ward*`, `address.district*`, `address.city*`, `description`. Strip empty `description` and `code` on submit.

### 10.2 `RoomForm`

**Top section**: `buildingId*` (BuildingSelector, disabled khi edit hoặc pre-selected), `roomCode` (read-only on edit), `roomName*`, `floor*`, `area`, `maxOccupancy`, `status` (locked khi OCCUPIED/DEPOSITED — chỉ AVAILABLE/MAINTENANCE selectable, value locked render nếu cần), `roomGroupId` (optional, "unassigned" → empty).

**Room type chooser** → conditional sections:

- **LONG_TERM**:
  - `defaultElectricPrice*`, `defaultWaterPrice*`, `defaultRoomPrice*`
  - `defaultTermMonths*` (Select: 1/2/3/6/12 + custom + NumberInput)
  - `currentElectricIndex`, `currentWaterIndex` (meter readings)

- **SHORT_TERM** → `shortTermPricingType` chooser:
  - **FIXED** → `fixedPrice*`
  - **HOURLY** → `hourlyPricingMode` chooser:
    - **PER_HOUR** → `pricePerHour*`
    - **TABLE** → `priceTableType` radio (PROGRESSIVE/FLAT) + price-tier table:
      - First tier `fromValue=1` (locked)
      - Last tier `toValue=-1` (rendered "Còn lại")
      - Add tier auto-link `fromValue = prevToValue + 1`
      - Locked from-values
      - Chỉ tier intermediate xóa được
  - **DAILY** → same price-tier table (in days)

- `description` (textarea)

**Defaults**: `roomType=LONG_TERM`, `shortTermPricingType=HOURLY`, `hourlyPricingMode=PER_HOUR`, `shortTermPrices=[{1,1,0},{2,-1,0}]`, `priceTableType=PROGRESSIVE`, `status=AVAILABLE`.

### 10.3 `RoomGroupForm`
- `buildingId*` (Select; disabled if preselected/editing)
- `code` (read-only on edit)
- `name*`, `description`, `color` (chip palette: red/blue/green/yellow/purple/pink/orange/gray), `sortOrder`

### 10.4 `ServiceForm`
- `name*`, `unit*` (free text + suggested units)
- `priceType` chooser:
  - **FIXED** → `fixedPrice*`
  - **TABLE** → `priceTiers` (default `[{0,0,0},{0,-1,0}]`)
- `buildingScope` chooser (ALL/SPECIFIC):
  - SPECIFIC → multi-select `buildingIds`
- `isActive` toggle

### 10.5 `TenantForm`
- `code` (read-only on edit), `fullName*`, `email`, `phone*` (Vietnamese phone regex)
- `idNumber*` (CMND/CCCD), `dateOfBirth` (DatePicker), `gender` (MALE/FEMALE/OTHER)
- `address`, `occupation`
- `status` chỉ ACTIVE/CLOSED (RENTING/DEPOSITED system-managed, stripped on submit)
- `emergencyContact { name, phone, relationship }` (nested, optional)

### 10.6 `ContractForm` (`pages/contracts/ContractForm.tsx`)

Fields:
- `buildingId*`, `roomId*` (RoomSelector filter by building/AVAILABLE)
- `tenantId` HOẶC nested `newTenant`
- `startDate*`, `endDate?`, `roomType*`
- `rentPrice*`, `electricityPrice*`, `waterPrice*`
- Short-term overrides (per `shortTermPricingType`)
- `depositAmount*`, `paymentCycle` (MONTHLY/MONTHLY_2/QUARTERLY/MONTHLY_6/MONTHLY_12/CUSTOM), `paymentCycleMonths` (khi CUSTOM), `paymentDueDay (1–31)*`
- `initialElectricIndex*`, `initialWaterIndex*`
- `serviceCharges[]` (name, amount, quantity, isRecurring, optional `serviceId` link)
- `notes`, `terms`

**Validation**: end-date phải `> firstPaymentDueDate` (= `startDate + cycleMonths` tháng @ `paymentDueDay`).

---

## 11. Validation Rules (`frontend/src/lib/validations.ts`)

Hook schemas (Zod with i18n):
- `useBuildingSchema` — name*, address {street, ward, district, city}*, description?.
- `useRoomSchema` — superRefine enforces LONG_TERM vs SHORT_TERM required fields + price-tier rules (sequencing, last.to=-1, price>0).
- `useTenantSchema` — fullName*, phone* (Vietnam regex), idNumber*; emergencyContact optional nested.
- `useRoomGroupSchema` — buildingId*, name*, color/sortOrder/isActive optional.
- `useLoginSchema` — email* + valid + password*.
- `useRegisterSchema` — email*, password (≥6), confirmPassword (matches), fullName*, phone* (vn).
- `useContractSchema` — combines pricing rules + endDate > firstPaymentDueDate cho LONG_TERM. paymentDueDay 1–31. CUSTOM → paymentCycleMonths≥1.

**Helpers exported**: `isValidVietnamesePhone(phone)`, `validateContractEndDate(start, end, cycleMonths, dueDay)`.

**Vietnam phone regex**: `/^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-46-9])[0-9]{7}$/`.

**Pure helpers** (`frontend/src/lib/priceTableValidation.ts`): validate/repair short-term price tier sequences (used by Room + Contract forms).

---

## 12. i18n

### Backend (`backend/src/i18n/{en,vi}/`)
**11 namespace files** mỗi locale: `auth.json`, `buildings.json`, `common.json`, `contracts.json`, `fields.json`, `invoices.json`, `payments.json`, `rooms.json`, `tenants.json`, `users.json`, `validation.json`.

`fields.json` (vi sample): `name, email, password, fullName, phone, address, street, ward, district, city, description, roomCode, roomName, floor, area, basePrice, price, status, buildingId, tenantId, roomId, contractId, invoiceId, startDate, endDate, monthlyRent, deposit, idNumber, occupation, roomGroupId, color, sortOrder`.

`validation.json`: keys như `NOT_EMPTY, EMAIL, STRING, MIN_LENGTH, PASSWORDS_NOT_MATCH, PASSWORD_COMPLEXITY, isMongoId, min, max, matches`. Placeholders: `{property}`, `{constraints.0}`.

**Resolvers** (in `app.module.ts`):
1. `QueryResolver(['lang'])`
2. `AcceptLanguageResolver`
3. `HeaderResolver(['x-lang'])`
4. Fallback: `en`.

### Frontend (`frontend/public/locales/{en,vi}/translation.json`)
1 file phẳng / locale (~1100 lines mỗi file). Top sections: `common, app, menu, theme, settings, auth, buildings, rooms, roomGroups, tenants, contracts, invoices, payments, services, validation, errors, dashboard, roomBoard`.

**Setup** (`frontend/src/i18n.ts`): `i18next-browser-languagedetector` + `i18next-http-backend`. Default fallback English (chú ý: app default user-facing là vi nhưng technical fallback là en).

---

## 13. Design System

### Color Palette (theme `light`)
| Role | Hex | Note |
|------|-----|------|
| Primary | `#7C3AED` | Indigo/purple |
| Secondary | `#A78BFA` | Lighter purple |
| CTA/Accent | `#F97316` | Orange (action button) |
| Background | `#FAF5FF` | Lavender white |
| Text | `#4C1D95` | Deep purple |

Tokens dùng CSS variables `hsl(var(--token))`: `border, input, ring, background, foreground, primary, secondary, destructive, muted, accent, popover, card, success, warning, info, error, chart-1..6, sidebar (+ .foreground/.border/.accent/.accent-foreground)`. Dark mode toggle via `class="dark"` trên `<html>`.

### Typography
- Heading: `Plus Jakarta Sans` (display token)
- Body: `Be Vietnam Pro` (sans token), fallback `Noto Sans, system-ui`
- Weights: 300/400/500/600/700

### Spacing Tokens
| Token | Value |
|-------|-------|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--space-2xl` | 48px |
| `--space-3xl` | 64px |

### Border Radius
- `lg/md/sm` derived from `--radius` CSS variable.

### Animations
- `accordion-down/up`, `collapsible-down/up`, `fade-in`, `slide-in-right` (via `tailwindcss-animate` plugin).

### Conventions UI
- **Buttons**: primary = orange CTA; secondary = transparent with purple border.
- **Cards**: `bg-card`, `rounded-12`, `shadow-md`, hover `shadow-lg + translateY(-2px)`.
- **Action buttons trong table**: ghost icon (Pencil, Trash2) inline, KHÔNG dropdown.
- **Submit buttons**: bắt buộc loading state với `<Loader2 animate-spin />` + `disabled={isSubmitting}`.
- **Mobile-first**: breakpoints `sm/md/lg/xl`. Tap target ≥ 44px.

---

## 14. Seed Data (`backend/src/scripts/seed.ts`)

Run: `npm run seed` (drops DB then creates):
1. **1 Owner**: `email='admin@example.com'`, `password='password123'`, `fullName='Admin User'`, `phone='0901234567'`.
2. **1 Building**: HCM, faker street.
3. **20 Services**: random FIXED/TABLE; name từ `[Điện kWh @3500, Nước m3 @15000, Internet tháng @100000, Vệ sinh tháng @50000]`; price 10k-200k; TABLE = 2 tiers `[{0-10, p}, {11-(-1), 1.5p}]`; `buildingScope=ALL`, `isActive=true`.
4. **3-5 RoomGroups / building** with random color.
5. **10-15 Rooms / group**: floor random; mixed RoomType; status random AVAILABLE/OCCUPIED/MAINTENANCE; area 20-60; maxOccupancy 2-6; amenities random subset `['AC', 'Wifi']`. LONG_TERM: defaultRoomPrice 3-8M, electricity 3500, water 20000, 6 months. SHORT_TERM: FIXED 200k-1M.
6. **100 Tenants**: faker fullName, idCard (12-digit), phone, email, address, occupation.

> Không seed contract/invoice/payment.

---

## 15. Config & Environment Variables

### Backend env vars
```env
NODE_ENV=development|production
PORT=3000
API_PREFIX=api                                 # default 'api'
MONGODB_URI=mongodb://localhost:27017/room-manager
MONGODB_USER=                                   # optional
MONGODB_PASSWORD=                               # optional
JWT_SECRET=<long-random>
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=<long-random-different>
REFRESH_TOKEN_EXPIRES_IN=30d
CORS_ORIGIN=http://localhost:5173               # comma-separated allow-list
LOG_LEVEL=info
```

**`main.ts` setup**:
- Helmet
- CORS: allow-list from env + LAN regex `192.168.x.x:port`
- `setGlobalPrefix(api)`
- `I18nValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, enableImplicitConversion: true })`
- Logger: Winston (console + `logs/error.log` + `logs/combined.log`)

### Frontend env vars
```env
VITE_API_URL=http://localhost:3000/api
```

### `vite.config.ts`
- Alias `@ → ./src`
- Manual chunks: `pdf-export` group (jspdf/html2canvas/canvg/svg-pathdata/stackblur-canvas/core-js)
- Vitest jsdom + setup `./src/test/setup.ts`
- Dev server port 5173, `/api` proxy → `http://localhost:3000`

### `tailwind.config.js`
- `darkMode: 'class'`
- Fonts: `sans = Be Vietnam Pro`, `display = Plus Jakarta Sans`
- Plugin: `tailwindcss-animate`

### Backend `tsconfig.json`
- Path aliases: `@common/*`, `@config/*`, `@modules/*`, `@shared/*`
- target ES2021, module commonjs, decorators on, `strictNullChecks: false`

---

## 16. Docker / Deployment

### `docker-compose.yml` — 3 services trên `room-manager-network`

**mongodb**:
- image `mongo:4.4`
- container `room-manager-mongodb`
- port `27017`
- env `MONGO_INITDB_DATABASE=room-manager`
- volume `mongodb_data:/data/db`

**backend** (`./backend/Dockerfile`):
- 2-stage build: `node:20-alpine` build → production `node dist/main.js`
- port `3000`
- env: `NODE_ENV=production`, `PORT=3000`, `MONGODB_URI=mongodb://mongodb:27017/room-manager`, JWT/REFRESH secrets, `CORS_ORIGIN=http://localhost`
- `depends_on: mongodb`

**frontend** (`./frontend/Dockerfile`):
- Build with `node:20-alpine` (`npm run build` → `dist/`)
- Runtime: `nginx:alpine` serving `dist/` với custom `nginx.conf`
- port `80`
- `depends_on: backend`

Volume: `mongodb_data` (persistent).

---

## 17. Tests

- **Backend (Jest)**: `backend/src/modules/contracts/contracts.service.spec.ts` (only file). Mocks Mongoose models + service deps; covers long-term + short-term creation paths.
- **Frontend unit (Vitest)**: `frontend/src/lib/priceTableValidation.test.ts`.
- **E2E (Playwright)** at `frontend/e2e/`:
  - `tests/login.spec.ts`
  - `tests/contract-api.spec.ts`
  - `tests/contract-create.spec.ts`
  - Config: `e2e/playwright.config.ts`
  - Fixtures: `e2e/fixtures.ts` (auto-resolves tenant/building/contract/invoice via API nếu không truyền IDs)

Env overrides: `E2E_BASE_URL`, `E2E_API_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`.

---

## 18. Cross-Cutting Conventions (đặc biệt khi rebuild)

1. **Multi-tenant**: mọi entity có `ownerId: ObjectId(User)`; mọi service filter `ownerId` AND convert string→ObjectId.
2. **Soft delete**: mọi entity (trừ Notification) có `isDeleted`; query luôn filter `isDeleted: false`.
3. **Auto-gen codes**: B-, R-, GP-, T-, HD-, SV-, INV-{Date.now()}.
4. **Default sort**: `createdAt: -1`. RoomGroups: `sortOrder asc`.
5. **Search Vietnamese-aware**: combo `escapeRegExp(raw)` + `normalizeString(search)` match `nameNormalized`.
6. **Pagination response**: `{ data, meta: { total, page, limit, totalPages } }`.
7. **Auth payload tại controller**: `user.userId` (NOT `user._id`).
8. **Reference fields strict**: schema `Types.ObjectId + ref`; service `new Types.ObjectId(id)` trước query/save.
9. **Submit buttons**: `<Loader2 animate-spin />` + `disabled={isSubmitting}`.
10. **Action buttons trong table**: inline ghost icon (Pencil/Trash2), KHÔNG dropdown.
11. **Mobile-first responsive**: `sm/md/lg/xl`; tap target ≥ 44px; sidebar lg:hidden mobile.
12. **Form pages thay Dialog**: layout `<div class="container max-w-3xl mx-auto py-6">` + breadcrumb + back button + Card chứa form. Form components giữ nguyên logic, chỉ thay nơi render.

---

## 19. Known Functional Gaps (V1)

> Không phải bug — là feature chưa hoàn thiện. Cân nhắc khi rebuild.

1. **Notifications**: schema/UI hoàn chỉnh, nhưng **chưa có code nào gọi `NotificationsService.create`**. Cần wire-up event triggers (contract activated, invoice created, payment received, contract expiring, invoice overdue…).
2. **Refresh token tự động ở frontend**: axios interceptor chưa implement auto-retry với refresh khi 401. Hết hạn → user phải login lại.
3. **Auto-invoice**: chưa có cron tự tạo invoice định kỳ theo `nextPaymentDate`. User phải tạo tay.
4. **Invoice overdue check**: chưa có cron auto đổi PENDING/PARTIAL → OVERDUE khi quá `dueDate`.
5. **Reports/statistics module**: không có (revenue, occupancy, debt, tenant-stats…).
6. **External notification channels**: không có Zalo OA / Email / SMS.
7. **File upload pipeline**: `Room.images: string[]` defined but no upload endpoint/storage.
8. **Audit log**: không có log mutation nhạy cảm (terminate contract, edit invoice, change password…).
9. **Swagger / OpenAPI spec**: không generate auto từ controllers.
10. **Test coverage**: chỉ có 1 backend spec + 1 frontend unit + 3 e2e.

---

## 20. File Reference Map (quick lookup)

| Concern | Path |
|---------|------|
| Enums | `backend/src/common/constants/enums.ts` |
| Schemas | `backend/src/modules/{module}/schemas/{module}.schema.ts` |
| DTOs | `backend/src/modules/{module}/dto/{module}.dto.ts` |
| Controllers | `backend/src/modules/{module}/{module}.controller.ts` |
| Services | `backend/src/modules/{module}/{module}.service.ts` |
| Common utilities | `backend/src/common/{decorators,filters,guards,interceptors,utils}` |
| App bootstrap | `backend/src/main.ts`, `backend/src/app.module.ts` |
| i18n backend | `backend/src/i18n/{en,vi}/*.json` |
| Seed | `backend/src/scripts/seed.ts` |
| Frontend pages | `frontend/src/pages/{module}/*.tsx` |
| Forms | `frontend/src/components/forms/*.tsx` |
| UI primitives | `frontend/src/components/ui/*.tsx` |
| API client | `frontend/src/api/client.ts` |
| Stores | `frontend/src/stores/{auth,building,theme}Store.ts` |
| Hooks | `frontend/src/hooks/*.ts` |
| Validations | `frontend/src/lib/validations.ts` |
| Utils | `frontend/src/lib/utils.ts`, `frontend/src/lib/priceTableValidation.ts`, `frontend/src/lib/pdf-export.ts` |
| Routes | `frontend/src/App.tsx` |
| Layout | `frontend/src/layouts/DashboardLayout.tsx` |
| i18n frontend | `frontend/public/locales/{en,vi}/translation.json` |
| Tailwind tokens | `frontend/tailwind.config.js`, `frontend/src/index.css` |
| Vite config | `frontend/vite.config.ts` |
| Docker | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` |
| E2E | `frontend/e2e/{playwright.config.ts,fixtures.ts,tests/*}` |

---

> **Hướng dẫn sử dụng làm rebuild prompt**:
>
> 1. Copy toàn bộ file này vào prompt context.
> 2. Mô tả thêm về stack/framework muốn dùng cho V2 (giữ nguyên hay đổi).
> 3. Yêu cầu rebuild theo từng module (bắt đầu từ Auth → Buildings → Rooms → …).
> 4. Tham chiếu các Section cụ thể (ví dụ: "implement invoice creation theo Section 8.1").
> 5. Nếu muốn đổi schema, đối chiếu Section 5 để biết field nào đang được dùng ở đâu.
