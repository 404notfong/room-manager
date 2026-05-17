# Room Manager — V2 Overview & Rebuild Spec

> **Mục đích**: Tài liệu tổng quan dùng làm reference cho việc xây dựng lại (rebuild) Room Manager v2.
> **Phạm vi**: Tổng hợp domain model, kiến trúc, API surface hiện tại (V1) + đề xuất nâng cấp cho V2.
> **Ngày tạo**: 2026-05-04

---

## 1. Mục Tiêu Sản Phẩm

Hệ thống quản lý nhà trọ/phòng cho thuê đa-tenant (mỗi user là một chủ trọ), hỗ trợ:

- **2 mô hình thuê**: dài hạn (trọ tháng) & ngắn hạn (giờ/ngày/cố định)
- **Vòng đời đầy đủ**: tòa nhà → phòng → hợp đồng → khách thuê → hóa đơn → thanh toán
- **Đa ngôn ngữ**: VI (mặc định) + EN
- **Multi-tenant**: dữ liệu tách biệt theo `ownerId`
- **Tự động hóa**: tạo hóa đơn định kỳ, nhắc thanh toán, tính bậc thang dịch vụ

---

## 2. Domain Model (Stable — giữ nguyên cho V2)

```
User (Owner/Staff)
 └── Building (tòa nhà)
      └── Room (phòng) ──── RoomGroup (nhóm phòng — VIP, thường, …)
           │
           └── Contract (hợp đồng) ── Tenant (khách thuê)
                ├── Invoice (hóa đơn) ── Payment (thanh toán)
                └── ServiceCharge (phí dịch vụ snapshot từ Service catalog)

Service (catalog: điện/nước/internet/…) — buildingScope: ALL | SPECIFIC
Notification — SYSTEM | INVOICE | CONTRACT | PAYMENT | SERVICE
Calendar — view tổng hợp events theo ngày/tháng
```

### Enums Chốt (`backend/src/common/constants/enums.ts`)

| Enum | Values |
|------|--------|
| `UserRole` | OWNER, STAFF |
| `RoomType` | LONG_TERM, SHORT_TERM |
| `RoomStatus` | AVAILABLE, OCCUPIED, MAINTENANCE, DEPOSITED |
| `TenantStatus` | RENTING, ACTIVE, CLOSED, DEPOSITED |
| `ContractType` | LONG_TERM, SHORT_TERM, DAILY, MONTHLY |
| `ContractStatus` | DRAFT, ACTIVE, EXPIRED, TERMINATED |
| `PaymentCycle` | MONTHLY, MONTHLY_2, QUARTERLY, MONTHLY_6, MONTHLY_12, CUSTOM |
| `InvoiceType` | REGULAR, FINAL |
| `InvoiceStatus` | PENDING, PARTIAL, PAID, OVERDUE, CANCELLED |
| `PaymentMethod` | CASH, BANK_TRANSFER, MOMO, ZALOPAY, DEPOSIT_DEDUCTION, OTHER |
| `ShortTermPricingType` | HOURLY, DAILY, FIXED |
| `PriceTableType` | PROGRESSIVE (lũy tiến), FLAT (trọn gói) |
| `Gender` | MALE, FEMALE, OTHER |

### Pricing Model (then & V2 vẫn giữ)

**Phòng dài hạn** — `defaultRoomPrice/defaultElectricPrice/defaultWaterPrice/defaultTermMonths`.

**Phòng ngắn hạn** — 3 chế độ:
- `HOURLY` × { `PER_HOUR` (1 giá/giờ) | `TABLE` (bảng giờ) }
- `DAILY` × bảng giá theo ngày
- `FIXED` × giá cố định

**PriceTier** (sub-doc dùng chung cho Room & Service):
```ts
{ fromValue, toValue, price }   // toValue = -1 → "còn lại"
```

**Service** — `priceType: FIXED | TABLE`, `buildingScope: ALL | SPECIFIC`, có `priceTiers` (bậc thang PROGRESSIVE/FLAT).

---

## 3. V1 — Trạng Thái Hiện Tại (Snapshot tham chiếu)

### Stack
- **Backend**: NestJS 10 + Mongoose 8 + Passport JWT + nestjs-i18n + Winston + Helmet + Throttler
- **Frontend**: React 18 + Vite 5 + Tailwind + Radix UI (shadcn) + Zustand + React Query 5 + Zod + react-i18next + react-hook-form
- **DB**: MongoDB
- **Deploy**: Docker Compose (3 services: mongo / backend / frontend-nginx)

