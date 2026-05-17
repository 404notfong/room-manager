# Auth Playbook

> **Vai trò trong domain**: Module xác thực danh tính người dùng — cấp phát và thu hồi JWT access token + refresh token cho toàn bộ hệ thống Room Manager.
> **Code paths**: `backend/src/modules/auth/`, `frontend/src/stores/authStore.ts`, `frontend/src/pages/auth/LoginPage.tsx`, `frontend/src/pages/auth/RegisterPage.tsx`

---

## 1. Purpose & Relations

Auth module chịu trách nhiệm đăng ký tài khoản mới, đăng nhập, đăng xuất, và làm mới access token thông qua refresh token. Mọi endpoint nghiệp vụ (buildings, rooms, contracts, invoices...) đều yêu cầu JWT access token hợp lệ từ module này — không có auth, không có gì hoạt động.

Mật khẩu được hash bằng bcrypt (10 rounds) trước khi lưu vào database. Refresh token cũng được hash bằng bcrypt (10 rounds) và lưu vào field `refreshToken` trên User document — không có bảng riêng.

Auth không quản lý user data trực tiếp mà uỷ quyền hoàn toàn cho `UsersService`: tạo user, tìm user theo email, cập nhật/xoá refresh token.

```
Auth Module
  ├── dùng → Users Module (validate credentials, create user, store refresh token)
  └── cung cấp cho → TẤT CẢ module (JwtAuthGuard bảo vệ mọi protected route)

Client (browser)
  ├── POST /api/auth/register  → nhận accessToken + refreshToken
  ├── POST /api/auth/login     → nhận accessToken + refreshToken
  ├── POST /api/auth/refresh   → nhận accessToken mới + refreshToken mới
  └── POST /api/auth/logout    → xoá refreshToken trong DB
```

---

## 2. Data Model

### Schema

Auth không có Mongoose schema riêng. Refresh token được lưu trực tiếp trên **User schema** (`backend/src/modules/users/schemas/user.schema.ts`):

| Field | Type | Constraint | Ghi chú |
|---|---|---|---|
| `email` | `string` | `required`, `unique`, `lowercase`, `trim` | Index `{ email: 1 }` |
| `password` | `string` | `required` | bcrypt hash, 10 rounds |
| `fullName` | `string` | `required`, `trim` | |
| `phone` | `string` | optional, `trim` | |
| `role` | `UserRole` | enum, default `OWNER` | |
| `isActive` | `boolean` | default `true` | Login bị chặn nếu `false` |
| `isDeleted` | `boolean` | default `false` | Soft delete |
| `refreshToken` | `string?` | optional | bcrypt hash của raw token; `null` sau logout |

Xem chi tiết tại `backend/src/modules/users/schemas/user.schema.ts`.

### Enums liên quan

Từ `backend/src/common/constants/enums.ts`:

```typescript
enum UserRole {
    OWNER = 'OWNER',   // Chủ nhà — role mặc định khi đăng ký
    STAFF = 'STAFF',   // Nhân viên
}
```

JWT payload: `{ userId: string, email: string }`. `role` không nằm trong token payload mà được tra cứu từ DB mỗi request qua `JwtStrategy.validate()`.

### DTO validation

**RegisterDto** (`backend/src/modules/auth/dto/auth.dto.ts`):

| Field | Decorators | Rule |
|---|---|---|
| `email` | `@IsEmail()`, `@IsNotEmpty()` | Phải là email hợp lệ, không rỗng |
| `password` | `@IsString()`, `@IsNotEmpty()`, `@MinLength(8)`, `@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)` | Tối thiểu 8 ký tự, có chữ thường + chữ hoa + số |
| `confirmPassword` | `@IsString()`, `@IsNotEmpty()`, `@Validate(MatchPasswordConstraint, ['password'])` | Phải khớp với `password` |
| `fullName` | `@IsString()`, `@IsNotEmpty()` | Không rỗng |
| `phone` | `@IsString()`, `@IsNotEmpty()` | Không rỗng (format validate ở frontend) |

`MatchPasswordConstraint` là custom `ValidatorConstraint` inline trong `auth.dto.ts` — so sánh `confirmPassword === password`.

**LoginDto** (`backend/src/modules/auth/dto/auth.dto.ts`):

| Field | Decorators | Rule |
|---|---|---|
| `email` | `@IsEmail()`, `@IsNotEmpty()` | Phải là email hợp lệ, không rỗng |
| `password` | `@IsString()`, `@IsNotEmpty()` | Không rỗng (backend không check độ phức tạp khi login) |

