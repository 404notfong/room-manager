# Testing — Room Management System

## Overview

Testing coverage is **minimal**. Only 2 test files exist across the entire codebase.

## Backend Testing

### Framework
- **Jest** ^29.7.0 with ts-jest
- Config in `backend/package.json` (jest section)
- Module aliases configured: `@common/`, `@config/`, `@modules/`, `@shared/`

### Test Files
- `backend/src/modules/contracts/contracts.service.spec.ts` — Contract service unit test (only backend test)

### Scripts
```bash
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:cov       # Coverage report
npm run test:debug     # Debug mode
npm run test:e2e       # E2E tests (jest-e2e.json config)
```

### Coverage
- **1 test file** out of 12 services (8% service coverage)
- No controller tests
- No integration tests
- No e2e tests (framework configured but no test files)

## Frontend Testing

### Framework
- **Vitest** ^1.0.0 — Vite-native test runner
- **@testing-library/react** ^14.0.0 — Component testing
- **@testing-library/user-event** ^14.0.0 — User interaction simulation
- **jsdom** ^24.0.0 — Browser environment

### Test Files
- `frontend/src/lib/priceTableValidation.test.ts` — Price table validation logic test (12KB - thorough)

### Scripts
```bash
npm test               # Run vitest
```

### Coverage
- **1 test file** for utility/library code
- No component tests
- No page tests
- No hook tests
- No API tests

## E2E Testing

### Framework
- **Playwright** (configured via `.playwright-mcp/` directory at root)
- **E2E directory**: `e2e/` at project root

### Status
- Framework configured but test coverage unknown (separate directory)

## Test Data

### Seeding
- `backend/src/scripts/seed.ts` — Database seeding script
- Uses `@faker-js/faker` ^10.2.0 for data generation
- Run via: `npm run seed`

## Mocking
- Backend: NestJS Testing module (`@nestjs/testing`)
- No mock utilities or shared fixtures observed

## Gaps

- **Critical gap**: No tests for auth flow (login, register, JWT validation)
- **Critical gap**: No tests for invoice/payment calculations
- **No CI/CD test pipeline** detected
- **No test utilities** or shared test helpers
- Most business logic in services is untested
- Frontend has no component or integration tests
