import { expect, test } from '@playwright/test';

import { resolveDemoFixtures } from './fixtures';
import { loginAsDemoUser } from './helpers';

test.describe.configure({ mode: 'serial' });

test('remembers selected PDF preset and shows export success toast', async ({ page, request }, testInfo) => {
    const demoFixtures = await resolveDemoFixtures(request);

    await loginAsDemoUser(page);

    await page.goto(`/invoices/${demoFixtures.invoiceId}`, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText(demoFixtures.invoiceNumber);

    await page.getByRole('button', { name: /xuất pdf|export pdf/i }).click();

    const invoiceDownloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('menuitemradio', { name: /pdf chất lượng cao|high-quality pdf/i }).click();
    const invoiceDownload = await invoiceDownloadPromise;
    await invoiceDownload.saveAs(testInfo.outputPath(`invoice-${invoiceDownload.suggestedFilename()}`));

    await expect(page.getByText(/đã xuất pdf thành công|pdf exported successfully/i).first()).toBeVisible();

    await page.goto(`/contracts/${demoFixtures.contractId}`, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText(demoFixtures.contractCode);

    const quickExportButton = page
        .getByRole('button', { name: /^pdf: (pdf chất lượng cao|high-quality pdf)$/i })
        .first();

    await expect(quickExportButton).toBeVisible();

    const contractDownloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await quickExportButton.click();
    const contractDownload = await contractDownloadPromise;
    await contractDownload.saveAs(testInfo.outputPath(`contract-${contractDownload.suggestedFilename()}`));

    await expect(page.getByText(/đã xuất pdf thành công|pdf exported successfully/i).first()).toBeVisible();
});
