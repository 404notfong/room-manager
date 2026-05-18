# Feature Playbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo 12 file playbook trong `docs/features/` (1 per module) làm reference cho AI agent khi build/sửa Room Manager modules; archive V1 overview docs.

**Architecture:** Pre-flight folder setup → parallel general-purpose subagent dispatch (12 subagents, single message) → consistency review pass → README index finalization → final verification. Truth source = code hiện tại; docs cũ chỉ tham khảo.

**Tech Stack:** Bash/PowerShell, git, Agent tool (general-purpose subagent), markdown.

**Spec reference:** `docs/superpowers/specs/2026-05-17-feature-playbook-design.md`

---

## Task 0: Pre-flight Setup

**Goal:** Tạo cấu trúc thư mục, archive V1 overview docs, scaffold README index với skeleton.

**Files:**
- Create dir: `docs/features/`
- Create dir: `docs/archive/`
- Move: `docs/PROJECT-OVERVIEW.md` → `docs/archive/PROJECT-OVERVIEW.md`
- Move: `docs/V2-OVERVIEW.md` → `docs/archive/V2-OVERVIEW.md`
- Create: `docs/features/README.md`

**Acceptance Criteria:**
- [ ] `docs/features/` và `docs/archive/` tồn tại
- [ ] V1 overview docs đã nằm ở `docs/archive/`, không còn ở `docs/`
- [ ] `docs/features/README.md` chứa bảng skeleton 12 module với placeholder "TBD"
- [ ] Tất cả thay đổi committed trong 1 commit

**Verify:** `ls docs/features/ docs/archive/ && git log -1 --stat` → thấy README + 2 file moved

**Steps:**

- [ ] **Step 1: Tạo directories và move V1 docs**

```bash
mkdir -p docs/features docs/archive
git mv docs/PROJECT-OVERVIEW.md docs/archive/PROJECT-OVERVIEW.md
git mv docs/V2-OVERVIEW.md      docs/archive/V2-OVERVIEW.md
```

- [ ] **Step 2: Viết `docs/features/README.md` với nội dung đầy đủ**

```markdown
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
```

- [ ] **Step 3: Commit pre-flight**

```bash
git add docs/features/README.md docs/archive/
git commit -m "docs(features): scaffold playbook dirs + archive V1 overviews"
```

Expected: 1 commit, 3 files (README + 2 moved).

---

## Task 1: Parallel Subagent Dispatch — Generate 12 Playbook Files

**Goal:** Generate `docs/features/<module>.md` cho cả 12 module qua parallel general-purpose subagents (1 message, 12 Agent calls).

**Files:**
- Create: `docs/features/auth.md`
- Create: `docs/features/users.md`
- Create: `docs/features/buildings.md`
- Create: `docs/features/room-groups.md`
- Create: `docs/features/rooms.md`
- Create: `docs/features/tenants.md`
- Create: `docs/features/services.md`
- Create: `docs/features/contracts.md`
- Create: `docs/features/invoices.md`
- Create: `docs/features/payments.md`
- Create: `docs/features/notifications.md`
- Create: `docs/features/calendar.md`

**Acceptance Criteria:**
- [ ] Đủ 12 file tồn tại
- [ ] Mỗi file có đủ 7 section đúng thứ tự và tiêu đề chính xác
- [ ] Mỗi file 250-700 dòng (cảnh báo nếu out-of-range, không block)
- [ ] Không có "TBD"/"FIXME" placeholder; chỉ chấp nhận `TODO: <reason> (file:line)` có citation
- [ ] Module-specific edge cases covered theo bảng pin trong prompt

**Verify:** `ls docs/features/*.md | wc -l` → 13 (README + 12); `grep -lE "TBD|FIXME" docs/features/` → empty

**Steps:**

- [ ] **Step 1: Dispatch 12 subagents trong 1 message (parallel)**

Dùng Agent tool với `subagent_type=general-purpose`, 12 calls trong cùng 1 message. Prompt template (substitute `<module>` cho mỗi call):

