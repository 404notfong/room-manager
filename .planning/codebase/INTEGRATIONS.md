# Integrations — Room Management System

## Database

### MongoDB
- **Connection**: Via Mongoose ODM (`@nestjs/mongoose`)
- **Config**: `backend/src/config/database.config.ts`
- **Connection string**: `MONGODB_URI` env var (default: `mongodb://localhost:27017/room-manager`)
- **Docker**: `mongo:4.4` container with volume `mongodb_data`

### Collections (inferred from schemas)
| Collection | Schema File | Purpose |
|------------|-------------|---------|
| users | `modules/users/schemas/user.schema.ts` | User accounts |
| buildings | `modules/buildings/schemas/building.schema.ts` | Properties |
| rooms | `modules/rooms/schemas/room.schema.ts` | Individual rooms |
| roomgroups | `modules/room-groups/schemas/room-group.schema.ts` | Room groupings |
| tenants | `modules/tenants/schemas/tenant.schema.ts` | Tenant records |
| contracts | `modules/contracts/schemas/contract.schema.ts` | Rental contracts |
| invoices | `modules/invoices/schemas/invoice.schema.ts` | Billing invoices |
| payments | `modules/payments/schemas/payment.schema.ts` | Payment records |
| services | `modules/services/schemas/service.schema.ts` | Utility services |
| notifications | `modules/notifications/schemas/notification.schema.ts` | Notifications |

## Authentication Provider

### JWT (Self-hosted)
- **Strategy**: `passport-jwt` (Passport.js)
- **Config**: `backend/src/config/jwt.config.ts`
- **Token storage**: `localStorage` (frontend)
- **Env vars**:
  - `JWT_SECRET` — Access token signing key
  - `JWT_EXPIRES_IN` — Access token TTL (default: 1h production, 7d docker)
  - `REFRESH_TOKEN_SECRET` — Refresh token signing key
  - `REFRESH_TOKEN_EXPIRES_IN` — Refresh token TTL (default: 7d/30d)

## External APIs

**None detected.** This is a self-contained system — no external API calls, payment gateways, email services, SMS providers, or cloud storage integrations. All data is managed internally.

## Deployment Targets

### Docker Compose (primary)
- 3 services: `mongodb`, `backend`, `frontend`
- Network: `room-manager-network` (bridge)
- Ports: MongoDB 27017, Backend 3000, Frontend 80
- Frontend served via Nginx

### Vercel (frontend alternative)
- Config: `frontend/vercel.json`
- SPA routing rewrites configured

### PM2 (backend alternative)
- Config: `backend/ecosystem.config.json`
- Process management for production Node.js

## CORS Configuration
- Backend `CORS_ORIGIN` env var
- Development: `http://localhost:5173` (Vite dev server)
- Production: `http://localhost` (Docker nginx)

## Webhooks / Events
**None detected.** No webhook receivers or event publishers.

## File Storage
**None detected.** No file upload/storage integration (S3, local filesystem, etc.).

## Email / SMS
**None detected.** No email or SMS sending capability.
