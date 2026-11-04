/** Exercise theme presentation through the real route shell and native controls. */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App, { AppRoutes } from '../App.jsx';

const writer = { userId: 'u1', username: 'writer', displayName: 'Writer', role: 'user' };
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'Admin' };
const account = {
  id: 'u1', username: 'writer', displayName: 'Writer', role: 'user',
  password: 'demo-only', createdAt: '2026-11-04T12:00:00.000Z',
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  window.history.replaceState({}, '', '/');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

/** Render the exported route entry without introducing a second browser router. */
function renderRoutes(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('theme initialization and keyboard control', () => {
  it.each([
    [null, false], ['light', false], ['dark', true], ['Dark', false],
    ['"dark"', false], ['system', false], ['', false],
  ])('initializes %s safely without any render-time storage write', (saved, dark) => {
    if (saved !== null) localStorage.setItem('writespace_theme', saved);
    document.documentElement.classList.add('dark');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const removals = vi.spyOn(Storage.prototype, 'removeItem');
    const view = renderRoutes();
    expect(document.documentElement.classList.contains('dark')).toBe(dark);
    expect(screen.getByRole('button', {
      name: dark ? 'Switch to light mode' : 'Switch to dark mode',
    })).toHaveAttribute('type', 'button');
    expect(view.container.firstChild).toHaveClass('dark:bg-neutral-950', 'dark:text-neutral-50');
    expect(screen.getByRole('banner')).toHaveClass('dark:bg-neutral-900', 'dark:text-neutral-50');
    expect(writes).not.toHaveBeenCalled();
    expect(removals).not.toHaveBeenCalled();
    expect(localStorage.getItem('writespace_theme')).toBe(saved);
  });

  it('supports Enter and Space with next-action labels, focus and actual persistence', async () => {
    const user = userEvent.setup();
    renderRoutes();
    const button = screen.getByRole('button', { name: 'Switch to dark mode' });
    expect(button).toHaveClass('focus-visible:ring-2', 'dark:focus-visible:ring-primary-300');
    for (let step = 0; step < 10 && document.activeElement !== button; step += 1) {
      await user.tab();
    }
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(document.documentElement).toHaveClass('dark');
    expect(button).toHaveAccessibleName('Switch to light mode');
    expect(button).toHaveFocus();
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
    await user.keyboard(' ');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(button).toHaveAccessibleName('Switch to dark mode');
    expect(localStorage.getItem('writespace_theme')).toBe('light');
  });

  it.each(['read', 'getter'])('keeps light navigation usable on a %s failure', async (failure) => {
    if (failure === 'getter') {
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('Blocked'); });
    } else {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    }
    const user = userEvent.setup();
    renderRoutes();
    expect(document.documentElement).not.toHaveClass('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['setter', 'getter'])('keeps the selected view active on a write %s failure', async (failure) => {
    localStorage.setItem('writespace_theme', 'light');
    const user = userEvent.setup();
    renderRoutes();
    if (failure === 'getter') {
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('Blocked'); });
    } else {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    }
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    vi.restoreAllMocks();
    expect(localStorage.getItem('writespace_theme')).toBe('light');
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('does not consult the OS or re-read preference during route changes', async () => {
    const os = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('matchMedia', os);
    const user = userEvent.setup();
    renderRoutes();
    localStorage.setItem('writespace_theme', 'dark');
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Sign in' }));
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass('dark');
    expect(os).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('public, authenticated and mobile navigation contracts', () => {
  it.each([[null, 'public'], [writer, 'writer'], [admin, 'admin']])(
    'retains %s navigation and uses the same toggle in the mobile menu', async (session, mode) => {
      if (session) localStorage.setItem('writespace_session', JSON.stringify(session));
      const user = userEvent.setup();
      renderRoutes();
      const nav = screen.getByRole('navigation', { name: 'Primary' });
      expect(nav).toHaveClass('hidden', 'sm:flex');
      await user.click(screen.getByRole('button', { name: 'Open navigation' }));
      expect(nav).toHaveClass('flex');
      expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
      expect(within(nav).getAllByRole('button', { name: 'Switch to dark mode' })).toHaveLength(1);
      if (mode === 'public') {
        expect(within(nav).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
        expect(within(nav).getByRole('link', { name: 'Join WriteSpace' })).toHaveAttribute('href', '/register');
        expect(within(nav).queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
      } else {
        expect(within(nav).getByRole('link', {
          name: mode === 'admin' ? 'Admin dashboard' : 'Your reading space',
        })).toHaveAttribute('href', mode === 'admin' ? '/admin' : '/blogs');
        expect(within(nav).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
        expect(within(nav).queryByRole('link', { name: 'Join WriteSpace' })).not.toBeInTheDocument();
      }
      await user.click(within(nav).getByRole('button', { name: 'Switch to dark mode' }));
      expect(document.documentElement).toHaveClass('dark');
      expect(nav).toHaveClass('flex');
      await user.click(within(nav).getByRole('link', { name: 'Explore', exact: true }));
      expect(nav).toHaveClass('hidden');
      expect(document.documentElement).toHaveClass('dark');
    },
  );

  it('preserves preference across routes, browser remount and logout without schema changes', async () => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    localStorage.setItem('writespace_posts', '[]');
    localStorage.setItem('writespace_session', JSON.stringify(writer));
    const usersBefore = localStorage.getItem('writespace_users');
    const sessionBefore = localStorage.getItem('writespace_session');
    const user = userEvent.setup();
    const view = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    await user.click(screen.getByRole('link', { name: 'Your reading space' }));
    expect(window.location.pathname).toBe('/blogs');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('writespace_session')).toBe(sessionBefore);
    view.unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(window.location.pathname).toBe('/');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
    expect(localStorage.getItem('writespace_users')).toBe(usersBefore);
    expect(localStorage.getItem('writespace_posts')).toBe('[]');
    expect(Object.keys(localStorage).sort()).toEqual(['writespace_posts', 'writespace_theme', 'writespace_users']);
    expect(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });
});
