/** Verify real forms, route guards, persistence and explicit identity transitions. */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '../App.jsx';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';
import { FormField } from '../components/FormField.jsx';
import { readJson, STORAGE_KEYS } from '../lib/storage.js';

const userSession = { userId: 'u1', username: 'writer', displayName: 'Writer', role: 'user' };
const adminSession = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'Admin' };
const account = {
  id: 'u1', username: 'writer', displayName: 'Writer', role: 'user',
  password: ' demo-only ', createdAt: '2026-11-04T12:00:00.000Z',
};
const protectedPaths = ['/blogs', '/blog/example', '/write', '/edit/example', '/admin', '/users'];

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('crypto', { randomUUID: () => 'u1' });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Enter the real single-router application at an initial browser path. */
function renderAt(path) {
  window.history.replaceState({}, '', path);
  return render(<App />);
}

/** Fill registration controls through accessible labels without submitting. */
async function fillRegistration(user, username = 'writer') {
  await user.type(screen.getByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Email'), 'writer@example.test');
  await user.type(screen.getByLabelText('Password', { exact: true }), ' demo-only ');
  await user.type(screen.getByLabelText('Confirm password'), ' demo-only ');
}

/** Submit credentials through the actual login form. */
async function submitLogin(user, username = 'writer', password = ' demo-only ') {
  await user.type(screen.getByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
}

describe('real account journeys', () => {
  it('registers only on submit, updates navbar, reloads, logs out and signs in using saved credentials', async () => {
    const user = userEvent.setup();
    const view = renderAt('/register');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const removals = vi.spyOn(Storage.prototype, 'removeItem');
    await fillRegistration(user);
    expect(writes).not.toHaveBeenCalled();
    expect(removals).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(window.location.pathname).toBe('/blogs');
    expect(screen.getByText('writer', { selector: 'p' })).toBeInTheDocument();
    expect(readJson(STORAGE_KEYS.users, []).value).toHaveLength(1);
    expect(readJson(STORAGE_KEYS.session, null).value).toMatchObject({ userId: 'u1', role: 'user' });
    view.unmount();
    const reloaded = renderAt('/blogs');
    expect(screen.getByRole('link', { name: 'Your reading space' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(window.location.pathname).toBe('/');
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
    expect(readJson(STORAGE_KEYS.users, []).value).toHaveLength(1);
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Sign in' }));
    await submitLogin(user);
    expect(window.location.pathname).toBe('/blogs');
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    reloaded.unmount();
  });

  it.each([['admin', 'admin', '/admin', 'Admin dashboard'], ['writer', ' demo-only ', '/blogs', 'Your reading space']])(
    'logs in %s through explicit submission and reflects role state', async (username, password, home, link) => {
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([account]));
      const user = userEvent.setup();
      renderAt('/login');
      expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
      await submitLogin(user, username, password);
      expect(window.location.pathname).toBe(home);
      expect(screen.getByRole('link', { name: link })).toBeInTheDocument();
      expect(readJson(STORAGE_KEYS.session, null).value.role).toBe(home === '/admin' ? 'Admin' : 'user');
    },
  );

  it('renders demo warnings and no login or registration mutations merely on render', () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const removals = vi.spyOn(Storage.prototype, 'removeItem');
    const view = renderAt('/login');
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
    expect(screen.getByText(/Demo Admin:/)).toHaveTextContent('username admin, password admin');
    expect(screen.getByText(/Do not use real passwords/)).toBeInTheDocument();
    view.unmount();
    renderAt('/register');
    expect(screen.getByText(/passwords are stored as plain text/)).toBeInTheDocument();
    expect(writes).not.toHaveBeenCalled();
    expect(removals).not.toHaveBeenCalled();
  });

  it('supports real login/register link navigation', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Join WriteSpace' }));
    expect(window.location.pathname).toBe('/register');
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Sign in' }));
    expect(window.location.pathname).toBe('/login');
  });
});

describe('validation and storage failure feedback', () => {
  it('associates each empty login field with its error and does not establish identity', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    for (const label of ['Username', 'Password']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(`${label} is required.`);
    }
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
    expect(window.location.pathname).toBe('/login');
  });

  it('shows the exact invalid-login message and preserves typed values', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await submitLogin(user, 'missing', 'wrong');
    expect(screen.getByRole('alert')).toHaveTextContent(/^Invalid username or password\.$/);
    expect(screen.getByLabelText('Username')).toHaveValue('missing');
    expect(screen.getByLabelText('Password')).toHaveValue('wrong');
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
    expect(window.location.pathname).toBe('/login');
  });

  it.each(['Username', 'Email', 'Password', 'Confirm password'])('rejects missing registration field %s individually', async (label) => {
    const user = userEvent.setup();
    renderAt('/register');
    await fillRegistration(user);
    await user.clear(screen.getByLabelText(label, { exact: true }));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('aria-describedby');
    expect(localStorage.length).toBe(0);
    expect(window.location.pathname).toBe('/register');
  });

  it.each([['admin', 'The username admin is reserved.'], ['writer', 'This username is already in use.']])(
    'shows associated reserved/duplicate error for %s without mutation', async (username, message) => {
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([account]));
      const user = userEvent.setup();
      renderAt('/register');
      await fillRegistration(user, username);
      await user.click(screen.getByRole('button', { name: 'Create account' }));
      expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(message);
      expect(screen.getByLabelText('Email')).toHaveValue('writer@example.test');
      expect(readJson(STORAGE_KEYS.users, []).value).toEqual([account]);
      expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
    },
  );

  it('rejects mismatched confirmation and clears errors on an explicitly corrected submit', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await fillRegistration(user);
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription('Passwords must match.');
    expect(localStorage.length).toBe(0);
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), ' demo-only ');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(window.location.pathname).toBe('/blogs');
  });

  it.each(['/login', '/register'])('keeps %s form and guest identity on failed write', async (path) => {
    const user = userEvent.setup();
    renderAt(path);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    if (path === '/register') {
      await fillRegistration(user);
      await user.click(screen.getByRole('button', { name: 'Create account' }));
    } else {
      await submitLogin(user, 'admin', 'admin');
    }
    expect(screen.getByRole('alert')).toHaveTextContent('The storage change could not be confirmed.');
    expect(window.location.pathname).toBe(path);
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(screen.getByLabelText('Username')).toHaveValue(path === '/register' ? 'writer' : 'admin');
  });

  it('does not navigate or update React identity after a partial registration write', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === STORAGE_KEYS.session) throw new Error('quota');
      setItem.call(this, key, value);
    });
    await fillRegistration(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Registration is incomplete');
    expect(window.location.pathname).toBe('/register');
    expect(readJson(STORAGE_KEYS.users, []).value).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('writer@example.test');
  });

  it.each(['/login', '/register'])('shows malformed account feedback in %s without overwriting data', async (path) => {
    localStorage.setItem(STORAGE_KEYS.users, '{');
    const user = userEvent.setup();
    renderAt(path);
    if (path === '/register') {
      await fillRegistration(user);
      await user.click(screen.getByRole('button', { name: 'Create account' }));
    } else {
      await submitLogin(user);
    }
    expect(screen.getByRole('alert')).toHaveTextContent('Stored data could not be read safely.');
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe('{');
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
    expect(window.location.pathname).toBe(path);
  });

  it('preserves identity and current route on failed logout, then allows an explicit retry', async () => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(userSession));
    const user = userEvent.setup();
    renderAt('/blogs');
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Logout failed.');
    expect(screen.getByText('Writer', { selector: 'p.font-semibold' })).toBeInTheDocument();
    expect(readJson(STORAGE_KEYS.session, null).value).toEqual(userSession);
    expect(window.location.pathname).toBe('/blogs');
    remove.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(window.location.pathname).toBe('/');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });
});