### Backend Modules (12)
`auth`, `users`, `buildings`, `rooms`, `room-groups`, `tenants`, `contracts`, `invoices`, `payments`, `services`, `notifications`, `calendar`. **~65 endpoints** (xem `docs/API.md` cho chi tiết).

### Frontend Routes (V1)
`/login`, `/register`, `/`, `/buildings`, `/rooms`, `/room-groups`, `/tenants`, `/tenants/:id/history`, `/contracts`, `/invoices`, `/payments`, `/services`.

### Conventions (đã ổn định, V2 phải giữ)
- Soft delete: `isDeleted: boolean` — query luôn filter `isDeleted: false`
- Default sort: `createdAt: -1`
- Reference fields: PHẢI dùng `Types.ObjectId` + `ref` ở schema, convert string → ObjectId trước khi query/save
- Multi-tenant: mọi entity có `ownerId` (indexed), service luôn filter theo `ownerId`
- Action buttons trong table: ghost icon trực tiếp, không dropdown
- Submit button: bắt buộc loading state với `Loader2` + `disabled`
- Mobile-first responsive (`sm/md/lg/xl`); tap target ≥ 44px

### i18n
- Backend: `backend/src/i18n/{en,vi}/*.json` (11 namespace files mỗi ngôn ngữ) — auth, buildings, common, contracts, fields, invoices, payments, rooms, tenants, users, validation
- Frontend: `frontend/public/locales/{en,vi}/translation.json` (1 file phẳng)
- Detection: `Accept-Language` + `x-lang` (BE), localStorage + browser (FE)

---

## 4. V1 Pain Points & Gaps (chính là động lực V2)

| # | Pain Point | Tham chiếu |
|---|------------|------------|
| 1 | Toàn bộ form nằm trong Modal/Dialog → trải nghiệm trên mobile/tablet kém, khó deep link/share URL | `docs/PLAN-modal-to-pages.md` (18 routes mới) |
| 2 | Không có module reports/statistics chuyên biệt — không có doanh thu, công nợ, tỉ lệ lấp phòng | `docs/PLAN-reports-zalo.md` Phase A |
| 3 | Notification chỉ polling — chưa real-time (SSE/WebSocket) | Phase B Sprint 4 |
| 4 | Chưa có integration kênh thông báo bên ngoài (Zalo OA, Email, SMS) | Phase B |
| 5 | Refresh token flow ở frontend chưa hoàn tất tự động — JWT hết hạn user phải login lại | `docs/SETUP.md` §4 |
| 6 | Đóng hợp đồng dài hạn chưa hỗ trợ "hóa đơn cuối" + trừ cọc/hoàn cọc | `docs/PLAN-contract-closure.md` (đã có plan, chưa ship) |
| 7 | Chưa có export PDF/Excel cho hóa đơn & báo cáo | Phase A |
| 8 | Chưa có audit log/activity log cho actions quan trọng (terminate contract, edit invoice…) | Mới |
| 9 | Backend frontend translations dạng "JSON phẳng" — khó scale; thiếu tooling kiểm tra missing keys | Mới |
| 10 | Chưa có tự động tạo hóa đơn định kỳ (cron) — user phải tạo tay mỗi tháng | Mới |
| 11 | Chưa có file storage/CDN — `images: string[]` trong Room schema chưa có pipeline upload | Mới |
| 12 | Chưa có test coverage chính thức (jest unit, e2e Playwright mới setup) | `docs/SETUP.md` §3 |

---

## 5. V2 — Mục Tiêu & Phạm Vi

### Nguyên Tắc
1. **Giữ domain model & enums** — đừng đập DB, viết migration nếu phải đổi.
2. **Giữ API contract chính** — thêm endpoint mới ok, đừng phá `/api/*` đang dùng. Nếu đổi phá → version `/api/v2/*`.
3. **Cải thiện DX/UX**: Modal → Pages, real-time, reports, automation.
4. **Mọi thay đổi phải multi-tenant safe** — luôn filter `ownerId`.

### Goals (theo độ ưu tiên)

**P0 — Foundation (ship trước)**
- [ ] **Page-based UX**: chuyển 18 modal thành route pages (`docs/PLAN-modal-to-pages.md`).
- [ ] **Refresh token tự động** ở axios interceptor (frontend).
- [ ] **Contract closure with FINAL invoice + deposit deduction** (`docs/PLAN-contract-closure.md`).
- [ ] **Cron auto-invoice**: backend job tạo invoice định kỳ theo `paymentCycle` của contract; gửi notification.

