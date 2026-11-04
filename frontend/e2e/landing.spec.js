/** Exercise the landing slice against a live frontend; run only in the parent phase. */
import { test, expect } from './fixtures.js';

const posts = [
  { id: 'old', title: 'An older page', content: 'An earlier thought.', createdAt: '2025-01-01T00:00:00Z' },
  { id: 'newest', title: 'The newest page', content: 'A freshly written thought.', createdAt: '2025-01-04T00:00:00Z' },
  { id: 'middle', title: 'A middle page', content: 'A thought worth revisiting.', createdAt: '2025-01-02T00:00:00Z' },
  { id: 'recent', title: 'A recent page', content: 'Another local thought.', createdAt: '2025-01-03T00:00:00Z' },
].map((post) => ({ ...post, userId: 'writer1', authorName: 'Local Writer', authorAvatar: 'Local Writer' }));

/** Seed deterministic browser-local records only before the initial navigation. */
async function seedPosts(page) {
  await page.addInitScript((records) => {
    if (localStorage.getItem('writespace_posts') === null) {
      localStorage.setItem('writespace_posts', JSON.stringify(records));
    }
  }, posts);
}

/** Check intrinsic layout and required column breakpoints in the real browser. */
async function assertLayout(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const grid = page.getByRole('region', { name: 'Recently written' }).locator('div.grid');
  const columns = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  const width = page.viewportSize().width;
  expect(columns).toBe(width >= 1024 ? 3 : width >= 768 ? 2 : 1);
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  if (width < 640) await expect(toggle).toBeVisible();
  else await expect(toggle).toBeHidden();
}

test('newest local previews, responsive layout, CSS motion and honest route fallback', async ({ page, browserErrors }, testInfo) => {
  await seedPosts(page);
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Recently written' });
  await expect(latest.getByRole('article')).toHaveCount(3);
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText([
    'The newest page', 'A recent page', 'A middle page',
  ]);
  await expect(page.getByRole('link', { name: 'An older page' })).toHaveCount(0);
  await expect(latest.getByText('Local Writer')).toHaveCount(3);
  await assertLayout(page);
  const note = page.locator('.floating-note');
  expect(await note.evaluate((element) => getComputedStyle(element).animationName)).toBe('float-note');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await note.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  await page.screenshot({ path: testInfo.outputPath('landing-populated.png'), fullPage: true });
  const before = await page.evaluate(() => localStorage.getItem('writespace_posts'));
  await page.getByRole('link', { name: 'The newest page' }).click();
  await expect(page).toHaveURL(/\/blog\/newest$/);
  // This slice intentionally owns only / and *; account guards belong to the auth slice.
  await expect(page.getByRole('heading', { name: 'This page isn’t here.' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to WriteSpace' }).click();
  await expect(page.getByRole('link', { name: 'The newest page' })).toBeVisible();
  await page.reload();
  await expect(latest.getByRole('article')).toHaveCount(3);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(before);
  expect(browserErrors).toEqual([]);
});

test('empty landing, hero actions, footer destinations and mobile menu', async ({ page, browserErrors }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No posts here yet.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recently written' }).getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Less distraction. More expression.' }).getByRole('article')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Start writing' })).toHaveAttribute('href', '/register');
  await expect(page.getByRole('region', { name: /Room for/ }).getByRole('link', { name: 'Sign in' }))
    .toHaveAttribute('href', '/login');
  const footer = page.getByRole('navigation', { name: 'Footer' });
  await expect(footer.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/');
  await expect(footer.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  await expect(footer.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
  if (page.viewportSize().width < 640) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Sign in' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('landing-mobile-menu.png'), fullPage: true });
    await page.getByRole('button', { name: 'Close navigation' }).click();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
  }
  await page.screenshot({ path: testInfo.outputPath('landing-empty.png'), fullPage: true });
  await page.getByRole('link', { name: 'Start writing' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByRole('link', { name: 'Back to WriteSpace' }).click();
  await footer.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Back to WriteSpace' }).click();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(browserErrors).toEqual([]);
});

for (const role of ['user', 'Admin']) {
  test(`local ${role} session presents the correct navbar destination`, async ({ page, browserErrors }, testInfo) => {
    await page.addInitScript((role) => {
      localStorage.setItem('writespace_session', JSON.stringify({
        userId: 'writer1', username: 'local-writer', displayName: 'Local Writer', role,
      }));
    }, role);
    await page.goto('/');
    if (page.viewportSize().width < 640) await page.getByRole('button', { name: 'Open navigation' }).click();
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('img', { name: `Local Writer, ${role}` })).toBeVisible();
    const destination = nav.getByRole('link', { name: role === 'Admin' ? 'Admin dashboard' : 'Your reading space' });
    await expect(destination).toHaveAttribute('href', role === 'Admin' ? '/admin' : '/blogs');
    await expect(nav.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`landing-${role}.png`), fullPage: true });
    await destination.click();
    await expect(page).toHaveURL(role === 'Admin' ? /\/admin$/ : /\/blogs$/);
    await page.getByRole('link', { name: 'Back to WriteSpace' }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).role)).toBe(role);
    expect(browserErrors).toEqual([]);
  });
}

test('malformed local data is not overwritten and remains a safe empty state', async ({ page, browserErrors }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('writespace_posts', '{broken-json');
    localStorage.setItem('writespace_session', '{"role":"Admin"}');
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('The stored data has not been changed.');
  await expect(page.getByRole('heading', { name: 'No posts here yet.' })).toBeVisible();
  if (page.viewportSize().width < 640) await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Sign in' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('{broken-json');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBe('{"role":"Admin"}');
  await page.screenshot({ path: testInfo.outputPath('landing-malformed.png'), fullPage: true });
  expect(browserErrors).toEqual([]);
});
