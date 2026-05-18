import { expect, type Page } from '@playwright/test';

import { demoUser } from './fixtures';

export async function loginAsDemoUser(page: Page) {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill(demoUser.email);
    await page.locator('input[type="password"]').fill(demoUser.password);

    await Promise.all([
        page.waitForURL('/', { timeout: 15_000 }),
        page.getByRole('button', { name: /đăng nhập|log in|login/i }).click(),
    ]);

    await expect(page).toHaveURL('/');
}
