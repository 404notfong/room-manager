# Plan: Notification System
Created: 2026-01-29 14:55
Status: 🟡 In Progress

## Overview
Implement a notification system to alert admins about important events (Contract expiry, Invoice due, System messages).
The system will start with a basic polling mechanism and a dropdown UI on the Dashboard Navbar.

## Tech Stack
- **Backend:** NestJS, MongoDB (Mongoose)
- **Frontend:** React, Zustand, React Query (Polling), Shadcn UI
- **Type:** Polling (Interval: 60s)

## Phases

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 01 | Backend API & Schema | ⬜ Pending | 0% |
| 02 | Frontend UI & Integration | ⬜ Pending | 0% |

## Phase Details

### Phase 01: Backend API & Schema
- **Goal:** Create `NotificationsModule` to manage notifications.
- **Key Tasks:**
    - Create `Notification` Schema (`userId`, `title`, `message`, `type`, `isRead`, `metadata`).
    - Create `NotificationsController`:
        - `GET /notifications`: Get paginated notifications for user.
        - `GET /notifications/unread-count`: Get count.
        - `PATCH /notifications/:id/read`: Mark as read.
        - `PATCH /notifications/read-all`: Mark all as read.
    - Create `NotificationsService`.

### Phase 02: Frontend UI & Integration
- **Goal:** Display notifications in Navbar.
- **Key Tasks:**
    - Create `useNotificationStore` (optional, or just use Query).
    - Implement `useNotifications` hook with `useQuery` (refetchInterval: 30000).
    - Create `NotificationDropdown` component using Shadcn `DropdownMenu`.
    - Integrate `NotificationDropdown` into `DashboardLayout`.
    - Functionality: Show badge count, List items, Click to mark read/navigate.

## Quick Commands
- Start Phase 1: `/code phase-01`
