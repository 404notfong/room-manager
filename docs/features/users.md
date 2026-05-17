# Users Playbook

> **Vai trò trong domain**: User là entity gốc của toàn bộ hệ thống — mọi entity khác đều mang `ownerId` tham chiếu về User để hỗ trợ multi-tenant.
> **Code paths**: `backend/src/modules/users/`, `frontend/src/pages/auth/`

---

## 1. Purpose & Relations

Module Users quản lý tài khoản người dùng của hệ thống Room Manager. Mỗi tài khoản đại diện cho một chủ nhà trọ (OWNER) hoặc nhân viên vận hành (STAFF). Khi đăng ký tài khoản, người dùng mặc định nhận role OWNER.

Module này là nền tảng của kiến trúc multi-tenant: tất cả Buildings, Rooms, Tenants, Contracts, Invoices, Payments đều mang `ownerId` trỏ về `_id` của User. Điều này đảm bảo mỗi người dùng chỉ nhìn thấy dữ liệu của chính mình.

Module `auth` phụ thuộc trực tiếp vào `UsersService` (qua `exports`) để tra cứu user khi login, xác thực refresh token, và cập nhật refresh token hash.

```
User (OWNER | STAFF)
  ├── Buildings (ownerId → User)
  │     └── Rooms (ownerId → User, buildingId → Building)
  │           └── Contracts (ownerId → User)
  │                 ├── Tenants (ownerId → User)
  │                 ├── Invoices (ownerId → User)
  │                 └── Payments (ownerId → User)
  └── Services (ownerId → User)
```

---

## 2. Data Model

### Schema (`backend/src/modules/users/schemas/user.schema.ts`)

| Field | Type | Required | Default | Mô tả |
|-------|------|----------|---------|-------|
| `email` | `String` | Yes | — | Unique, lowercase, trim. Dùng làm login key. |
| `password` | `String` | Yes | — | Lưu dạng bcrypt hash (10 rounds). Không bao giờ trả về client. |
| `fullName` | `String` | Yes | — | Trim. Tên hiển thị của user. |
| `phone` | `String` | No | — | Trim. Không có regex validation ở schema level. |
| `role` | `String (enum UserRole)` | No | `UserRole.OWNER` | Quyền hạn: `OWNER` hoặc `STAFF`. |
| `isActive` | `Boolean` | No | `true` | Tài khoản đang hoạt động hay bị vô hiệu hóa. |
| `isDeleted` | `Boolean` | No | `false` | Soft delete flag. |
| `refreshToken` | `String` | No | — | Lưu bcrypt hash của refresh token hiện tại (10 rounds). `null` khi logout. |
| `createdAt` | `Date` | Auto | — | Tự động bởi `timestamps: true`. |
| `updatedAt` | `Date` | Auto | — | Tự động bởi `timestamps: true`. |

**Indexes** (định nghĩa trong `UserSchema`):
- `{ email: 1 }` — tra cứu login nhanh.
- `{ isDeleted: 1, isActive: 1 }` — lọc user đang hoạt động.
- `unique: true` trên `email` (khai báo trực tiếp trong `@Prop`).

**Hooks / Virtuals**: Không có pre-save hook trong schema. Password hashing được thực hiện trong `UsersService.create()` và `UsersService.changePassword()` bằng `bcrypt.hash(value, 10)`.

### Enums liên quan (`backend/src/common/constants/enums.ts`)

```typescript
enum UserRole {
    OWNER = 'OWNER',   // Chủ nhà — full access toàn bộ CRUD + user management
    STAFF = 'STAFF',   // Nhân viên — chỉ tự cập nhật profile và đổi mật khẩu
}
```

Không có enum nào khác được dùng trực tiếp trong module users.

### DTO validation

**`CreateUserDto`** (`backend/src/modules/users/dto/create-user.dto.ts`)
- `email`: `@IsEmail()`, `@IsNotEmpty()`
- `password`: `@IsString()`, `@IsNotEmpty()`, `@MinLength(6)`
- `fullName`: `@IsString()`, `@IsNotEmpty()`
- `phone`: `@IsString()`, `@IsOptional()`
- `role`: `@IsEnum(UserRole)`, `@IsOptional()` (không truyền → default OWNER)

**`UpdateUserDto`** (`backend/src/modules/users/dto/update-user.dto.ts`)
- `fullName`: `@IsString()`, `@IsOptional()`
- `phone`: `@IsString()`, `@IsOptional()`
- `isActive`: `@IsBoolean()`, `@IsOptional()` (chỉ OWNER dùng để deactivate)

