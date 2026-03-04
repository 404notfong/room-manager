# Stack — Room Management System

## Runtime & Languages

| Layer | Language | Version | Runtime |
|-------|----------|---------|---------|
| Backend | TypeScript | ^5.3.3 | Node.js >= 18 |
| Frontend | TypeScript | ^5.3.3 | Browser (Vite dev server) |

## Backend Stack

### Framework
- **NestJS** ^10.3.0 — Modular Node.js framework with dependency injection
- **Platform**: Express (`@nestjs/platform-express`)

### Database
- **MongoDB** >= 5.0 (Docker image: `mongo:4.4`)
- **Mongoose** ^8.0.3 via `@nestjs/mongoose` ^10.0.2
- Schema-based ODM with 10 schemas (building, room, tenant, contract, invoice, payment, service, room-group, notification, user)

### Authentication
- **Passport** ^0.7.0 with `passport-jwt` ^4.0.1 and `passport-local` ^1.0.0
- **JWT** via `@nestjs/jwt` ^10.2.0
- Access + Refresh token pattern
- **bcrypt** ^5.1.1 for password hashing

### Validation
- **class-validator** ^0.14.0 — Decorator-based DTO validation
- **class-transformer** ^0.5.1 — DTO transformation

### Internationalization
- **nestjs-i18n** ^10.4.5 — Server-side i18n with AcceptLanguage, Header, Query resolvers
- Languages: English (en), Vietnamese (vi)

### Logging
- **Winston** ^3.11.0 via `nest-winston` ^1.9.4
- Console + File transports (error.log, combined.log)

### Security
- **Helmet** ^8.1.0 — HTTP security headers
- **@nestjs/throttler** ^6.5.0 — Rate limiting (100 req/60s)

### Utilities
- **date-fns** ^4.1.0 — Date manipulation
- **dotenv** ^16.3.1 — Environment loading

### Dev/Test
- **Jest** ^29.7.0 + ts-jest — Unit testing
- **@faker-js/faker** ^10.2.0 — Test data generation
- **ESLint** + **Prettier** — Code formatting

## Frontend Stack

### Framework & Build
- **React** ^18.2.0 with react-dom
- **Vite** ^5.0.11 — Build tool + dev server
- **@vitejs/plugin-react** ^4.2.1

### Styling
- **Tailwind CSS** ^3.4.1 with `tailwindcss-animate`
- **PostCSS** + Autoprefixer
- Custom tailwind config with plugins

### UI Components
- **shadcn/ui** component library (28 components in `frontend/src/components/ui/`)
  - Built on Radix UI primitives (@radix-ui/react-*)
  - class-variance-authority, clsx, tailwind-merge for class composition
- **Lucide React** ^0.303.0 — Icon library
- **cmdk** ^1.1.1 — Command palette

### State Management
- **Zustand** ^4.4.7 — Client state (auth, building selection, theme)
- **@tanstack/react-query** ^5.17.9 — Server state / data fetching cache

### Routing
- **react-router-dom** ^6.21.1 — Client-side routing

### Forms & Validation
- **react-hook-form** ^7.70.0 + @hookform/resolvers
- **Zod** ^3.25.76 — Schema validation (used with react-hook-form)
- **react-number-format** ^5.4.4 — Number input formatting

### Internationalization
- **i18next** ^23.7.16 + react-i18next ^14.0.0
- Browser language detection + HTTP backend loader
- Translation files in `frontend/public/locales/`

### Date Handling
- **date-fns** ^3.0.6
- **react-day-picker** ^9.13.0 — Calendar/date picker

### Drag & Drop
- **@dnd-kit/core** ^6.3.1 + @dnd-kit/sortable ^10.0.0

### Export/PDF
- **jspdf** ^4.0.0 — PDF generation
- **html2canvas** ^1.4.1 — HTML to canvas capture

### Dev/Test
- **Vitest** ^1.0.0 — Unit testing
- **@testing-library/react** ^14.0.0 — Component testing
- **jsdom** ^24.0.0 — Browser environment simulation

## Infrastructure

### Containerization
- **Docker Compose** v3.8 — 3 services (mongodb, backend, frontend)
- Backend Dockerfile → Node.js
- Frontend Dockerfile → Nginx (serving built assets on port 80)

### Deployment
- **Vercel** config exists (`frontend/vercel.json`) for frontend
- **PM2** (`backend/ecosystem.config.json`) for backend process management

### Configuration
- `.env` files for both backend and frontend
- Backend: MONGODB_URI, JWT_SECRET, CORS_ORIGIN, etc.
- Frontend: VITE_API_URL