**RefreshTokenDto**: Không có DTO riêng. Controller lấy trực tiếp từ body: `@Body('refreshToken') refreshToken: string`.

---

## 3. API Endpoints

| Method | Path | Auth | Mô tả | Request body | Response shape |
|---|---|---|---|---|---|
| `POST` | `/api/auth/register` | Không | Tạo tài khoản mới | `{ email, password, confirmPassword, fullName, phone }` | `{ user: { id, email, fullName, role }, accessToken, refreshToken }` |
| `POST` | `/api/auth/login` | Không | Đăng nhập | `{ email, password }` | `{ user: { id, email, fullName, role }, accessToken, refreshToken }` |
| `POST` | `/api/auth/logout` | `JwtAuthGuard` (Bearer) | Đăng xuất, xoá refresh token | _(body rỗng)_ | `undefined` (void) |
| `POST` | `/api/auth/refresh` | Không | Lấy token mới bằng refresh token | `{ refreshToken: string }` | `{ accessToken, refreshToken }` |

**Rate limiting** (via `@Throttle`): `register` và `login` giới hạn **10 request / 15 giây** mỗi IP.

**Lưu ý `refresh` endpoint**: không có `JwtAuthGuard` — access token đã hết hạn nên không thể dùng để verify. Xác thực hoàn toàn bằng `REFRESH_TOKEN_SECRET`.

---

## 4. Business Rules & State Machine

### Invariants (không bao giờ vi phạm)

- **Password hash**: Mật khẩu plain-text KHÔNG BAO GIỜ được lưu vào DB. Luôn hash với `bcrypt.hash(password, 10)` trước khi `user.save()`.
- **Refresh token hash**: Raw refresh token KHÔNG BAO GIỜ được lưu vào DB. `updateRefreshToken()` luôn gọi `bcrypt.hash(refreshToken, 10)` trước khi lưu. Sau logout → lưu `null`.
- **isActive check**: Login thất bại với `401 Unauthorized` nếu `user.isActive === false` — ngay cả khi credentials đúng.
- **Credentials error message**: Login fail vì sai email hay sai password đều trả cùng một message `auth.errors.invalidCredentials` (không phân biệt để tránh user enumeration).
- **Refresh token rotation**: Mỗi lần gọi `/api/auth/refresh` thành công đều sinh cặp token mới và ghi đè `refreshToken` trong DB. Token cũ bị vô hiệu hoá ngay.

### Token generation

Hàm `generateTokens(userId, email)` trong `auth.service.ts` tạo đồng thời hai token:

| Token | Secret env var | Expiry env var | Default |
|---|---|---|---|
| `accessToken` | `JWT_SECRET` | `JWT_EXPIRES_IN` | `7d` (từ `jwt.config.ts`) |
| `refreshToken` | `REFRESH_TOKEN_SECRET` | `REFRESH_TOKEN_EXPIRES_IN` | TODO: không có default trong code — phụ thuộc hoàn toàn vào `.env` (`auth.service.ts:128`) |

JWT payload: `{ userId, email }`. Không có `role` trong payload — `JwtStrategy.validate()` tra thêm từ DB.

### Refresh token flow

```
Client                           Backend
  │                                 │
  ├─POST /auth/refresh ─────────────▶ verifyAsync(token, REFRESH_TOKEN_SECRET)
  │   { refreshToken }              ├─ findOneDocument(payload.userId)
  │                                 ├─ bcrypt.compare(rawToken, user.refreshToken)
  │                                 ├─ generateTokens() → newAccess + newRefresh
  │                                 ├─ updateRefreshToken(userId, newRefresh) [hash]
  │ ◀──────────────────────────────── { accessToken, refreshToken }
```

Nếu token hết hạn, chữ ký sai, user không tìm thấy, hoặc `refreshTokenMatches === false` → `401 UnauthorizedException('Access denied')`.

### Logout flow

```
Client                           Backend
  │                                 │
  ├─POST /auth/logout ──────────────▶ JwtAuthGuard → JwtStrategy.validate()
  │   Authorization: Bearer <token> ├─ authService.logout(user.userId)
  │                                 └─ updateRefreshToken(userId, null) [lưu null]
  │ ◀──────────────────────────────── 200 OK (void)
```

Sau logout, refresh token bị vô hiệu hoá ở DB. Frontend tự xoá `token` khỏi `localStorage` và clear Zustand state — backend không set cookie.