**`ChangePasswordDto`** (`backend/src/modules/users/dto/update-user.dto.ts`)
- `currentPassword`: `@IsString()`, `@IsNotEmpty()`
- `newPassword`: `@IsString()`, `@IsNotEmpty()`, `@MinLength(8)` (message i18n: `validation.MIN_LENGTH`), `@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)` (message i18n: `validation.PASSWORD_COMPLEXITY`)

> Lưu ý: `CreateUserDto` yêu cầu `password` tối thiểu 6 ký tự; `ChangePasswordDto` yêu cầu 8 ký tự + complexity. Hai mức yêu cầu không đồng nhất.

---

## 3. API Endpoints

Controller base: `@Controller('users')`, guards: `JwtAuthGuard` + `RolesGuard` áp dụng toàn bộ controller.

| Method | Path | Role required | Mô tả | Request body | Response shape |
|--------|------|---------------|-------|--------------|----------------|
| `GET` | `/api/users/profile` | Any authenticated | Lấy profile của user hiện tại | — | `User` (no `password`, no `refreshToken`) |
| `PUT` | `/api/users/profile` | Any authenticated | Cập nhật profile của user hiện tại | `UpdateUserDto` | `User` (updated, no sensitive fields) |
| `PUT` | `/api/users/change-password` | Any authenticated | Đổi mật khẩu | `ChangePasswordDto` | `void` (204) |
| `GET` | `/api/users` | `OWNER` only | Lấy danh sách tất cả users | — | `User[]` |
| `GET` | `/api/users/:id` | `OWNER` only | Lấy user theo ID | — | `User` |
| `PUT` | `/api/users/:id` | `OWNER` only | Cập nhật user bất kỳ | `UpdateUserDto` | `User` |
| `DELETE` | `/api/users/:id` | `OWNER` only | Soft delete user | — | `void` |

`@CurrentUser()` decorator trích `userId` từ JWT payload. `@Roles(UserRole.OWNER)` kết hợp với `RolesGuard` để block STAFF khỏi các route admin.

---

## 4. Business Rules & State Machine

### Invariants

- **Unique email**: Service kiểm tra `{ email, isDeleted: false }` trước khi tạo. Nếu đã tồn tại → `ConflictException('Email already exists')`. Không có i18n message trên exception này.
- **Password không leak**: `findAll()`, `findOne()`, `update()` đều `.select('-password -refreshToken')`. Chỉ `findByEmail()` và `findOneDocument()` trả về document đầy đủ (dùng nội bộ bởi `auth` module).
- **bcrypt rounds**: Luôn là `10` cho cả password lẫn refresh token hash.
- **Soft delete**: `remove()` set `{ isDeleted: true }` thay vì xóa thật. Mọi query đều filter `isDeleted: false`.
- **Refresh token hash**: `updateRefreshToken()` hash refresh token trước khi lưu. Khi logout, gọi với `null` → lưu `null` vào DB (không hash).

### Role-based access

| Action | OWNER | STAFF |
|--------|-------|-------|
| Xem / sửa profile của chính mình | Yes | Yes |
| Đổi mật khẩu của chính mình | Yes | Yes |
| Xem danh sách tất cả users | Yes | No |
| Sửa / Xóa user bất kỳ | Yes | No |
| Tạo user (qua `/auth/register`) | Yes | Yes |

### Auto-actions / Side effects

- Khi `UsersService.create()` được gọi (từ `auth/register`), password bị hash ngay lập tức trước khi lưu.
- Không có event emit, không có cascade delete khi soft delete user — các entity khác mang `ownerId` vẫn tồn tại trong DB.

---

## 5. Frontend Touchpoints

### Pages

Không có trang `/users` hay `/profile` riêng trong codebase hiện tại. Các điểm tiếp xúc với module users nằm ở:

- **`frontend/src/pages/auth/LoginPage.tsx`**: Form đăng nhập — gọi `POST /api/auth/login`, response trả về `user` object (từ UsersService) và `accessToken`.
- **`frontend/src/pages/auth/RegisterPage.tsx`**: Form đăng ký — gọi `POST /api/auth/register` với `email`, `password`, `fullName`, `phone`.

**TODO**: Chưa có trang Profile (`/profile`) hay User Management (`/users`) trên frontend. Các endpoint `GET/PUT /api/users/profile` và `PUT /api/users/change-password` chưa được gọi từ bất kỳ page nào.

### State management

- `frontend/src/stores/authStore.ts` (Zustand + persist): Lưu `user` object và `token` vào localStorage sau login. `user` object được populate từ response auth, không phải gọi trực tiếp users API.

