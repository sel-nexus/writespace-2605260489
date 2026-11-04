/** Verify account branches against real browser storage and exact state transitions. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listUsers, validateAdminUser, createAdminUser, deleteUser, deletionProtection } from './accounts.js';
import { getSession, login } from './auth.js';
import { STORAGE_KEYS } from './storage.js';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'Admin' };
const input = { displayName: ' Editor ', username: 'Editor', password: ' demo-only ', role: 'user' };
const account = { ...input, id: 'u1', createdAt: '2026-11-04T12:00:00.000Z' };

/** Read the persisted collection independently of account helpers. */
function stored() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.users));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([account]));
  vi.stubGlobal('crypto', { randomUUID: () => '7a587348-f914-4df9-80a6-c7e7dc813519' });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('account validation and creation', () => {
  it('lists stored accounts without inserting the seeded Admin or writing', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(listUsers(admin)).toEqual({ ok: true, value: [account] });
    expect(stored()).toEqual([account]);
    expect(write).not.toHaveBeenCalled();
    localStorage.removeItem(STORAGE_KEYS.users);
    expect(listUsers(admin)).toEqual({ ok: true, value: [] });
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBeNull();
  });

  it.each(['user', 'Admin'])('creates %s with native identity and ISO time, no email or session write', (role) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T12:00:00.000Z'));
    const result = createAdminUser({ ...input, username: 'editor', role, email: 'ignored', id: 'ignored' }, admin);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      ...input, username: 'editor', role,
      id: '7a587348-f914-4df9-80a6-c7e7dc813519', createdAt: '2026-11-05T12:00:00.000Z',
    });
    expect(stored()).toEqual([account, result.value]);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
    expect(login('editor', ' demo-only ').ok).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session))).toMatchObject({ userId: result.value.id, role });
  });

  it('creates long account text verbatim, requeries it and authenticates exact credentials', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T12:00:00.000Z'));
    const username = ` Editor-${'u'.repeat(16384)} `;
    const displayName = ` Display-${'名'.repeat(16384)} `;
    const password = ` Password-${'p'.repeat(16384)} `;
    const values = { username, displayName, password, role: 'user' };
    const created = {
      ...values, id: '7a587348-f914-4df9-80a6-c7e7dc813519', createdAt: '2026-11-05T12:00:00.000Z',
    };
    const identity = { userId: created.id, username, displayName, role: 'user' };
    const sessionRaw = JSON.stringify(admin);
    localStorage.setItem(STORAGE_KEYS.session, sessionRaw);

    expect(createAdminUser(values, admin)).toEqual({ ok: true, value: created });
    expect(listUsers(admin)).toEqual({ ok: true, value: [account, created] });
    expect(stored()).toEqual([account, created]);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(sessionRaw);
    expect(createAdminUser(values, admin).error.code).toBe('DUPLICATE_USERNAME');
    expect(listUsers(admin)).toEqual({ ok: true, value: [account, created] });
    expect(login(username.toLowerCase(), password).error.code).toBe('INVALID_CREDENTIALS');
    expect(login(username, password.trim()).error.code).toBe('INVALID_CREDENTIALS');
    expect(getSession()).toEqual({ ok: true, value: admin });
    expect(login(username, password)).toEqual({ ok: true, value: identity });
    expect(getSession()).toEqual({ ok: true, value: identity });
    expect(listUsers(admin)).toEqual({ ok: true, value: [account, created] });
  });

  it.each(['u1', 'admin'])('rejects generated identity %s without changing accounts or active session', (id) => {
    const usersRaw = localStorage.getItem(STORAGE_KEYS.users);
    const sessionRaw = JSON.stringify(admin);
    localStorage.setItem(STORAGE_KEYS.session, sessionRaw);
    vi.stubGlobal('crypto', { randomUUID: () => id });

    expect(createAdminUser({ ...input, username: 'new' }, admin)).toEqual({
      ok: false, error: { code: 'UNSUPPORTED_ID', message: 'This browser cannot generate account IDs.' },
    });
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(usersRaw);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(sessionRaw);
    expect(listUsers(admin)).toEqual({ ok: true, value: [account] });
    expect(getSession()).toEqual({ ok: true, value: admin });
  });

  it.each([null, undefined, [], 'input', 1, true])('rejects invalid input shape %j with all field errors', (value) => {
    expect(Object.keys(validateAdminUser(value))).toEqual(['displayName', 'username', 'password', 'role']);
    expect(createAdminUser(value, admin).error.code).toBe('INVALID_INPUT');
    expect(stored()).toEqual([account]);
  });

  for (const field of ['displayName', 'username', 'password', 'role']) {
    it.each([undefined, null, '', '   ', 1, {}, []])(`rejects missing or invalid ${field} individually: %j`, (value) => {
      const values = { ...input, [field]: value };
      expect(Object.keys(validateAdminUser(values))).toEqual([field]);
      expect(createAdminUser(values, admin).error.code).toBe('INVALID_INPUT');
      expect(stored()).toEqual([account]);
    });
  }

  it.each(['admin', 'USER', ' Admin ', 'owner'])('rejects invalid role %s without mutation', (role) => {
    expect(validateAdminUser({ ...input, role })).toEqual({ role: 'Choose Admin or user.' });
    expect(createAdminUser({ ...input, role }, admin).error.code).toBe('INVALID_INPUT');
    expect(stored()).toEqual([account]);
  });

  it('rejects exact reserved and duplicate names, but permits a case variant', () => {
    expect(validateAdminUser({ ...input, username: 'admin' })).toEqual({ username: 'The username admin is reserved.' });
    expect(createAdminUser({ ...input, username: 'admin' }, admin).error.code).toBe('INVALID_INPUT');
    expect(createAdminUser(input, admin).error.code).toBe('DUPLICATE_USERNAME');
    expect(stored()).toEqual([account]);
    expect(createAdminUser({ ...input, username: 'Admin' }, admin).ok).toBe(true);
    expect(stored().map((user) => user.username)).toEqual(['Editor', 'Admin']);
  });

  it.each([
    {}, { randomUUID: null }, { randomUUID: () => '' }, { randomUUID: () => 42 },
    { randomUUID: () => 'u1' }, { randomUUID: () => 'admin' },
    { randomUUID: () => { throw new Error('unsupported'); } },
  ])('fails native UUID generation safely for %j without retry or write', (crypto) => {
    vi.stubGlobal('crypto', crypto);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(createAdminUser({ ...input, username: 'new' }, admin).error.code).toBe('UNSUPPORTED_ID');
    expect(stored()).toEqual([account]);
    expect(write).not.toHaveBeenCalled();
  });
});

