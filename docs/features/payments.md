# Payments Playbook

> **Vai trò trong domain**: Module Payments ghi nhận các lần thanh toán thực tế của khách thuê cho một Invoice, đồng thời tự động cập nhật trạng thái và số tiền đã thanh toán của Invoice đó.
> **Code paths**: `backend/src/modules/payments/`, `frontend/src/components/RecordPaymentModal.tsx`, `frontend/src/pages/payments/PaymentsPage.tsx`

---

## 1. Purpose & Relations

- Mỗi `Payment` gắn với đúng một `Invoice` (quan hệ nhiều-một).
- Một `Invoice` có thể có nhiều `Payment` (thanh toán từng phần — partial payments).
- Sau mỗi thao tác tạo / sửa / xóa Payment, service **tự tính lại** `paidAmount`, `remainingAmount`, và `status` của Invoice liên quan.
- Payment cũng mang tham chiếu đến `Contract` và `Tenant` được sao chép từ Invoice khi tạo, giúp truy vấn nhanh mà không cần join ngược.

---

## 2. Data Model

### Schema (`payment.schema.ts`)

| Field | Type (Mongoose) | Required | Default | Mô tả |
|---|---|---|---|---|
| `ownerId` | `Types.ObjectId` → `User` | ✓ | — | Multi-tenant owner; index |
| `invoiceId` | `Types.ObjectId` → `Invoice` | ✓ | — | Hóa đơn được thanh toán; index |
| `contractId` | `Types.ObjectId` → `Contract` | ✓ | — | Hợp đồng liên quan; index (sao chép từ Invoice khi tạo) |
| `tenantId` | `Types.ObjectId` → `Tenant` | ✓ | — | Khách thuê; index (sao chép từ Invoice khi tạo) |
| `amount` | `number` | ✓ | `0` | Số tiền thanh toán |
| `paymentMethod` | `PaymentMethod` (enum) | — | `CASH` | Phương thức thanh toán |
| `paymentDate` | `Date` | ✓ | — | Ngày thanh toán thực tế |
| `transactionId` | `string` | — | — | Mã giao dịch (bank/ví điện tử), trim |
| `notes` | `string` | — | — | Ghi chú tự do, trim |
| `receivedBy` | `Types.ObjectId` → `User` | — | — | Người thu tiền (hiện tại = user tạo Payment) |
| `isDeleted` | `boolean` | — | `false` | Soft-delete flag |
| `createdAt`, `updatedAt` | `Date` | — | auto | Mongoose timestamps |

**Compound indexes** được khai báo thêm:
- `{ ownerId: 1, isDeleted: 1 }`
- `{ invoiceId: 1 }`, `{ contractId: 1 }`, `{ tenantId: 1 }`, `{ paymentDate: 1 }`

### Enums liên quan (`enums.ts`)

```typescript
export enum PaymentMethod {
    CASH               = 'CASH',
    BANK_TRANSFER      = 'BANK_TRANSFER',
    MOMO               = 'MOMO',
    ZALOPAY            = 'ZALOPAY',
    DEPOSIT_DEDUCTION  = 'DEPOSIT_DEDUCTION',
    OTHER              = 'OTHER',
}
```

> **TODO [frontend-gap]**: `ZALOPAY` tồn tại trong enum backend nhưng **không** có trong `PAYMENT_METHODS` constant của `RecordPaymentModal.tsx` và không có i18n key `payments.method_zalopay` trong `translation.json` (vi). Cần bổ sung để UI không hiển thị fallback key khi có payment cũ với method `ZALOPAY`.

### DTO Validation

#### `CreatePaymentDto`
| Field | Decorators | Bắt buộc |
|---|---|---|
| `invoiceId` | `@IsMongoId()`, `@IsNotEmpty()` | ✓ |
| `contractId` | `@IsMongoId()`, `@IsNotEmpty()` | ✓ |
| `tenantId` | `@IsMongoId()`, `@IsNotEmpty()` | ✓ |
| `amount` | `@IsNumber()`, `@IsNotEmpty()` | ✓ |
| `paymentMethod` | `@IsEnum(PaymentMethod)`, `@IsOptional()` | — |
| `paymentDate` | `@IsDate()`, `@Type(() => Date)`, `@IsNotEmpty()` | ✓ |
| `transactionId` | `@IsString()`, `@IsOptional()` | — |
| `notes` | `@IsString()`, `@IsOptional()` | — |

