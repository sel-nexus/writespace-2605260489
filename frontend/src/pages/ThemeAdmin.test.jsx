/** Verify dark administration through real routes, records and negative mutation outcomes. */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';
import { STORAGE_KEYS } from '../lib/storage.js';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'Admin' };
const account = {
  id: 'u1', displayName: 'Editor', username: 'editor', password: 'demo-only',
  role: 'Admin', createdAt: '2026-11-04T12:00:00Z',
};
const reader = { ...account, id: 'u2', username: 'reader', displayName: 'Reader', role: 'user' };
const post = {
  id: 'p1', title: 'Local post', content: 'Local words', userId: 'writer',
  authorName: 'Writer', authorAvatar: 'Writer', createdAt: '2026-11-04T12:00:00Z',
};

/** Mount the existing single-router app with a saved Admin identity. */
function renderAt(path, session = admin) {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  window.history.replaceState({}, '', path);
  return render(<App />);
}

/** Inspect actual storage independently of the domain helpers. */
function stored(key = STORAGE_KEYS.users) {
  return JSON.parse(localStorage.getItem(key));
}

/** Enter every required account value without submitting. */
async function fill(user, username = 'new-editor', role = 'user') {
  await user.type(screen.getByLabelText('Display name'), 'New Editor');
  await user.type(screen.getByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Password'), ' demo-only ');
  await user.selectOptions(screen.getByLabelText('Role'), role);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('writespace_theme', 'dark');
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([account, reader]));
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post]));
  vi.stubGlobal('crypto', { randomUUID: () => '7a587348-f914-4df9-80a6-c7e7dc813519' });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
});

describe('dark dashboard presentation and metric preservation', () => {
  it.each([0, 1, 7])('keeps all four metric rules and newest-five ordering for %s posts', async (count) => {
    const records = Array.from({ length: count }, (_, index) => ({
      ...post, id: `p${index}`, title: `Post ${index}`, createdAt: `2026-11-0${index + 1}T00:00:00Z`,
    }));
    localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(records));
    const user = userEvent.setup();
    renderAt('/admin');
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('main')).toHaveClass('dark:text-slate-100');
    const statistics = screen.getByRole('region', { name: 'Local statistics' });
    const terms = within(statistics).getAllByRole('term');
    expect(terms.map((term) => term.textContent)).toEqual([
      'Total Posts', 'Total Users', 'Total Admins', 'Total users',
    ]);
    expect(within(statistics).getAllByRole('definition').map((value) => value.textContent)).toEqual([
      String(count), '3', '2', '3',
    ]);
    for (const term of terms) {
      expect(term).toHaveClass('dark:text-slate-300');
      expect(term.parentElement).toHaveClass('bg-surface', 'dark:bg-slate-900', 'dark:border-slate-700');
    }
    const newest = screen.getByRole('region', { name: 'Newest posts' });
    expect(within(newest).queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(
      records.slice().reverse().slice(0, 5).map((record) => record.title),
    );
    for (const card of within(newest).queryAllByRole('article')) expect(card).toHaveClass('dark:bg-slate-900');
    if (!count) expect(within(newest).getByText('No posts here yet.')).toHaveClass('dark:text-slate-300');
    const manage = screen.getByRole('link', { name: 'Manage Users' });
    expect(manage).toHaveClass('action-secondary', 'dark:text-slate-100', 'dark:focus-visible:ring-primary-300');
    expect(screen.getByRole('link', { name: 'Write New Post' })).toHaveClass('dark:bg-primary-300');
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(stored()).toEqual([account, reader]);
    expect(stored(STORAGE_KEYS.posts)).toEqual(records);
    expect(stored(STORAGE_KEYS.session)).toEqual(admin);
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    await user.click(manage);
    expect(window.location.pathname).toBe('/users');
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
  });

  it('cancels then confirms a dark destructive post action and refreshes only post metrics', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/admin');
    const remove = screen.getByRole('button', { name: 'Delete Local post' });
    expect(remove).toHaveClass('dark:text-red-300', 'dark:focus-visible:ring-red-300');
    expect(screen.getByRole('link', { name: 'Edit Local post' })).toHaveClass('dark:hover:bg-slate-800');
    await user.click(remove);
    expect(stored(STORAGE_KEYS.posts)).toEqual([post]);
    confirm.mockReturnValue(true);
    await user.click(remove);
    expect(stored(STORAGE_KEYS.posts)).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('Post deleted.');
    expect(screen.getByRole('status')).toHaveClass('dark:text-slate-300');
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual(['0', '3', '2', '3']);
    expect(stored()).toEqual([account, reader]);
  });
});

