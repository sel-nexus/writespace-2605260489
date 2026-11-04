/** Exercise guarded storage contracts and record-shape trust boundaries. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEYS, isSession, readJson, readPosts, readSession, removeKey, writeJson,
} from './storage.js';

const post = {
  id: 'p1', title: 'A thought', content: 'Plain text', createdAt: '2025-01-02T12:00:00Z',
  userId: 'u1', authorName: 'Ada Writer', authorAvatar: 'Ada Writer',
};
const session = { userId: 'u1', username: 'ada', displayName: 'Ada Writer', role: 'user' };

beforeEach(() => {
  window.localStorage.clear();
});

describe('readJson', () => {
  it('returns the missing-key fallback without persisting it', () => {
    const fallback = [];
    expect(readJson('missing', fallback)).toEqual({ ok: true, value: [] });
    expect(window.localStorage.getItem('missing')).toBeNull();
  });

  it.each([[], [1, 2], { title: 'note' }, 'text', 0, false, null].map((value) => [value]))(
    'reads valid JSON value %j unchanged', (value) => {
      window.localStorage.setItem('data', JSON.stringify(value));
      expect(readJson('data', null)).toEqual({ ok: true, value });
      expect(window.localStorage.getItem('data')).toBe(JSON.stringify(value));
    },
  );

  it.each(['{', 'undefined', '', 'null trailing'])('reports malformed JSON %j without deleting it', (raw) => {
    window.localStorage.setItem('data', raw);
    expect(readJson('data', [])).toEqual({
      ok: false, error: { code: 'MALFORMED', message: 'Stored data could not be read safely.' },
    });
    expect(window.localStorage.getItem('data')).toBe(raw);
  });

  it.each([{}, null, 'text', 42, true])('rejects non-array collection %j', (value) => {
    window.localStorage.setItem('data', JSON.stringify(value));
    expect(readJson('data', [])).toMatchObject({ ok: false, error: { code: 'MALFORMED' } });
    expect(window.localStorage.getItem('data')).toBe(JSON.stringify(value));
  });

  it('reports unavailable storage when the browser getter throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    expect(readJson('data', [])).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
  });

  it('reports unavailable storage when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readJson('data', [])).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
  });

  it('reports unavailable storage when storage is absent', () => {
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(undefined);
    expect(readJson('data', [])).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
  });

  it('rejects data when an explicit validator rejects or throws', () => {
    window.localStorage.setItem('data', '{}');
    expect(readJson('data', null, () => false)).toMatchObject({ ok: false, error: { code: 'MALFORMED' } });
    expect(readJson('data', null, () => { throw new Error('shape'); }))
      .toMatchObject({ ok: false, error: { code: 'MALFORMED' } });
    expect(window.localStorage.getItem('data')).toBe('{}');
  });
});

describe('writeJson', () => {
  it('persists one key and returns the value only after success', () => {
    window.localStorage.setItem('other', 'keep');
    expect(writeJson('data', [post])).toEqual({ ok: true, value: [post] });
    expect(readJson('data', [])).toEqual({ ok: true, value: [post] });
    expect(window.localStorage.getItem('other')).toBe('keep');
  });

  it('replaces the requested record and can persist null', () => {
    writeJson('data', { old: true });
    expect(writeJson('data', null)).toEqual({ ok: true, value: null });
    expect(window.localStorage.getItem('data')).toBe('null');
  });

  it('does not claim success or change the previous value on a setItem exception', () => {
    window.localStorage.setItem('data', 'previous');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(writeJson('data', [post])).toEqual({
      ok: false, error: { code: 'WRITE_FAILED', message: 'The storage change could not be confirmed.' },
    });
    expect(window.localStorage.getItem('data')).toBe('previous');
  });

  it.each([undefined, () => null, Symbol('unserializable'), 1n])(
    'rejects unserializable value %s without replacing a key', (value) => {
      window.localStorage.setItem('data', 'previous');
      expect(writeJson('data', value)).toMatchObject({ ok: false, error: { code: 'WRITE_FAILED' } });
      expect(window.localStorage.getItem('data')).toBe('previous');
    },
  );

  it('rejects circular data and serialization exceptions without leaking their contents', () => {
    const circular = {};
    circular.self = circular;
    expect(writeJson('data', circular)).toMatchObject({ ok: false, error: { code: 'WRITE_FAILED' } });
    const result = writeJson('data', { toJSON() { throw new Error('secret content'); } });
    expect(result.error.message).not.toContain('secret');
    expect(window.localStorage.getItem('data')).toBeNull();
  });

  it('reports unavailable access rather than a confirmed write', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(writeJson('data', [])).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
  });

  it('reports missing storage rather than a confirmed write', () => {
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(null);
    expect(writeJson('data', [])).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
  });
});

describe('removeKey', () => {
  it('removes only its key and succeeds idempotently for a missing key', () => {
    writeJson(STORAGE_KEYS.session, session);
    writeJson(STORAGE_KEYS.posts, [post]);
    expect(removeKey(STORAGE_KEYS.session)).toEqual({ ok: true, value: null });
    expect(window.localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
    expect(readPosts()).toEqual({ ok: true, value: [post] });
    expect(removeKey(STORAGE_KEYS.session)).toEqual({ ok: true, value: null });
  });

  it('returns failure and retains data if removal throws', () => {
    writeJson(STORAGE_KEYS.session, session);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(removeKey(STORAGE_KEYS.session)).toMatchObject({ ok: false, error: { code: 'WRITE_FAILED' } });
    expect(readSession()).toEqual({ ok: true, value: session });
  });

  it('reports unavailable access when the getter throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(removeKey('data')).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
  });

  it('reports unavailable access when storage is missing', () => {
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(undefined);
    expect(removeKey('data')).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
  });
});

describe('validated source records', () => {
  it.each(['Admin', 'user'])('reads the exact %s session role without normalization', (role) => {
    writeJson(STORAGE_KEYS.session, { ...session, role });
    expect(readSession()).toEqual({ ok: true, value: { ...session, role } });
  });

  it('allows a missing or explicitly null session', () => {
    expect(readSession()).toEqual({ ok: true, value: null });
    writeJson(STORAGE_KEYS.session, null);
    expect(readSession()).toEqual({ ok: true, value: null });
    expect(isSession(null)).toBe(true);
  });

  it.each([
    [], {}, 'admin', false, 1,
    { ...session, role: 'admin' }, { ...session, role: 'owner' },
    { ...session, userId: '' }, { ...session, userId: {} },
    { ...session, displayName: ' ' }, { ...session, displayName: null },
    { ...session, username: 1 }, { ...session, username: '' },
    { username: 'ada', displayName: 'Ada', role: 'Admin' },
    { userId: 'u1', displayName: 'Ada', role: 'user' },
    { userId: 'u1', username: 'ada', role: 'user' },
    { userId: 'u1', username: 'ada', displayName: 'Ada' },
  ].map((value) => [value]))('fails closed for malformed session %j without deleting it', (value) => {
    writeJson(STORAGE_KEYS.session, value);
    expect(isSession(value)).toBe(false);
    expect(readSession()).toMatchObject({ ok: false, error: { code: 'MALFORMED' } });
    expect(window.localStorage.getItem(STORAGE_KEYS.session)).toBe(JSON.stringify(value));
  });

  it('reads empty and valid posts while retaining malformed timestamp strings', () => {
    expect(readPosts()).toEqual({ ok: true, value: [] });
    const records = [post, { ...post, id: 'p2', createdAt: 'invalid-date' }];
    writeJson(STORAGE_KEYS.posts, records);
    expect(readPosts()).toEqual({ ok: true, value: records });
  });

  it.each([
    {}, null, [null], [[]], [{ ...post, title: {} }], [{ ...post, content: null }],
    [{ ...post, authorName: '' }], [{ ...post, authorAvatar: false }],
    [{ ...post, id: ' ' }], [{ ...post, userId: '' }], [{ ...post, createdAt: 123 }],
    [post, post], [{ id: 'only-an-id' }],
  ].map((value) => [value]))('rejects unusable preview collection %j without repairing it', (value) => {
    writeJson(STORAGE_KEYS.posts, value);
    expect(readPosts()).toMatchObject({ ok: false, error: { code: 'MALFORMED' } });
    expect(window.localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify(value));
  });

  it('preserves a first successful key when a later key fails without claiming transaction success', () => {
    expect(writeJson(STORAGE_KEYS.users, [{ id: 'u1' }]).ok).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(writeJson(STORAGE_KEYS.session, session).ok).toBe(false);
    expect(readJson(STORAGE_KEYS.users, []).value).toEqual([{ id: 'u1' }]);
    expect(readSession()).toEqual({ ok: true, value: null });
  });
});
