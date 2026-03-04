import { expect, test } from '@playwright/test';

// ─── Config ────────────────────────────────────────────────────────

const API = 'http://localhost:3000/api';

const TEST_USER = {
    email: 'e2e-contract-ui@example.com',
    password: 'Test@12345',
    confirmPassword: 'Test@12345',
    fullName: 'E2E UI Tester',
    phone: '0877000222',
};

let token: string;
let buildingId: string;

// ─── Setup: Register, Login, Seed Building + Room via API ──────────

test.beforeAll(async ({ request }) => {
    // Register (ignore if exists)
    await request.post(`${API}/auth/register`, { data: TEST_USER });

    // Login
    const loginRes = await request.post(`${API}/auth/login`, {
        data: { email: TEST_USER.email, password: TEST_USER.password },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginBody = await loginRes.json();
    token = loginBody.accessToken;

    // Create Building
    const bRes = await request.post(`${API}/buildings`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
            name: 'UI Test Building',
            address: {
                street: '456 UI Test St',
                ward: 'Ward 2',
                district: 'District 2',
                city: 'Test City',
            },
        },
    });
    if (bRes.ok()) {
        buildingId = (await bRes.json())._id;
    }

    // Create Room (AVAILABLE, LONG_TERM)
    await request.post(`${API}/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
            buildingId,
            roomName: 'Room UI-01',
            floor: 1,
            area: 20,
            maxOccupancy: 2,
            roomType: 'LONG_TERM',
            defaultRoomPrice: 3000000,
            defaultElectricPrice: 3500,
            defaultWaterPrice: 20000,
        },
    });

    // Create Tenant (ACTIVE)
    await request.post(`${API}/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
            fullName: 'UI Test Tenant',
            phone: '0909876543',
            idCard: '079888777666',
        },
    });
});

// ─── Helper: Login via UI ──────────────────────────────────────────

async function loginViaUI(page: any) {
    await page.goto('/login');
    await page.evaluate(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('auth-storage');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('name@example.com').fill(TEST_USER.email);
    await page.getByPlaceholder('••••••••').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
}

// ═══════════════════════════════════════════════════════════════════
// UI1: Navigate to Contracts Page
// ═══════════════════════════════════════════════════════════════════

test.describe('Contract Creation UI Flow', () => {
    test.beforeEach(async ({ page }) => {
        await loginViaUI(page);
    });

    test('UI1: should navigate to contracts page and see the add button', async ({ page }) => {
        // Navigate to contracts page via sidebar
        await page.getByRole('link', { name: /Hợp đồng/i }).click();
        await expect(page).toHaveURL(/\/contracts/);

        // "Thêm hợp đồng" button should be visible
        const addBtn = page.getByRole('button', { name: /Thêm hợp đồng/i });
        await expect(addBtn).toBeVisible({ timeout: 5_000 });
    });

    // ═══════════════════════════════════════════════════════════════
    // UI2: Open Contract Form Dialog
    // ═══════════════════════════════════════════════════════════════

    test('UI2: should open the contract creation dialog', async ({ page }) => {
        await page.getByRole('link', { name: /Hợp đồng/i }).click();
        await expect(page).toHaveURL(/\/contracts/);

        // Click add button
        await page.getByRole('button', { name: /Thêm hợp đồng/i }).click();

        // Dialog should appear with correct title
        await expect(page.getByText('Tạo hợp đồng thuê')).toBeVisible({ timeout: 5_000 });

        // Building selector label should be visible (use exact label to avoid sidebar/filter matches)
        await expect(page.getByText('Tòa nhà *')).toBeVisible();

        // Cancel button
        await expect(page.getByRole('button', { name: 'Hủy' })).toBeVisible();

        // Create button (last submit button in footer)
        const createBtn = page.getByRole('button', { name: 'Tạo', exact: true });
        await expect(createBtn).toBeVisible();

        // Draft button ("Cọc")
        await expect(page.getByRole('button', { name: 'Cọc', exact: true })).toBeVisible();
    });

    // ═══════════════════════════════════════════════════════════════
    // UI3: Form Validation on empty submit
    // ═══════════════════════════════════════════════════════════════

    test('UI3: should show validation toast when submitting empty form', async ({ page }) => {
        await page.getByRole('link', { name: /Hợp đồng/i }).click();
        await page.getByRole('button', { name: /Thêm hợp đồng/i }).click();
        await expect(page.getByText('Tạo hợp đồng thuê')).toBeVisible({ timeout: 5_000 });

        // Click "Tạo" without filling anything
        await page.getByRole('button', { name: 'Tạo' }).click();

        // Toast with validation error should appear
        await expect(page.getByText(/kiểm tra lại/i)).toBeVisible({ timeout: 5_000 });
    });

    // ═══════════════════════════════════════════════════════════════
    // UI4: Select Building shows Room Selector
    // ═══════════════════════════════════════════════════════════════

    test('UI4: should show room selector after building is selected', async ({ page }) => {
        await page.getByRole('link', { name: /Hợp đồng/i }).click();
        await page.getByRole('button', { name: /Thêm hợp đồng/i }).click();
        await expect(page.getByText('Tạo hợp đồng thuê')).toBeVisible({ timeout: 5_000 });

        // Click building selector and pick the test building
        const buildingTrigger = page.locator('button:has-text("Chọn tòa nhà")').first();
        if (await buildingTrigger.isVisible()) {
            await buildingTrigger.click();
            // Wait for dropdown and select the test building
            const buildingOption = page.getByText('UI Test Building');
            if (await buildingOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await buildingOption.click();
            }
        }

        // Room selector label should now be available (use exact match to avoid sidebar 'Phòng')
        await expect(page.getByText('Phòng *')).toBeVisible();
    });

    // ═══════════════════════════════════════════════════════════════
    // UI5: Dialog Dismiss
    // ═══════════════════════════════════════════════════════════════

    test('UI5: should close dialog when cancel is clicked', async ({ page }) => {
        await page.getByRole('link', { name: /Hợp đồng/i }).click();
        await page.getByRole('button', { name: /Thêm hợp đồng/i }).click();
        await expect(page.getByText('Tạo hợp đồng thuê')).toBeVisible({ timeout: 5_000 });

        // Click Cancel
        await page.getByRole('button', { name: 'Hủy' }).click();

        // Dialog should close
        await expect(page.getByText('Tạo hợp đồng thuê')).not.toBeVisible({ timeout: 3_000 });
    });

    // ═══════════════════════════════════════════════════════════════
    // UI6: Tenant Tab Switching
    // ═══════════════════════════════════════════════════════════════

    test('UI6: should switch between existing and new tenant tabs', async ({ page }) => {
        await page.getByRole('link', { name: /Hợp đồng/i }).click();
        await page.getByRole('button', { name: /Thêm hợp đồng/i }).click();
        await expect(page.getByText('Tạo hợp đồng thuê')).toBeVisible({ timeout: 5_000 });

        // "Khách thuê có sẵn" tab should be default
        const existingTab = page.getByText('Khách thuê có sẵn');
        const newTab = page.getByText('Khách thuê mới');

        await expect(existingTab).toBeVisible();
        await expect(newTab).toBeVisible();

        // Switch to new tenant tab
        await newTab.click();

        // Should see name/phone/idCard fields for new tenant
        await expect(page.getByText('Họ và tên')).toBeVisible();
        await expect(page.getByText('Số điện thoại')).toBeVisible();
        await expect(page.getByText('CMND/CCCD')).toBeVisible();
    });
});
