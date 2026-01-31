# Phase 02: Frontend UI & Integration
Status: ⬜ Pending
Dependencies: Phase 01

## Objective
Implement the user interface for notifications in the Dashboard Navbar, allowing users to view and interact with alerts.

## Requirements
### Functional
- [ ] Bell icon in Navbar with red badge for unread count.
- [ ] Dropdown menu showing list of notifications (max 5-10 visible).
- [ ] "Mark as read" functionality when clicking or opening.
- [ ] "View all" link (optional for now).
- [ ] Auto-refresh every 30-60 seconds.

### UI/UX
- [ ] Use `lucide-react` Bell icon.
- [ ] Shadcn `DropdownMenu` component.
- [ ] Empty state: "No new notifications".
- [ ] Loading state: Skeleton or spinner.

## Implementation Steps
1. [ ] Create API client functions in `frontend/src/api/notifications.api.ts`
2. [ ] Create React Query hooks in `frontend/src/hooks/useNotifications.ts` (`useGetNotifications`, `useGetUnreadCount`, `useMarkRead`)
3. [ ] Create `NotificationItem` component (UI for single row)
4. [ ] Create `NotificationDropdown` component (The bell + dropdown)
5. [ ] Integrate `NotificationDropdown` into `DashboardLayout.tsx`

## Files to Create/Modify
- `frontend/src/api/notifications.api.ts`
- `frontend/src/hooks/useNotifications.ts`
- `frontend/src/components/common/NotificationDropdown.tsx` (New)
- `frontend/src/layouts/DashboardLayout.tsx` (Modify)

## Test Criteria
- [ ] Unread count appears on load.
- [ ] Clicking Bell opens dropdown.
- [ ] Clicking item marks as read (badge updates).
- [ ] New notification appears after polling interval.

---
End of Plan