**P1 — Reports & Insights**
- [ ] Module `reports`: revenue / occupancy / debt / tenant-stats / service-usage / contract-summary.
- [ ] Frontend reports pages (charts, filter range/building, export PDF/Excel).
- [ ] Audit log module (user, action, entityType, entityId, before/after, timestamp).

**P2 — Real-time & External Channels**
- [ ] SSE notifications stream (`/api/notifications/stream`) thay polling.
- [ ] Zalo OA module: OAuth link tenant, send invoice notify, overdue reminder, payment confirm.
- [ ] Email transactional (SendGrid/Postmark) — tùy chọn cho user EN.

**P3 — Quality & Operations**
- [ ] File upload pipeline (S3/MinIO) cho `Room.images`, `Tenant.identityImage`, contract scans.
- [ ] Test coverage: BE unit ≥ 60%, FE component test cho forms, Playwright e2e cho 5 happy paths.
- [ ] OpenAPI/Swagger generated từ NestJS controllers (currently chưa có spec chính thức).
- [ ] CI/CD: GitHub Actions (lint + test + build) trước merge `main`.

### Non-Goals (V2 không làm)
- Đập đổi DB schema cốt lõi (Room/Contract/Invoice).
- Thay đổi auth model (JWT vẫn ok, không chuyển OAuth toàn hệ thống).
- Multi-currency / international (vẫn VND-only).
- Mobile app native (PWA-friendly responsive là đủ).

---

## 6. Tech Stack V2 (đề xuất)

Giữ nguyên 95% V1 — chỉ bổ sung nơi có gap rõ ràng.

| Layer | V1 | V2 đề xuất | Lý do |
|-------|----|------------|-------|
| BE framework | NestJS 10 | NestJS 10 (giữ) hoặc 11 nếu LTS đã ổn | Stable |
| ODM | Mongoose 8 | Mongoose 8 | Stable |
| Auth | Passport JWT | Passport JWT + **refresh rotation** | Bảo mật |
| Validation | class-validator | class-validator | Stable |
| API spec | — | **Swagger** (`@nestjs/swagger`) | Self-documenting |
| Background jobs | — | **BullMQ + Redis** (cron auto-invoice, email/zalo queue) | Reliable jobs |
| Realtime | — | **SSE** (đơn giản hơn WS, đủ dùng) | Notification stream |
| File storage | — | **MinIO** (self-host) hoặc S3 | Images, scans |
| Cache | — | Redis (kèm BullMQ) | Throttling, sessions |
| FE framework | React 18 + Vite 5 | React 18 + Vite 5 | Stable |
| State | Zustand + React Query | giữ | Đã đủ |
| Forms | RHF + Zod | giữ | Đã đủ |
| Charts | — | **Recharts** | Reports |
| Export | jspdf (đã có) + html2canvas | + **xlsx** | Excel export |
| i18n | nestjs-i18n + react-i18next | giữ + **lint missing keys** (script CI) | Tooling |
| Testing | Jest + Vitest + Playwright | giữ + **viết test thực sự** | Quality |
| Observability | Winston | + **structured logging** + request-id correlation | Debug |
| Deploy | Docker Compose | + **healthchecks** + Redis + MinIO services | Ops |

---

## 7. Đề Xuất Schema Bổ Sung Cho V2

### 7.1 Audit Log (mới)
```ts
@Schema({ timestamps: true })
class AuditLog {
  ownerId: ObjectId;          // multi-tenant
  actorId: ObjectId;          // user thực hiện
  action: string;             // CONTRACT_TERMINATE, INVOICE_DELETE, ...
  entityType: string;         // Contract, Invoice, ...
  entityId: ObjectId;
  before: Record<string, any>;
  after: Record<string, any>;
  ip?: string;
  userAgent?: string;
}
```

### 7.2 Tenant — bổ sung Zalo
```ts
@Prop({ type: String, default: null }) zaloUserId: string;
@Prop({ type: Boolean, default: false }) zaloLinked: boolean;
@Prop({ type: String, default: null }) email: string; // for transactional email
```

### 7.3 Notification — bổ sung kênh
```ts
@Prop({ type: [String], default: ['IN_APP'] }) channels: ('IN_APP' | 'ZALO' | 'EMAIL')[];
@Prop({ type: Object }) deliveryStatus: { zalo?: 'SENT' | 'FAILED'; email?: 'SENT' | 'FAILED' };
```

