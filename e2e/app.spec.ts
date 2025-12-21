import { test, expect } from '@playwright/test';

/**
 * Basic smoke tests for the Furlong app
 * Verifies core functionality works without errors
 */

test.describe('App Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto('/');
  });

  test('app loads without error', async ({ page }) => {
    // Verify the page title or main container loads
    await expect(page).toHaveTitle(/Furlong/i);

    // Verify no console errors (excluding expected warnings)
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait for app to fully load
    await page.waitForLoadState('networkidle');

    // Check for critical errors (filter out expected development warnings)
    const criticalErrors = errors.filter(
      (err) =>
        !err.includes('DevTools') &&
        !err.includes('React DevTools') &&
        !err.includes('favicon')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('dashboard renders', async ({ page }) => {
    // Wait for the dashboard to be visible
    const dashboard = page.locator('.dashboard');
    await expect(dashboard).toBeVisible();

    // Verify main content area exists
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });

  test('file upload button visible', async ({ page }) => {
    // The upload button text is "Upload DRF File"
    const uploadButton = page.getByRole('button', { name: /upload/i });
    await expect(uploadButton).toBeVisible();
  });

  test('navigation works - sidebar links', async ({ page }) => {
    // Desktop sidebar should be visible
    const sidebar = page.locator('.sidebar-desktop');
    await expect(sidebar).toBeVisible();

    // Dashboard nav item should be active by default
    const dashboardNav = page.locator('.sidebar-nav-item.active');
    await expect(dashboardNav).toContainText('Dashboard');

    // Help Center link should be visible in sidebar
    const helpLink = page.getByRole('button', { name: /help/i }).first();
    await expect(helpLink).toBeVisible();

    // Legal section should be visible
    const legalSection = page.locator('.sidebar-legal');
    await expect(legalSection).toBeVisible();

    // Terms of Service link should exist
    const termsLink = page.getByRole('button', { name: /terms of service/i });
    await expect(termsLink).toBeVisible();
  });
});
