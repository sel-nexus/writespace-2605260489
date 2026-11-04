/** Exercise real admin routes, controls and storage failures without mocked domain methods. */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';
import { STORAGE_KEYS } from '../lib/storage.js';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'Admin' };
const account = {
  id: 'u1', displayName: '<b>Editor</b>', username: 'editor', password: 'hidden-secret',
  role: 'Admin', createdAt: '2026-11-04T12:00:00.000Z',
};
const post = {
  id: 'p1', title: 'First post', content: 'Plain text', createdAt: '2026-11-04T12:00:00Z',
  userId: 'writer', authorName: 'Writer', authorAvatar: 'Writer',
};

/** Enter the single-router app using an initial path and existing local identity. */
function renderAt(path, session = admin) {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  window.history.replaceState({}, '', path);
  return render(<App />);
}

/** Inspect persisted state independently of the account domain. */
function stored(key = STORAGE_KEYS.users) {
  return JSON.parse(localStorage.getItem(key));
}

/** Fill every accessible account field without submitting. */
async function fill(user, username = 'new-editor', role = 'user') {
  await user.type(screen.getByLabelText('Display name'), 'New Editor');
  await user.type(screen.getByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Password'), ' demo-only ');
  await user.selectOptions(screen.getByLabelText('Role'), role);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([account]));
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post]));
  vi.stubGlobal('crypto', { randomUUID: () => '7a587348-f914-4df9-80a6-c7e7dc813519' });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('dashboard data and explicit navigation', () => {
  it('shows exact four labels and shared user totals including the separate seeded Admin', () => {
    renderAt('/admin');
    const statistics = screen.getByRole('region', { name: 'Local statistics' });
    const terms = within(statistics).getAllByRole('term');
    expect(terms.map((term) => term.textContent)).toEqual(['Total Posts', 'Total Users', 'Total Admins', 'Total users']);
    expect(within(statistics).getAllByRole('definition').map((value) => value.textContent)).toEqual(['1', '2', '2', '2']);
    expect(stored()).toEqual([account]);
  });

  it.each([0, 1, 5, 7])('shows only the newest five of %s posts without fabricating empty records', (count) => {
    const records = Array.from({ length: count }, (_, index) => ({
      ...post, id: `p${index}`, title: `Post ${index}`, createdAt: `2026-11-0${index + 1}T00:00:00Z`,
    }));
    localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(records));
    renderAt('/admin');
    const newest = screen.getByRole('region', { name: 'Newest posts' });
    expect(within(newest).queryAllByRole('article')).toHaveLength(Math.min(count, 5));
    expect(within(newest).queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(
      records.slice().reverse().slice(0, 5).map((record) => record.title),
    );
    if (!count) expect(within(newest).getByText('No posts here yet.')).toBeInTheDocument();
    expect(stored(STORAGE_KEYS.posts)).toEqual(records);
  });

  it('opens existing write and users destinations only by clicking', async () => {
    const user = userEvent.setup();
    renderAt('/admin');
    await user.click(screen.getByRole('link', { name: 'Write New Post' }));
    expect(window.location.pathname).toBe('/write');
    expect(screen.getByLabelText('Title')).toHaveValue('');
    await user.click(screen.getByRole('link', { name: 'Admin dashboard' }));
    await user.click(screen.getByRole('link', { name: 'Manage Users' }));
    expect(window.location.pathname).toBe('/users');
    await user.click(screen.getByRole('link', { name: 'Back to dashboard' }));
    expect(window.location.pathname).toBe('/admin');
  });

  it('edits another author from inline controls and preserves original metadata', async () => {
    const user = userEvent.setup();
    renderAt('/admin');
    await user.click(screen.getByRole('link', { name: 'Edit First post' }));
    expect(window.location.pathname).toBe('/edit/p1');
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Admin revision');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(stored(STORAGE_KEYS.posts)).toEqual([{ ...post, title: 'Admin revision' }]);
  });

  it('cancels then confirms only the selected post and updates the dashboard total', async () => {
    const second = { ...post, id: 'p2', title: 'Second post' };
    localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post, second]));
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/admin');
    await user.click(screen.getByRole('button', { name: 'Delete First post' }));
    expect(stored(STORAGE_KEYS.posts)).toEqual([post, second]);
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete First post' }));
    expect(stored(STORAGE_KEYS.posts)).toEqual([second]);
    expect(screen.queryByRole('link', { name: 'First post' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Post deleted.');
    expect(window.location.pathname).toBe('/admin');
  });
});

