/** Exercise real routed pages against jsdom storage, never mocked business methods. */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';
import { getPost, listPosts } from '../lib/posts.js';
import { STORAGE_KEYS } from '../lib/storage.js';

const owner = { userId: 'u1', username: 'writer', displayName: 'Writer One', role: 'user' };
const admin = { ...owner, userId: 'admin', role: 'Admin' };
const other = { ...owner, userId: 'u2', displayName: 'Other Writer' };
const post = {
  id: 'p1', title: '<b>A title</b>', content: '<script>text only</script>\nSecond line',
  createdAt: '2026-11-04T12:00:00.000Z', userId: 'u1',
  authorName: 'Writer One', authorAvatar: 'Writer One',
};

/** Enter the real application with an explicit initial session fixture. */
function renderAt(path, session = owner, records = [post]) {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  if (records !== null) localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(records));
  window.history.replaceState({}, '', path);
  return render(<App />);
}

/** Fill the actual accessible post controls without submitting. */
async function fill(user, title = 'New title', content = 'New content') {
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), title);
  await user.clear(screen.getByLabelText('Content'));
  await user.type(screen.getByLabelText('Content'), content);
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('crypto', { randomUUID: () => 'new-id' });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('reading and route states', () => {
  it('renders all newest-first escaped previews with 120 characters, avatars, dates and repeating accents', async () => {
    const records = [0, 4, 2, 3, 1].map((day) => ({
      ...post, id: `p${day}`, title: `<b>Day ${day}</b>`,
      content: '😀'.repeat(121), createdAt: day ? `2026-11-0${day}T00:00:00Z` : '?',
    }));
    const user = userEvent.setup();
    const { container } = renderAt('/blogs', owner, records);
    const region = screen.getByRole('region', { name: 'All posts' });
    expect(within(region).getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      '<b>Day 4</b>', '<b>Day 3</b>', '<b>Day 2</b>', '<b>Day 1</b>', '<b>Day 0</b>',
    ]);
    const cards = within(region).getAllByRole('article');
    for (const [index, card] of cards.entries()) {
      expect(card).toHaveClass(`preview-accent-${index % 3}`);
      expect(within(card).getByText('😀'.repeat(120) + '…')).toBeInTheDocument();
      expect(within(card).getByRole('img', { name: 'Writer One' })).toBeInTheDocument();
      expect(within(card).getByText('Writer One')).toBeInTheDocument();
    }
    expect(within(region).getByText('Nov 4, 2026')).toBeInTheDocument();
    expect(within(region).getByText('Date unavailable')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
    expect(listPosts().value).toHaveLength(5);
    await user.click(within(cards[0]).getByRole('link'));
    expect(window.location.pathname).toBe('/blog/p4');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('<b>Day 4</b>');
  });

  it.each([owner, admin])('offers empty Write CTA for $role and navigates by link', async (session) => {
    const user = userEvent.setup();
    renderAt('/blogs', session, []);
    expect(screen.getByRole('heading', { name: 'No posts here yet.' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Write a post' }));
    expect(window.location.pathname).toBe('/write');
    expect(screen.getByLabelText('Content')).toHaveValue('');
  });

  it.each(['/blog/missing', '/edit/missing'])('renders safe missing post and back navigation at %s', async (path) => {
    const user = userEvent.setup();
    renderAt(path);
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to blogs' }));
    expect(window.location.pathname).toBe('/blogs');
    expect(getPost('p1').value).toEqual(post);
  });

  it.each(['/blogs', '/blog/p1', '/edit/p1'])('uses malformed fallback without repair at %s', (path) => {
    localStorage.setItem(STORAGE_KEYS.posts, '{');
    renderAt(path, owner, null);
    expect(screen.getByRole('status')).toHaveTextContent('Stored data could not be read safely.');
    expect(screen.getByRole('heading', { name: path === '/blogs' ? 'No posts here yet.' : 'Post not found' })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe('{');
  });

  it.each(['/blogs', '/blog/p1', '/edit/p1'])('uses unavailable post fallback while retaining navigation at %s', (path) => {
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === STORAGE_KEYS.posts) throw new Error('blocked');
      return original.call(this, key);
    });
    renderAt(path);
    expect(screen.getByRole('status')).toHaveTextContent('Browser storage is unavailable.');
    expect(window.location.pathname).toBe(path);
  });

  it('escapes full detail text and displays invalid date fallback', () => {
    const { container } = renderAt('/blog/p1', owner, [{ ...post, createdAt: '?' }]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(post.title);
    expect(screen.getByText(post.content, { exact: true, collapseWhitespace: false })).toHaveClass('whitespace-pre-wrap');
    expect(screen.getByText('Date unavailable')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });
});

describe('explicit forms and persistence', () => {
  it.each(['/blogs', '/blog/p1', '/write', '/edit/p1'])('does not mutate posts merely by rendering %s', (path) => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(owner));
    localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post]));
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    window.history.replaceState({}, '', path);
    render(<App />);
    expect(writes).not.toHaveBeenCalled();
    expect(getPost('p1').value).toEqual(post);
  });

  it.each(['/write', '/edit/p1'])('never saves during render or typing at %s and exposes the live counter', async (path) => {
    const user = userEvent.setup();
    renderAt(path);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    await fill(user, 'Typed title', '😀abc');
    expect(screen.getByRole('status')).toHaveTextContent('4 characters');
    expect(writes).not.toHaveBeenCalled();
    expect(getPost('p1').value).toEqual(post);
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(window.location.pathname).toBe(path === '/write' ? '/blogs' : '/blog/p1');
    expect(getPost('p1').value).toEqual(post);
  });

  for (const path of ['/write', '/edit/p1']) {
    it.each([['Title', ''], ['Content', ''], ['Title', '   '], ['Content', '   ']])(
      `validates missing or whitespace %s inline at ${path}`, async (label, value) => {
        const user = userEvent.setup();
        renderAt(path);
        await fill(user);
        await user.clear(screen.getByLabelText(label));
        if (value) await user.type(screen.getByLabelText(label), value);
        await user.click(screen.getByRole('button', { name: path === '/write' ? 'Save post' : 'Save changes' }));
        expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText(label)).toHaveAccessibleDescription(expect.stringContaining(`${label} is required.`));
        expect(window.location.pathname).toBe(path);
        expect(listPosts().value).toEqual([post]);
      },
    );
  }

  it('shows both empty-field errors, then clears them after corrected explicit creation', async () => {
    const user = userEvent.setup();
    renderAt('/write', owner, []);
    await user.click(screen.getByRole('button', { name: 'Save post' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(listPosts().value).toEqual([]);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save post' }));
    expect(window.location.pathname).toBe('/blog/new-id');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getPost('new-id').value.title).toBe('New title');
  });

  it.each([owner, admin])('creates, reloads and edits for $role while preserving metadata', async (session) => {
    const user = userEvent.setup();
    const view = renderAt('/write', session, []);
    await fill(user, ' Title ', ' <b>body</b>\n ');
    await user.click(screen.getByRole('button', { name: 'Save post' }));
    expect(window.location.pathname).toBe('/blog/new-id');
    const saved = getPost('new-id').value;
    expect(saved).toMatchObject({ title: ' Title ', content: ' <b>body</b>\n ', userId: session.userId, authorName: session.displayName });
    expect(Number.isFinite(Date.parse(saved.createdAt))).toBe(true);
    view.unmount();
    renderAt('/blog/new-id', session, null);
    await user.click(screen.getByRole('link', { name: 'Edit', exact: true }));
    expect(screen.getByLabelText('Title')).toHaveValue(saved.title);
    expect(screen.getByLabelText('Content')).toHaveValue(saved.content);
    await fill(user, 'Edited title', 'Edited body');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(window.location.pathname).toBe('/blog/new-id');
    expect(getPost('new-id').value).toEqual({ ...saved, title: 'Edited title', content: 'Edited body' });
  });

  it.each(['/write', '/edit/p1'])('preserves failed-write form at %s and allows an explicit retry', async (path) => {
    const user = userEvent.setup();
    renderAt(path);
    await fill(user);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await user.click(screen.getByRole('button', { name: path === '/write' ? 'Save post' : 'Save changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The storage change could not be confirmed.');
    expect(screen.getByLabelText('Title')).toHaveValue('New title');
    expect(screen.getByLabelText('Content')).toHaveValue('New content');
    expect(window.location.pathname).toBe(path);
    expect(getPost('p1').value).toEqual(post);
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: path === '/write' ? 'Save post' : 'Save changes' }));
    expect(window.location.pathname).toBe(path === '/write' ? '/blog/new-id' : '/blog/p1');
  });

  it('keeps create form and corrupt records when submission cannot read current posts', async () => {
    const user = userEvent.setup();
    renderAt('/write');
    localStorage.setItem(STORAGE_KEYS.posts, '{');
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save post' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Stored data could not be read safely.');
    expect(screen.getByLabelText('Content')).toHaveValue('New content');
    expect(window.location.pathname).toBe('/write');
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe('{');
  });

  it.each(['/write', '/edit/p1'])('preserves form when current posts become unavailable at %s', async (path) => {
    const user = userEvent.setup();
    renderAt(path);
    await fill(user);
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    await user.click(screen.getByRole('button', { name: path === '/write' ? 'Save post' : 'Save changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Browser storage is unavailable.');
    expect(screen.getByLabelText('Content')).toHaveValue('New content');
    expect(window.location.pathname).toBe(path);
    get.mockRestore();
    expect(getPost('p1').value).toEqual(post);
  });

  it('reports unsupported UUID without navigating or discarding text', async () => {
    const user = userEvent.setup();
    renderAt('/write');
    vi.stubGlobal('crypto', {});
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save post' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This browser cannot generate post IDs.');
    expect(screen.getByLabelText('Title')).toHaveValue('New title');
    expect(window.location.pathname).toBe('/write');
    expect(listPosts().value).toEqual([post]);
  });
});