describe('route policy and render safety', () => {
  it.each(protectedPaths)('redirects guest direct entry %s to login without mutation', (path) => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    renderAt(path);
    expect(window.location.pathname).toBe('/login');
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(['/admin', '/users'])('redirects a valid non-Admin from %s to blogs', (path) => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(userSession));
    renderAt(path);
    expect(window.location.pathname).toBe('/blogs');
    expect(screen.getByRole('heading', { name: 'Your reading space.' })).toBeInTheDocument();
  });

  it.each(protectedPaths)('admits Admin direct entry %s with the correct protected destination', (path) => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(adminSession));
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    renderAt(path);
    expect(window.location.pathname).toBe(path);
    const heading = path === '/blogs' ? 'Your reading space.'
      : path === '/write' ? 'Write a post.'
        : path.startsWith('/blog/') || path.startsWith('/edit/') ? 'Post not found'
          : path === '/admin' ? 'Admin dashboard.' : 'Manage users.';
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(['/blogs', '/blog/example', '/write', '/edit/example'])('admits a valid user to %s', (path) => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(userSession));
    renderAt(path);
    expect(window.location.pathname).toBe(path);
    const heading = path === '/blogs' ? 'Your reading space.' : path === '/write' ? 'Write a post.' : 'Post not found';
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  for (const session of [userSession, adminSession]) {
    it.each(['/login', '/register'])(`redirects authenticated ${session.role} from %s to role home without writes`, (path) => {
      localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
      const write = vi.spyOn(Storage.prototype, 'setItem');
      const remove = vi.spyOn(Storage.prototype, 'removeItem');
      renderAt(path);
      expect(window.location.pathname).toBe(session.role === 'Admin' ? '/admin' : '/blogs');
      expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
      expect(write).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });
  }

  it.each(['{', '{}', '[]', JSON.stringify({ ...adminSession, displayName: '' }), JSON.stringify({ ...adminSession, role: 'admin' })])(
    'fails closed on malformed stored session %s and does not repair it', (raw) => {
      localStorage.setItem(STORAGE_KEYS.session, raw);
      renderAt('/admin');
      expect(window.location.pathname).toBe('/login');
      expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(raw);
      expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    },
  );

  it('fails closed on unavailable session reads without a crash or mutation', () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    renderAt('/write');
    expect(window.location.pathname).toBe('/login');
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
    expect(writes).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps unknown routes public and supplies a real return link', () => {
    renderAt('/unknown');
    expect(window.location.pathname).toBe('/unknown');
    expect(screen.getByRole('link', { name: 'Back to WriteSpace' })).toHaveAttribute('href', '/');
  });

  it('renders explicit guard children and default outlet, denying wrong roles', () => {
    render(
      <MemoryRouter initialEntries={['/restricted']}>
        <Routes>
          <Route
            path="/restricted"
            element={
              <ProtectedRoute session={userSession} allowedRoles={['Admin']}>
                <p>
                  Restricted child
                </p>
              </ProtectedRoute>
            }
          />
          <Route
            path="/blogs"
            element={
              <p>
                Role home
              </p>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Role home')).toBeInTheDocument();
    expect(screen.queryByText('Restricted child')).not.toBeInTheDocument();
  });

  it('admits guest-only children and outlet without writes', () => {
    const view = render(
      <MemoryRouter>
        <ProtectedRoute guestOnly>
          <p>
            Guest content
          </p>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText('Guest content')).toBeInTheDocument();
    view.unmount();
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<ProtectedRoute guestOnly />}>
            <Route
              path="/"
              element={
                <p>
                  Guest outlet
                </p>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Guest outlet')).toBeInTheDocument();
  });
});

