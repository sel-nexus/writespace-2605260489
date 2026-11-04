/** Exercise browser-local account journeys with console-error capture from fixtures. */
import { test, expect } from './fixtures.js';

const protectedPaths = ['/blogs', '/blog/example', '/write', '/edit/example', '/admin', '/users'];

/** Fill all four registration fields through their accessible labels. */
async function fillRegistration(page, username = 'journey-writer') {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill('writer@example.test');
  await page.getByLabel('Password', { exact: true }).fill(' demo-only ');
  await page.getByLabel('Confirm password', { exact: true }).fill(' demo-only ');
}

test('public exploration to registration, reload, logout and exact local login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No posts here yet.' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Join WriteSpace' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByText(/Do not use real passwords or sensitive data/)).toBeVisible();
  await fillRegistration(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('navigation', { name: 'Primary' })).toContainText('journey-writer');
  const saved = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(saved.users).toHaveLength(1);
  expect(saved.users[0]).toMatchObject({ username: 'journey-writer', password: ' demo-only ', role: 'user' });
  expect(saved.users[0]).not.toHaveProperty('confirmPassword');
  expect(saved.session.userId).toBe(saved.users[0].id);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toContainText('journey-writer');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Sign in' }).click();
  await page.getByLabel('Username').fill('journey-writer');
  await page.getByLabel('Password').fill('demo-only');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  await page.getByLabel('Password').fill(' demo-only ');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('link', { name: 'Your reading space' })).toBeVisible();
  await page.getByRole('link', { name: 'Explore', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Your reading space' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
});

test('registration required, mismatch, reserved and duplicate errors preserve inputs', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveCount(4);
  await fillRegistration(page, 'admin');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('The username admin is reserved.');
  await page.getByLabel('Username').fill('journey-writer');
  await page.getByLabel('Confirm password').fill('different');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords must match.');
  await expect(page.getByLabel('Email')).toHaveValue('writer@example.test');
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  await page.getByLabel('Confirm password').fill(' demo-only ');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Join WriteSpace' }).click();
  await fillRegistration(page);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('This username is already in use.');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')).length)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
});

test('exact demo Admin login updates navigation and logout clears identity', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText(/Demo Admin:/)).toContainText('username admin, password admin');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('link', { name: 'Admin dashboard' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).role)).toBe('Admin');
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  await page.getByRole('link', { name: 'Explore', exact: true }).click();
  await page.getByRole('link', { name: 'Admin dashboard' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
});

test('mobile account form and authenticated menu open, close, navigate and logout', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Join WriteSpace' }).click();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  await fillRegistration(page, 'mobile-writer');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toContainText('mobile-writer');
  await page.getByRole('button', { name: 'Close navigation' }).click();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Explore', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.screenshot({ path: testInfo.outputPath('auth-mobile-menu.png'), fullPage: true });
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
});

for (const path of protectedPaths) {
  test(`guest direct initial entry ${path} redirects to login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  });
}

for (const role of ['user', 'Admin']) {
  for (const path of [...protectedPaths, '/login', '/register']) {
    test(`${role} direct initial entry ${path} applies role policy`, async ({ page }) => {
      // Direct-entry setup only; the normal account journeys above use real UI authentication.
      await page.addInitScript(({ role }) => {
        localStorage.setItem('writespace_session', JSON.stringify({
          userId: role === 'Admin' ? 'admin' : 'entry-user', username: 'entry', displayName: 'Entry account', role,
        }));
      }, { role });
      await page.goto(path);
      const authScreen = ['/login', '/register'].includes(path);
      const denied = role === 'user' && ['/admin', '/users'].includes(path);
      const expectedPath = authScreen ? (role === 'Admin' ? '/admin' : '/blogs') : denied ? '/blogs' : path;
      await expect(page).toHaveURL(new RegExp(`${expectedPath}$`));
      await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).role)).toBe(role);
    });
  }
}

test('malformed session direct entry fails closed without repairing stored data', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('writespace_session', '{'));
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBe('{');
});