describe('account presentation and creation', () => {
  it('shows escaped names, avatars, roles, dates and protected seeded/current tooltips but never passwords', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('/users', { ...admin, userId: account.id, username: account.username });
    expect(screen.getByRole('img', { name: '<b>Editor</b>, Admin' })).toBeInTheDocument();
    expect(screen.getByText('<b>Editor</b>')).toBeInTheDocument();
    expect(screen.getByText('11/4/2026')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
    expect(container).not.toHaveTextContent('hidden-secret');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    const fixed = screen.getByRole('button', { name: 'Delete admin' });
    const current = screen.getByRole('button', { name: 'Delete editor' });
    expect(fixed).toBeDisabled();
    expect(fixed).toHaveAttribute('title', 'The default admin account is protected.');
    expect(current).toBeDisabled();
    expect(current).toHaveAttribute('title', 'You cannot delete your currently signed-in account.');
    const confirm = vi.spyOn(window, 'confirm');
    await user.click(fixed);
    await user.click(current);
    expect(confirm).not.toHaveBeenCalled();
    expect(stored()).toEqual([account]);
  });

  it.each(['user', 'Admin'])('creates and reloads a %s account only after explicit submit', async (role) => {
    const user = userEvent.setup();
    const view = renderAt('/users');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    await fill(user, 'new-editor', role);
    expect(writes).not.toHaveBeenCalled();
    expect(stored()).toEqual([account]);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    const saved = stored()[1];
    expect(saved).toMatchObject({ username: 'new-editor', displayName: 'New Editor', password: ' demo-only ', role });
    expect(saved.id).toBe('7a587348-f914-4df9-80a6-c7e7dc813519');
    expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
    expect(saved).not.toHaveProperty('email');
    expect(screen.getByRole('status')).toHaveTextContent('Account created.');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(stored(STORAGE_KEYS.session)).toEqual(admin);
    view.unmount();
    renderAt('/users');
    expect(screen.getByRole('button', { name: 'Delete new-editor' })).toBeInTheDocument();
    expect(stored()).toEqual([account, saved]);
  });

  it.each(['Display name', 'Username', 'Password', 'Role'])('validates missing %s individually with associated feedback', async (label) => {
    const user = userEvent.setup();
    renderAt('/users');
    await fill(user);
    if (label === 'Role') await user.selectOptions(screen.getByLabelText(label), '');
    else await user.clear(screen.getByLabelText(label));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(label)).toHaveAccessibleDescription(`${label} is required.`);
    expect(stored()).toEqual([account]);
  });

  it('reports all required fields, then clears errors after corrected submission', async () => {
    const user = userEvent.setup();
    renderAt('/users');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getAllByRole('alert')).toHaveLength(4);
    expect(stored()).toEqual([account]);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(stored()).toHaveLength(2);
  });

  it.each([['admin', 'The username admin is reserved.'], ['editor', 'This username is already in use.']])(
    'preserves form and collection on reserved or duplicate username %s', async (username, message) => {
      const user = userEvent.setup();
      renderAt('/users');
      await fill(user, username);
      await user.click(screen.getByRole('button', { name: 'Create account' }));
      expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(message);
      expect(screen.getByLabelText('Display name')).toHaveValue('New Editor');
      expect(stored()).toEqual([account]);
    },
  );

  it('cancels and confirms account removal, preserving the active session', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/users');
    await user.click(screen.getByRole('button', { name: 'Delete editor' }));
    expect(stored()).toEqual([account]);
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete editor' }));
    expect(stored()).toEqual([]);
    expect(stored(STORAGE_KEYS.session)).toEqual(admin);
    expect(screen.getByRole('status')).toHaveTextContent('Account deleted.');
    expect(screen.getByText('No stored accounts yet.')).toBeInTheDocument();
  });
});

