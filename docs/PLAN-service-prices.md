# Project Plan - Service Prices Display

Implementation of detailed service price listings on the Dashboard Room Cards and the Contract View.

## Phase 1: Dashboard Enhancement
Modify the `RoomCard` component to display the price alongside the service name, rather than just the service name.

- **Objective**: Provide immediate financial visibility for recurring service charges.
- **UI Strategy**: Change service badges to show `Name: Price` format or show them in a more ledger-like vertical list if they are recurring.
- **Components**: `RoomCard.tsx`

## Phase 2: Contract View Enhancement
Ensure the Contract details view correctly lists all services with their associated costs and recurrence status.

- **Objective**: Allow users to see the full breakdown of contract costs during audit/viewing.
- **Components**: `ContractViewModal.tsx` (or equivalent details component).

## Phase 3: Translation Updates
Add any necessary translation keys for "Recurring", "One-time", and "Total Services".

- **Files**: `vi/translation.json`, `en/translation.json`

## Phase 4: Verification
- Manual check of Room Cards for both Long-term and Short-term.
- Manual check of the Contract View modal.

## Task Breakdown

### [EXECUTION] Frontend
- [ ] Refactor `renderLongTermContent` in `RoomCard.tsx` to include service prices.
- [ ] Update `ContractViewModal.tsx` table/list to include price columns.
- [ ] Add Vietnamese/English keys for service price units.

### [EXECUTION] Backend
- [ ] (Optional) Double check that `rooms.service.ts` projects the full `serviceCharges` array with `amount`. (Already verified: Yes).

## Agent Assignments
- **Antigravity**: Implementation and UI Refinement.
- **Project Planner**: Verification Checklist creation.