### Auto-actions (side effects)

- **Register thành công**: tạo User document → generate token pair → hash & lưu refresh token → trả `{ user, accessToken, refreshToken }`.
- **Login thành công**: generate token pair → hash & lưu refresh token vào user document → trả `{ user, accessToken, refreshToken }`.
- **Refresh thành công**: generate token pair mới → hash & ghi đè refresh token trong DB.

---

## 5. Frontend Touchpoints

### Pages

| File | Route | Chức năng |
|---|---|---|
| `frontend/src/pages/auth/LoginPage.tsx` | `/login` | Form đăng nhập (email + password), gọi `authApi.login`, lưu token vào store rồi redirect về `/` |
| `frontend/src/pages/auth/RegisterPage.tsx` | `/register` | Form đăng ký 5 field, gọi `authApi.register`, auto-login ngay sau đăng ký thành công |

### Components quan trọng

| Component | File | Vai trò |
|---|---|---|
| `ProtectedRoute` | `frontend/src/App.tsx:38` | Inline component — check `token` từ authStore; redirect `/login` nếu null |
| `AuthShell` | `frontend/src/components/layout/auth-shell.tsx` | Layout wrapper 2 cột (hero panel trái + form phải) dùng chung cho login và register |

**Không có** file AuthGuard riêng — `ProtectedRoute` là component inline trong `App.tsx`.

### Stores

`frontend/src/stores/authStore.ts` — Zustand với `persist` middleware:

```typescript
interface User {
    id: string;
    email: string;
    fullName: string;
    role: string;
}

interface AuthState {
    user: User | null;        // null = chưa đăng nhập
    token: string | null;     // access token (JWT string)
    setAuth: (user, token) => void;  // lưu vào state + localStorage['token']
    logout: () => void;              // xoá state + localStorage['token']
}
```

- Persist key: `'auth-storage'` (localStorage).
- `setAuth()` vừa gọi `localStorage.setItem('token', token)` (cho axios interceptor) vừa `set({ user, token })` (cho Zustand persist).
- `logout()` chỉ xoá state local — **không tự động gọi** `authApi.logout()` (tức không revoke refresh token ở backend). Frontend cần gọi API logout riêng nếu muốn revoke.
- **Refresh token không được lưu ở frontend** — frontend không thực hiện auto-refresh; khi access token hết hạn, người dùng cần login lại thủ công.

### API client

`frontend/src/api/auth.api.ts` — wrapper trên `apiClient` (axios instance tại `frontend/src/api/client.ts`):

```typescript
authApi.login(data: LoginDto)     → POST /auth/login
authApi.register(data: RegisterDto) → POST /auth/register
authApi.logout()                  → POST /auth/logout
```

`RegisterDto` frontend thiếu `confirmPassword` so với backend DTO — validation `confirmPassword` chỉ thực hiện ở frontend (Zod `.refine()`), không gửi lên server.

### Frontend validation (Zod — `frontend/src/lib/validations.ts`)

**useLoginSchema**: `email` (`.email()`), `password` (`.min(1)` — chỉ required, không check complexity).

**useRegisterSchema**: `email` (`.email()`), `password` (`.min(6)` — **khác backend** là `MinLength(8)`), `confirmPassword` (`.refine(equal password)`), `fullName` (`.min(1)`), `phone` (`.refine(isValidVietnamesePhone)`).

### Key i18n keys (namespace `translation`, prefix `auth.*`)

| Key | Tiếng Việt |
|---|---|
| `auth.login` | Đăng nhập |
| `auth.register` | Đăng ký |
| `auth.logout` | Đăng xuất |
| `auth.email` | Email |
| `auth.password` | Mật khẩu |
| `auth.confirmPassword` | Nhập lại mật khẩu |
| `auth.fullName` | Họ và tên |
| `auth.phone` | Số điện thoại |
| `auth.loginSuccess` | Đăng nhập thành công |
| `auth.registerSuccess` | Tạo tài khoản thành công |
| `auth.welcome` | Chào mừng trở lại! |
| `auth.welcomeNewUser` | Chào mừng! Tài khoản của bạn đã được tạo. |
| `auth.invalidCredentials` | Email hoặc mật khẩu không đúng |
| `auth.serverError` | Không thể kết nối đến máy chủ. Vui lòng thử lại sau. |
| `auth.loggingIn` | Đang đăng nhập... |
| `auth.registering` | Đang đăng ký... |
| `auth.heroTitle` | Vận hành nhà trọ rõ ràng và tập trung |
| `auth.highlights.manageTitle` | Quản lý vận hành tập trung |

