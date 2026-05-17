# Feature Playbooks

> Per-module reference cho AI agent khi build/sửa Room Manager.
> Mỗi file mô tả 1 module: domain, data model, API, business rules, FE touchpoints, dependencies, gotchas.
> Đọc file khớp với task của bạn trước khi sửa code.

## Modules

| Module          | File                                     | Domain                          |
|-----------------|------------------------------------------|---------------------------------|
| auth            | [auth.md](auth.md)                       | TBD                             |
| users           | [users.md](users.md)                     | TBD                             |
| buildings       | [buildings.md](buildings.md)             | TBD                             |
| room-groups     | [room-groups.md](room-groups.md)         | TBD                             |
| rooms           | [rooms.md](rooms.md)                     | TBD                             |
| tenants         | [tenants.md](tenants.md)                 | TBD                             |
| services        | [services.md](services.md)               | TBD                             |
| contracts       | [contracts.md](contracts.md)             | TBD                             |
| invoices        | [invoices.md](invoices.md)               | TBD                             |
| payments        | [payments.md](payments.md)               | TBD                             |
| notifications   | [notifications.md](notifications.md)     | TBD                             |
| calendar        | [calendar.md](calendar.md)               | TBD                             |

## Template (7 sections, fixed)

1. Purpose & Relations
2. Data Model (schema + enums + DTO)
3. API Endpoints
4. Business Rules & State Machine
5. Frontend Touchpoints
6. Cross-Module Dependencies
7. Gotchas & Testing Notes

Xem `docs/superpowers/specs/2026-05-17-feature-playbook-design.md` cho full spec.
