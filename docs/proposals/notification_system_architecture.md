# Smart Proposal: Hệ thống Cấu hình Thông báo

## 1. Tổng quan
Hệ thống cho phép cấu hình linh hoạt các quy tắc gửi thông báo dựa trên phạm vi áp dụng (Chi nhánh, Nhóm phòng, Loại phòng).

## 2. Logic Ưu tiên (Hierarchy)
Hệ thống hoạt động theo cơ chế **"Specific wins over General"** (Cụ thể đè Tổng quát).
Khi hệ thống kiểm tra một hợp đồng để gửi thông báo, nó sẽ tìm config theo thứ tự ưu tiên sau:

1.  🥇 **Loại phòng (Room Type)**: `SHORT_TERM` / `LONG_TERM` (Độ ưu tiên cao nhất, vì tính chất hợp đồng khác nhau rõ rệt).
2.  🥈 **Nhóm phòng (Room Group)**: Cấu hình đặc thù cho một dãy phòng hoặc khu vực.
3.  🥉 **Chi nhánh (Branch/Building)**: Cấu hình chung cho toàn bộ tòa nhà.

*Ví dụ:* Một hợp đồng ngắn hạn tại Tòa A.
- Nếu có config cho `SHORT_TERM` -> Dùng config `SHORT_TERM`.
- Nếu KHÔNG, tìm config của `Tòa A`.

## 3. Database Schema (Mongoose)
Collection: `NotificationConfigs`

| Field | Type | Description |
|-------|------|-------------|
| `scope` | Enum | `ROOM_GROUP`, `ROOM_TYPE`, `ALL` |
| `targetId` | String/ObjectId | ID của Building/Group hoặc 'LONG_TERM'/'SHORT_TERM' |
| `configType` | Enum | `CONTRACT_START`, `PAYMENT_DUE`, `CONTRACT_END` |
| `daysBefore` | Number[] | Mảng các ngày báo trước. VD: `[3, 2, 1]` |
| `channels` | Enum[] | `['IN_APP', 'EMAIL']` (Dự phòng cho tương lai) |
| `isActive` | Boolean | Bật/Tắt |
| `createdAt` | Date | Thời gian tạo |
| `updatedAt` | Date | Thời gian cập nhật |
| `buildingId` | String/ObjectId | ID của tòa nhà |


**Constraints:** Unique index on `[scope, targetId, configType]` để đảm bảo không trùng lặp.

## 4. Backend Implementation
- **Dependencies**: Cài đặt `@nestjs/schedule` để chạy Cron Jobs.
- **Module**: `NotificationConfigModule`
    - API CRUD: Create, Read, Update, Delete configs.
    - Validate logic: Không cho phép tạo config trùng nhau.
- **Scheduler Service (Cron Job)**:
    - Chạy định kỳ (VD: 07:00 AM mỗi ngày).
    - Bước 1: Lấy danh sách hợp đồng đang Active/Deposited.
    - Bước 2: Với mỗi hợp đồng, resolve config áp dụng (dùng Strategy Pattern hoặc Service logic).
    - Bước 3: So sánh `daysBefore` với ngày hiện tại -> Tạo Notification nếu khớp.

## 5. Frontend UI
- **Menu**: Thêm mục `Cấu hình` -> `Cấu hình thông báo`.
- **Danh sách Config**:
    - Hiển thị dạng bảng hoặc card.
    - Group by Scope (Nhóm theo Chi nhánh / Loại phòng).
- **Form Tạo/Sửa**:
    - **Bước 1**: Chọn `Phạm vi` (Dropdown: Nhóm, Loại, Tất cả).
    - **Bước 2**: Chọn `Đối tượng` (Dropdown dynamic theo phạm vi).
    - **Bước 3**: Chọn `Loại thông báo` (Sắp hết hạn, Thanh toán...).
    - **Bước 4**: Nhập `Ngày báo trước` (Input tags: 3, 2, 1).
