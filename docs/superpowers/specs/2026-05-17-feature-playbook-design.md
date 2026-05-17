# Feature Playbook System — Design Spec

> **Ngày**: 2026-05-17
> **Tác giả**: brainstorm session với owner (carnextdev@gmail.com)
> **Mục tiêu**: Xây dựng tài liệu per-feature làm "superpower" reference cho AI agent khi build / sửa các module trong Room Manager.

---

## 1. Mục tiêu & Bối cảnh

### Vấn đề hiện tại
- `docs/` đã có `PROJECT-OVERVIEW.md` (1164 dòng) và `V2-OVERVIEW.md` (395 dòng), nhưng là snapshot **2026-05-04** (~1 năm trước) và rất khả năng đã lệch khỏi code hiện tại.
- Không có per-module reference rõ ràng → AI agent khi build feature mới phải tự đọc lại schema/service/controller/dto, dễ miss invariants hoặc cross-module side effects.
- `docs/ARCHITECTURE.md` + `docs/API.md` chỉ tổng quan, không đủ chi tiết để dùng làm prompt context.

### Người dùng đầu cuối
- **Primary**: AI agent (Claude) khi nhận task build/sửa 1 module → load đúng 1 file playbook để có full context.
- **Secondary**: Human dev mới onboard, hoặc tác giả nhìn lại business logic của module.

### Kết quả thành công
- 12 file `docs/features/<module>.md` (1 per module), bám đúng template 7-section.
- 1 file `docs/features/README.md` index để AI scan nhanh.
- Tất cả fact trong playbook đến từ **code hiện tại**, không phải docs cũ.
- Docs cũ archive sang `docs/archive/` (không xóa).

---

## 2. Phạm vi (Scope)

### In-scope
- 12 modules: `auth`, `users`, `buildings`, `room-groups`, `rooms`, `tenants`, `services`, `contracts`, `invoices`, `payments`, `notifications`, `calendar`.
- Folder layout: `docs/features/`, `docs/archive/`.
- 1 plan duy nhất cover toàn bộ 12 file.
- Index `docs/features/README.md`.

### Out-of-scope (cho lần này)
- Cập nhật `docs/ARCHITECTURE.md` / `docs/API.md` (giữ nguyên).
- Tạo skill mới trong `.agent/skills/`.
- Documenting kiến trúc cross-module (ví dụ event-driven flow giữa Invoice → Notification) ngoài phần "Cross-Module Dependencies" trong từng file.
- E2E/test playbook riêng.
- Documenting Docker/deploy.

---

## 3. Folder Layout & Naming

```
docs/
├── features/              ← MỚI
│   ├── README.md          ← index: bảng module + path + 1-line summary
│   ├── auth.md
│   ├── users.md
│   ├── buildings.md
│   ├── room-groups.md
│   ├── rooms.md
│   ├── tenants.md
│   ├── services.md
│   ├── contracts.md
│   ├── invoices.md
│   ├── payments.md
│   ├── notifications.md
│   └── calendar.md
├── archive/               ← MỚI (di chuyển từ docs/)
│   ├── PROJECT-OVERVIEW.md
│   └── V2-OVERVIEW.md
├── ARCHITECTURE.md        (giữ nguyên)
├── API.md                 (giữ nguyên)
├── SETUP.md               (giữ nguyên)
└── PLAN-*.md              (giữ nguyên — unrelated planning docs)
```

**`docs/features/README.md`** chứa bảng:

```
| Module          | File                | Domain                                            |
|-----------------|---------------------|---------------------------------------------------|
| auth            | auth.md             | JWT login/register/refresh                        |
| users           | users.md            | User CRUD, profile, password change               |
| buildings       | buildings.md        | Tòa nhà (parent của rooms)                        |
| ...             | ...                 | ...                                               |
```

---

## 4. Per-File Template (7 sections — định dạng cứng)

Mỗi `docs/features/<module>.md` BẮT BUỘC bám đúng cấu trúc:

