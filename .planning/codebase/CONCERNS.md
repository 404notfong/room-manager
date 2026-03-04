# Concerns — Room Management System

## High Priority

### 1. Massive Component Files
Several frontend components are extremely large and likely unmaintainable:

| File | Size | Issue |
|------|------|-------|
| `components/dashboard/RoomCard.tsx` | 62KB | Single component doing too much |
| `components/CreateShortTermInvoiceModal.tsx` | 41KB | Modal with complex business logic |
| `components/CreateInvoiceModal.tsx` | 37KB | Duplicate logic with short-term variant |
| `lib/validations.ts` | 31KB | Monolithic validation file |
| `components/dashboard/RoomStatusOverview.tsx` | 31KB | Large overview component |
| `components/ContractViewModal.tsx` | 30KB | View modal with rich display logic |
| `layouts/DashboardLayout.tsx` | 24KB | Layout doing too much |

**Impact**: Hard to maintain, review, debug. High risk of merge conflicts. Component decomposition needed.

### 2. Extremely Low Test Coverage
- Only **2 test files** in entire codebase
- No tests for core business logic: invoicing, payments, contracts
- No auth flow tests
- No API endpoint tests
- No frontend component tests

**Impact**: Changes risk breaking untested behavior. Refactoring is risky without test safety net.

### 3. Security Concerns
- **JWT tokens in localStorage** — Vulnerable to XSS attacks. HttpOnly cookies would be more secure.
- **No CSRF protection** visible
- **JWT secret in docker-compose.yml** as default value — Risk of production deployment with weak default
- **No input sanitization** beyond class-validator
- **Rate limiting** is global (100/60s) — may not be sufficient for sensitive endpoints like login

### 4. No Centralized API Layer
Frontend API calls are scattered:
- `api/client.ts` — Base axios config
- `api/auth.api.ts` — Auth calls
- `api/calendar.ts` — Calendar calls
- `api/notifications.api.ts` — Notification calls
- **Missing**: API files for buildings, rooms, tenants, contracts, invoices, payments, services, room-groups

Most API calls likely live inline in page/component files using React Query, making them hard to find and maintain.

## Medium Priority

### 5. Duplicate Code Patterns
- `CreateInvoiceModal.tsx` (37KB) and `CreateShortTermInvoiceModal.tsx` (41KB) likely share significant logic
- Each page probably has its own data-fetching setup rather than shared hooks
- Schema definitions (MongoDB) and frontend types may not be in sync

### 6. No TypeScript Strict Mode
- Backend and frontend both lack `strict: true` in tsconfig
- No `strictNullChecks` — potential runtime null/undefined errors
- `types/` directory is empty — types likely co-located or missing

### 7. Missing Infrastructure
- **No CI/CD pipeline** detected (no `.github/actions`, no Jenkinsfile, etc.)
- **No database migrations** — Schema changes rely on Mongoose auto-handling
- **No monitoring/observability** — Winston logs only, no APM or metrics
- **No email/notification service** — Notifications stored but not delivered
- **No file upload** — Cannot attach documents to contracts/invoices

### 8. Outdated Dependencies
- Docker uses `mongo:4.4` (old) — Latest is 7.x
- Some dependencies may have security patches pending
- `eslint` 8.x (frontend) — 9.x is current

## Low Priority

### 9. Frontend Architecture
- Zustand stores are minimal (auth, building, theme) — most state likely in React Query + component state
- No error boundary components detected
- No loading/error states standardized across pages
- No shared table/list component — each page likely implements its own

### 10. Backend Architecture  
- No caching layer (Redis or in-memory)
- No pagination standards visible at common level
- `app.module.ts` imports all 12 modules directly — no lazy loading
- No database seeding for development beyond custom script

### 11. Developer Experience
- `replace-imports.ps1` PowerShell script in backend — suggests manual import management issues
- `errors.txt` in frontend root — leftover debug file
- No development documentation beyond README
- No API documentation (Swagger/OpenAPI not installed)