```
You are documenting the `<module>` module of Room Manager
(NestJS 10 + Mongoose 8 + React 18 + Vite + Tailwind + Radix).

INPUT FILES — read in full, do NOT skim:
- backend/src/modules/<module>/<module>.schema.ts
- backend/src/modules/<module>/<module>.service.ts
- backend/src/modules/<module>/<module>.controller.ts
- backend/src/modules/<module>/<module>.module.ts
- backend/src/modules/<module>/dto/*.ts
- backend/src/common/constants/enums.ts (extract only enums used by this module)
- frontend/src/pages/ — use Glob to find all files whose name contains <module> (case-insensitive)
- frontend/src/components/ — same discovery rule
- frontend/public/locales/vi/translation.json (extract <module>.* keys)

OUTPUT — write a single file at docs/features/<module>.md following EXACTLY this template:

# <Module> Playbook

> **Vai trò trong domain**: <1 câu>
> **Code paths**: `backend/src/modules/<module>/`, `frontend/src/pages/<Module>*.tsx` (or actual paths found)

## 1. Purpose & Relations
- Mục đích nghiệp vụ (3-5 câu, VI)
- Sơ đồ quan hệ với module khác (ASCII hoặc bullet)

## 2. Data Model

### Schema (`<module>.schema.ts`)
| Field | Type | Required | Default | Mô tả |
|-------|------|----------|---------|-------|

- Indexes / Virtuals / Hooks (pre-save/post-save) nếu có

### Enums liên quan
Liệt kê từ `common/constants/enums.ts`, chỉ enum module này thực sự dùng.

### DTO validation
- **CreateDto**: list rule (e.g., `buildingId: @IsMongoId @IsNotEmpty`)
- **UpdateDto**: thêm/khác gì so với Create
- Cross-field validation nếu có

## 3. API Endpoints
| Method | Path | Auth | Mô tả | Request body | Response shape |
|--------|------|------|-------|--------------|----------------|

## 4. Business Rules & State Machine
- **Invariants**: rules không bao giờ vi phạm (ví dụ: ownerId luôn filter, isDeleted: false default)
- **State machine** (nếu có status): ASCII diagram hoặc bullet condition
- **Auto-actions**: side effects (notifications, cascade updates...)

## 5. Frontend Touchpoints
- **Pages**: list `<file>.tsx` với chức năng 1 dòng
- **Components quan trọng**: forms, modals, tables
- **Key i18n keys**: namespace + leaf keys chính

## 6. Cross-Module Dependencies
- **Module này CẦN**: foreign refs (Building, Room, Tenant...) và lý do
- **Module khác CẦN module này**: ai consume schema/data này

## 7. Gotchas & Testing Notes
- Common pitfalls (vd: forget Types.ObjectId convert, missing ownerId filter)
- Test scenarios chính (happy + edge)

MODULE-SPECIFIC EDGE CASES MUST COVER (nếu áp dụng):
- rooms: cả LONG_TERM/SHORT_TERM, cả 3 short-term pricing modes (HOURLY/DAILY/FIXED)
- services: cả ALL/SPECIFIC buildingScope, cả FIXED/TABLE priceType
- contracts: full state machine DRAFT → ACTIVE → (EXPIRED | TERMINATED)
- invoices: REGULAR vs FINAL, tất cả InvoiceStatus transitions
- payments: tất cả PaymentMethod (CASH, BANK_TRANSFER, MOMO, ZALOPAY, DEPOSIT_DEDUCTION, OTHER)
- auth: cả access + refresh token flow
- calendar: aggregation từ Contract/Invoice/Payment events
- tenants: TenantStatus transitions + history endpoint

RULES:
- All facts MUST come from code, not assumptions
- Quote schema field names verbatim
- For API endpoints, copy exact route từ @Controller/@Get/@Post/@Put/@Patch/@Delete decorators
- For DTO validation, copy class-validator decorator names exactly (IsString, Min, IsEnum...)
- Mark unknowns as `TODO: <reason>` với `file:line` citation; KHÔNG dùng bare TBD/FIXME
- Body language: Tiếng Việt; tên technical (fields, routes, enums): English
- Target length: 250-500 lines (max 700)
- Do NOT modify any file outside docs/features/<module>.md
- Do NOT run code/commands beyond Read/Grep/Glob/Write

Report back: file path written + line count + any TODOs added.
```

12 modules to dispatch:
1. `auth`
2. `users`
3. `buildings`
4. `room-groups`
5. `rooms`
6. `tenants`
7. `services`
8. `contracts`
9. `invoices`
10. `payments`
11. `notifications`
12. `calendar`

- [ ] **Step 2: Verify all 12 files created và in range**

