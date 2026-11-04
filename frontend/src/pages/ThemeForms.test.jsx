/** Exercise themed controls through real browser-local authentication and post state. */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { Avatar } from '../components/Avatar.jsx';

const writer = { userId: 'u1', username: 'writer', displayName: 'Writer One', role: 'user' };
const account = {
  id: 'u1', username: 'writer', displayName: 'Writer One', role: 'user',
  password: 'demo-only', createdAt: '2026-11-04T12:00:00Z',
};
const post = {
  id: 'p1', userId: 'u1', title: 'Local words', content: 'Original words',
  authorName: 'Writer One', authorAvatar: 'Writer One', createdAt: '2026-11-04T12:00:00Z',
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('writespace_theme', 'dark');
  window.history.replaceState({}, '', '/');
});
afterEach(() => document.documentElement.classList.remove('dark'));

/** Render the real routed application with an initial location and optional identity. */
function renderAt(path, session = null) {
  if (session) localStorage.setItem('writespace_session', JSON.stringify(session));
  window.history.replaceState({}, '', path);
  return render(<App />);
}

/** Read actual saved records rather than mocking the domain layer. */
function stored(key) {
  return JSON.parse(localStorage.getItem(`writespace_${key}`));
}

/** Check the paired native field palette and visible focus offset. */
function expectDarkField(field) {
  expect(field).toHaveClass('bg-surface', 'border-border', 'dark:bg-slate-900', 'dark:text-slate-100');
  expect(field).toHaveClass('dark:border-slate-600', 'focus:ring-offset-2', 'dark:focus:ring-offset-slate-900');
  expect(field).not.toHaveAttribute('maxlength');
}

describe('dark auth forms', () => {
  it('keeps login fields, associated errors and exact credentials through failure and successful login', async () => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    const user = userEvent.setup();
    renderAt('/login');
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('main')).toHaveClass('dark:text-slate-100');
    expectDarkField(screen.getByLabelText('Username'));
    expectDarkField(screen.getByLabelText('Password'));
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('Username is required.');
    for (const error of screen.getAllByRole('alert')) expect(error).toHaveClass('dark:text-red-300');
    expect(stored('session')).toBeNull();
    await user.type(screen.getByLabelText('Username'), 'writer');
    await user.type(screen.getByLabelText('Password'), 'incorrect');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    expect(screen.getByRole('alert')).toHaveClass('dark:text-red-300');
    expect(screen.getByLabelText('Password')).toHaveValue('incorrect');
    expect(stored('session')).toBeNull();
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'demo-only');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    expect(stored('session')).toEqual(writer);
    expect(stored('users')).toEqual([account]);
    expect(localStorage.getItem('writespace_theme')).toBe('dark');
  });

  it('preserves all four registration fields including email and mismatch validation before saving', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    for (const label of ['Username', 'Email', 'Password', 'Confirm password']) {
      expectDarkField(screen.getByLabelText(label, { exact: true }));
    }
    const submit = screen.getByRole('button', { name: 'Create account' });
    expect(submit).toHaveClass('action-primary', 'dark:text-primary-950', 'dark:bg-primary-300');
    await user.type(screen.getByLabelText('Username'), 'new-writer');
    await user.type(screen.getByLabelText('Email'), 'writer@example.test');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'demo-only');
    await user.type(screen.getByLabelText('Confirm password'), 'different');
    await user.click(submit);
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveClass('dark:text-red-300');
    expect(stored('users')).toBeNull();
    expect(screen.getByLabelText('Email')).toHaveValue('writer@example.test');
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'demo-only');
    await user.click(submit);
    expect(window.location.pathname).toBe('/blogs');
    expect(stored('users')).toHaveLength(1);
    expect(stored('users')[0]).toMatchObject({ username: 'new-writer', role: 'user', password: 'demo-only' });
    expect(stored('session').userId).toBe(stored('users')[0].id);
  });
});