### 7.4 Invoice — đã có FINAL + adjustments + contractSnapshot, V2 thêm:
```ts
@Prop({ type: Boolean, default: false }) autoGenerated: boolean;  // do cron tạo
@Prop({ type: String, default: null }) generatedFromJobId: string;
```

### 7.5 Settings (per-owner, mới)
```ts
@Schema({ timestamps: true })
class OwnerSettings {
  ownerId: ObjectId;
  invoiceAutoCreate: boolean;
  invoiceAutoCreateDayOfMonth: number; // 1-28
  notificationChannels: { invoice: ('IN_APP'|'ZALO'|'EMAIL')[]; ... };
  zaloOA: { connected: boolean; oaId?: string; accessTokenEnc?: string };
  invoiceTemplate?: string;        // Markdown/HTML template
}
```

---

## 8. API Surface — V2 Diff

### Mới
```
GET    /api/reports/revenue
GET    /api/reports/occupancy
GET    /api/reports/debt
GET    /api/reports/tenant-stats
GET    /api/reports/service-usage
GET    /api/reports/contract-summary
GET    /api/reports/export/:type           # PDF/Excel

GET    /api/notifications/stream           # SSE
GET    /api/audit-logs                     # filter by entityType/entityId
GET    /api/audit-logs/:id

GET    /api/zalo/auth-url
GET    /api/zalo/callback
POST   /api/zalo/send-message
POST   /api/zalo/send-invoice
GET    /api/zalo/status

GET    /api/settings
PUT    /api/settings

POST   /api/uploads/sign                   # presigned URL cho client upload
DELETE /api/uploads/:key
```

### Đổi/Mở rộng
- `POST /api/invoices` — chấp nhận `invoiceType=FINAL` (không yêu cầu `billingPeriod` chuẩn).
- `PATCH /api/contracts/:id/terminate` — body thêm `{ createFinalInvoice, invoiceData, applyDeposit }`.
- Tất cả `POST /auth/refresh` — rotate refresh token (revoke cái cũ).

### Giữ nguyên
12 module hiện có (xem `docs/API.md`).

---

## 9. Frontend V2 — UX Roadmap

### Routes V2 (Modal → Page)

> Theo `docs/PLAN-modal-to-pages.md`, Sprint 1-6.

```
/buildings/new, /buildings/:id/edit
/rooms/new, /rooms/:id/edit
/tenants/new, /tenants/:id/edit
/services/new, /services/:id/edit
/room-groups/new, /room-groups/:id/edit
/contracts/new, /contracts/:id, /contracts/:id/edit, /contracts/:id/terminate
/invoices/new (long-term flow 2 bước), /invoices/new/short-term
/invoices/:id, /invoices/:id/payment
/reports                         # mới
/settings                        # mới
/settings/zalo                   # mới
/audit-logs                      # mới (admin)
```

Vẫn giữ confirm dialog nhỏ (delete, activate contract).

### Patterns chuẩn V2
- **Form pages** dùng `<div class="container max-w-3xl">` + breadcrumb + back button + Card.
- **Detail pages** (`/invoices/:id`, `/contracts/:id`) dùng layout 2 cột (info + actions).
- **List pages** giữ filter bar + table + pagination như V1.
- **Skeleton loading** cho mọi edit page khi fetch.
- **404 handling** cho invalid IDs.

---

## 10. Cron / Background Jobs (mới ở V2)

| Job | Schedule | Mô tả |
|-----|----------|-------|
| `auto-invoice-monthly` | 1 lần/ngày 06:00 | Quét contracts ACTIVE, nếu `nextPaymentDate <= today` → tạo invoice REGULAR + notification |
| `invoice-overdue-check` | 1 lần/ngày 07:00 | Đổi status `PENDING/PARTIAL` → `OVERDUE` nếu `dueDate < today`; gửi nhắc Zalo/email |
| `contract-expiring-warn` | 1 lần/ngày 08:00 | Contract `endDate` trong 7 ngày → notify owner |
| `zalo-message-queue` | on-demand | BullMQ worker gửi tin Zalo (retry 3 lần) |
| `email-queue` | on-demand | BullMQ worker gửi email transactional |

---

## 11. Security & Compliance Checklist V2