```bash
ls docs/features/*.md | wc -l        # expect 13 (README + 12)
wc -l docs/features/*.md              # 250-700 per file
grep -lE "TBD|FIXME" docs/features/   # expect empty (TODO with citation OK)
```

Expected output:
- `wc -l`: 13 lines, each module 250-700
- `grep`: no output

- [ ] **Step 3: Recovery — re-dispatch failed modules nếu có**

Nếu bất kỳ subagent fail/output invalid:
- Re-spawn riêng module đó với cùng prompt (substitute `<module>`)
- Nếu fail 2 lần → main session tự viết module đó bằng cách đọc các file input và follow template

- [ ] **Step 4: Commit**

```bash
git add docs/features/*.md
git commit -m "docs(features): generate 12 per-module playbooks"
```

Expected: 1 commit, 12 new files.

---

## Task 2: Cross-Reference Consistency Pass

**Goal:** Verify cross-module dependencies trong Section 6 đối xứng giữa các file; template adherence uniform.

**Files:**
- Modify (chỉ nếu phát hiện asymmetry): any file trong `docs/features/*.md`

**Acceptance Criteria:**
- [ ] Nếu file A's Section 6 nói "Module này CẦN B", thì file B's Section 6 phải có "Module khác CẦN module này: ..., A, ..."
- [ ] 12 file có identical section structure (7 sections, đúng titles, đúng thứ tự)
- [ ] Enum names spot-check (2 enum/module) match `backend/src/common/constants/enums.ts`
- [ ] 1 API route spot-check per module match actual controller decorator
- [ ] 3 i18n keys spot-check tồn tại trong `frontend/public/locales/vi/translation.json`

**Verify:** Manual review report — table of dependencies in/out per module, eyeball asymmetries

**Steps:**

- [ ] **Step 1: Đọc tất cả 12 file vào context**

```bash
# Reference: read all playbooks
for f in docs/features/auth.md docs/features/users.md docs/features/buildings.md \
         docs/features/room-groups.md docs/features/rooms.md docs/features/tenants.md \
         docs/features/services.md docs/features/contracts.md docs/features/invoices.md \
         docs/features/payments.md docs/features/notifications.md docs/features/calendar.md; do
  echo "=== $f ==="
  cat "$f"
done
```

Use Read tool on each file individually trong main session.

- [ ] **Step 2: Build cross-reference map**

Cho mỗi file, extract:
- "Module này CẦN" list (Section 6, sub-bullet đầu) → outgoing deps
- "Module khác CẦN module này" list (Section 6, sub-bullet thứ 2) → incoming deps

Lưu thành bảng (in mental model hoặc scratch note):
```
auth         → users
users        ← auth
buildings    → users
buildings    ← rooms, room-groups, services
rooms        → buildings, room-groups
rooms        ← contracts
contracts    → rooms, tenants
contracts    ← invoices
...
```

- [ ] **Step 3: Verify symmetry**

Cho mỗi outgoing dep `A → B` declared trong file A:
- Check file B's Section 6 sub-bullet "Module khác CẦN module này" có chứa A không
- Nếu không → Edit file B thêm A vào incoming list

- [ ] **Step 4: Section structure check**

```bash
# Đếm số section header level-2 (##) trong mỗi file
for f in docs/features/auth.md docs/features/users.md docs/features/buildings.md \
         docs/features/room-groups.md docs/features/rooms.md docs/features/tenants.md \
         docs/features/services.md docs/features/contracts.md docs/features/invoices.md \
         docs/features/payments.md docs/features/notifications.md docs/features/calendar.md; do
  count=$(grep -c '^## ' "$f")
  echo "$f: $count sections"
done
```

Expected: mỗi file chính xác 7 sections.

Nếu file nào ≠ 7 → mở file, sửa thủ công theo template, đảm bảo 7 section đúng tiêu đề.

- [ ] **Step 5: Spot-check enums / routes / i18n keys**

Pick random:
- 2 enum tên trong 2 file ngẫu nhiên → grep `backend/src/common/constants/enums.ts`
- 1 API route từ `contracts.md` → check `backend/src/modules/contracts/contracts.controller.ts`
- 3 i18n keys từ random files → grep `frontend/public/locales/vi/translation.json`

Nếu mismatch → fix in file.

- [ ] **Step 6: Commit fixes (nếu có)**

```bash
git status docs/features/
# Nếu có thay đổi:
git add docs/features/*.md
git commit -m "docs(features): fix cross-reference asymmetries"
```