describe('invalid route role configuration', () => {
  it.each([[null], [[]], ['Admin']])('denies malformed or empty allowed roles %j', (allowedRoles) => {
    render(
      <MemoryRouter initialEntries={['/restricted']}>
        <Routes>
          <Route
            path="/restricted"
            element={
              <ProtectedRoute session={userSession} allowedRoles={allowedRoles}>
                <p>
                  Restricted content
                </p>
              </ProtectedRoute>
            }
          />
          <Route
            path="/blogs"
            element={
              <p>
                Safe role home
              </p>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Safe role home')).toBeInTheDocument();
    expect(screen.queryByText('Restricted content')).not.toBeInTheDocument();
  });
});

describe('explicit authenticated guard children', () => {
  it('renders children only for an admitted complete identity', () => {
    render(
      <MemoryRouter>
        <ProtectedRoute session={userSession}>
          <p>
            Allowed child
          </p>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText('Allowed child')).toBeInTheDocument();
  });
});

describe('shared field and navigation behavior', () => {
  it('supports optional native field state and updates on explicit input', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(<FormField id="optional" label="Optional note" value="" onChange={change} required={false} />);
    const field = screen.getByLabelText('Optional note');
    expect(field).toHaveAttribute('aria-required', 'false');
    expect(field).toHaveAttribute('aria-invalid', 'false');
    expect(field).not.toHaveAttribute('aria-describedby');
    await user.type(field, 'note');
    expect(change).toHaveBeenCalled();
  });

  it('toggles authenticated navigation explicitly and closes after route navigation', async () => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(userSession));
    const user = userEvent.setup();
    renderAt('/');
    const toggle = screen.getByRole('button', { name: 'Open navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('link', { name: 'Your reading space' }));
    expect(window.location.pathname).toBe('/blogs');
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  });
});
