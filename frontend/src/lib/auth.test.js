/** Exercise demo-local authentication against the real guarded storage adapter. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession, login, logout, register, validateRegistration } from './auth.js';
import { readJson, STORAGE_KEYS } from './storage.js';

const input = { username: 'writer', email: 'writer@example.test', password: ' demo-only ', confirmPassword: ' demo-only ' };
const account = {
  id: 'user-1', username: 'writer', displayName: 'Writer One', password: ' demo-only ',
  role: 'user', createdAt: '2026-11-04T12:00:00.000Z',
};
const session = { userId: 'user-1', username: 'writer', displayName: 'Writer One', role: 'user' };

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'user-uuid') });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-04T12:00:00.000Z'));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('login', () => {
  it('checks exact admin/admin before any local account read and never seeds users', () => {
    localStorage.setItem(STORAGE_KEYS.users, 'broken');
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(login('admin', 'admin')).toEqual({
      ok: true, value: { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'Admin' },
    });
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe('broken');
    expect(getSession().value.role).toBe('Admin');
  });

  it.each(['user', 'Admin'])('establishes a complete %s session for exact stored credentials', (role) => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([{ ...account, role }]));
    expect(login('writer', ' demo-only ')).toEqual({ ok: true, value: { ...session, role } });
    expect(getSession()).toEqual({ ok: true, value: { ...session, role } });
    expect(getSession().value).not.toHaveProperty('password');
  });

  it.each([
    [undefined, 'admin'], [null, 'admin'], [23, 'admin'], [{}, 'admin'], [[], 'admin'],
    ['', 'admin'], ['   ', 'admin'], ['admin', undefined], ['admin', null], ['admin', 23],
    ['admin', {}], ['admin', []], ['admin', ''], ['admin', '   '],
    ['Admin', 'admin'], ['admin', 'Admin'], ['admin ', 'admin'], ['admin', 'admin '],
    ['missing', 'demo'],
  ])('rejects invalid or inexact credentials %j / %j without session mutation', (username, password) => {
    expect(login(username, password)).toEqual({
      ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' },
    });
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });

  it('does not normalize stored usernames or passwords and preserves an existing session on denial', () => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([account]));
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    for (const [name, password] of [['Writer', ' demo-only '], ['writer ', ' demo-only '], ['writer', 'demo-only']]) {
      expect(login(name, password).error.code).toBe('INVALID_CREDENTIALS');
      expect(getSession().value).toEqual(session);
    }
  });

  it('logs in with long exact credentials and roundtrips the complete display name', () => {
    const username = ` Writer-${'u'.repeat(16384)} `;
    const password = ` Password-${'p'.repeat(16384)} `;
    const displayName = ` Display-${'名'.repeat(16384)} `;
    const user = { ...account, username, password, displayName };
    const identity = { ...session, username, displayName };
    const raw = JSON.stringify([user]);
    localStorage.setItem(STORAGE_KEYS.users, raw);
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));

    expect(login(username.toLowerCase(), password).error.code).toBe('INVALID_CREDENTIALS');
    expect(login(username, password.trim()).error.code).toBe('INVALID_CREDENTIALS');
    expect(getSession()).toEqual({ ok: true, value: session });
    expect(login(username, password)).toEqual({ ok: true, value: identity });
    expect(getSession()).toEqual({ ok: true, value: identity });
    expect(readJson(STORAGE_KEYS.users, [])).toEqual({ ok: true, value: [user] });
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(raw);
  });

  it.each(['{', '{}', 'null', '[null]', '[[]]', '[23]'])('fails closed on malformed account storage %s', (raw) => {
    localStorage.setItem(STORAGE_KEYS.users, raw);
    expect(login('writer', ' demo-only ').error.code).toBe('MALFORMED');
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(raw);
  });

  it.each(['id', 'username', 'displayName', 'password', 'createdAt', 'role'])('rejects accounts missing %s', (field) => {
    const malformed = { ...account };
    delete malformed[field];
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([malformed]));
    expect(login('writer', ' demo-only ').error.code).toBe('MALFORMED');
    expect(getSession().value).toBeNull();
  });

  it.each([
    { ...account, role: 'admin' }, { ...account, role: 'editor' },
    { ...account, createdAt: 'invalid' }, { ...account, email: '' }, { ...account, email: 1 },
    { ...account, id: 1 }, { ...account, displayName: ' ' },
  ])('rejects invalid account fields %j', (malformed) => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([malformed]));
    expect(login('writer', ' demo-only ').error.code).toBe('MALFORMED');
    expect(getSession().value).toBeNull();
  });

  it.each([
    [[account, { ...account, username: 'other' }]],
    [[account, { ...account, id: 'other' }]],
  ])('rejects duplicate account identities %j', (users) => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
    expect(login('writer', ' demo-only ').error.code).toBe('MALFORMED');
    expect(getSession().value).toBeNull();
  });

  it('reports unavailable account reads and leaves the session untouched', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(login('writer', 'demo').error.code).toBe('UNAVAILABLE');
  });

  it.each([['admin', 'admin'], ['writer', ' demo-only ']])('never reports success after session write failure for %s', (username, password) => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([account]));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(login(username, password).error.code).toBe('WRITE_FAILED');
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });

  it('reports unavailable storage for fixed Admin session writes', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(login('admin', 'admin').error.code).toBe('UNAVAILABLE');
  });
});

describe('registration validation and persistence', () => {
  it('validates all required values without altering input', () => {
    const original = { ...input };
    expect(validateRegistration(input)).toEqual({});
    expect(input).toEqual(original);
  });

  it.each([null, undefined, [], 2, 'text', true].map((value) => [value]))('rejects invalid input containers %j', (value) => {
    expect(Object.keys(validateRegistration(value))).toEqual(['username', 'email', 'password', 'confirmPassword']);
    expect(register(value).error.code).toBe('INVALID_INPUT');
    expect(localStorage.length).toBe(0);
  });

  for (const field of ['username', 'email', 'password', 'confirmPassword']) {
    it.each([undefined, null, '', '  ', 4, {}, [], false].map((value) => [value]))(`rejects invalid required ${field}: %j before writing`, (value) => {
      expect(validateRegistration({ ...input, [field]: value })).toHaveProperty(field);
      expect(register({ ...input, [field]: value }).error.code).toBe('INVALID_INPUT');
      expect(localStorage.length).toBe(0);
    });
  }

  it('rejects mismatched passwords without trimming them', () => {
    expect(validateRegistration({ ...input, confirmPassword: 'demo-only' })).toEqual({ confirmPassword: 'Passwords must match.' });
    expect(register({ ...input, confirmPassword: 'demo-only' }).error.code).toBe('INVALID_INPUT');
    expect(localStorage.length).toBe(0);
  });

  it('rejects reserved lowercase admin before generating an account', () => {
    expect(register({ ...input, username: 'admin' }).error.code).toBe('INVALID_INPUT');
    expect(validateRegistration({ ...input, username: 'admin' }).username).toBe('The username admin is reserved.');
    expect(localStorage.length).toBe(0);
  });

  it('saves exact fields, native UUID/time and session without password confirmation or seeded Admin', () => {
    const result = register(input);
    const user = {
      id: 'user-uuid', displayName: 'writer', username: 'writer', email: 'writer@example.test',
      password: ' demo-only ', role: 'user', createdAt: '2026-11-04T12:00:00.000Z',
    };
    const identity = { userId: 'user-uuid', username: 'writer', displayName: 'writer', role: 'user' };
    expect(result).toEqual({ ok: true, value: { user, session: identity } });
    expect(readJson(STORAGE_KEYS.users, []).value).toEqual([user]);
    expect(getSession()).toEqual({ ok: true, value: identity });
  });

  it('registers long username, email and matching password verbatim and supports later login', () => {
    const username = ` Writer-${'u'.repeat(16384)} `;
    const email = `${'e'.repeat(16384)}@example.test`;
    const password = ` Password-${'p'.repeat(16384)} `;
    const values = { username, email, password, confirmPassword: password };
    const user = {
      id: 'user-uuid', displayName: username, username, email, password,
      role: 'user', createdAt: '2026-11-04T12:00:00.000Z',
    };
    const identity = { userId: user.id, username, displayName: username, role: 'user' };

    expect(register(values)).toEqual({ ok: true, value: { user, session: identity } });
    expect(readJson(STORAGE_KEYS.users, [])).toEqual({ ok: true, value: [user] });
    expect(getSession()).toEqual({ ok: true, value: identity });
    expect(register(values).error.code).toBe('DUPLICATE_USERNAME');
    expect(readJson(STORAGE_KEYS.users, [])).toEqual({ ok: true, value: [user] });
    expect(logout()).toEqual({ ok: true, value: null });
    expect(login(username, password.trim()).error.code).toBe('INVALID_CREDENTIALS');
    expect(getSession()).toEqual({ ok: true, value: null });
    expect(login(username, password)).toEqual({ ok: true, value: identity });
    expect(getSession()).toEqual({ ok: true, value: identity });
  });

  it('rejects exact duplicates while allowing case-sensitive Admin and Writer names', () => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([account]));
    expect(register(input).error.code).toBe('DUPLICATE_USERNAME');
    expect(getSession().value).toBeNull();
    expect(readJson(STORAGE_KEYS.users, []).value).toEqual([account]);
    expect(register({ ...input, username: 'Admin' }).ok).toBe(true);
    vi.stubGlobal('crypto', { randomUUID: () => 'second-id' });
    expect(register({ ...input, username: 'Writer' }).ok).toBe(true);
    expect(readJson(STORAGE_KEYS.users, []).value.map((user) => user.username)).toEqual(['writer', 'Admin', 'Writer']);
  });

  it('preserves whitespace in account names consistently with login', () => {
    expect(register({ ...input, username: ' writer ' }).ok).toBe(true);
    expect(logout().ok).toBe(true);
    expect(login('writer', input.password).ok).toBe(false);
    expect(login(' writer ', input.password).ok).toBe(true);
  });

  it.each(['{', '{}', '[null]', JSON.stringify([{ ...account, role: 'editor' }])])('does not overwrite malformed accounts %s', (raw) => {
    localStorage.setItem(STORAGE_KEYS.users, raw);
    expect(register(input).error.code).toBe('MALFORMED');
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(raw);
    expect(getSession().value).toBeNull();
  });

  it('reports unavailable account reads without writing', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(register(input).error.code).toBe('UNAVAILABLE');
    expect(write).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { randomUUID: 'not a function' }, { randomUUID: () => '' }, { randomUUID: () => null },
    { randomUUID: () => { throw new Error('unsupported'); } }])('fails explicitly when native UUID generation is unsupported %j', (crypto) => {
    vi.stubGlobal('crypto', crypto);
    expect(register(input).error.code).toBe('UNSUPPORTED_ID');
    expect(localStorage.length).toBe(0);
  });

  it.each(['user-1', 'admin'])('rejects generated identity %s and preserves accounts and session', (id) => {
    const usersRaw = JSON.stringify([account]);
    const sessionRaw = JSON.stringify(session);
    localStorage.setItem(STORAGE_KEYS.users, usersRaw);
    localStorage.setItem(STORAGE_KEYS.session, sessionRaw);
    vi.stubGlobal('crypto', { randomUUID: () => id });

    expect(register({ ...input, username: 'new-writer' })).toEqual({
      ok: false, error: { code: 'UNSUPPORTED_ID', message: 'This browser cannot generate account IDs.' },
    });
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(usersRaw);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(sessionRaw);
    expect(readJson(STORAGE_KEYS.users, [])).toEqual({ ok: true, value: [account] });
    expect(getSession()).toEqual({ ok: true, value: session });
    expect(login(account.username, account.password)).toEqual({ ok: true, value: session });
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(usersRaw);
  });

  it('reports first-key failure and creates neither account nor session', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(register(input).error.code).toBe('WRITE_FAILED');
    expect(localStorage.length).toBe(0);
  });

  it('reports second-key partial failure, preserves saved account and never returns success', () => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === STORAGE_KEYS.session) throw new Error('quota');
      setItem.call(this, key, value);
    });
    const result = register(input);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('WRITE_FAILED');
    expect(result.error.message).toMatch(/Registration is incomplete/);
    expect(readJson(STORAGE_KEYS.users, []).value).toHaveLength(1);
    expect(getSession().value).toBeNull();
    expect(register(input).error.code).toBe('DUPLICATE_USERNAME');
  });
});

describe('session lifecycle', () => {
  it('returns absent and explicit null sessions without mutation', () => {
    expect(getSession()).toEqual({ ok: true, value: null });
    localStorage.setItem(STORAGE_KEYS.session, 'null');
    expect(getSession()).toEqual({ ok: true, value: null });
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('null');
  });

  it('reads a persisted session repeatedly and removes only that key idempotently', () => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([account]));
    expect(getSession()).toEqual({ ok: true, value: session });
    expect(getSession()).toEqual({ ok: true, value: session });
    expect(logout()).toEqual({ ok: true, value: null });
    expect(getSession().value).toBeNull();
    expect(logout()).toEqual({ ok: true, value: null });
    expect(readJson(STORAGE_KEYS.users, []).value).toEqual([account]);
  });

  it.each(['{', '{}', '[]', '42', 'true', '"text"', JSON.stringify({ ...session, role: 'admin' })])('fails closed without repairing malformed session %s', (raw) => {
    localStorage.setItem(STORAGE_KEYS.session, raw);
    expect(getSession().error.code).toBe('MALFORMED');
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(raw);
  });

  it('reports unavailable session reads', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getSession().error.code).toBe('UNAVAILABLE');
  });

  it.each(['userId', 'username', 'displayName', 'role'])('rejects a stored session missing %s without repair', (field) => {
    const malformed = { ...session };
    delete malformed[field];
    const raw = JSON.stringify(malformed);
    localStorage.setItem(STORAGE_KEYS.session, raw);
    expect(getSession().error.code).toBe('MALFORMED');
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(raw);
  });

  it('preserves the session on failed logout', () => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(logout().error.code).toBe('WRITE_FAILED');
    expect(getSession().value).toEqual(session);
  });

  it('reports unavailable logout storage', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(logout().error.code).toBe('UNAVAILABLE');
  });
});