```markdown
# <Module> Playbook

> **Vai trò trong domain**: <1 câu>
> **Code paths**: `backend/src/modules/<module>/`, `frontend/src/pages/<Module>*.tsx`

## 1. Purpose & Relations
- Mục đích nghiệp vụ (3-5 câu, VI)
- Sơ đồ quan hệ với module khác (ASCII hoặc bullet)

## 2. Data Model

### Schema (`<module>.schema.ts`)
| Field | Type | Required | Default | Mô tả |
|-------|------|----------|---------|-------|
| ...   | ...  | ...      | ...     | ...   |

- Indexes
- Virtuals / hooks (pre-save, post-save) nếu có

### Enums liên quan
Liệt kê từ `common/constants/enums.ts`, chỉ những enum module này thực sự dùng.

### DTO validation
- **CreateDto**: list rule (e.g., `buildingId: @IsMongoId @IsNotEmpty`)
- **UpdateDto**: thêm/khác gì so với Create
- Cross-field validation nếu có

## 3. API Endpoints

| Method | Path | Auth | Mô tả | Request body | Response shape |
|--------|------|------|-------|--------------|----------------|
| ...    | ...  | ...  | ...   | ...          | ...            |

## 4. Business Rules & State Machine
- **Invariants**: rules không bao giờ vi phạm (ví dụ: `ownerId` luôn filter, `isDeleted: false` mặc định)
- **State machine** (nếu có status): ASCII diagram hoặc bullet condition
- **Auto-actions**: side effects (notifications gửi khi nào, cascade updates...)

## 5. Frontend Touchpoints
- **Pages**: list `<file>.tsx` với chức năng 1 dòng
- **Components quan trọng**: forms, modals, tables
- **Key i18n keys**: namespace + leaf keys chính (extract từ `frontend/public/locales/vi/translation.json`)

## 6. Cross-Module Dependencies
- **Module này CẦN**: foreign refs (Building, Room, Tenant...) và lý do
- **Module khác CẦN module này**: ai consume schema/data này

## 7. Gotchas & Testing Notes
- Common pitfalls (vd: forget `Types.ObjectId` convert, missing `ownerId` filter)
- Test scenarios chính (happy + edge)
```

**Quy ước ngôn ngữ:**
- Tiêu đề section: EN (consistent với code và tools)
- Nội dung diễn giải: VI (matching CLAUDE.md / project default)
- Tên technical (field name, enum, route): giữ nguyên EN

---

## 5. Subagent Prompt Contract

Mỗi subagent (general-purpose) nhận **identical-structure prompt** chỉ khác `<module>`:

```
You are documenting the `<module>` module of Room Manager
(stack: NestJS 10 + Mongoose 8 + React 18 + Vite + Tailwind + Radix).

INPUT FILES (read these in full, do NOT skim):
- backend/src/modules/<module>/<module>.schema.ts
- backend/src/modules/<module>/<module>.service.ts
- backend/src/modules/<module>/<module>.controller.ts
- backend/src/modules/<module>/<module>.module.ts
- backend/src/modules/<module>/dto/*.ts
- backend/src/common/constants/enums.ts (extract only enums used by this module)
- frontend/src/pages/ — use Glob to find all files whose name contains <module> (case-insensitive: e.g. for "rooms" match Rooms.tsx, RoomBoard.tsx, RoomDetail.tsx)
- frontend/src/components/ — same discovery rule for modal/form components related to <module>
- frontend/public/locales/vi/translation.json (extract <module>.* keys)

OUTPUT: Write a single file at docs/features/<module>.md following EXACTLY
this template: [paste full template from Section 4]

RULES:
- All facts MUST come from code, not assumptions
- Quote schema field names verbatim
- For API endpoints, copy exact route from @Controller/@Get/@Post/@Put/@Patch/@Delete decorators
- For DTO validation, copy class-validator decorator names exactly
- Mark unknowns as `TODO: <reason>` with `file:line` citation
- Body language: Vietnamese; technical names (fields, routes, enums): English
- Target length: 250-500 lines
- Do NOT modify any other file
- Do NOT run code or execute commands beyond Read/Grep/Glob/Write
```

Subagent type: **general-purpose** (vì module-agnostic, không cần specialist).

---

## 6. Orchestration Pipeline

```
Phase 1 — Pre-flight (main session)
  1.1. mkdir docs/features/  docs/archive/
  1.2. git mv docs/PROJECT-OVERVIEW.md docs/archive/PROJECT-OVERVIEW.md
  1.3. git mv docs/V2-OVERVIEW.md     docs/archive/V2-OVERVIEW.md
  1.4. Write docs/features/README.md (skeleton index — chỉ tên file, summary sẽ điền sau Phase 3)

Phase 2 — Parallel subagent dispatch (single message, 12 Agent tool calls)
  Dispatch 12 subagents:
    auth, users, buildings, room-groups, rooms, tenants,
    services, contracts, invoices, payments, notifications, calendar

Phase 3 — Consolidation (main session)
  3.1. Read all 12 generated files
  3.2. Run consistency check (xem Section 7)
  3.3. Update docs/features/README.md với 1-line summary từng module
  3.4. Stage và commit toàn bộ — 1 commit duy nhất:
       "docs(features): add per-module playbooks + archive V1 overviews"
```

**Concurrency note**: 12 Agent tool calls trong 1 message → chạy parallel. Mỗi subagent có context riêng, không share state.

---

## 7. Quality Controls