> **TODO [validation-gap]**: DTO không có `@Min(1)` trên `amount`. Giới hạn này được enforce ở tầng service (kiểm tra `amount > currentRemaining` nhưng không kiểm tra `amount <= 0` tường minh). Nên thêm `@IsPositive()` hoặc `@Min(1)` vào DTO.

#### `UpdatePaymentDto`
| Field | Decorators | Bắt buộc |
|---|---|---|
| `amount` | `@IsNumber()`, `@IsOptional()` | — |
| `paymentMethod` | `@IsEnum(PaymentMethod)`, `@IsOptional()` | — |
| `notes` | `@IsString()`, `@IsOptional()` | — |

> **Lưu ý**: `UpdatePaymentDto` chỉ cho phép sửa `amount`, `paymentMethod`, `notes`. Không thể đổi `invoiceId`, `paymentDate`, hay `transactionId` sau khi tạo.

#### `PaymentQueryDto` (extends `PaginationDto`)
| Field | Decorators | Mô tả |
|---|---|---|
| `search` | `@IsOptional()`, `@IsString()` | Tìm theo `invoiceNumber` hoặc `tenantId.fullName` |
| `buildingId` | `@IsOptional()`, `@IsMongoId()` | Lọc theo tòa nhà (join qua invoice → room → building) |

---

## 3. API Endpoints

Tất cả routes yêu cầu `JwtAuthGuard`. `ownerId` lấy từ JWT (`user.userId`).

| Method | Path | Mô tả | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/api/payments` | Tạo payment mới, cập nhật Invoice | `CreatePaymentDto` | `Payment` object |
| `GET` | `/api/payments` | Danh sách payments (paginated + filter) | Query: `PaymentQueryDto` | `{ data: Payment[], meta: PaginationMeta }` |
| `GET` | `/api/payments/:id` | Chi tiết một payment (populate invoice, contract, tenant) | — | `Payment` object |
| `PUT` | `/api/payments/:id` | Cập nhật amount/method/notes, tái tính Invoice | `UpdatePaymentDto` | `Payment` object |
| `DELETE` | `/api/payments/:id` | Soft-delete payment, rollback Invoice | — | `void` |

### Populated response shape (`GET /api/payments`)

`findAll` dùng MongoDB aggregation pipeline với `$lookup` lồng nhau:

```
Payment
  → invoiceId (Invoice)
      → roomId (Room)
          → buildingId (Building)
  → contractId (Contract)
  → tenantId (Tenant)
```

Frontend đọc `payment.invoice.invoiceNumber` (alias field `invoice` = `invoiceId` được thêm qua `$addFields`).

### Sort keys hợp lệ cho `GET /api/payments`

| `sortBy` query value | Mongo sort thực tế |
|---|---|
| `invoice` | `invoiceId.invoiceNumber`, tiebreak `paymentDate desc` |
| `amount` | `amount`, tiebreak `paymentDate desc` |
| `method` | `paymentMethod`, tiebreak `paymentDate desc` |
| `date` | `paymentDate`, tiebreak `_id asc` |
| `createdAt` | `createdAt` |
| _(mặc định)_ | `paymentDate desc` |

---

## 4. Business Rules & State Machine

### Invariants

- `amount` phải > 0 (enforce tại service; **TODO**: thêm decorator DTO — xem mục 2).
- `invoiceId` phải thuộc cùng `ownerId` với user đang đăng nhập.
- Không thể tạo payment cho Invoice có status `PAID` hoặc `CANCELLED`.
- `amount` không được vượt quá `invoice.totalAmount - invoice.paidAmount` (số tiền còn lại).

### Auto Invoice Sync — Logic tái tính status

Logic này được dùng đồng nhất ở cả ba operation (create, update, delete):

```
newPaidAmount = invoice.paidAmount ± delta
newRemainingAmount = invoice.totalAmount - newPaidAmount

