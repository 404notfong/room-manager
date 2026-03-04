# Architecture — Room Management System

## Pattern

**Monorepo with separate backend/frontend apps** communicating via REST API.

- Backend: NestJS modular monolith (12 feature modules)
- Frontend: React SPA with component-based architecture
- Database: Single MongoDB instance

## Layers

### Backend Layers

```
┌──────────────────────────────────────────────────┐
│ Controllers (HTTP endpoints, route handlers)      │
├──────────────────────────────────────────────────┤
│ Services (Business logic, orchestration)          │
├──────────────────────────────────────────────────┤
│ Schemas/Models (Mongoose ODM, data definitions)   │
├──────────────────────────────────────────────────┤
│ MongoDB (persistence)                             │
└──────────────────────────────────────────────────┘

Cross-cutting:
├── Guards (JWT auth, throttling)
├── Interceptors (logging)
├── Filters (exception handling)
├── DTOs (validation via class-validator)
├── Decorators (custom param decorators)
└── i18n (language resolution)
```

### Frontend Layers

```
┌──────────────────────────────────────────────────┐
│ Pages (route-level components)                    │
├──────────────────────────────────────────────────┤
│ Components (reusable UI + business components)    │
│   ├── ui/ (shadcn primitives: button, dialog...)  │
│   ├── dashboard/ (RoomCard, Calendar, Overview)   │
│   ├── forms/ (form components)                    │
│   └── *.tsx (modals, selectors, feature comps)    │
├──────────────────────────────────────────────────┤
│ Hooks (use-toast, useDebounce, useNotifications)  │
├──────────────────────────────────────────────────┤
│ Stores (Zustand: auth, building, theme)           │
├──────────────────────────────────────────────────┤
│ API Client (Axios + interceptors)                 │
├──────────────────────────────────────────────────┤
│ Utils/Lib (validations, table utils)              │
└──────────────────────────────────────────────────┘
```

## Backend Modules

Each module follows NestJS convention: `module → controller → service → schema`.

| Module | Schema | Purpose |
|--------|--------|---------|
| `auth` | — | Login, register, JWT token management |
| `users` | `user.schema.ts` | User CRUD |
| `buildings` | `building.schema.ts` | Building/property management |
| `rooms` | `room.schema.ts` | Room management within buildings |
| `room-groups` | `room-group.schema.ts` | Logical room grouping |
| `tenants` | `tenant.schema.ts` | Tenant information |
| `contracts` | `contract.schema.ts` | Rental agreements |
| `invoices` | `invoice.schema.ts` | Invoice generation and tracking |
| `payments` | `payment.schema.ts` | Payment recording |
| `services` | `service.schema.ts` | Additional services (electricity, water, etc.) |
| `notifications` | `notification.schema.ts` | System notifications |
| `calendar` | — | Calendar/timeline view data |

## Data Flow

```
User → React SPA → Axios Client → NestJS Controller → Service → Mongoose → MongoDB
                                   ↑                     ↑
                              JWT Guard          Business Logic
                              i18n Header        Cross-module queries
```

### Authentication Flow
1. User submits credentials → `POST /auth/login`
2. Backend validates → returns `{ token, refreshToken, user }`
3. Frontend stores token in `localStorage` via `authStore`
4. Axios interceptor attaches `Bearer {token}` to all requests
5. Backend `JwtAuthGuard` validates token on protected routes
6. On 401 → frontend clears auth state → redirects to `/login`

### i18n Flow
1. Frontend detects language (browser/saved preference)
2. Loads translation JSON from `public/locales/{lang}/`
3. Sends `Accept-Language` + `x-lang` headers via axios interceptor
4. Backend resolves language via nestjs-i18n resolvers
5. Error messages returned in user's language

## Entry Points

### Backend
- `backend/src/main.ts` — NestJS bootstrap (port 3000)
- `backend/src/app.module.ts` — Root module importing all feature modules

### Frontend
- `frontend/src/main.tsx` — React DOM render with i18n init
- `frontend/src/App.tsx` — Router with `ProtectedRoute` wrapper
- `frontend/src/layouts/DashboardLayout.tsx` — Main app shell (sidebar + content)

## Key Relationships

- **Building → Rooms**: Building contains multiple rooms
- **Room → Contracts**: Room can have contracts
- **Contract → Tenant**: Contract links tenant to room
- **Contract → Invoices**: Contract generates invoices
- **Invoice → Payments**: Invoice tracks payments
- **Room-Group**: Logical grouping of rooms (for UI organization)
- **Services**: Tied to buildings (electricity, water, internet rates)