describe('failed reads and writes and render safety', () => {
  it.each(['/admin', '/users'])('does not mutate or confirm on render at %s', (path) => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(admin));
    window.history.replaceState({}, '', path);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const removes = vi.spyOn(Storage.prototype, 'removeItem');
    const confirm = vi.spyOn(window, 'confirm');
    render(<App />);
    expect(writes).not.toHaveBeenCalled();
    expect(removes).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(stored()).toEqual([account]);
    expect(stored(STORAGE_KEYS.posts)).toEqual([post]);
  });

  for (const path of ['/admin', '/users']) {
    it.each(['malformed', 'unavailable'])(`shows safe ${path} fallback for %s account reads without repair`, (mode) => {
      if (mode === 'malformed') localStorage.setItem(STORAGE_KEYS.users, '{');
      const original = Storage.prototype.getItem;
      const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
        if (mode === 'unavailable' && key === STORAGE_KEYS.users) throw new Error('blocked');
        return original.call(this, key);
      });
      renderAt(path);
      expect(screen.getByRole('status')).toHaveTextContent(
        mode === 'malformed' ? 'Stored data could not be read safely.' : 'Browser storage is unavailable.',
      );
      read.mockRestore();
      expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(mode === 'malformed' ? '{' : JSON.stringify([account]));
      if (path === '/users') expect(screen.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
    });
  }

  it.each(['create', 'account delete', 'post delete'])('preserves state and never retries a failed %s write', async (action) => {
    const user = userEvent.setup();
    renderAt(action === 'post delete' ? '/admin' : '/users');
    if (action === 'create') await fill(user);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const name = action === 'create' ? 'Create account' : action === 'post delete' ? 'Delete First post' : 'Delete editor';
    await user.click(screen.getByRole('button', { name }));
    expect(screen.getByRole('alert')).toHaveTextContent('The storage change could not be confirmed.');
    expect(screen.getByRole('status')).not.toHaveTextContent(/created|deleted/);
    expect(stored()).toEqual([account]);
    expect(stored(STORAGE_KEYS.posts)).toEqual([post]);
    expect(writes).toHaveBeenCalledTimes(1);
    if (action === 'create') expect(screen.getByLabelText('Display name')).toHaveValue('New Editor');
  });

  it.each(['create', 'account delete', 'post delete'])('rechecks changed storage for %s rather than trusting the rendered list', async (action) => {
    const user = userEvent.setup();
    renderAt(action === 'post delete' ? '/admin' : '/users');
    if (action === 'create') await fill(user);
    const key = action === 'post delete' ? STORAGE_KEYS.posts : STORAGE_KEYS.users;
    localStorage.setItem(key, '{');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', {
      name: action === 'create' ? 'Create account' : action === 'post delete' ? 'Delete First post' : 'Delete editor',
    }));
    expect(screen.getByRole('alert')).toHaveTextContent('Stored data could not be read safely.');
    expect(localStorage.getItem(key)).toBe('{');
  });

  it.each(['account delete', 'post delete'])('reports a disappeared target on %s without claiming success', async (action) => {
    const user = userEvent.setup();
    renderAt(action === 'post delete' ? '/admin' : '/users');
    const key = action === 'post delete' ? STORAGE_KEYS.posts : STORAGE_KEYS.users;
    localStorage.setItem(key, '[]');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: action === 'post delete' ? 'Delete First post' : 'Delete editor' }));
    expect(screen.getByRole('alert')).toHaveTextContent(action === 'post delete' ? 'Post not found' : 'Account not found.');
    expect(stored(key)).toEqual([]);
  });

  it('keeps account form values on unavailable native UUID support', async () => {
    const user = userEvent.setup();
    renderAt('/users');
    vi.stubGlobal('crypto', {});
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This browser cannot generate account IDs.');
    expect(screen.getByLabelText('Display name')).toHaveValue('New Editor');
    expect(stored()).toEqual([account]);
  });

  it.each(['create', 'account delete', 'post delete'])('blocks %s when current storage becomes unavailable', async (action) => {
    const user = userEvent.setup();
    renderAt(action === 'post delete' ? '/admin' : '/users');
    if (action === 'create') await fill(user);
    const key = action === 'post delete' ? STORAGE_KEYS.posts : STORAGE_KEYS.users;
    const original = Storage.prototype.getItem;
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (requested) {
      if (requested === key) throw new Error('blocked');
      return original.call(this, requested);
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', {
      name: action === 'create' ? 'Create account' : action === 'post delete' ? 'Delete First post' : 'Delete editor',
    }));
    expect(screen.getByRole('alert')).toHaveTextContent('Browser storage is unavailable.');
    read.mockRestore();
    expect(stored()).toEqual([account]);
    expect(stored(STORAGE_KEYS.posts)).toEqual([post]);
    expect(screen.getByRole('status')).not.toHaveTextContent(/created|deleted/);
  });

  it('rechecks a newly protected username before account deletion', async () => {
    const user = userEvent.setup();
    renderAt('/users');
    const protectedAccount = { ...account, username: 'admin' };
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([protectedAccount]));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete editor' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This account is protected.');
    expect(stored()).toEqual([protectedAccount]);
  });

  it.each(['malformed', 'unavailable'])('shows a safe empty dashboard when posts are %s', (mode) => {
    if (mode === 'malformed') localStorage.setItem(STORAGE_KEYS.posts, '{');
    const original = Storage.prototype.getItem;
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (mode === 'unavailable' && key === STORAGE_KEYS.posts) throw new Error('blocked');
      return original.call(this, key);
    });
    renderAt('/admin');
    expect(screen.getByRole('region', { name: 'Newest posts' })).toHaveTextContent('No posts here yet.');
    expect(screen.getByRole('status')).toHaveTextContent(
      mode === 'malformed' ? 'Stored data could not be read safely.' : 'Browser storage is unavailable.',
    );
    read.mockRestore();
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(mode === 'malformed' ? '{' : JSON.stringify([post]));
  });
});
