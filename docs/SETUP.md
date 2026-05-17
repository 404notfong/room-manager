# Room Manager — Setup & Deployment Guide

## Prerequisites

| Tool | Version | Kiểm tra |
|------|---------|---------|
| Node.js | ≥ 18 | `node --version` |
| npm | ≥ 9 | `npm --version` |
| MongoDB | ≥ 5.0 | `mongod --version` |
| Docker (optional) | ≥ 20 | `docker --version` |

---

## 1. Local Development

### 1.1 Clone & Install

```bash
git clone <repo-url> room-manager
cd room-manager

# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### 1.2 Environment Configuration

**Backend** — tạo file `backend/.env`:
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/room-manager
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your-refresh-secret-change-this
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
```

**Frontend** — tạo file `frontend/.env`:
```env
VITE_API_URL=http://localhost:3000
```

### 1.3 Start Development Servers

```bash
# Terminal 1 — Backend (NestJS, port 3000)
cd backend
npm run start:dev

# Terminal 2 — Frontend (Vite, port 5173)
cd frontend
npm run dev
```

**URLs:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api

### 1.4 Seed Data (Optional)

```bash
cd backend
npm run seed
```

---

## 2. Docker Deployment

### 2.1 Quick Start

```bash
# Build và start tất cả services
docker-compose up -d

# Xem logs
docker-compose logs -f

# Chỉ xem logs backend
docker-compose logs -f backend
```

### 2.2 Services

| Service | Port | Container |
|---------|------|-----------|
| MongoDB | 27017 | `room-manager-mongodb` |
| Backend (NestJS) | 3000 | `room-manager-backend` |
| Frontend (nginx) | 80 | `room-manager-frontend` |

### 2.3 Environment Variables (Production)

Tạo file `.env` ở root:
```env
JWT_SECRET=production-secret-key-very-long-random-string
REFRESH_TOKEN_SECRET=production-refresh-secret-very-long-random-string
```

### 2.4 Rebuild

```bash
# Rebuild khi thay đổi code
docker-compose up -d --build

# Reset toàn bộ (xóa data)
docker-compose down -v
docker-compose up -d --build
```

---

## 3. Common Commands

### Backend
```bash
cd backend
npm run start:dev      # Dev server (hot reload)
npm run build          # Build production
npm run start:prod     # Run production build
npm run lint           # Lint check
npm run test           # Run tests
npm run seed           # Seed sample data
```

### Frontend
```bash
cd frontend
npm run dev            # Dev server (HMR, port 5173)
npm run build          # Build production
npm run preview        # Preview production build
npm run lint           # Lint check
npm run test           # Run vitest
```

---

## 4. Troubleshooting

| Vấn đề | Giải pháp |
|---------|-----------|
| MongoDB connection failed | Kiểm tra MongoDB đang chạy: `mongod --version` hoặc `docker ps` |
| CORS error | Kiểm tra `CORS_ORIGIN` trong backend `.env` match với frontend URL |
| JWT expired | Refresh page sẽ tự động dùng refresh token. Nếu vẫn lỗi → đăng nhập lại |
| Port 3000/5173 in use | Kill process: `netstat -ano \| findstr :3000` rồi `taskkill /PID <pid> /F` |
| Frontend build fails | Xóa `node_modules` + `npm install` lại |
| i18n missing keys | Check console warnings, thêm key vào `locales/{lang}/translation.json` |

---

## 5. Project Structure Quick Reference

```
room-manager/
├── backend/              # NestJS API server
│   ├── src/
│   │   ├── common/       # Guards, filters, decorators, enums
│   │   ├── config/       # Database config
│   │   ├── i18n/         # Backend translations (en/, vi/)
│   │   ├── modules/      # 12 feature modules
│   │   ├── scripts/      # Seed scripts
│   │   ├── app.module.ts # Root module
│   │   └── main.ts       # Entry point
│   └── package.json
├── frontend/             # React + Vite
│   ├── public/locales/   # Frontend translations (en/, vi/)
│   ├── src/
│   │   ├── api/          # Axios client
│   │   ├── components/   # UI + forms + dashboard
│   │   ├── hooks/        # Custom hooks
│   │   ├── layouts/      # DashboardLayout
│   │   ├── lib/          # Utils + Zod validations
│   │   ├── pages/        # 10 page modules
│   │   ├── stores/       # Zustand stores
│   │   └── types/        # TypeScript types
│   └── package.json
├── design-system/        # Design System documentation
│   └── MASTER.md         # Source of truth for UI tokens
├── docs/                 # Project documentation
├── docker-compose.yml    # Docker deployment
└── README.md
```
