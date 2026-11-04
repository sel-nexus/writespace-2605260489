/** Exercise dark auth, write and edit through real links and browser-local records. */
import { test, expect } from './fixtures.js';

/** Reveal collapsed navigation before using its real controls on narrow screens. */
async function openNavigation(page) {
  if (page.viewportSize().width < 640) {
    const button = page.getByRole('button', { name: /^(Open|Close) navigation$/ });
    if (await button.getAttribute('aria-expanded') === 'false') await button.click();
  }
}

test('dark registration login write and edit preserve real records and informational counting', async ({ page }) => {
  await page.goto('/login');
  await openNavigation(page);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Username')).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('main').getByRole('link', { name: 'Join WriteSpace' }).click();
  await page.getByLabel('Username').fill('theme-writer');
  await page.getByLabel('Email').fill('theme-writer@example.test');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm password').fill('wrong');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByLabel('Confirm password')).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  await page.getByLabel('Confirm password').fill('demo-only');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const users = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(users).toHaveLength(1);
  expect(users[0]).toMatchObject({ username: 'theme-writer', role: 'user', password: 'demo-only' });
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  expect(session).toMatchObject({ userId: users[0].id, username: 'theme-writer', role: 'user' });
  // Re-enter auth through navigation; do not seed a fabricated authenticated session.
  await openNavigation(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await openNavigation(page);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Sign in' }).click();
  await page.getByLabel('Username').fill('theme-writer');
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByLabel('Password').fill('demo-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Write a post' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByText('A blank page', { exact: true })).toHaveCSS('color', 'rgb(148, 163, 184)');
  await expect(page.getByText('Plain text, saved only in this browser. Do not include sensitive data.', { exact: true }))
    .toHaveCSS('color', 'rgb(148, 163, 184)');
  await page.getByRole('button', { name: 'Save post' }).click();
  await expect(page.getByLabel('Content')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Title').fill('Dark browser journey');
  const content = '😀' + 'x'.repeat(10001);
  await page.getByLabel('Content').fill(content);
  await expect(page.getByLabel('Content')).not.toHaveAttribute('maxlength');
  await expect(page.getByRole('status')).toHaveText('10002 characters');
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBeNull();
  await page.getByRole('button', { name: 'Save post' }).click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/);
  const [saved] = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  expect(saved).toMatchObject({ title: 'Dark browser journey', content, userId: users[0].id });
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Content')).toHaveValue(content);
  await page.getByLabel('Content').fill('');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Content is required.')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([saved]);
  await page.getByLabel('Title').fill('Dark revision');
  await page.getByLabel('Content').fill('Revised 😀');
  await expect(page.getByRole('status')).toHaveText('9 characters');
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([
    { ...saved, title: 'Dark revision', content: 'Revised 😀' },
  ]);
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(users);
});