---

## 6. Cross-Module Dependencies

### Module này CẦN

- **Users Module** (`UsersModule`): `UsersService.create()` (register), `findByEmail()` (login), `findOneDocument()` (refresh), `findOne()` (JWT validate), `updateRefreshToken()` (login/register/refresh/logout).
- **@nestjs/jwt** (`JwtModule`): `jwtService.signAsync()` để tạo token, `jwtService.verifyAsync()` để verify refresh token.
- **@nestjs/config** (`ConfigModule`): đọc `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_IN` từ `.env`.
- **nestjs-i18n** (`I18nService`): dịch message lỗi `auth.errors.invalidCredentials`, `auth.errors.accountInactive`.
- **passport-jwt** (`JwtStrategy`): extract Bearer token từ Authorization header, validate payload.

### Module khác CẦN module này

- **TẤT CẢ module** protected dùng `JwtAuthGuard` (re-export từ `AuthModule` → inject vào từng controller).
- `AuthModule` export `AuthService` — hiện chưa có module nào import `AuthService` trực tiếp ngoài auth flow.

---

## 7. Gotchas & Testing Notes

### Common pitfalls

1. **Missing Bearer prefix**: `JwtStrategy` dùng `ExtractJwt.fromAuthHeaderAsBearerToken()` — header phải là `Authorization: Bearer <token>`, thiếu `Bearer ` sẽ trả 401 ngay.

2. **Frontend password min khác backend**: Frontend `useRegisterSchema` validate `password` tối thiểu **6 ký tự**, nhưng backend `RegisterDto` dùng `@MinLength(8)`. User có thể submit form (frontend pass) rồi bị lỗi 400 từ backend nếu password dài 6-7 ký tự. (`frontend/src/lib/validations.ts:291` vs `backend/src/modules/auth/dto/auth.dto.ts:32`)

3. **Refresh token không auto-refresh ở frontend**: `authStore.logout()` không gọi `authApi.logout()` — nếu người dùng chỉ click logout UI mà không có code gọi API, refresh token vẫn còn hợp lệ trong DB. Cần đảm bảo flow logout UI gọi cả `authApi.logout()` lẫn `authStore.logout()`.

4. **role không trong JWT payload**: `JwtStrategy.validate()` trả `{ userId, email, role }` nhưng `role` lấy từ DB query mỗi request (`usersService.findOne(payload.userId)`). Nếu user bị vô hiệu hoá sau khi đã đăng nhập, token vẫn pass `JwtAuthGuard` (vì không check `isActive` trong strategy) — chỉ login mới block `isActive === false`.

5. **REFRESH_TOKEN_EXPIRES_IN không có default**: Khác với access token (default `7d` trong `jwt.config.ts`), `REFRESH_TOKEN_EXPIRES_IN` phụ thuộc hoàn toàn vào `.env`. Nếu thiếu biến này, `expiresIn: undefined` → JWT library có thể tạo token không hết hạn. (`backend/src/modules/auth/auth.service.ts:128`)

6. **Throttle config**: comment trong code ghi "10 requests per 60 seconds" nhưng thực tế `ttl: 15000` là **15 giây**, không phải 60. (`backend/src/modules/auth/auth.controller.ts:13`)

### Test scenarios chính

| Scenario | Input | Expected |
|---|---|---|
| Happy login | email + password đúng, `isActive: true` | 200 `{ user, accessToken, refreshToken }` |
| Sai password | email đúng, password sai | 401 `invalidCredentials` |
| Email không tồn tại | email không có trong DB | 401 `invalidCredentials` (cùng message) |
| User bị vô hiệu hoá | `isActive: false`, credentials đúng | 401 `accountInactive` |
| Register email trùng | email đã có trong DB | 409 ConflictException |
| Register password không match | `confirmPassword !== password` | 400 validation error |
| Register password yếu | password không có uppercase/number | 400 `validation.PASSWORD_COMPLEXITY` |
| Refresh với token hợp lệ | raw refreshToken đúng | 200 `{ accessToken, refreshToken }` mới |
| Refresh với token sai chữ ký | token bị tamper | 401 `Access denied` |
| Refresh sau logout | user.refreshToken là null | 401 `Access denied` |
| Logout | valid access token | 200 void; `user.refreshToken = null` trong DB |
| Expired access token | token quá hạn `JWT_EXPIRES_IN` | 401 (JwtAuthGuard reject) |