describe('dark post forms and previews', () => {
  it('validates without writes, counts Unicode informationally with no maximum and saves long content', async () => {
    const user = userEvent.setup();
    renderAt('/write', writer);
    expectDarkField(screen.getByLabelText('Title'));
    const content = screen.getByLabelText('Content');
    expectDarkField(content);
    expect(screen.getByRole('status')).toHaveClass('dark:text-slate-300');
    await user.click(screen.getByRole('button', { name: 'Save post' }));
    expect(content).toHaveAccessibleDescription('Content is required. 0 characters');
    for (const error of screen.getAllByRole('alert')) expect(error).toHaveClass('dark:text-red-300');
    expect(stored('posts')).toBeNull();
    await user.type(screen.getByLabelText('Title'), 'Long local post');
    await user.click(content);
    const text = '😀' + 'x'.repeat(10001);
    await user.paste(text);
    expect(screen.getByRole('status')).toHaveTextContent('10002 characters');
    expect(stored('posts')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save post' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveClass('dark:text-slate-100', 'dark:hover:bg-slate-800');
    await user.click(screen.getByRole('button', { name: 'Save post' }));
    expect(stored('posts')[0]).toMatchObject({ title: 'Long local post', content: text, userId: writer.userId });
    expect(window.location.pathname).toMatch(/^\/blog\//);
  });

  it('retains a real save error and typed values when stored records are malformed', async () => {
    localStorage.setItem('writespace_posts', '{');
    const user = userEvent.setup();
    renderAt('/write', writer);
    await user.type(screen.getByLabelText('Title'), 'Unsaved');
    await user.type(screen.getByLabelText('Content'), 'Retained words');
    await user.click(screen.getByRole('button', { name: 'Save post' }));
    expect(screen.getByRole('alert')).toHaveClass('dark:text-red-300');
    expect(screen.getByLabelText('Content')).toHaveValue('Retained words');
    expect(localStorage.getItem('writespace_posts')).toBe('{');
    expect(window.location.pathname).toBe('/write');
  });

  it('keeps edit and cancel behavior and saved record identity unchanged in dark mode', async () => {
    localStorage.setItem('writespace_posts', JSON.stringify([post]));
    const user = userEvent.setup();
    renderAt('/edit/p1', writer);
    expect(screen.getByLabelText('Content')).toHaveValue(post.content);
    await user.clear(screen.getByLabelText('Content'));
    await user.type(screen.getByLabelText('Content'), 'Revised 😀');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(stored('posts')).toEqual([{ ...post, content: 'Revised 😀' }]);
    await user.click(screen.getByRole('link', { name: 'Edit', exact: true }));
    await user.type(screen.getByLabelText('Title'), ' not saved');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(stored('posts')).toEqual([{ ...post, content: 'Revised 😀' }]);
  });

  it.each([writer, { ...writer, userId: 'other' }, { ...writer, userId: 'admin', role: 'Admin' }])(
    'keeps preview navigation and ownership controls for $role/$userId', async (session) => {
      localStorage.setItem('writespace_posts', JSON.stringify([post]));
      const user = userEvent.setup();
      renderAt('/blogs', session);
      const card = screen.getByRole('article');
      expect(card).toHaveClass('bg-surface', 'dark:bg-slate-900', 'dark:text-slate-100');
      expect(within(card).getByText('Nov 4, 2026')).toHaveClass('dark:text-slate-300');
      const link = within(card).getByRole('link', { name: post.title });
      expect(link).toHaveClass('dark:hover:text-primary-300', 'dark:focus-visible:ring-offset-slate-900');
      expect(within(card).queryByRole('button')).not.toBeInTheDocument();
      await user.click(link);
      const canManage = session.userId === post.userId || session.role === 'Admin';
      expect(Boolean(screen.queryByRole('link', { name: 'Edit', exact: true }))).toBe(canManage);
      expect(Boolean(screen.queryByRole('button', { name: 'Delete' }))).toBe(canManage);
      expect(stored('posts')).toEqual([post]);
    },
  );

  it('keeps invalid-date metadata readable without repairing stored records', () => {
    localStorage.setItem('writespace_posts', JSON.stringify([{ ...post, createdAt: '?' }]));
    renderAt('/blogs', writer);
    expect(screen.getByText('Date unavailable')).toHaveClass('dark:text-slate-300');
    expect(stored('posts')[0].createdAt).toBe('?');
  });
});

it('distinguishes Admin from user avatars without hiding names and retains unknown-author fallback', () => {
  render(
    <MemoryRouter>
      <Avatar name="Admin Writer" role="Admin" />
      <Avatar name="Regular Writer" role="user" />
      <Avatar name="" />
    </MemoryRouter>,
  );
  expect(screen.getByRole('img', { name: 'Admin Writer, Admin' })).toHaveClass('dark:ring-2', 'dark:ring-primary-300');
  expect(screen.getByRole('img', { name: 'Regular Writer, user' })).toHaveClass('dark:bg-slate-800');
  expect(screen.getByRole('img', { name: 'Regular Writer, user' })).not.toHaveClass('dark:ring-2');
  expect(screen.getByRole('img', { name: 'Unknown author' })).toHaveTextContent('?');
});