- [ ] Refresh token rotation + revocation list (Redis).
- [ ] Rate limit chặt cho `/auth/login` (5 req/15 phút/IP).
- [ ] Helmet CSP đã bật, audit lại với images/CDN external.
- [ ] CORS allowlist từ env, không `*`.
- [ ] Mongo queries luôn filter `ownerId` — viết unit test phòng leak cross-tenant.
- [ ] Password policy ≥ 8 chars, hash bcrypt cost 12.
- [ ] Audit log mọi mutation nhạy cảm (terminate, delete invoice, change password).
- [ ] PII (CCCD, phone, ảnh) — log không in giá trị, mã hóa cột nếu cần.
- [ ] Zalo access token mã hóa AES-256 trong DB.
- [ ] Upload: validate mime + size + virus scan (clamav optional).

---

## 12. Migration Plan V1 → V2

1. **Branch model**: feature branches → `develop` → `main`. V2 không cần long-lived `v2` branch nếu schema không phá.
2. **Schema migrations**: Thêm field optional với default → safe. Nếu rename hoặc đổi enum → viết script trong `backend/src/scripts/migrate-vN.ts`.
3. **API compat**: V2 thêm endpoints mới, giữ V1 endpoints cho rollback.
4. **Frontend**: ship Modal-to-Pages từng module (Sprint 1-6) — không phải big bang.
5. **Data backfill**:
   - `OwnerSettings` cho user hiện có (default values).
   - `Tenant.email`, `Tenant.zaloUserId` = null OK.
   - `AuditLog` chỉ ghi từ V2 trở đi (không backfill).
6. **Feature flags** (env hoặc per-owner setting):
   - `FEATURE_AUTO_INVOICE`, `FEATURE_ZALO`, `FEATURE_REPORTS`.

---

## 13. Sprints Đề Xuất (V2 Roadmap, ~10-12 tuần)

| Sprint | Tuần | Nội dung |
|--------|------|----------|
| S1 | 1-2 | Modal→Page (Buildings, RoomGroups, Tenants, Services) — `PLAN-modal-to-pages` S1+S2 |
| S2 | 3-4 | Modal→Page (Rooms, Contracts) — S3+S4 |
| S3 | 5 | Modal→Page (Invoices flow 2 bước + Payment) — S5+S6 |
| S4 | 6 | Contract closure + FINAL invoice + deposit deduction (`PLAN-contract-closure`) |
| S5 | 7 | Refresh token rotation + audit log + cron `auto-invoice-monthly` + `overdue-check` |
| S6 | 8-9 | Reports backend + frontend (`PLAN-reports-zalo` Phase A) |
| S7 | 10 | SSE notifications + Settings page |
| S8 | 11 | Zalo OA integration (`PLAN-reports-zalo` Phase B) |
| S9 | 12 | File upload (MinIO) + Swagger + CI + e2e tests |

---

## 14. Tài Liệu Liên Quan

- `docs/ARCHITECTURE.md` — kiến trúc V1 chi tiết (giữ làm baseline)
- `docs/API.md` — full API V1 (~65 endpoints)
- `docs/SETUP.md` — local + Docker setup
- `docs/PLAN-modal-to-pages.md` — chi tiết refactor Modal → Page
- `docs/PLAN-contract-closure.md` — flow đóng hợp đồng + FINAL invoice
- `docs/PLAN-reports-zalo.md` — module reports + Zalo OA
- `design-system/MASTER.md` — design tokens (color, typography, spacing)
- `design-system/room-manager/MASTER.md` — design system cụ thể của project
- `CLAUDE.md` — agent guidelines, conventions, code style

---

## 15. Open Questions (cần chốt trước khi rebuild)

1. **Có giữ MongoDB hay đổi sang PostgreSQL?** — Mongoose hiện đáp ứng tốt; đổi DB là big migration. Khuyến nghị: **giữ MongoDB**.
2. **Có cần multi-currency?** — Hiện chỉ VND, schema không hỗ trợ. Khuyến nghị: **không, V2**.
3. **Auth: chỉ JWT, hay bổ sung OAuth (Google/Facebook)?** — Khuyến nghị: thêm Google OAuth optional ở P3.
4. **Background jobs: BullMQ + Redis hay NestJS Schedule + cron?** — Khuyến nghị: **BullMQ** cho retry + DLQ; `@nestjs/schedule` cho trigger.
5. **File storage: S3 thật hay MinIO self-host?** — Khuyến nghị: **MinIO** dev; S3-compatible env-based prod.
6. **Reports: gen on-fly hay precompute (materialized view)?** — Khuyến nghị: on-fly với MongoDB aggregation cho < 100k records; precompute nếu chậm.

---

> **Next step**: Reviewer xác nhận scope V2 → tạo issue/epic trong tracker theo Sprint S1-S9 ở §13.
