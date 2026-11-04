/** Verify public content, local data resilience, native links and navbar interactions. */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import LandingPage from './LandingPage.jsx';
import { Navbar } from '../components/Navbar.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { BlogCard } from '../components/BlogCard.jsx';
import { STORAGE_KEYS } from '../lib/storage.js';

const session = { userId: 'u1', username: 'ada', displayName: 'Ada Writer', role: 'user' };

/** Produce a deterministic local post with the full source record shape. */
function post(id, createdAt, overrides = {}) {
  return {
    id, createdAt, title: `Post ${id}`, content: `The words of ${id}.`,
    userId: 'u1', authorName: 'Ada Writer', authorAvatar: 'Ada Writer', ...overrides,
  };
}

/** Wrap isolated components in a single in-memory router. */
function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('landing content and local previews', () => {
  it('renders the tagline, exactly three distinct features and honest empty state', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Room for your words.');
    const features = screen.getByRole('region', { name: 'Less distraction. More expression.' });
    expect(within(features).getAllByRole('article')).toHaveLength(3);
    for (const title of ['Room to write', 'A fresh perspective', 'Your own collection']) {
      expect(within(features).getByRole('heading', { name: title })).toBeInTheDocument();
    }
    const latest = screen.getByRole('region', { name: 'Recently written' });
    expect(within(latest).queryAllByRole('article')).toHaveLength(0);
    expect(within(latest).getByRole('heading', { name: 'No posts here yet.' })).toBeInTheDocument();
    expect(screen.getByText(/no cross-device sync or backup/i)).toBeInTheDocument();
    expect(screen.getByText(/never use real passwords or sensitive data/i)).toBeInTheDocument();
  });

  it('shows only the three newest posts, with source metadata and detail URLs', () => {
    const posts = [
      post('old', '2025-01-01T00:00:00Z'), post('newest', '2025-01-04T00:00:00Z'),
      post('middle', '2025-01-02T00:00:00Z'), post('recent', '2025-01-03T00:00:00Z'),
    ];
    const stored = JSON.stringify(posts);
    window.localStorage.setItem(STORAGE_KEYS.posts, stored);
    renderLanding();
    const latest = screen.getByRole('region', { name: 'Recently written' });
    const cards = within(latest).getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => within(card).getByRole('heading').textContent))
      .toEqual(['Post newest', 'Post recent', 'Post middle']);
    expect(screen.queryByRole('link', { name: 'Post old' })).not.toBeInTheDocument();
    for (const id of ['newest', 'recent', 'middle']) {
      expect(screen.getByRole('link', { name: `Post ${id}` })).toHaveAttribute('href', `/blog/${id}`);
    }
    expect(within(cards[0]).getByText('Ada Writer')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Jan 4, 2025')).toHaveAttribute('datetime', '2025-01-04T00:00:00.000Z');
    expect(window.localStorage.getItem(STORAGE_KEYS.posts)).toBe(stored);
  });

  it.each([1, 2, 3])('renders %i available posts without inventing filler cards', (count) => {
    window.localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(
      Array.from({ length: count }, (_, i) => post(String(i), '2025-01-01T00:00:00Z')),
    ));
    renderLanding();
    expect(within(screen.getByRole('region', { name: 'Recently written' })).getAllByRole('article')).toHaveLength(count);
    expect(screen.queryByText('No posts here yet.')).not.toBeInTheDocument();
  });

  it('sorts valid dates ahead of invalid ones and preserves equal-date and invalid-date order', () => {
    window.localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([
      post('invalid-first', 'bad'), post('tie-first', '2025-01-02T00:00:00Z'),
      post('invalid-second', ''), post('tie-second', '2025-01-02T00:00:00Z'),
    ]));
    renderLanding();
    const latest = screen.getByRole('region', { name: 'Recently written' });
    expect(within(latest).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent))
      .toEqual(['Post tie-first', 'Post tie-second', 'Post invalid-first']);
    expect(within(latest).getByText('Date unavailable')).toBeInTheDocument();
  });

  it.each(['{', '{}', 'null', '[null]', '[{"title": {}}]'])(
    'shows safe empty and error states for corrupt source %s without repairing it', (raw) => {
      window.localStorage.setItem(STORAGE_KEYS.posts, raw);
      renderLanding();
      expect(screen.getByText('No posts here yet.')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('The stored data has not been changed.');
      expect(window.localStorage.getItem(STORAGE_KEYS.posts)).toBe(raw);
    },
  );

  it('keeps guest navigation and empty content usable when the storage getter throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('Browser storage is unavailable');
    expect(screen.getByText('No posts here yet.')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Sign in' }))
      .toHaveAttribute('href', '/login');
  });

  it('handles getItem exceptions without an uncaught render error', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    renderLanding();
    expect(screen.getByRole('status')).toHaveTextContent('Browser storage is unavailable');
    expect(screen.getByRole('link', { name: 'Write your first post' })).toHaveAttribute('href', '/register');
  });

  it('exposes real hero and footer destinations with no fabricated footer routes', () => {
    renderLanding();
    expect(screen.getByRole('link', { name: 'Start writing' })).toHaveAttribute('href', '/register');
    const hero = screen.getByRole('region', { name: /Room for/ });
    expect(within(hero).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    const footer = screen.getByRole('navigation', { name: 'Footer' });
    expect(within(footer).getAllByRole('link').map((link) => link.getAttribute('href')))
      .toEqual(['/', '/login', '/register']);
  });

  it('does not write, remove, clear or fetch during StrictMode render, menu clicks and navigation', async () => {
    const original = JSON.stringify([post('p1', '2025-01-01T00:00:00Z')]);
    window.localStorage.setItem(STORAGE_KEYS.posts, original);
    window.localStorage.setItem('unrelated', 'keep');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const clear = vi.spyOn(Storage.prototype, 'clear');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    await user.click(screen.getByRole('link', { name: 'Post p1' }));
    expect(window.location.pathname).toBe('/blog/p1');
    expect(screen.getByRole('heading', { name: 'This page isn’t here.' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to WriteSpace' }));
    expect(screen.getByRole('link', { name: 'Post p1' })).toBeInTheDocument();
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEYS.posts)).toBe(original);
    expect(window.localStorage.getItem('unrelated')).toBe('keep');
  });
});