describe('dark account form, responsive records and safeguards', () => {
  it.each(['user', 'Admin'])('creates a %s account, preserves input until submit and reloads the saved record', async (role) => {
    const user = userEvent.setup();
    const view = renderAt('/users');
    for (const label of ['Display name', 'Username', 'Password', 'Role']) {
      expect(screen.getByLabelText(label)).toHaveClass('bg-surface', 'dark:bg-slate-900', 'dark:text-slate-100');
      expect(screen.getByLabelText(label)).toHaveClass('dark:border-slate-600', 'dark:focus:ring-offset-slate-900');
    }
    expect(screen.getByRole('table')).toHaveClass('block', 'md:table', 'md:table-fixed');
    for (const row of screen.getAllByRole('row').slice(1)) {
      expect(row).toHaveClass('block', 'md:table-row', 'dark:bg-slate-900', 'dark:border-slate-700');
    }
    const editorRow = screen.getByRole('button', { name: 'Delete editor' }).closest('tr');
    const readerRow = screen.getByRole('button', { name: 'Delete reader' }).closest('tr');
    expect(within(editorRow).getByText('Admin')).toHaveClass('dark:bg-primary-950', 'dark:text-primary-200');
    expect(within(readerRow).getByText('user')).toHaveClass('dark:bg-slate-800', 'dark:text-slate-200');
    await fill(user, 'new-editor', role);
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(screen.getByLabelText('Password')).toHaveValue(' demo-only ');
    expect(screen.getByLabelText('Role')).toHaveValue(role);
    expect(stored()).toEqual([account, reader]);
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    const submit = screen.getByRole('button', { name: 'Create account' });
    expect(submit).toHaveClass('action-primary', 'dark:bg-primary-300', 'dark:focus-visible:ring-primary-300');
    await user.click(submit);
    const saved = stored()[2];
    expect(saved).toMatchObject({ username: 'new-editor', displayName: 'New Editor', password: ' demo-only ', role });
    expect(screen.getByRole('status')).toHaveTextContent('Account created.');
    expect(screen.getByLabelText('Username')).toHaveValue('');
    expect(stored(STORAGE_KEYS.session)).toEqual(admin);
    expect(stored(STORAGE_KEYS.posts)).toEqual([post]);
    view.unmount();
    renderAt('/users');
    expect(screen.getByRole('button', { name: 'Delete new-editor' })).toBeEnabled();
    expect(stored()).toEqual([account, reader, saved]);
  });

  it('pairs all required errors including select feedback and recovers after correction', async () => {
    const user = userEvent.setup();
    renderAt('/users');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getAllByRole('alert')).toHaveLength(4);
    for (const alert of screen.getAllByRole('alert')) expect(alert).toHaveClass('dark:text-red-300');
    for (const label of ['Display name', 'Username', 'Password', 'Role']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(`${label} is required.`);
    }
    expect(stored()).toEqual([account, reader]);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(stored()).toHaveLength(3);
  });

  it.each([
    ['admin', 'The username admin is reserved.'],
    ['editor', 'This username is already in use.'],
  ])('rejects %s without resetting the dark form or changing records', async (username, message) => {
    const user = userEvent.setup();
    renderAt('/users');
    await fill(user, username);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveClass('dark:text-red-300');
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(message);
    expect(screen.getByLabelText('Password')).toHaveValue(' demo-only ');
    expect(stored()).toEqual([account, reader]);
  });

  it('keeps seeded and current account controls disabled, then cancels and confirms an eligible deletion', async () => {
    const session = { ...admin, userId: account.id, username: account.username, displayName: account.displayName };
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/users', session);
    for (const [name, title] of [
      ['Delete admin', 'The default admin account is protected.'],
      ['Delete editor', 'You cannot delete your currently signed-in account.'],
    ]) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', title);
      expect(button).toHaveClass('dark:disabled:text-slate-400', 'dark:disabled:border-slate-600');
      await user.click(button);
    }
    expect(confirm).not.toHaveBeenCalled();
    const remove = screen.getByRole('button', { name: 'Delete reader' });
    expect(remove).toHaveClass('dark:text-red-300', 'dark:focus-visible:ring-offset-slate-900');
    await user.click(remove);
    expect(stored()).toEqual([account, reader]);
    confirm.mockReturnValue(true);
    await user.click(remove);
    expect(stored()).toEqual([account]);
    expect(stored(STORAGE_KEYS.session)).toEqual(session);
    expect(stored(STORAGE_KEYS.posts)).toEqual([post]);
    expect(screen.getByRole('status')).toHaveTextContent('Account deleted.');
  });
});

it.each(['create', 'account delete', 'post delete'])('retains dark feedback and saved state on failed %s writes', async (action) => {
  const user = userEvent.setup();
  renderAt(action === 'post delete' ? '/admin' : '/users');
  if (action === 'create') await fill(user);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const name = action === 'create' ? 'Create account' : action === 'post delete' ? 'Delete Local post' : 'Delete reader';
  await user.click(screen.getByRole('button', { name }));
  expect(screen.getByRole('alert')).toHaveTextContent('The storage change could not be confirmed.');
  expect(screen.getByRole('alert')).toHaveClass('dark:text-red-300');
  expect(screen.getByRole('status')).not.toHaveTextContent(/created|deleted/);
  expect(stored()).toEqual([account, reader]);
  expect(stored(STORAGE_KEYS.posts)).toEqual([post]);
  expect(stored(STORAGE_KEYS.session)).toEqual(admin);
  expect(localStorage.getItem('writespace_theme')).toBe('dark');
  if (action === 'create') expect(screen.getByLabelText('Display name')).toHaveValue('New Editor');
});

it.each(['/admin', '/users'])('keeps malformed account fallback readable at %s without repair', (path) => {
  localStorage.setItem(STORAGE_KEYS.users, '{');
  renderAt(path);
  expect(screen.getByRole('status')).toHaveTextContent('Stored data could not be read safely.');
  expect(screen.getByRole('status')).toHaveClass('dark:text-slate-300');
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe('{');
  if (path === '/admin') {
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual(['1', '1', '1', '1']);
  } else {
    expect(screen.getByText('No stored accounts yet.')).toHaveClass('dark:text-slate-300');
    expect(screen.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
  }
});