### Key i18n keys (VI)

Không có namespace `users.*` hay `profile.*` trong `frontend/public/locales/vi/translation.json`. Các key liên quan nằm trong `auth.*`:

| Key | Giá trị |
|-----|---------|
| `auth.email` | Email |
| `auth.password` | Mật khẩu |
| `auth.confirmPassword` | Nhập lại mật khẩu |
| `auth.fullName` | Họ và tên |
| `auth.phone` | Số điện thoại |
| `auth.login` | Đăng nhập |
| `auth.register` | Đăng ký |
| `auth.logout` | Đăng xuất |
| `auth.loggingIn` | Đang đăng nhập... |
| `auth.registering` | Đang đăng ký... |
| `validation.PASSWORD_COMPLEXITY` | Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số |
| `validation.MIN_LENGTH` | Độ dài tối thiểu là {{constraints.0}} ký tự |
| `errors.unauthorized` | Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại. |
| `errors.forbidden` | Bạn không có quyền thực hiện hành động này |

---

## 6. Cross-Module Dependencies

### Module này CẦN

- `bcrypt` (npm) — hash password và refresh token.
- Không import module NestJS nào khác ngoài `MongooseModule`.

### Module khác CẦN module Users

- **`auth` module**: Import `UsersModule` (qua `exports: [UsersService]`). Dùng `UsersService.findByEmail()` để validate login, `UsersService.findOneDocument()` để xác thực refresh token, `UsersService.updateRefreshToken()` khi login/logout, `UsersService.create()` khi register.
- **TẤT CẢ modules còn lại** (buildings, rooms, room-groups, tenants, contracts, invoices, payments, services): Không import `UsersModule` trực tiếp, nhưng tất cả entity schemas đều có `ownerId: Types.ObjectId` tham chiếu về `User._id`. Service của mỗi module nhận `ownerId` từ JWT payload (qua `@CurrentUser()`) và dùng nó để filter dữ liệu.

---

## 7. Gotchas & Testing Notes

### Common pitfalls

1. **Password leak**: Luôn kiểm tra response không chứa `password` hay `refreshToken`. `findByEmail()` và `findOneDocument()` trả về full document — chỉ dùng nội bộ, không trả về controller.

2. **ownerId mismatch**: STAFF có thể gọi `PUT /api/users/:id` với bất kỳ `id` nào nhưng bị block bởi `RolesGuard`. Tuy nhiên khi OWNER gọi `PUT /api/users/:id` để thay đổi user khác, không có kiểm tra nào đảm bảo user đó thuộc về OWNER (không có `ownerId` trong User schema). Đây là design choice: users không có multi-tenant isolation với nhau.

3. **Email conflict message không có i18n**: `ConflictException('Email already exists')` dùng hardcoded English string, không qua `nestjs-i18n`.

4. **Refresh token null handling**: `updateRefreshToken(userId, null)` → `bcrypt.hash(null, 10)` được bỏ qua bởi ternary `refreshToken ? ... : null`. Lưu `null` trực tiếp vào DB — đúng behavior khi logout.

5. **Password strength asymmetry**: Register yêu cầu min 6 ký tự (không cần complexity), đổi mật khẩu yêu cầu min 8 + complexity. Có thể tạo tài khoản với mật khẩu yếu rồi không đổi được nếu dùng mật khẩu đó.

6. **Không có `email` trong `UpdateUserDto`**: Email không thể được thay đổi sau khi tạo tài khoản — không có endpoint để đổi email.

### Test scenarios

| Scenario | Expected |
|----------|----------|
| Đăng ký với email đã tồn tại (`isDeleted: false`) | `409 ConflictException` |
| Đăng ký với email của user đã soft-delete | Thành công (vì query filter `isDeleted: false`) |
| STAFF gọi `GET /api/users` | `403 Forbidden` (RolesGuard) |
| OWNER gọi `DELETE /api/users/:id` với id không tồn tại | `404 NotFoundException` |
| `PUT /api/users/change-password` với `currentPassword` sai | `400 BadRequestException('Current password is incorrect')` |
| `PUT /api/users/change-password` với `newPassword = 'abc'` (< 8 chars) | `400 ValidationError` (MIN_LENGTH) |
| `PUT /api/users/change-password` với `newPassword = 'alllowercase1'` | `400 ValidationError` (PASSWORD_COMPLEXITY) |
| `findAll()` / `findOne()` response | Không có `password`, không có `refreshToken` |
| Soft delete user rồi login lại | `401` (findByEmail filter `isDeleted: false`) |
