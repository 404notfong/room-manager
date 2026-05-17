# Room Manager — Architecture Overview

> Hệ thống quản lý nhà trọ/phòng cho thuê toàn diện, hỗ trợ đa ngôn ngữ (Tiếng Anh & Tiếng Việt).

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│  React 18 + TypeScript + Vite                          │
│  Tailwind CSS + shadcn/ui + Lucide Icons               │
│  Zustand (auth/theme) + React Query (server state)     │
│  react-i18next + Zod validation                        │
│                                                         │
│  Port: 5173 (dev) / 80 (Docker)                        │
└───────────────┬─────────────────────────────────────────┘
                │ REST API (JSON)
                │ Authorization: Bearer <JWT>
                │ Headers: x-lang (vi/en)
┌───────────────▼─────────────────────────────────────────┐
│                      BACKEND                            │
│  NestJS 10 + TypeScript                                │
│  Passport JWT + class-validator                         │
│  nestjs-i18n + Winston logging                         │
│  Helmet (security headers)                             │
│                                                         │
│  Port: 3000 (prefix: /api)                             │
└───────────────┬─────────────────────────────────────────┘
                │ Mongoose ODM
┌───────────────▼─────────────────────────────────────────┐
│                    MONGODB                              │
│  Port: 27017 | DB: room-manager                        │
│  Collections: users, buildings, rooms, room-groups,    │
│  tenants, contracts, invoices, payments, services,     │
│  notifications                                         │
└─────────────────────────────────────────────────────────┘
```

## 2. Multi-Tenant Model

Tất cả entities đều có `ownerId` (ObjectId → User). Mỗi owner chỉ thấy dữ liệu của mình.

```
User (Owner/Staff)
 └── Buildings
      └── Rooms
           ├── Room Groups (phân loại)
           └── Contracts
                ├── Tenants
                ├── Invoices
                │    └── Payments
                └── Services (điện, nước, internet...)