describe('Admin context and protected deletion', () => {
  it.each([null, undefined, {}, [], 'Admin', { ...admin, role: 'user' }, { ...admin, displayName: '' }, { ...admin, role: 'admin' }])(
    'denies every account operation for invalid context %j', (session) => {
      const writes = vi.spyOn(Storage.prototype, 'setItem');
      expect(listUsers(session).error.code).toBe('FORBIDDEN');
      expect(createAdminUser(input, session).error.code).toBe('FORBIDDEN');
      expect(deleteUser('u1', session, true).error.code).toBe('FORBIDDEN');
      expect(stored()).toEqual([account]);
      expect(writes).not.toHaveBeenCalled();
    },
  );

  it.each([null, undefined, 1, {}, [], '', '  '])('rejects invalid deletion ID %j', (id) => {
    expect(deleteUser(id, admin, true).error.code).toBe('INVALID_INPUT');
    expect(stored()).toEqual([account]);
  });

  it('protects fixed ID, fixed username and current account even with explicit confirmation', () => {
    expect(deleteUser('admin', admin, true).error.code).toBe('FORBIDDEN');
    const current = { ...admin, userId: 'u1', username: 'Editor' };
    expect(deleteUser('u1', current, true).error.code).toBe('FORBIDDEN');
    const fixed = { ...account, username: 'admin' };
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([fixed]));
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(deleteUser('u1', admin, true).error.code).toBe('FORBIDDEN');
    expect(deletionProtection(fixed, admin)).toBe('The default admin account is protected.');
    expect(deletionProtection(account, current)).toBe('You cannot delete your currently signed-in account.');
    expect(deletionProtection(account, admin)).toBe('');
    expect(stored()).toEqual([fixed]);
    expect(writes).not.toHaveBeenCalled();
  });

  it.each([false, undefined, null, 1, 'true', {}, []])('requires literal true confirmation instead of %j', (confirmed) => {
    expect(deleteUser('u1', admin, confirmed).error.code).toBe('CONFIRMATION_REQUIRED');
    expect(stored()).toEqual([account]);
  });

  it('returns not found without changing records', () => {
    expect(deleteUser('missing', admin, true).error.code).toBe('NOT_FOUND');
    expect(stored()).toEqual([account]);
  });

  it('deletes only the confirmed target and leaves unrelated accounts and session intact', () => {
    const another = { ...account, id: 'u2', username: 'Other' };
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([account, another]));
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(admin));
    expect(deleteUser('u1', admin, true)).toEqual({ ok: true, value: null });
    expect(stored()).toEqual([another]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session))).toEqual(admin);
  });
});

describe('failed storage never becomes success', () => {
  const malformed = [
    '{', '{}', 'null', '[null]', '[[]]', JSON.stringify([{ ...account, role: 'owner' }]),
    JSON.stringify([{ ...account, createdAt: '?' }]), JSON.stringify([{ ...account, email: '' }]),
    JSON.stringify([account, account]), JSON.stringify([account, { ...account, id: 'u2' }]),
  ];
  for (const field of ['id', 'displayName', 'username', 'password', 'createdAt']) {
    malformed.push(JSON.stringify([{ ...account, [field]: null }]));
  }
  it.each(malformed)('preserves malformed collection %s on list/create/delete', (raw) => {
    localStorage.setItem(STORAGE_KEYS.users, raw);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(listUsers(admin).error.code).toBe('MALFORMED');
    expect(createAdminUser({ ...input, username: 'new' }, admin).error.code).toBe('MALFORMED');
    expect(deleteUser('u1', admin, true).error.code).toBe('MALFORMED');
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(raw);
    expect(writes).not.toHaveBeenCalled();
  });

  it('does not mutate when account reads become unavailable', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(listUsers(admin).error.code).toBe('UNAVAILABLE');
    expect(createAdminUser({ ...input, username: 'new' }, admin).error.code).toBe('UNAVAILABLE');
    expect(deleteUser('u1', admin, true).error.code).toBe('UNAVAILABLE');
    read.mockRestore();
    expect(stored()).toEqual([account]);
    expect(writes).not.toHaveBeenCalled();
  });

  it.each(['create', 'delete'])('reports quota failure for %s with exactly one attempt and unchanged state', (action) => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const result = action === 'create'
      ? createAdminUser({ ...input, username: 'new' }, admin) : deleteUser('u1', admin, true);
    expect(result.error.code).toBe('WRITE_FAILED');
    expect(stored()).toEqual([account]);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
