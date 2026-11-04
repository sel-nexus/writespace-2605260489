/** Exercise dark administration with real login, click navigation and browser-local persistence. */
import { test, expect } from './fixtures.js';

/** Reveal primary navigation only when the existing mobile menu is collapsed. */
async function openNavigation(page) {
  if (page.viewportSize().width < 640) {
    const button = page.getByRole('button', { name: /^(Open|Close) navigation$/ });
    if (await button.getAttribute('aria-expanded') === 'false') await button.click();
  }
}

/** Read the actual product records without injecting sessions or calling domain methods. */
async function stored(page, key) {
  return page.evaluate((name) => JSON.parse(localStorage.getItem(`writespace_${name}`) || '[]'), key);
}

/** Check the root theme and saved raw preference after navigation or reload. */
async function expectDark(page) {
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
}

test('dark Admin manages eligible accounts and writes reads edits and deletes a post', async ({ page, browserErrors }, testInfo) => {
  await page.goto('/login');
  await openNavigation(page);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expectDark(page);
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const session = await stored(page, 'session');
  expect(session).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'Admin' });
  const statistics = page.getByRole('region', { name: 'Local statistics' });
  await expect(statistics.locator('dt')).toHaveText(['Total Posts', 'Total Users', 'Total Admins', 'Total users']);
  await expect(statistics.locator('dd')).toHaveText(['0', '1', '1', '1']);
  await expect(page.getByText('No posts here yet.')).toBeVisible();
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expectDark(page);
  await expect(page.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveCount(4);
  expect(await stored(page, 'users')).toEqual([]);
  await page.getByLabel('Display name').fill('Dark Editor');
  await page.getByLabel('Username').fill('dark-editor');
  await page.getByLabel('Password').fill(' demo-only ');
  await page.getByLabel('Role').selectOption('user');
  expect(await stored(page, 'users')).toEqual([]);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status')).toContainText('Account created.');
  const accounts = await stored(page, 'users');
  expect(accounts).toHaveLength(1);
  expect(accounts[0]).toMatchObject({
    username: 'dark-editor', displayName: 'Dark Editor', password: ' demo-only ', role: 'user',
  });
  expect(accounts[0].id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(new Date(accounts[0].createdAt).toISOString()).toBe(accounts[0].createdAt);
  await page.reload();
  await expectDark(page);
  await expect(page.getByRole('button', { name: 'Delete dark-editor' })).toBeVisible();
  expect(await stored(page, 'users')).toEqual(accounts);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('theme-admin-accounts.png'), fullPage: true });
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete dark-editor' }).click();
  expect(await stored(page, 'users')).toEqual(accounts);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete dark-editor' }).click();
  await expect(page.getByRole('status')).toContainText('Account deleted.');
  expect(await stored(page, 'users')).toEqual([]);
  expect(await stored(page, 'session')).toEqual(session);
  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await expect(statistics.locator('dd')).toHaveText(['0', '1', '1', '1']);
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await page.getByLabel('Title').fill('Dark admin post');
  await page.getByLabel('Content').fill('Browser-local admin words');
  await page.getByRole('button', { name: 'Save post' }).click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/);
  await expect(page.getByRole('heading', { name: 'Dark admin post' })).toBeVisible();
  await expect(page.getByText('Browser-local admin words', { exact: true })).toBeVisible();
  const [post] = await stored(page, 'posts');
  expect(post).toMatchObject({ title: 'Dark admin post', content: 'Browser-local admin words', userId: session.userId });
  await expectDark(page);
  await openNavigation(page);
  await page.getByRole('link', { name: 'Admin dashboard' }).click();
  await expect(statistics.locator('dd')).toHaveText(['1', '1', '1', '1']);
  await page.getByRole('region', { name: 'Newest posts' }).getByRole('link', { name: 'Dark admin post', exact: true }).click();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title').fill('Dark admin revision');
  await page.getByLabel('Content').fill('Edited browser-local words');
  await page.getByRole('button', { name: 'Save changes' }).click();
  const edited = { ...post, title: 'Dark admin revision', content: 'Edited browser-local words' };
  expect(await stored(page, 'posts')).toEqual([edited]);
  await page.reload();
  await expectDark(page);
  await expect(page.getByRole('heading', { name: edited.title })).toBeVisible();
  await expect(page.getByText(edited.content, { exact: true })).toBeVisible();
  await openNavigation(page);
  await page.getByRole('link', { name: 'Admin dashboard' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Dark admin revision' }).click();
  expect(await stored(page, 'posts')).toEqual([edited]);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Dark admin revision' }).click();
  await expect(statistics.locator('dd')).toHaveText(['0', '1', '1', '1']);
  expect(await stored(page, 'posts')).toEqual([]);
  await page.reload();
  await expect(page.getByText('No posts here yet.')).toBeVisible();
  await expectDark(page);
  expect(await stored(page, 'session')).toEqual(session);
  expect(await stored(page, 'users')).toEqual([]);
  expect(browserErrors).toEqual([]);
});
