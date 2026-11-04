/** Verify real responsive theme journeys with automatic browser-error capture. */
import { test, expect } from './fixtures.js';

/** Reveal the existing mobile menu only when it is collapsed. */
async function openNavigation(page) {
  if (page.viewportSize().width < 640) {
    const button = page.getByRole('button', { name: /^(Open|Close) navigation$/ });
    if (await button.getAttribute('aria-expanded') === 'false') await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
  }
}

test('public keyboard toggle survives login, route clicks, reload and logout', async ({ page }) => {
  await page.goto('/');
  await openNavigation(page);
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const toggle = nav.getByRole('button', { name: 'Switch to dark mode' });
  await expect(toggle).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBeNull();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAccessibleName('Switch to light mode');
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  const focusStyle = await toggle.evaluate((button) => getComputedStyle(button).boxShadow);
  expect(focusStyle).not.toBe('none');
  await nav.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await openNavigation(page);
  await expect(nav.getByRole('link', { name: 'Admin dashboard' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  const session = await page.evaluate(() => localStorage.getItem('writespace_session'));
  expect(JSON.parse(session)).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'Admin' });
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  await nav.getByRole('link', { name: 'Explore', exact: true }).click();
  await openNavigation(page);
  await nav.getByRole('link', { name: 'Admin dashboard' }).click();
  await page.reload();
  await openNavigation(page);
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBe(session);
  await nav.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await openNavigation(page);
  await expect(nav.getByRole('link', { name: 'Join WriteSpace' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  const lightAction = nav.getByRole('button', { name: 'Switch to light mode' });
  await lightAction.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('light');
});

test('invalid raw preference stays unmodified until explicit selection', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('writespace_theme', '"dark"'));
  await page.reload();
  await openNavigation(page);
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('"dark"');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  await page.reload();
  await openNavigation(page);
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['writespace_theme']);
});
