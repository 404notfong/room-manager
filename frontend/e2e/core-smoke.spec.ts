import { expect, test } from '@playwright/test';

import { resolveDemoFixtures } from './fixtures';
import { loginAsDemoUser } from './helpers';

test.describe.configure({ mode: 'serial' });

test('covers login, tenant filters, pagination, history, and key detail pages', async ({ page, request }) => {
    const demoFixtures = await resolveDemoFixtures(request);

    await loginAsDemoUser(page);
    await expect(page.locator('body')).toContainText(/dashboard|tổng quan|vận hành/i);

    await page.goto('/room-board', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/room-board$/);
    await expect(page.getByRole('button', { name: /bảng phòng|room board/i })).toBeVisible();

    await page.getByRole('button', { name: /danh sách phòng|room list/i }).click();
    await expect(page).toHaveURL(/\/room-board\?view=list/);
    await expect(page.locator('.room-board-list-head').first()).toBeVisible();

    const roomBoardPagination = page.locator('main').getByRole('button', { name: /trang sau|next page/i }).first();
    await expect(roomBoardPagination).toBeEnabled();
    await roomBoardPagination.click();
    await expect(page).toHaveURL(/page=2/);

    const roomBoardSearch = page.getByRole('textbox', { name: /search rooms, tenants|tìm phòng, khách thuê/i });
    await roomBoardSearch.fill('T-10');
    await page.waitForTimeout(900);
    await expect(page).toHaveURL(/q=T-10/);
    await expect(page).not.toHaveURL(/page=2/);

    await page.getByRole('button', { name: /vacant|trống/i }).click();
    await expect(page).toHaveURL(/status=AVAILABLE/);

    await page.getByRole('button', { name: /all groups|tất cả nhóm/i }).click();
    await page.getByRole('checkbox').first().click();
    await expect(page).toHaveURL(/groups=/);
    await page.keyboard.press('Escape');

    await page.getByRole('combobox', { name: /sắp xếp danh sách|sort list/i }).click();
    await page.getByRole('option', { name: /theo tầng|floor/i }).click();
    await expect(page).toHaveURL(/sort=floor/);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/room-board\?.*view=list/);
    await expect(page).toHaveURL(/q=T-10/);
    await expect(page).toHaveURL(/status=AVAILABLE/);
    await expect(page).toHaveURL(/groups=/);
    await expect(page).toHaveURL(/sort=floor/);
    await expect(page.locator('.room-board-list-head').first()).toBeVisible();
    await expect(roomBoardSearch).toHaveValue('T-10');
    await expect(page.getByRole('button', { name: /1 groups selected|1 nhóm đã chọn/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /sắp xếp danh sách|sort list/i })).toContainText(/theo tầng|floor/i);

    await page.getByRole('button', { name: /xóa: T-10|clear: T-10/i }).click();
    await expect(page).not.toHaveURL(/q=T-10/);
    await expect(page).toHaveURL(/status=AVAILABLE/);
    await expect(page).toHaveURL(/groups=/);
    await expect(page).toHaveURL(/sort=floor/);
    await expect(roomBoardSearch).toHaveValue('');

    const clearRoomBoardFiltersButton = page.locator('main').getByRole('button', { name: /xóa tất cả|clear all/i }).first();
    await clearRoomBoardFiltersButton.click();
    await expect(page).toHaveURL(/\/room-board\?view=list$/);
    await expect(page).not.toHaveURL(/q=T-10|status=AVAILABLE|groups=|sort=floor/);
    await expect(roomBoardSearch).toHaveValue('');
    await expect(page.getByRole('button', { name: /all groups|tất cả nhóm/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /sắp xếp danh sách|sort list/i })).toContainText(/layout order|theo bố cục/i);

    const roomBoardTableHead = page.locator('thead');

    await roomBoardTableHead.getByRole('button', { name: /theo giá|highest price/i }).click();
    await expect(page).toHaveURL(/sort=price/);
    await roomBoardTableHead.getByRole('button', { name: /theo giá|highest price/i }).click();
    await expect(page).not.toHaveURL(/sort=price/);

    await roomBoardTableHead.getByRole('button', { name: /theo khách thuê|tenant/i }).click();
    await expect(page).toHaveURL(/sort=tenant/);
    await roomBoardTableHead.getByRole('button', { name: /theo khách thuê|tenant/i }).click();
    await expect(page).not.toHaveURL(/sort=tenant/);

    await page.getByRole('button', { name: /bảng phòng|room board/i }).click();
    await expect(page).toHaveURL(/\/room-board$/);

    await page.getByRole('button', { name: /sắp xếp|arrange/i }).click();
    const dragHandles = page.locator('[title="Kéo để sắp xếp"]');
    await expect(dragHandles.first()).toBeVisible();

    const firstHandleBox = await dragHandles.nth(0).boundingBox();
    const secondHandleBox = await dragHandles.nth(1).boundingBox();

    if (!firstHandleBox || !secondHandleBox) {
        throw new Error('Missing drag handles for room arrangement');
    }

    const reorderResponse = page.waitForResponse((response) =>
        response.url().includes('/rooms/reorder') && response.request().method() === 'PATCH'
    );

    await page.mouse.move(firstHandleBox.x + firstHandleBox.width / 2, firstHandleBox.y + firstHandleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(secondHandleBox.x + secondHandleBox.width / 2, secondHandleBox.y + secondHandleBox.height / 2, { steps: 15 });
    await page.mouse.up();

    const reorderResult = await reorderResponse;
    expect(reorderResult.ok()).toBeTruthy();
    await expect(page.locator('body')).toContainText(/đã sắp xếp lại phòng|room order updated/i);

    await page.goto('/tenants', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/tenants$/);
    await expect(page.getByRole('button', { name: /trang sau|next page/i })).toBeEnabled();
    await page.getByRole('button', { name: /trang sau|next page/i }).click();
    await expect(page).toHaveURL(/\/tenants\?page=2/);

    const searchInput = page.locator('main input[placeholder]').first();
    await searchInput.fill('Paula');
    await page.waitForTimeout(900);
    await expect(page).toHaveURL(/q=Paula/);
    await expect(page.locator('body')).toContainText(demoFixtures.tenantName);

    await page.goto('/rooms', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/rooms$/);
    const roomsTableHead = page.locator('main thead');
    await roomsTableHead.getByRole('button', { name: /tầng|floor/i }).click();
    await expect(page).toHaveURL(/sortBy=floor/);
    await expect(page).toHaveURL(/sortOrder=asc/);
    const clearRoomSortChip = page.locator('main').getByRole('button', { name: /xóa: tầng|clear: floor/i });
    await expect(clearRoomSortChip).toBeVisible();
    await clearRoomSortChip.click();
    await expect(page).not.toHaveURL(/sortBy=floor/);
    await expect(page).not.toHaveURL(/sortOrder=asc/);
    await roomsTableHead.getByRole('button', { name: /tầng|floor/i }).click();
    await roomsTableHead.getByRole('button', { name: /tầng|floor/i }).click();
    await expect(page).toHaveURL(/sortBy=floor/);
    await expect(page).toHaveURL(/sortOrder=desc/);
    await roomsTableHead.getByRole('button', { name: /tầng|floor/i }).click();
    await expect(page).not.toHaveURL(/sortBy=floor/);
    await expect(page).not.toHaveURL(/sortOrder=/);

    await page.goto(`/tenants/${demoFixtures.tenantId}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(`/tenants/${demoFixtures.tenantId}`);
    await expect(page.getByRole('heading', { name: demoFixtures.tenantName })).toBeVisible();
    await page.getByRole('tab', { name: /lịch sử|history/i }).click();
    await page.getByRole('button', { name: /xem tất cả|view all/i }).click();

    await expect(page).toHaveURL(new RegExp(`/tenants/${demoFixtures.tenantId}/history`));
    await expect(page.locator('body')).toContainText(demoFixtures.tenantName);

    const historyTypeFilter = page.locator('main').getByRole('combobox').first();
    await historyTypeFilter.click();
    await page.getByRole('option', { name: /invoice/i }).click();
    await expect(page).toHaveURL(/type=invoice/);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/type=invoice/);
    await expect(page.locator('main').getByRole('combobox').first()).toContainText(/invoice/i);

    const clearAllButton = page.getByRole('button', { name: /xóa tất cả|clear all/i });
    if (await clearAllButton.count()) {
        await clearAllButton.click();
        await expect(page).not.toHaveURL(/type=invoice/);
    }

    await page.goto('/buildings/new', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL('/buildings/new');
    await expect(page.locator('form#building-form')).toBeVisible();
    await expect(page.getByRole('button', { name: /lưu|save/i })).toBeVisible();

    await page.goto(`/buildings/${demoFixtures.buildingId}/edit`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(`/buildings/${demoFixtures.buildingId}/edit`);
    await expect(page.locator('form#building-form')).toBeVisible();
    await expect(page.locator('#name')).toHaveValue(demoFixtures.buildingName);

    await page.goto(`/contracts/${demoFixtures.contractId}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(`/contracts/${demoFixtures.contractId}`);
    await expect(page.locator('body')).toContainText(demoFixtures.contractCode);

    await page.goto(`/invoices/${demoFixtures.invoiceId}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(`/invoices/${demoFixtures.invoiceId}`);
    await expect(page.locator('body')).toContainText(demoFixtures.invoiceNumber);
});
