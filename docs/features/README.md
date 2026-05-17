# Feature Playbooks

> Per-module reference cho AI agent khi build/sửa Room Manager.
> Mỗi file mô tả 1 module: domain, data model, API, business rules, FE touchpoints, dependencies, gotchas.
> Đọc file khớp với task của bạn trước khi sửa code.

## Modules

| Module          | File                                     | Domain                          |
|-----------------|------------------------------------------|---------------------------------|
| auth            | [auth.md](auth.md)                       | JWT login/register/logout/refresh; multi-tenant auth |
| users           | [users.md](users.md)                     | Root entity for multi-tenant system; all entities have ownerId reference |
| buildings       | [buildings.md](buildings.md)             | Top-level organization unit; all rooms/contracts belong to a Building |
| room-groups     | [room-groups.md](room-groups.md)         | Optional classification labels for Rooms to enable filtering/organizing |
| rooms           | [rooms.md](rooms.md)                     | Central entity; physical units for rent, link Building with Contract/Invoice |
| tenants         | [tenants.md](tenants.md)                 | Tenant profiles; linked to Rooms via Contract, source of Invoice/Payment |
| services        | [services.md](services.md)               | Catalog of chargeable services (electricity, water, etc.) with FIXED/TABLE pricing |
| contracts       | [contracts.md](contracts.md)             | Core of rental lifecycle; link Room with Tenant, determine finances, dispatch Invoices |
| invoices        | [invoices.md](invoices.md)               | Financial vouchers from Contract; record all period costs, tracked by Payments |
| payments        | [payments.md](payments.md)               | Record actual rent payments, auto-update Invoice status and paid amount |
| notifications   | [notifications.md](notifications.md)     | In-app notifications for events (invoices, contracts, payments, system) |
| calendar        | [calendar.md](calendar.md)               | View-only aggregate; timeline of Contract and Invoice events by date/month |

## Template (7 sections, fixed)

1. Purpose & Relations
2. Data Model (schema + enums + DTO)
3. API Endpoints
4. Business Rules & State Machine
5. Frontend Touchpoints
6. Cross-Module Dependencies
7. Gotchas & Testing Notes

Xem `docs/superpowers/specs/2026-05-17-feature-playbook-design.md` cho full spec.