describe('shared preview presentation', () => {
  it.each([0, 119, 120, 121, 300])('caps a %i-character excerpt at 120 content characters', (length) => {
    const content = 'x'.repeat(length);
    render(
      <MemoryRouter>
        <BlogCard post={post('p', '2025-01-01T00:00:00Z', { content })} />
      </MemoryRouter>,
    );
    const card = screen.getByRole('article');
    const excerpt = card.querySelector('p.leading-relaxed');
    expect(excerpt.textContent).toBe('x'.repeat(Math.min(length, 120)) + (length > 120 ? '…' : ''));
  });

  it('escapes markup, safely encodes IDs and handles invalid dates', () => {
    const content = '<script>alert("unsafe")</script>';
    render(
      <MemoryRouter>
        <BlogCard post={post('a/b ?#', 'invalid', { title: '<img src=x>', content })} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '<img src=x>' })).toHaveAttribute('href', '/blog/a%2Fb%20%3F%23');
    expect(screen.getByText(content)).toBeInTheDocument();
    expect(screen.getByText('Date unavailable')).toBeInTheDocument();
    expect(screen.getByRole('article').querySelector('script, img')).toBeNull();
  });

  it('keeps Unicode excerpt characters intact and repeats the quiet accent after three cards', () => {
    render(
      <MemoryRouter>
        {[0, 1, 2, 3].map((index) => (
          <BlogCard key={index} index={index} post={post(String(index), 'bad', { content: '🌿'.repeat(121) })} />
        ))}
      </MemoryRouter>,
    );
    const cards = screen.getAllByRole('article');
    for (const [index, card] of cards.entries()) {
      expect(card).toHaveClass(`preview-accent-${index % 3}`);
      expect(card.querySelector('p.leading-relaxed').textContent).toBe('🌿'.repeat(120) + '…');
    }
  });

  it.each([['Ada Writer', 'AW'], ['Ada', 'A'], ['  Ada   Writer  ', 'AW'], ['', '?']])(
    'presents initials for %j with an accessible name', (name, initials) => {
      render(<Avatar name={name} />);
      expect(screen.getByRole('img', { name: name.trim().replace(/\s+/g, ' ') || 'Unknown author' }))
        .toHaveTextContent(initials);
    },
  );
});

describe('role-aware navigation and route shell', () => {
  it.each(['user', 'Admin'])('initializes the %s presentation from local session data', (role) => {
    window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ ...session, role }));
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const destination = role === 'Admin' ? 'Admin dashboard' : 'Your reading space';
    expect(within(nav).getByRole('link', { name: destination }))
      .toHaveAttribute('href', role === 'Admin' ? '/admin' : '/blogs');
    expect(within(nav).getByRole('img', { name: `Ada Writer, ${role}` })).toHaveTextContent('AW');
    expect(within(nav).getByText('Ada Writer')).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it.each(['{', '{}', '[]', '{"role":"Admin"}', JSON.stringify({ ...session, displayName: {} })])(
    'falls back to guest navbar for invalid session %s without clearing it', (raw) => {
      window.localStorage.setItem(STORAGE_KEYS.session, raw);
      render(<App />);
      const nav = screen.getByRole('navigation', { name: 'Primary' });
      expect(within(nav).getByRole('link', { name: 'Join WriteSpace' })).toHaveAttribute('href', '/register');
      expect(within(nav).queryByRole('link', { name: 'Admin dashboard' })).not.toBeInTheDocument();
      expect(window.localStorage.getItem(STORAGE_KEYS.session)).toBe(raw);
    },
  );

  it('uses explicit clicks to toggle, associates the menu, and closes on navigation', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Open navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'primary-navigation');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveAttribute('id', 'primary-navigation');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Sign in' }));
    expect(window.location.pathname).toBe('/login');
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('heading', { name: 'This page isn’t here.' })).toBeInTheDocument();
  });

  it('supports keyboard activation and closes on clicking the current Explore link', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );
    screen.getByRole('button', { name: 'Open navigation' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('link', { name: 'Explore' }));
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('aria-current', 'page');
  });

  it('renders unknown paths as NotFound and returns through its real home link', async () => {
    window.history.replaceState({}, '', '/unknown');
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'This page isn’t here.' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to WriteSpace' }));
    expect(window.location.pathname).toBe('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Room for your words.');
  });
});