```

## 3. Backend Modules

| Module | Endpoints | Mô tả |
|--------|-----------|-------|
| `auth` | 4 | Register, Login, Logout, Refresh token |
| `users` | 7 | Profile, CRUD users, change password |
| `buildings` | 5 | CRUD tòa nhà |
| `rooms` | 7 | CRUD phòng + dashboard stats + reorder + update indexes |
| `room-groups` | 5 | CRUD nhóm phòng |
| `tenants` | 6 | CRUD khách thuê + xem lịch sử |
| `contracts` | 8+ | CRUD hợp đồng + activate/terminate |
| `invoices` | 6 | CRUD hóa đơn + lấy theo contract |
| `payments` | 5 | CRUD thanh toán |
| `services` | 5 | CRUD dịch vụ (cố định/bậc thang, phạm vi ALL/SPECIFIC) |
| `notifications` | 4 | List, unread count, mark read, mark all read |
| `calendar` | 3 | Events, day detail, month summary |

**Tổng: ~65 API endpoints**

## 4. Backend Module Pattern

```
modules/{name}/
├── dto/
│   └── {name}.dto.ts          # CreateDto, UpdateDto (class-validator)
├── schemas/
│   └── {name}.schema.ts       # Mongoose schema (@Schema, @Prop)
├── {name}.controller.ts       # REST endpoints (@Controller, @Get, @Post...)
├── {name}.service.ts          # Business logic, database queries
└── {name}.module.ts           # NestJS module registration
```

**Conventions:**
- Soft delete: `isDeleted: boolean` (queries luôn filter `isDeleted: false`)
- Default sort: `createdAt: -1` (newest first)
- Reference fields: luôn dùng `Types.ObjectId`, convert trước khi query/save
- Global prefix: `/api`

## 5. Frontend Structure

```
frontend/src/
├── api/                  # Axios client + API functions
│   ├── client.ts         # Axios instance (JWT auto-attach, i18n header)
│   ├── auth.api.ts       # Auth endpoints
│   └── notifications.api.ts
├── components/
│   ├── ui/               # 28 shadcn/ui components (Button, Dialog, Table...)
│   ├── forms/            # 5 form components (Building, Room, RoomGroup, Service, Tenant)
│   ├── dashboard/        # 5 dashboard components (BigCalendar, RoomCard, DraggableRoomCard...)
│   └── common/           # Shared components (NotificationDropdown...)
├── hooks/                # 4 custom hooks (useToast, useColumnVisibility, useDebounce, useNotifications)
├── layouts/              # DashboardLayout (sidebar + header + main content)
├── lib/                  # utils.ts + validations.ts (Zod schemas + i18n)
├── pages/                # 10 page modules (11 routes)
├── stores/               # Zustand: authStore, buildingStore, themeStore
└── types/                # TypeScript type definitions
```

## 6. Frontend Routes

| Route | Page | Mô tả |
|-------|------|-------|
| `/login` | LoginPage | Đăng nhập |
| `/register` | RegisterPage | Đăng ký |
| `/` | DashboardPage | Tổng quan (overview + calendar + room cards) |
| `/buildings` | BuildingsPage | Quản lý tòa nhà |
| `/rooms` | RoomsPage | Quản lý phòng |
| `/room-groups` | RoomGroupsPage | Nhóm phòng |
| `/tenants` | TenantsPage | Quản lý khách thuê |
| `/tenants/:id/history` | TenantHistoryPage | Lịch sử khách thuê |
| `/contracts` | ContractsPage | Quản lý hợp đồng |
| `/invoices` | InvoicesPage | Quản lý hóa đơn |
| `/payments` | PaymentsPage | Quản lý thanh toán |
| `/services` | ServicesPage | Quản lý dịch vụ |

## 7. Key Enums

| Enum | Values | Mô tả |
|------|--------|-------|
| `UserRole` | OWNER, STAFF | Vai trò người dùng |
| `RoomType` | LONG_TERM, SHORT_TERM | Loại phòng |
| `RoomStatus` | AVAILABLE, OCCUPIED, MAINTENANCE, DEPOSITED | Trạng thái phòng |
| `ContractStatus` | DRAFT, ACTIVE, EXPIRED, TERMINATED | Trạng thái hợp đồng |
| `InvoiceStatus` | PENDING, PARTIAL, PAID, OVERDUE, CANCELLED | Trạng thái hóa đơn |
| `PaymentMethod` | CASH, BANK_TRANSFER, MOMO, ZALOPAY, OTHER | Phương thức thanh toán |
| `PaymentCycle` | MONTHLY, MONTHLY_2, QUARTERLY, MONTHLY_6, MONTHLY_12, CUSTOM | Kỳ thanh toán |
| `TenantStatus` | RENTING, ACTIVE, CLOSED, DEPOSITED | Trạng thái khách thuê |
| `ContractType` | LONG_TERM, SHORT_TERM, DAILY, MONTHLY | Loại hợp đồng |
| `ShortTermPricingType` | HOURLY, DAILY, FIXED | Cách tính giá ngắn hạn |
| `NotificationType` | SYSTEM, INVOICE, CONTRACT, PAYMENT, SERVICE | Loại thông báo |

## 8. Pricing Model

### Phòng dài hạn
- `defaultRoomPrice`: Giá phòng/tháng
- `defaultElectricPrice`, `defaultWaterPrice`: Giá điện/nước theo số
- `defaultTermMonths`: Kỳ hạn mặc định

### Phòng ngắn hạn
- **HOURLY**: Per hour hoặc bảng giá theo giờ (PriceTier)
- **DAILY**: Bảng giá theo ngày
- **FIXED**: Giá cố định

### Dịch vụ
- **FIXED**: Giá cố định
- **TABLE**: Bậc thang (lũy tiến PROGRESSIVE hoặc trọn gói FLAT)
- Phạm vi: ALL (toàn bộ) hoặc SPECIFIC (theo tòa nhà)

## 9. Auth & Security

- JWT access token (default 1h) + refresh token (default 7d)
- Passwords hashed with bcrypt
- Helmet security headers
- CORS configured per environment
- Rate limiting via `@nestjs/throttler`
- I18n validation pipe (auto-translate error messages)

## 10. i18n

| Layer | Library | Files |
|-------|---------|-------|
| Backend | nestjs-i18n | `backend/src/i18n/{en,vi}/*.json` (11 files each) |
| Frontend | react-i18next | `frontend/public/locales/{en,vi}/translation.json` |

Language detection: `Accept-Language` header + `x-lang` header (backend), localStorage + browser detection (frontend).

## 11. Deployment

- **Docker Compose**: 3 services (mongodb, backend, frontend)
- **MongoDB**: Port 27017, persistent volume `mongodb_data`
- **Backend**: Port 3000, production mode
- **Frontend**: Port 80 (nginx), production build