describe('owner and Admin actions', () => {
  it('hides nonowner controls and redirects a direct unauthorized edit without mutation', async () => {
    const user = userEvent.setup();
    const view = renderAt('/blog/p1', other);
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to blogs' }));
    view.unmount();
    renderAt('/edit/p1', other);
    expect(window.location.pathname).toBe('/blogs');
    expect(getPost('p1').value).toEqual(post);
  });

  it('allows Admin to edit another author while preserving original author', async () => {
    const user = userEvent.setup();
    renderAt('/edit/p1', admin);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(window.location.pathname).toBe('/blog/p1');
    expect(getPost('p1').value).toEqual({ ...post, title: 'New title', content: 'New content' });
  });

  it.each([owner, admin])('cancels then confirms native deletion for $role', async (session) => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/blog/p1', session);
    expect(confirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirm).toHaveBeenCalledWith('Delete this post? This cannot be undone.');
    expect(window.location.pathname).toBe('/blog/p1');
    expect(getPost('p1').value).toEqual(post);
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(window.location.pathname).toBe('/blogs');
    expect(getPost('p1').value).toBeNull();
    expect(screen.getByRole('heading', { name: 'No posts here yet.' })).toBeInTheDocument();
  });

  it('preserves detail after failed delete write', async () => {
    const user = userEvent.setup();
    renderAt('/blog/p1');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The storage change could not be confirmed.');
    expect(window.location.pathname).toBe('/blog/p1');
    expect(getPost('p1').value).toEqual(post);
  });

  it.each(['edit', 'delete'])('rechecks changed ownership on %s action', async (action) => {
    const user = userEvent.setup();
    renderAt(action === 'edit' ? '/edit/p1' : '/blog/p1');
    const changed = { ...post, userId: other.userId };
    localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([changed]));
    if (action === 'edit') {
      await fill(user);
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(window.location.pathname).toBe('/blogs');
    } else {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      expect(screen.getByRole('alert')).toHaveTextContent('You cannot manage this post.');
      expect(window.location.pathname).toBe('/blog/p1');
    }
    expect(getPost('p1').value).toEqual(changed);
  });

  it.each(['edit', 'delete'])('handles a disappeared target during %s without claiming success', async (action) => {
    const user = userEvent.setup();
    renderAt(action === 'edit' ? '/edit/p1' : '/blog/p1');
    localStorage.setItem(STORAGE_KEYS.posts, '[]');
    if (action === 'edit') {
      await fill(user);
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(screen.getByLabelText('Content')).toHaveValue('New content');
    } else {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await user.click(screen.getByRole('button', { name: 'Delete' }));
    }
    expect(screen.getByRole('alert')).toHaveTextContent('Post not found');
    expect(window.location.pathname).toBe(action === 'edit' ? '/edit/p1' : '/blog/p1');
    expect(listPosts().value).toEqual([]);
  });
});
