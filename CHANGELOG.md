# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-02-10

### Added
- **Backend**: Active contract update restrictions — strips immutable fields (building, room, contractType, startDate), checks invoice count for meter indexes
- **Frontend**: Disabled fields with amber hint text for ACTIVE contracts in ContractForm
- **Frontend**: Translations (vi/en) for `cannotChangeActiveField` and `cannotChangeMeterWithInvoice`

### Changed
- **Frontend**: ACTIVE contract badge color from emerald (green) to blue-500 to match dashboard OCCUPIED color

### Fixed
- **Backend**: `CreateInvoiceDto` whitelist validation — added `initialElectricIndex`, `initialWaterIndex`, `ServiceChargeDto.quantity/isRecurring/_id`

---

## [Unreleased] - 2026-02-03

### Added
- **Frontend**: "Overdue" badge (Red) for Deposited rooms with past start dates.
- **Frontend**: "Deposited" status filter in Dashboard.
- **Frontend**: "Occupied" badge (Blue) to Room Card header.
- **Frontend**: Missing translation for `contracts.overdue`.
- **Frontend**: Full Internationalization support for Price Table and Room Cards.
- **Backend**: `POST /rooms/fix-order` endpoint to initialize room ordering.

### Changed
- **Frontend**: **Dashboard Split**: Separated "Dashboard" (Stats) and "Board" (Room Management).
- **Frontend**: **Ultra-Compact Room Card UI**: Reduced padding, fonts, and spacing.
- **Frontend**: Moved Available/Maintenance status from button to Header Badge.
- **Frontend**: Reordered Dashboard status badges (Occupied -> Deposited -> Available).
- **Frontend**: Implemented **Dynamic Pagination** (Max 2 rows per group) responsive to screen width.
- **Frontend**: Enabled **Drag and Drop** for Room Cards.

### Fixed
- **Frontend**: Removed pagination from `RoomGroupCollapse` to allow seamless drag-and-drop.
