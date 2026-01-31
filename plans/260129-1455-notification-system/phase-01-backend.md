# Phase 01: Backend API & Schema
Status: ⬜ Pending
Dependencies: None

## Objective
Establish the backend foundation for the Notification System, enabling storage, retrieval, and management of user notifications.

## Requirements
### Functional
- [ ] Schema `Notification` must support `userId`, `title`, `message`, `type`, `isRead`, `metadata`.
- [ ] API to fetch paginated notifications (sorted by createdAt desc).
- [ ] API to fetch unread count (for badge).
- [ ] API to mark single/all notifications as read.
- [ ] Service method `createNotification` for internal use by other modules.

### Non-Functional
- [ ] Use `lean()` for read performance.
- [ ] Indexes on `userId` and `createdAt`.

## Implementation Steps
1. [ ] Generate Module: `nest g module notifications`
2. [ ] Generate Controller: `nest g controller notifications`
3. [ ] Generate Service: `nest g service notifications`
4. [ ] Define Mongoose Schema `Notification` in `notifications.schema.ts`
5. [ ] Implement Service methods (`create`, `findAll`, `countUnread`, `markRead`)
6. [ ] Implement Controller endpoints (`GET /`, `GET /unread`, `PATCH /read`, `PATCH /:id/read`)

## Files to Create/Modify
- `backend/src/notifications/notifications.module.ts`
- `backend/src/notifications/notifications.controller.ts`
- `backend/src/notifications/notifications.service.ts`
- `backend/src/notifications/schemas/notification.schema.ts`
- `backend/src/app.module.ts` (Import module)

## Test Criteria
- [ ] `POST /notifications` (internal test) creates a record.
- [ ] `GET /notifications` returns list.
- [ ] `PATCH /notifications/:id/read` updates `isRead` to true.

---
Next Phase: [Phase 02](phase-02-frontend.md)
