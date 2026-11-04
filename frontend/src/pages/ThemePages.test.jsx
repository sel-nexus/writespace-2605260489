/** Verify dark reading surfaces and unchanged browser-local permissions and records. */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';

const owner = { userId: 'u1', username: 'writer', displayName: 'Writer One', role: 'user' };
const other = { ...owner, userId: 'u2' };
const admin = { ...owner, userId: 'admin', role: 'Admin' };
const post = {
  id: 'p1', userId: 'u1', title: 'Local pages', content: 'Original words',
  authorName: 'Writer One', authorAvatar: 'Writer One', createdAt: '2026-11-04T12:00:00Z',
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('writespace_theme', 'dark');
  window.history.replaceState({}, '', '/');
});
afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

/** Enter the real router with optional identity and real persisted records. */
function renderAt(path, session = null, records = [post]) {
  if (session) localStorage.setItem('writespace_session', JSON.stringify(session));
  localStorage.setItem('writespace_posts', JSON.stringify(records));
  window.history.replaceState({}, '', path);
  return render(<App />);
}

/** Read saved data independently of the rendered page. */
function storedPosts() {
  return JSON.parse(localStorage.getItem('writespace_posts'));
}

/** Check keyboard focus colors on the existing native link or button. */
function expectFocus(control, color = 'primary-300') {
  expect(control).toHaveClass(`dark:focus-visible:ring-${color}`, 'dark:focus-visible:ring-offset-slate-950');
}

describe('dark public and list surfaces', () => {
  it('pairs hero, feature, preview and footer colors without changing records or public access', async () => {
    const user = userEvent.setup();
    renderAt('/');
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('main')).toHaveClass('dark:text-slate-100');
    const hero = screen.getByRole('region', { name: /Room for your words/ });
    expect(hero).toHaveClass('dark:bg-none', 'dark:bg-slate-900', 'dark:border-slate-700');
    const feature = screen.getByRole('heading', { name: 'Room to write' }).closest('article');
    expect(feature).toHaveClass('dark:border-slate-700');
    expect(within(feature).getByText(/Let an idea/)).toHaveClass('dark:text-slate-300');
    const previews = screen.getByRole('region', { name: 'Recently written' });
    expect(within(previews).getByRole('article')).toHaveClass('dark:bg-slate-900');
    expect(within(previews).getByText('Nov 4, 2026')).toHaveClass('dark:text-slate-300');
    expect(screen.getByRole('contentinfo')).toHaveClass('dark:border-slate-700', 'dark:text-slate-100');
    expectFocus(screen.getByRole('link', { name: 'Start writing' }));
    expectFocus(within(screen.getByRole('navigation', { name: 'Footer' })).getByRole('link', { name: 'Explore' }));
    await user.click(within(previews).getByRole('link', { name: post.title }));
    expect(window.location.pathname).toBe('/login');
    expect(storedPosts()).toEqual([post]);
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
  });

  it.each([['/', null], ['/blogs', owner]])('keeps the empty CTA usable in dark mode at %s', async (path, session) => {
    const user = userEvent.setup();
    renderAt(path, session, []);
    const empty = screen.getByRole('heading', { name: 'No posts here yet.' }).parentElement;
    expect(empty).toHaveClass('dark:border-slate-700');
    const link = within(empty).getByRole('link');
    expectFocus(link);
    await user.click(link);
    expect(window.location.pathname).toBe(path === '/' ? '/register' : '/write');
    expect(storedPosts()).toEqual([]);
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
  });

  it('pairs the populated list and write action while keeping post navigation intact', async () => {
    const user = userEvent.setup();
    renderAt('/blogs', owner);
    expect(screen.getByRole('main')).toHaveClass('dark:text-slate-100');
    expect(screen.getByText('Words to pause with, ideas to return to.')).toHaveClass('dark:text-slate-300');
    expectFocus(screen.getByRole('link', { name: 'Write a post' }));
    await user.click(within(screen.getByRole('region', { name: 'All posts' })).getByRole('link', { name: post.title }));
    expect(window.location.pathname).toBe('/blog/p1');
    expect(storedPosts()).toEqual([post]);
  });
});