if newPaidAmount >= invoice.totalAmount → status = PAID  (+ paidDate = now)
else if newPaidAmount > 0              → status = PARTIAL
else if invoice.dueDate < now          → status = OVERDUE
else                                   → status = PENDING
```

**Create**: `delta = +createPaymentDto.amount`; `paidDate` được set khi status chuyển sang `PAID`.

**Update** (khi `amount` thay đổi): `delta = newAmount - oldAmount`; `Math.max(0, newPaidAmount)` để tránh âm.

**Delete**: `delta = -payment.amount`; `Math.max(0, newPaidAmount)` để tránh âm; `paidDate` **không** được reset về `null` khi rollback từ PAID (TODO).

### DEPOSIT_DEDUCTION

`DEPOSIT_DEDUCTION` là một giá trị của `PaymentMethod`, không phải một flow riêng biệt ở tầng backend hiện tại. Nghĩa là:

- Backend **không** tự động trừ `Contract.depositAmount` khi tạo payment với method này.
- Đây là phương thức mang tính **khai báo** (ghi nhận rằng khoản tiền đến từ tiền cọc), không có side-effect đặc biệt nào trong `PaymentsService`.
- Việc điều chỉnh deposit trên Contract là thủ công / thuộc về luồng đóng hợp đồng (contract closure).

> **TODO [deposit-deduction]**: Nếu cần enforce tự động trừ `Contract.depositAmount`, cần inject `ContractModel` vào `PaymentsService` và thêm validation: `amount <= contract.depositAmount` khi method là `DEPOSIT_DEDUCTION`.

> **TODO [frontend-gap]**: `RecordPaymentModal` không expose `DEPOSIT_DEDUCTION` và `ZALOPAY` trong `PAYMENT_METHODS` constant. Chỉ có: `CASH`, `BANK_TRANSFER`, `MOMO`, `OTHER`.

---

## 5. Frontend Touchpoints

### Pages

**`frontend/src/pages/payments/PaymentsPage.tsx`**

- Route: `/payments` (xem trong `App.tsx`).
- Hiển thị danh sách tất cả payments của owner, có search (theo invoice number hoặc tên tenant), filter theo building, sort theo 4 cột, phân trang.
- Responsive: card view trên mobile (`md:hidden`), table view trên desktop (`hidden md:block`).
- Action duy nhất từ trang này: **Delete** (soft-delete có confirm dialog).
- Không có nút "Tạo payment" trực tiếp — việc tạo payment được thực hiện từ `InvoiceViewModal` / `RecordPaymentModal`.
- `paymentMethod` từ API có thể ở dạng chữ thường hoặc hoa; frontend normalize về lowercase trước khi render badge (`normalizePaymentMethod`).

### Components

**`frontend/src/components/RecordPaymentModal.tsx`**

- Được mở từ trang Invoices khi user muốn ghi nhận thanh toán cho một Invoice cụ thể.
- Props: `open`, `onOpenChange`, `invoice` (object), `onSuccess`.
- Hiển thị summary Invoice (total, paid, remaining) trước khi nhập.
- Input `amount` dùng thousand-separator formatting (`formatNumberInput` / `parseFormattedNumber`).
- Nút "Thanh toán hết" (`payFull`) tự điền `remainingAmount` vào field amount.
- Client-side validation: `amount > 0` và `amount <= remainingAmount`.
- Sau khi tạo thành công: invalidate query keys `['invoices']` và `['payments']`.
- **Không** dùng react-hook-form / Zod; dùng local `useState` cho từng field.

### Key i18n Keys (`payments.*`)

| Key | VI |
|---|---|
| `payments.title` | Quản lý thanh toán |
| `payments.record` | Ghi nhận thanh toán |
| `payments.amount` | Số tiền |
| `payments.method` | Phương thức |
| `payments.date` | Ngày |
| `payments.notes` | Ghi chú |
| `payments.transactionId` | Mã giao dịch |
| `payments.payFull` | Thanh toán hết |
| `payments.method_cash` | Tiền mặt |
| `payments.method_bank_transfer` | Chuyển khoản |
| `payments.method_momo` | MoMo |
| `payments.method_deposit_deduction` | Trừ cọc |
| `payments.method_other` | Khác |
| `payments.invalidAmount` | Vui lòng nhập số tiền hợp lệ |
| `payments.amountExceedsRemaining` | Số tiền không được vượt quá số còn lại ({{amount}}) |
| `payments.recordSuccess` | Ghi nhận thanh toán thành công |
| `payments.deleteSuccess` | Xóa thanh toán thành công |

> **TODO [i18n-missing]**: Không có key `payments.method_zalopay` trong cả `vi/translation.json` và `en/translation.json`.

---

## 6. Cross-Module Dependencies

### Module này CẦN (inject/import)

| Dependency | Lý do |
|---|---|
| `Invoice` model | Đọc invoice để validate + cập nhật `paidAmount`/`status` |
| `User` (qua JWT) | `ownerId` và `receivedBy` filter |

`PaymentsModule` import `MongooseModule.forFeature([Payment, Invoice])` — không inject thêm module nào khác.

### Module khác CẦN Payment

| Module | Cách sử dụng |
|---|---|
| `InvoicesModule` | Import `PaymentSchema` trực tiếp (không qua `PaymentsModule`) — `InvoicesService` tạo deposit payment bằng PaymentModel; `InvoiceViewModal` mở `RecordPaymentModal` ở frontend |
| `ContractsModule` | Import `PaymentSchema` trực tiếp — đếm invoice/payment trước khi cập nhật meter index |
| `TenantsModule` | Import `PaymentSchema` trực tiếp — query payment history trong `getHistory()` |

> **Lưu ý**: `PaymentsModule` export `PaymentsService` nhưng hiện tại **không có NestJS module nào import `PaymentsModule`** ngoài `AppModule`. Các module khác dùng `PaymentSchema` trực tiếp qua `MongooseModule.forFeature`. `PaymentsService` export sẵn sàng nếu cần tích hợp sau này.

### Module chưa tích hợp (potential)

- **Notifications**: Chưa có event phát ra sau khi payment thành công.
- **Reports**: Chưa có aggregate endpoint thống kê doanh thu theo thời gian / building.
- **Contract Closure**: `DEPOSIT_DEDUCTION` chưa tự động sync với `Contract.depositAmount`.

---

## 7. Gotchas & Testing Notes

### Pitfalls

1. **`receivedBy` luôn = `ownerId`**: Controller truyền `user.userId` cho cả hai tham số `create(user.userId, user.userId, ...)`. Đây là placeholder — chưa hỗ trợ staff ghi nhận thay owner.

2. **ZALOPAY không có UI**: Enum có `ZALOPAY` nhưng `RecordPaymentModal` không liệt kê. Nếu import dữ liệu cũ có payment method `ZALOPAY`, badge trên `PaymentsPage` sẽ hiển thị key `payments.method_zalopay` thay vì text.

3. **`paidDate` không reset khi xóa payment**: Khi xóa payment khiến Invoice rollback từ `PAID` về `PARTIAL`/`PENDING`, field `paidDate` trên Invoice **không được xóa**. Cần `$unset: { paidDate: 1 }` trong trường hợp này.

4. **Race condition khi tạo nhiều payment đồng thời**: Không có transaction/lock. Nếu hai request cùng ghi payment cho một invoice cùng lúc, cả hai đều đọc `paidAmount` cũ và có thể vượt quá `totalAmount`. Cần MongoDB transaction hoặc optimistic locking.

5. **`amount` âm không bị chặn ở DTO**: Chỉ có check `amount > currentRemaining` trong service; nếu `amount = 0` hoặc `amount` âm được gửi lên, sẽ bị lọt qua DTO validation.

6. **`UpdatePaymentDto` không cho sửa `paymentDate` và `transactionId`**: Field bị bỏ qua nếu gửi lên.

### Test Scenarios Cần Cover

| Scenario | Kết quả mong đợi |
|---|---|
| Tạo payment với `CASH`, amount = totalAmount | Invoice status → `PAID`, `paidDate` được set |
| Tạo payment với `BANK_TRANSFER`, amount < totalAmount | Invoice status → `PARTIAL` |
| Tạo payment thứ hai bù đủ | Invoice status → `PAID` |
| Tạo payment với `amount > remainingAmount` | `BadRequestException` |
| Tạo payment cho Invoice status `PAID` | `BadRequestException` |
| Tạo payment cho Invoice status `CANCELLED` | `BadRequestException` |
| Tạo payment với `MOMO` + `transactionId` | Lưu thành công, `transactionId` được ghi |
| Tạo payment với `DEPOSIT_DEDUCTION` | Lưu thành công, **không** tự trừ deposit trên Contract |
| Tạo payment với `ZALOPAY` (qua API trực tiếp) | Lưu thành công; UI badge hiển thị fallback key (bug đã biết) |
| Tạo payment với `OTHER` | Lưu thành công |
| Xóa payment duy nhất của Invoice `PAID` | Invoice rollback → `PENDING` hoặc `OVERDUE`; `paidDate` không reset (bug đã biết) |
| Xóa payment partial | Invoice `paidAmount` giảm đúng delta |
| Update `amount` lên cao hơn | Invoice `paidAmount` tăng theo diff |
| Update `amount` xuống thấp hơn | Invoice `paidAmount` giảm theo diff |
| `findAll` với `buildingId` filter | Chỉ trả về payments thuộc building đó |
| `findAll` với `search` = invoice number | Khớp theo `invoiceId.invoiceNumber` |
| `findAll` với `search` = tên tenant | Khớp theo `tenantId.fullName` |
