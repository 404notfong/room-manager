# Structure — Room Management System

## Top-Level Layout

```
room-manager/
├── backend/                    # NestJS API server
├── frontend/                   # React SPA
├── design-system/              # Design system assets
├── docs/                       # Documentation
├── e2e/                        # End-to-end tests
├── .planning/                  # GSD planning artifacts
├── docker-compose.yml          # Multi-service orchestration
└── README.md
```

## Backend Structure

```
backend/
├── src/
│   ├── main.ts                            # Bootstrap entry point
│   ├── app.module.ts                      # Root module (imports all)
│   ├── app.controller.ts                  # Health check / root controller
│   ├── common/                            # Shared infrastructure
│   │   ├── constants/                     # App-wide constants
│   │   ├── decorators/                    # Custom decorators
│   │   ├── dto/                           # Shared DTOs (pagination etc.)
│   │   ├── filters/                       # Exception filters (AllExceptionsFilter)
│   │   ├── guards/                        # Auth guards (JwtAuthGuard)
│   │   ├── interceptors/                  # Logging interceptor
│   │   └── utils/                         # Shared utilities
│   ├── config/                            # Configuration
│   │   ├── database.config.ts             # MongoDB connection config
│   │   └── jwt.config.ts                  # JWT strategy config
│   ├── i18n/                              # Translation files
│   │   ├── en/                            # English translations
│   │   └── vi/                            # Vietnamese translations
│   ├── modules/                           # Feature modules
│   │   ├── auth/                          # Authentication
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/               # Passport strategies
│   │   │   └── dto/                      # Auth DTOs
│   │   ├── buildings/                     # Building management
│   │   │   ├── buildings.module.ts
│   │   │   ├── buildings.controller.ts
│   │   │   ├── buildings.service.ts
│   │   │   ├── schemas/building.schema.ts
│   │   │   └── dto/
│   │   ├── rooms/                         # Room management
│   │   ├── room-groups/                   # Room grouping
│   │   ├── tenants/                       # Tenant management
│   │   ├── contracts/                     # Contract management
│   │   ├── invoices/                      # Invoice management
│   │   ├── payments/                      # Payment tracking
│   │   ├── services/                      # Utility services config
│   │   ├── notifications/                 # Notifications
│   │   ├── calendar/                      # Calendar data
│   │   └── users/                         # User management
│   └── scripts/                           # Utility scripts (seeding)
├── Dockerfile
├── package.json
├── tsconfig.json
├── nest-cli.json
└── ecosystem.config.json                  # PM2 config
```

### Module Convention

Each module follows this pattern:
```
module-name/
├── module-name.module.ts       # NestJS module definition
├── module-name.controller.ts   # HTTP route handlers
├── module-name.service.ts      # Business logic
├── schemas/
│   └── model.schema.ts         # Mongoose schema
└── dto/
    ├── create-model.dto.ts     # Create DTO
    └── update-model.dto.ts     # Update DTO
```

## Frontend Structure

```
frontend/
├── src/
│   ├── main.tsx                           # React entry (DOM render)
│   ├── App.tsx                            # Router + route definitions
│   ├── i18n.ts                            # i18n config
│   ├── index.css                          # Global CSS (Tailwind base)
│   ├── vite-env.d.ts                      # Vite type declarations
│   ├── api/                               # API layer
│   │   ├── client.ts                      # Axios instance + interceptors
│   │   ├── auth.api.ts                    # Auth API calls
│   │   ├── calendar.ts                    # Calendar API
│   │   └── notifications.api.ts           # Notifications API
│   ├── components/                        # UI components
│   │   ├── ui/                            # shadcn/ui primitives (28 files)
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── form.tsx
│   │   │   ├── table.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── skeletons/                # Loading skeleton variants
│   │   │   └── ... (24 more)
│   │   ├── dashboard/                     # Dashboard-specific components
│   │   │   ├── RoomCard.tsx              # Room status card (62KB - largest component)
│   │   │   ├── RoomStatusOverview.tsx    # Room overview grid (31KB)
│   │   │   ├── BigCalendar.tsx           # Calendar view
│   │   │   ├── RoomGroupCollapse.tsx     # Collapsible room groups
│   │   │   └── DraggableRoomCard.tsx     # DnD room card
│   │   ├── forms/                         # Form components
│   │   ├── common/                        # Shared components
│   │   ├── BuildingSelector.tsx           # Building picker
│   │   ├── CreateInvoiceModal.tsx         # Invoice creation (37KB)
│   │   ├── CreateShortTermInvoiceModal.tsx # Short-term invoice (41KB)
│   │   ├── ContractViewModal.tsx          # Contract viewer (30KB)
│   │   └── ... (10+ more feature components)
│   ├── hooks/                             # Custom hooks
│   │   ├── use-toast.ts                   # Toast notifications
│   │   ├── useColumnVisibility.ts         # Table column toggle
│   │   ├── useDebounce.ts                 # Input debouncing
│   │   └── useNotifications.ts            # Notification polling
│   ├── layouts/
│   │   └── DashboardLayout.tsx            # Main app shell (sidebar + content)
│   ├── lib/                               # Shared libraries
│   │   ├── validations.ts                 # Zod schemas (31KB - all form validations)
│   │   ├── priceTableValidation.ts        # Price table validation logic
│   │   ├── priceTableValidation.test.ts   # Tests for above
│   │   └── utils.ts                       # clsx/twMerge utility
│   ├── pages/                             # Route pages
│   │   ├── auth/ (LoginPage, RegisterPage)
│   │   ├── dashboard/ (DashboardPage)
│   │   ├── buildings/ (BuildingsPage)
│   │   ├── rooms/ (RoomsPage)
│   │   ├── tenants/ (TenantsPage)
│   │   ├── contracts/ (ContractsPage)
│   │   ├── invoices/ (InvoicesPage)
│   │   ├── payments/ (PaymentsPage)
│   │   ├── room-groups/ (RoomGroupsPage)
│   │   └── services/ (ServicesPage)
│   ├── stores/                            # Zustand stores
│   │   ├── authStore.ts                   # Auth state (token, user)
│   │   ├── buildingStore.ts               # Current building selection
│   │   └── themeStore.ts                  # Dark/light theme
│   ├── test/                              # Test utilities
│   ├── types/                             # TypeScript types (empty currently)
│   └── utils/
│       └── tableUtils.ts                  # Table helper utilities
├── public/
│   └── locales/                           # i18n translation JSON files
├── Dockerfile
├── nginx.conf                             # Production Nginx config
├── vite.config.ts                         # Vite config
├── tailwind.config.js                     # Tailwind config
├── components.json                        # shadcn/ui config
├── vercel.json                            # Vercel deployment config
└── package.json
```

## Naming Conventions

- **Backend modules**: kebab-case directories (`room-groups/`)
- **Backend files**: kebab-case (`buildings.controller.ts`, `building.schema.ts`)
- **Frontend pages**: PascalCase (`BuildingsPage.tsx`, `LoginPage.tsx`)
- **Frontend components**: PascalCase (`RoomCard.tsx`, `BuildingSelector.tsx`)
- **Frontend UI**: lowercase (`button.tsx`, `dialog.tsx`) — shadcn convention
- **Stores**: camelCase (`authStore.ts`, `themeStore.ts`)
- **Path aliases**: `@common/`, `@config/`, `@modules/` (backend); `@/` (frontend)
