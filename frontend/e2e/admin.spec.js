/** Exercise live Admin journeys with the existing automatic console-error fixture. */
import { test, expect } from './fixtures.js';

/** Sign in through the existing form without injecting a session. */
async function login(page, username = 'admin', password = 'admin') {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** Fill the account form without submitting or changing local storage directly. */
async function fillAccount(page, username, role) {
  await page.getByLabel('Display name').fill(`${username} display`);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(' demo-only ');
  await page.getByLabel('Role', { exact: true }).selectOption(role);
}

/** Read actual persisted accounts, never calling application domain helpers. */
async function accounts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users') || '[]'));
}

test('Admin validates, creates both roles, reloads and logs into each new account', async ({ page, browserErrors }, testInfo) => {
  await page.goto('/login');
  await login(page);
  await expect(page.getByRole('heading', { name: 'Admin dashboard.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Newest posts' })).toContainText('No posts here yet.');
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expect(page.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete admin' })).toHaveAttribute(
    'title', 'The default admin account is protected.',
  );
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveCount(4);
  await fillAccount(page, 'admin', 'user');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByLabel('Username')).toHaveAttribute('aria-describedby', 'username-error');
  await expect(page.getByRole('alert')).toHaveText('The username admin is reserved.');
  expect(await accounts(page)).toEqual([]);
  await fillAccount(page, 'new-writer', 'user');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status')).toContainText('Account created.');
  await fillAccount(page, 'new-writer', 'Admin');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('This username is already in use.');
  await page.getByLabel('Username').fill('new-admin');
  await page.getByRole('button', { name: 'Create account' }).click();
  const saved = await accounts(page);
  expect(saved.map((account) => account.role)).toEqual(['user', 'Admin']);
  for (const account of saved) {
    expect(account.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
    expect(account).not.toHaveProperty('email');
  }
  await page.reload();
  await expect(page.getByRole('button', { name: 'Delete new-admin' })).toBeVisible();
  expect(await accounts(page)).toEqual(saved);
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Sign in' }).click();
  await login(page, 'new-writer', ' demo-only ');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('link', { name: 'Your reading space' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Sign in' }).click();
  await login(page, 'new-admin', ' demo-only ');
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expect(page.getByRole('button', { name: 'Delete new-admin' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete new-admin' })).toHaveAttribute(
    'title', 'You cannot delete your currently signed-in account.',
  );
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete new-writer' }).click();
  expect(await accounts(page)).toEqual(saved);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete new-writer' }).click();
  expect(await accounts(page)).toEqual([saved[1]]);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Delete new-writer' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('admin-accounts-desktop.png'), fullPage: true });
  expect(browserErrors).toEqual([]);
});

test('Admin edits and deletes another writer from newest-five inline controls', async ({ page, browserErrors }) => {
  // Seed posts only once; authentication and subsequent navigation use the actual UI.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('admin-post-fixture')) {
      localStorage.setItem('writespace_posts', JSON.stringify(Array.from({ length: 7 }, (_, index) => ({
        id: `p${index}`, title: `Writer post ${index}`, content: `Writer words ${index}`,
        userId: 'writer', authorName: 'Writer', authorAvatar: 'Writer',
        createdAt: `2026-11-0${index + 1}T00:00:00.000Z`,
      }))));
      sessionStorage.setItem('admin-post-fixture', 'ready');
    }
  });
  await page.goto('/login');
  await login(page);
  const newest = page.getByRole('region', { name: 'Newest posts' });
  await expect(newest.getByRole('article')).toHaveCount(5);
  await expect(newest.getByRole('heading', { level: 3 })).toHaveText([
    'Writer post 6', 'Writer post 5', 'Writer post 4', 'Writer post 3', 'Writer post 2',
  ]);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  await newest.getByRole('link', { name: 'Edit Writer post 6' }).click();
  await page.getByLabel('Title').fill('Admin revision');
  await page.getByRole('button', { name: 'Save changes' }).click();
  const edited = before.map((post) => post.id === 'p6' ? { ...post, title: 'Admin revision' } : post);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(edited);
  await page.getByRole('link', { name: 'Admin dashboard' }).click();
  await page.reload();
  await expect(newest.getByRole('link', { name: 'Admin revision', exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await newest.getByRole('button', { name: 'Delete Admin revision' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(edited);
  page.once('dialog', (dialog) => dialog.accept());
  await newest.getByRole('button', { name: 'Delete Admin revision' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(
    edited.filter((post) => post.id !== 'p6'),
  );
  await expect(newest.getByRole('article')).toHaveCount(5);
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await expect(page.getByRole('heading', { name: 'Write a post.' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

for (const width of [390, 768, 1280]) {
  test(`account cards/table remain usable at ${width}px`, async ({ page, browserErrors }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await login(page);
    await page.getByRole('link', { name: 'Manage Users' }).click();
    await fillAccount(page, 'responsive-writer', 'user');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('button', { name: 'Delete responsive-writer' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`admin-users-${width}.png`), fullPage: true });
    expect(browserErrors).toEqual([]);
  });
}