Nếu không có thay đổi → skip commit, ghi note trong report.

---

## Task 3: Finalize README Index

**Goal:** Thay TBD trong `docs/features/README.md` bằng 1-line summary extracted từ mỗi playbook's "Vai trò trong domain" line.

**Files:**
- Modify: `docs/features/README.md`

**Acceptance Criteria:**
- [ ] Không còn "TBD" trong `docs/features/README.md`
- [ ] Mỗi row Domain column có 1-line summary lấy từ playbook tương ứng

**Verify:** `grep TBD docs/features/README.md` → empty

**Steps:**

- [ ] **Step 1: Extract "Vai trò trong domain" line từ 12 playbook**

Đối với mỗi file:
```bash
for f in docs/features/auth.md docs/features/users.md docs/features/buildings.md \
         docs/features/room-groups.md docs/features/rooms.md docs/features/tenants.md \
         docs/features/services.md docs/features/contracts.md docs/features/invoices.md \
         docs/features/payments.md docs/features/notifications.md docs/features/calendar.md; do
  module=$(basename "$f" .md)
  summary=$(grep -m1 'Vai trò trong domain' "$f" | sed 's/.*\*\*: *//' | sed 's/\\$//')
  echo "$module | $summary"
done
```

- [ ] **Step 2: Update README table**

Mở `docs/features/README.md`, replace từng row's Domain column từ "TBD" → summary extracted. Giữ format bảng nguyên.

- [ ] **Step 3: Verify no TBD**

```bash
grep TBD docs/features/README.md
```

Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add docs/features/README.md
git commit -m "docs(features): fill README index with module summaries"
```

---

## Task 4: Final Verification

**Goal:** Run spec's verification checklist (Section 9), confirm system usable, generate report.

**Files:** none modified (except optional fix commit nếu spot-check fail)

**Acceptance Criteria:**
- [ ] `ls docs/features/` → 13 entries (README + 12 modules)
- [ ] `ls docs/archive/` → ≥2 files (PROJECT-OVERVIEW + V2-OVERVIEW)
- [ ] `grep -lE "TBD|FIXME" docs/features/` → empty
- [ ] Final git log shows 3-4 commits (Task 0 + Task 1 + optional Task 2 + Task 3)
- [ ] 5-minute read of 2 random playbook files (e.g. `contracts.md`, `services.md`) finds no obvious factual error

**Verify:** `git log --oneline -5` shows `docs(features)` commits in order

**Steps:**

- [ ] **Step 1: Run all verification commands**

```bash
ls docs/features/
ls docs/archive/
grep -lE "TBD|FIXME" docs/features/
wc -l docs/features/*.md
git log --oneline -6
```

Expected:
- `ls docs/features/`: 13 entries
- `ls docs/archive/`: ≥2 files
- `grep`: empty
- `wc -l`: 250-700 per module
- `git log`: 3-4 `docs(features)` commits

- [ ] **Step 2: Manual sanity check 2 playbook**

Read `docs/features/contracts.md` end-to-end, spot-check 2 facts:
1. Pick 1 enum mentioned → grep `backend/src/common/constants/enums.ts`
2. Pick 1 route → check `backend/src/modules/contracts/contracts.controller.ts`

Repeat for `docs/features/services.md`.

- [ ] **Step 3: Fix-up nếu thấy lỗi**

Nếu Step 2 phát hiện lỗi factual:
- Edit file fix
- Commit: `git commit -m "docs(features): fix factual errors in <file>"`

Nếu không có lỗi → skip.

- [ ] **Step 4: Report final summary**

In report cho user gồm:
- Số file generated: 12
- Số commit tạo: 3-4
- Module bất thường (out-of-range line count, có TODO citations)
- Recommendations nếu cần follow-up (e.g., 1 module quá lớn → decompose tương lai)

---

## Notes

- **Không có code unit tests cho doc files** — verification = `grep`/`ls`/`wc` + manual spot-check
- **Không có TDD cycle** — đây là doc generation, không phải code change
- **Commits**: 1 per task (4 commits total nếu Task 2 có fix, 3 commits nếu không)
- **Subagent failure handling**: re-dispatch riêng module fail; nếu fail 2 lần → main session viết tay
- **Spec reference**: tất cả ambiguity → trace về `docs/superpowers/specs/2026-05-17-feature-playbook-design.md`
