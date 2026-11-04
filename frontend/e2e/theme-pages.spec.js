/** Follow dark public previews into real authentication, reading and permitted management. */
import { test, expect } from './fixtures.js';

const account = {
  id: 'page-writer', username: 'page-writer', displayName: 'Page Writer', role: 'user',
  password: 'demo-only', createdAt: '2026-11-04T12:00:00Z',
};
const post = {
  id: 'page-post', userId: account.id, title: 'A page in the dark',
  content: 'Words saved in this browser.\nA second line to read.',
  authorName: account.displayName, authorAvatar: account.displayName, createdAt: account.createdAt,
};

/** Reveal existing collapsed navigation before clicking its controls. */
async function openNavigation(page) {
  if (page.viewportSize().width < 640) {
    const toggle = page.getByRole('button', { name: /^(Open|Close) navigation$/ });
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  }
}

/** Read actual persisted posts, independently of displayed content. */
async function storedPosts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
}

/** Supply demo records before entry, without fabricating a logged-in session. */
async function seedRecords(page, records = [post]) {
  await page.addInitScript(({ account, records }) => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    localStorage.setItem('writespace_posts', JSON.stringify(records));
  }, { account, records });
}

test('dark public preview authenticates and preserves records through read, edit cancel and delete cancel', async ({ page }) => {
  await seedRecords(page);
  await page.goto('/');
  await openNavigation(page);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  const previews = page.getByRole('region', { name: 'Recently written' });
  await expect(previews.getByText(account.displayName)).toBeVisible();
  await expect(previews.getByText('Nov 4, 2026')).toBeVisible();
  await previews.getByRole('link', { name: post.title }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await storedPosts(page)).toEqual([post]);
  await page.getByLabel('Username').fill(account.username);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  expect(session).toEqual({
    userId: account.id, username: account.username, displayName: account.displayName, role: account.role,
  });
  await page.getByRole('region', { name: 'All posts' }).getByRole('link', { name: post.title }).click();
  await expect(page).toHaveURL(/\/blog\/page-post$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title);
  await expect(page.getByRole('main').getByText(post.content, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveClass(/dark:text-red-300/);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title').fill('Unsaved draft');
  await page.getByLabel('Content').fill('Unsaved content');
  await page.getByRole('link', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title);
  expect(await storedPosts(page)).toEqual([post]);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/blog\/page-post$/);
  expect(await storedPosts(page)).toEqual([post]);
  await page.getByRole('link', { name: 'Back to blogs' }).click();
  await expect(page.getByRole('region', { name: 'All posts' }).getByRole('link', { name: post.title })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual([account]);
});

test('dark empty public collection remains usable through registration navigation', async ({ page }) => {
  await seedRecords(page, []);
  await page.goto('/');
  await openNavigation(page);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.getByRole('heading', { name: 'No posts here yet.' })).toBeVisible();
  await page.getByRole('link', { name: 'Write your first post' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('Username')).toBeVisible();
  expect(await storedPosts(page)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
});

for (const entry of ['/blog/missing', '/edit/missing']) {
  test(`dark missing entry ${entry} keeps safe back navigation for an existing local session`, async ({ page }) => {
    await seedRecords(page);
    // Missing URLs have no incoming link; enter with an existing demo session fixture.
    await page.addInitScript((account) => {
      localStorage.setItem('writespace_theme', 'dark');
      localStorage.setItem('writespace_session', JSON.stringify({
        userId: account.id, username: account.username, displayName: account.displayName, role: account.role,
      }));
    }, account);
    await page.goto(entry);
    await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to blogs' })).toHaveClass(/dark:text-slate-100/);
    await page.getByRole('link', { name: 'Back to blogs' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('region', { name: 'All posts' }).getByRole('link', { name: post.title })).toBeVisible();
    expect(await storedPosts(page)).toEqual([post]);
    expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
}

test('dark unknown route returns through the public fallback link', async ({ page }) => {
  await seedRecords(page);
  await page.addInitScript(() => localStorage.setItem('writespace_theme', 'dark'));
  await page.goto('/unknown-page');
  await expect(page.getByRole('heading', { name: 'This page isn’t here.' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to WriteSpace' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('region', { name: 'Recently written' }).getByRole('link', { name: post.title })).toBeVisible();
  expect(await storedPosts(page)).toEqual([post]);
  expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
});
