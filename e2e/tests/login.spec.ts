import { expect, test } from '@playwright/test';

// Test user — auto-registered via API before tests
const TEST_USER = {
    email: `e2e-login-test@example.com`,
    password: 'Test@12345',
    confirmPassword: 'Test@12345',
    fullName: 'E2E Test User',
    phone: '0999999999',
};

const API_BASE = 'http://localhost:3000/api';

// Register test user via API (runs once per worker)
test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API_BASE}/auth/register`, { data: TEST_USER });
    if (!res.ok()) {
        const body = await res.json();
        if (!JSON.stringify(body).includes('already') && !JSON.stringify(body).includes('exists')) {
            console.warn('Registration:', res.status(), JSON.stringify(body).substring(0, 200));
        }
    }
});

test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate first, THEN clear storage (avoid about:blank localStorage error)
        await page.goto('/login');
        await page.evaluate(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('auth-storage');
        });
        await page.reload();
        await page.waitForLoadState('networkidle');
    });

    // ============================================================
    // UI RENDERING
    // ============================================================

    test('should display the login page with all elements', async ({ page }) => {
        await expect(page.getByAltText('Nhà Trọ Số')).toBeVisible();
        await expect(page.getByRole('heading')).toContainText('Quản lý thuê phòng');
        await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
        await expect(page.getByPlaceholder('••••••••')).toBeVisible();

        const loginButton = page.getByRole('button', { name: 'Đăng nhập' });
        await expect(loginButton).toBeVisible();
        await expect(loginButton).toBeEnabled();

        await expect(page.getByText('Đăng ký ngay')).toBeVisible();
    });

    // ============================================================
    // FORM VALIDATION
    // ============================================================

    test('should show validation errors for empty form', async ({ page }) => {
        await page.getByRole('button', { name: 'Đăng nhập' }).click();
        await expect(page.getByText('Email là bắt buộc')).toBeVisible({ timeout: 3000 });
    });

    test('should reject invalid email format', async ({ page }) => {
        await page.getByPlaceholder('name@example.com').fill('not-an-email');
        await page.getByPlaceholder('••••••••').fill('somepassword');
        await page.getByRole('button', { name: 'Đăng nhập' }).click();

        // Browser's native type="email" validation blocks submission
        // Verify form stays on login page (no redirect)
        await page.waitForTimeout(1000);
        await expect(page).toHaveURL(/\/login/);

        // The email input should still contain the invalid value
        await expect(page.getByPlaceholder('name@example.com')).toHaveValue('not-an-email');
    });

    test('should show error for short password', async ({ page }) => {
        await page.getByPlaceholder('name@example.com').fill('test@example.com');
        await page.getByPlaceholder('••••••••').fill('12');
        await page.getByRole('button', { name: 'Đăng nhập' }).click();

        // Form submits to server which rejects invalid credentials
        const errorBox = page.locator('.text-red-500');
        await expect(errorBox).toBeVisible({ timeout: 10_000 });
    });

    // ============================================================
    // AUTHENTICATION
    // ============================================================

    test('should login successfully with valid credentials', async ({ page }) => {
        await page.getByPlaceholder('name@example.com').fill(TEST_USER.email);
        await page.getByPlaceholder('••••••••').fill(TEST_USER.password);
        await page.getByRole('button', { name: 'Đăng nhập' }).click();

        // Should leave the login page
        await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });

        // Token persisted
        const token = await page.evaluate(() => localStorage.getItem('token'));
        expect(token).toBeTruthy();
    });

    test('should show error for wrong password', async ({ page }) => {
        await page.getByPlaceholder('name@example.com').fill(TEST_USER.email);
        await page.getByPlaceholder('••••••••').fill('wrongpassword123');
        await page.getByRole('button', { name: 'Đăng nhập' }).click();

        const errorBox = page.locator('.text-red-500');
        await expect(errorBox).toBeVisible({ timeout: 10_000 });
    });

    test('should show error for non-existent email', async ({ page }) => {
        await page.getByPlaceholder('name@example.com').fill('nobody-here@example.com');
        await page.getByPlaceholder('••••••••').fill('password123');
        await page.getByRole('button', { name: 'Đăng nhập' }).click();

        const errorBox = page.locator('.text-red-500');
        await expect(errorBox).toBeVisible({ timeout: 10_000 });
    });

    // ============================================================
    // LOADING STATE
    // ============================================================

    test('should show loading spinner during login', async ({ page }) => {
        await page.getByPlaceholder('name@example.com').fill(TEST_USER.email);
        await page.getByPlaceholder('••••••••').fill(TEST_USER.password);

        // Delay the API response to observe the loading state
        await page.route('**/api/auth/login', async (route) => {
            await new Promise((r) => setTimeout(r, 1500));
            await route.continue();
        });

        await page.getByRole('button', { name: 'Đăng nhập' }).click();

        await expect(page.getByRole('button', { name: /Đang đăng nhập/i })).toBeVisible();
        await expect(page.locator('.animate-spin')).toBeVisible();

        // Wait for redirect
        await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    });

    // ============================================================
    // NAVIGATION
    // ============================================================

    test('should navigate to register page', async ({ page }) => {
        await page.getByText('Đăng ký ngay').click();
        await expect(page).toHaveURL(/\/register/);
    });

    // ============================================================
    // PERSISTENCE
    // ============================================================

    test('should persist auth after page reload', async ({ page }) => {
        await page.getByPlaceholder('name@example.com').fill(TEST_USER.email);
        await page.getByPlaceholder('••••••••').fill(TEST_USER.password);
        await page.getByRole('button', { name: 'Đăng nhập' }).click();
        await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });

        // Reload and verify
        await page.reload();
        await page.waitForLoadState('networkidle');
        await expect(page).not.toHaveURL(/\/login/);

        const token = await page.evaluate(() => localStorage.getItem('token'));
        expect(token).toBeTruthy();
    });
});
