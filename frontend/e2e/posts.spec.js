/** Exercise live browser-local posts; defer execution to the parent verification phase. */
import { test as base, expect } from './fixtures.js';

const owner = { userId: 'u1', username: 'writer', displayName: 'Writer One', role: 'user' };
const other = { ...owner, userId: 'u2', displayName: 'Other Writer' };
const post = {
  id: 'p1', title: '<b>Plain title</b>', content: '<script>plain text</script>\n' + 'x'.repeat(130),
  createdAt: '2026-11-04T12:00:00Z', userId: 'u1', authorName: 'Writer One', authorAvatar: 'Writer One',
};

/** Seed only first entry so reload cannot reset mutations. */
async function seed(page, session, records) {
  await page.addInitScript(({ session, records }) => {
    if (!sessionStorage.getItem('posts-fixture')) {
      localStorage.setItem('writespace_session', JSON.stringify(session));
      localStorage.setItem('writespace_posts', JSON.stringify(records));
      sessionStorage.setItem('posts-fixture', 'ready');
    }
  }, { session, records });
}

const test = base.extend({
  nonownerSession: async ({ page }, use) => {
    await seed(page, other, [post]);
    await use(other);
  },
});

/** Requery actual persisted state without invoking domain methods. */
async function persisted(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
}

test('create edit reload cancel and confirm deletion through real links', async ({ page, browserErrors }) => {
  await seed(page, owner, []);
  await page.goto('/blogs');
  await expect(page.getByRole('heading', { name: 'No posts here yet.' })).toBeVisible();
  await page.getByRole('link', { name: 'Write a post' }).click();
  await page.getByRole('button', { name: 'Save post' }).click();
  await expect(page.getByLabel('Title')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Content')).toHaveAttribute('aria-invalid', 'true');
  expect(await persisted(page)).toEqual([]);
  await page.getByLabel('Title').fill('Browser journey');
  await page.getByLabel('Content').fill('Plain text\nSecond line');
  await expect(page.getByRole('status')).toHaveText('22 characters');
  expect(await persisted(page)).toEqual([]);
  await page.getByRole('button', { name: 'Save post' }).click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/);
  const [saved] = await persisted(page);
  expect(saved).toMatchObject({ title: 'Browser journey', content: 'Plain text\nSecond line', userId: 'u1', authorName: 'Writer One' });
  expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  expect(Number.isFinite(Date.parse(saved.createdAt))).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Browser journey' })).toBeVisible();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Browser journey');
  await page.getByLabel('Content').fill('');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Content is required.')).toBeVisible();
  expect(await persisted(page)).toEqual([saved]);
  await page.getByLabel('Title').fill('Revised journey');
  await page.getByLabel('Content').fill('Revised words');
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect(await persisted(page)).toEqual([{ ...saved, title: 'Revised journey', content: 'Revised words' }]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Revised journey' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: 'Revised journey' })).toBeVisible();
  expect(await persisted(page)).toHaveLength(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await persisted(page)).toEqual([]);
  await expect(page.getByRole('heading', { name: 'No posts here yet.' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('nonowner reads metadata and escaped text with no management controls', async ({ page, nonownerSession, browserErrors }) => {
  expect(nonownerSession.userId).toBe('u2');
  await page.goto('/blogs');
  const card = page.getByRole('article');
  await expect(card.getByRole('img', { name: 'Writer One' })).toBeVisible();
  await expect(card.getByText('Nov 4, 2026')).toBeVisible();
  await expect(card.locator('p').filter({ hasText: '<script>plain text</script>' })).toHaveText(post.content.slice(0, 120) + '…');
  await expect(card.locator('b, script')).toHaveCount(0);
  await card.getByRole('link', { name: post.title }).click();
  await expect(page.getByRole('heading', { name: post.title })).toBeVisible();
  await expect(page.getByRole('main').locator('p.whitespace-pre-wrap')).toHaveText(post.content);
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to blogs' }).click();
  expect(await persisted(page)).toEqual([post]);
  expect(browserErrors).toEqual([]);
});

test('nonowner direct edit entry redirects without changing the record', async ({ page, nonownerSession, browserErrors }) => {
  expect(nonownerSession.role).toBe('user');
  await page.goto('/edit/p1');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('link', { name: post.title })).toBeVisible();
  expect(await persisted(page)).toEqual([post]);
  expect(browserErrors).toEqual([]);
});

test('Admin manages another author through detail links', async ({ page, browserErrors }) => {
  await seed(page, { ...owner, userId: 'admin', role: 'Admin' }, [post]);
  await page.goto('/blogs');
  await page.getByRole('link', { name: post.title }).click();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title').fill('Admin revision');
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect(await persisted(page)).toEqual([{ ...post, title: 'Admin revision' }]);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('link', { name: 'Write a post' })).toBeVisible();
  expect(await persisted(page)).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test('missing detail returns to the real empty reading page', async ({ page, browserErrors }) => {
  await seed(page, owner, []);
  await page.goto('/blog/missing');
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to blogs' }).click();
  await expect(page.getByRole('heading', { name: 'No posts here yet.' })).toBeVisible();
  expect(await persisted(page)).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test('malformed records remain intact after a user-directed create attempt', async ({ page, browserErrors }) => {
  await seed(page, owner, []);
  await page.goto('/blogs');
  // Introduce browser-local corruption, then reload to exercise real adapter recovery.
  await page.evaluate(() => localStorage.setItem('writespace_posts', '{'));
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Stored data could not be read safely.');
  await page.getByRole('link', { name: 'Write a post' }).click();
  await page.getByLabel('Title').fill('Unsaved title');
  await page.getByLabel('Content').fill('Unsaved body');
  await page.getByRole('button', { name: 'Save post' }).click();
  await expect(page.getByRole('alert')).toContainText('Stored data could not be read safely.');
  await expect(page).toHaveURL(/\/write$/);
  await expect(page.getByLabel('Content')).toHaveValue('Unsaved body');
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('{');
  expect(browserErrors).toEqual([]);
});