describe('dark detail and management', () => {
  it.each([owner, other, admin])('preserves detail permissions for $role/$userId and metadata', (session) => {
    renderAt('/blog/p1', session);
    expect(screen.getByRole('main')).toHaveClass('dark:text-slate-100');
    expect(screen.getByText(post.content)).toHaveClass('whitespace-pre-wrap');
    expect(screen.getByText('Nov 4, 2026')).toHaveClass('dark:text-slate-300');
    expectFocus(screen.getByRole('link', { name: 'Back to blogs' }));
    const canManage = session.userId === post.userId || session.role === 'Admin';
    if (canManage) {
      const edit = screen.getByRole('link', { name: 'Edit', exact: true });
      expect(edit).toHaveAttribute('href', '/edit/p1');
      expect(edit).toHaveClass('dark:border-slate-600', 'dark:text-slate-100', 'dark:hover:bg-slate-800');
      expect(edit.parentElement).toHaveClass('dark:border-slate-700');
      expectFocus(edit);
      const remove = screen.getByRole('button', { name: 'Delete' });
      expect(remove).toHaveClass('dark:border-red-400', 'dark:text-red-300', 'dark:hover:bg-red-950');
      expectFocus(remove, 'red-300');
    } else {
      expect(screen.queryByRole('link', { name: 'Edit', exact: true })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    }
    expect(storedPosts()).toEqual([post]);
  });

  it('keeps invalid-date detail metadata readable without repairing it', () => {
    renderAt('/blog/p1', owner, [{ ...post, createdAt: '?' }]);
    expect(screen.getByText('Date unavailable')).toHaveClass('dark:text-slate-300');
    expect(storedPosts()).toEqual([{ ...post, createdAt: '?' }]);
  });

  it('cancels edits and native deletion without losing the post, identity or theme', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/blog/p1', owner);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(window.location.pathname).toBe('/blog/p1');
    expect(storedPosts()).toEqual([post]);
    await user.click(screen.getByRole('link', { name: 'Edit', exact: true }));
    await user.type(screen.getByLabelText('Title'), ' unsaved');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(post.title);
    expect(storedPosts()).toEqual([post]);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(owner);
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
  });

  it('retains details and a dark error after failed deletion, then permits an explicit retry', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt('/blog/p1', owner);
    const original = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'writespace_posts') throw new Error('quota');
      return original.call(this, key, value);
    });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveClass('dark:text-red-300');
    expect(screen.getByRole('alert')).toHaveTextContent('The storage change could not be confirmed.');
    expect(window.location.pathname).toBe('/blog/p1');
    expect(screen.getByText(post.content)).toBeInTheDocument();
    expect(storedPosts()).toEqual([post]);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(owner);
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(window.location.pathname).toBe('/blogs');
    expect(storedPosts()).toEqual([]);
    expect(screen.getByRole('heading', { name: 'No posts here yet.' })).toBeInTheDocument();
  });

  it('denies a nonowner direct edit without mutating records or preference', () => {
    renderAt('/edit/p1', other);
    expect(window.location.pathname).toBe('/blogs');
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(storedPosts()).toEqual([post]);
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
  });
});


describe('dark missing and unreadable pages', () => {
  it.each(['/blog/missing', '/edit/missing'])('keeps the missing surface and back action usable at %s', async (path) => {
    const user = userEvent.setup();
    renderAt(path, owner);
    expect(screen.getByRole('main')).toHaveClass('dark:text-slate-100');
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
    const back = screen.getByRole('link', { name: 'Back to blogs' });
    expect(back).toHaveClass('dark:border-slate-600', 'dark:text-slate-100');
    expectFocus(back);
    await user.click(back);
    expect(window.location.pathname).toBe('/blogs');
    expect(storedPosts()).toEqual([post]);
  });

  it.each(['/', '/blogs', '/blog/p1', '/edit/p1'])('keeps unreadable storage and dark status at %s', (path) => {
    renderAt(path, path === '/' ? null : owner).unmount();
    localStorage.setItem('writespace_posts', '{');
    render(<App />);
    expect(screen.getByRole('status')).toHaveClass('dark:text-slate-300');
    expect(localStorage.getItem('writespace_posts')).toBe('{');
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
  });

  it('pairs the unknown route and returns to public content via its existing link', async () => {
    const user = userEvent.setup();
    renderAt('/unknown');
    expect(screen.getByRole('main')).toHaveClass('dark:text-slate-100');
    expect(screen.getByText('Page not found')).toHaveClass('dark:text-slate-300');
    const back = screen.getByRole('link', { name: 'Back to WriteSpace' });
    expectFocus(back);
    await user.click(back);
    expect(window.location.pathname).toBe('/');
    expect(storedPosts()).toEqual([post]);
  });
});