### Self-review checklist (chạy sau Phase 2)
- [ ] Mỗi file có đủ 7 section, đúng thứ tự, đúng tiêu đề
- [ ] Không "TBD" / "TODO" placeholder không justified (TODO có citation `file:line` được chấp nhận)
- [ ] Cross-reference đối xứng:
  - Nếu `contracts.md` nói "needs Tenant" → `tenants.md` mục 6 phải nói "consumed by Contract"
  - Nếu `invoices.md` nói "auto-creates Notification" → `notifications.md` mục 6 phải nói "produced by Invoice"
- [ ] Enum name match `backend/src/common/constants/enums.ts` (spot-check 2 enum/module)
- [ ] Spot-check 1 API route/module match controller decorator
- [ ] Spot-check 3 i18n keys tồn tại trong `frontend/public/locales/vi/translation.json`
- [ ] Mỗi file 250-500 dòng (nếu vượt 700: cảnh báo subagent dài, không block)

### Module-specific edge cases (pin trong prompt từng subagent)
| Module     | Edge case bắt buộc cover                                            |
|------------|---------------------------------------------------------------------|
| rooms      | Cả 2 type `LONG_TERM` và `SHORT_TERM`, cả 3 chế độ giá ngắn hạn     |
| services   | Cả 2 `buildingScope`: `ALL` và `SPECIFIC`; cả `FIXED` và `TABLE`    |
| contracts  | State machine đầy đủ: DRAFT → ACTIVE → (EXPIRED \| TERMINATED)      |
| invoices   | Phân biệt `REGULAR` vs `FINAL`; tất cả `InvoiceStatus` transitions  |
| payments   | Tất cả `PaymentMethod` (CASH, BANK_TRANSFER, MOMO, ZALOPAY, …)      |
| auth       | Cả access token + refresh token flow                                |
| calendar   | Aggregation từ Contract/Invoice/Payment events                      |
| tenants    | TenantStatus transitions + history endpoint                         |

---

## 8. Error Handling & Recovery

| Tình huống                              | Xử lý                                                                                              |
|-----------------------------------------|----------------------------------------------------------------------------------------------------|
| Subagent timeout                        | Re-spawn riêng module đó với same prompt; nếu fail 2 lần → main session tự viết module đó         |
| Subagent ghi sai path                   | Self-review phát hiện → re-spawn với prompt nhấn mạnh path đích                                     |
| File vượt 700 dòng                       | Warning trong report cuối, không block; xem xét decompose ở plan tương lai                         |
| Cross-reference asymmetric              | Tôi tự edit fix trong main session, không re-spawn                                                  |
| Module thực tế không có FE pages (vd notifications) | Subagent ghi rõ "không có FE page riêng, chỉ hiển thị qua component X" trong Section 5     |
| File `docs/archive/` đã tồn tại         | Pre-flight check; nếu trùng → rename `*.bak.md` và cảnh báo user                                   |

---

## 9. Verification (sau khi commit)

- [ ] `ls docs/features/` → 13 entry (README + 12 module)
- [ ] `ls docs/archive/` → ít nhất 2 file (PROJECT-OVERVIEW.md, V2-OVERVIEW.md)
- [ ] `git log -1 --stat` → commit chứa 14+ file changed
- [ ] Mở 2 file ngẫu nhiên (vd `contracts.md`, `services.md`) → đọc 5 phút, không thấy lỗi rõ ràng
- [ ] `grep -l "TBD\|FIXME" docs/features/` → empty (chỉ chấp nhận `TODO: <reason>` có citation)

---

## 10. Quyết định đã chốt (recap từ brainstorm)

| Quyết định           | Lựa chọn                                                  |
|----------------------|-----------------------------------------------------------|
| Output               | Per-feature playbook cho AI agent                         |
| Granularity          | 1 file / module (12 files)                                |
| Truth source         | Đọc code hiện tại, docs cũ chỉ tham khảo                  |
| Docs cũ              | Archive sang `docs/archive/` (không xóa)                  |
| Vị trí               | `docs/features/<module>.md`                               |
| Template             | Balanced 7 sections (cố định)                             |
| Decomposition        | 1 plan duy nhất cover 12 module                           |
| Ngôn ngữ             | VI nội dung, EN cho tiêu đề + technical names             |
| Execution approach   | Subagent-driven parallel (12 subagent / 1 message)        |

---

## 11. Open questions (cần làm rõ trước/trong implementation)

- Một số FE pages có thể overlap (vd `RoomBoard.tsx` thuộc rooms hay là dashboard?). Subagent sẽ list những gì khớp tên module, main session decide overlap khi consolidation.
- Nếu module có **sub-module** (ví dụ `contracts/` có `contract-closure` flow phức tạp) → vẫn nhét vào 1 file `contracts.md`, không tách. Decompose tương lai nếu file vượt 700 dòng.
