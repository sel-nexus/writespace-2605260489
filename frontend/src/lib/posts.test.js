/** Exercise real domain rules and requery persisted browser-local state after every mutation. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPost, deletePost, getPost, listPosts, updatePost, validatePost } from './posts.js';
import { readPosts, STORAGE_KEYS } from './storage.js';

const owner = { userId: 'u1', username: 'writer', displayName: 'Writer One', role: 'user' };
const admin = { ...owner, userId: 'admin', role: 'Admin' };
const other = { ...owner, userId: 'u2' };
const input = { title: ' Title ', content: ' <script>plain text</script>\n ' };
const post = {
  id: 'p1', ...input, createdAt: '2026-11-04T12:00:00.000Z',
  userId: owner.userId, authorName: owner.displayName, authorAvatar: owner.displayName,
};

/** Seed through storage rather than mocking any domain method. */
function seed(records = [post]) {
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(records));
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('crypto', { randomUUID: () => 'new-id' });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('guarded reads and stable ordering', () => {
  it('returns a missing-key empty array and absent detail without creating storage', () => {
    expect(listPosts()).toEqual({ ok: true, value: [] });
    expect(getPost('missing')).toEqual({ ok: true, value: null });
    expect(localStorage.length).toBe(0);
  });

  it('sorts all valid times before malformed ones with stable ties and no persisted reordering', () => {
    const records = ['bad', 'old', 'new', 'tie', 'bad2'].map((id) => ({
      ...post, id,
      createdAt: { bad: '?', old: '2025-01-01', new: '2026-01-01', tie: '2026-01-01', bad2: '' }[id],
    }));
    seed(records);
    expect(listPosts().value.map((entry) => entry.id)).toEqual(['new', 'tie', 'old', 'bad', 'bad2']);
    expect(readPosts().value).toEqual(records);
    expect(getPost('bad').value).toEqual(records[0]);
    expect(getPost('BAD').value).toBeNull();
  });

  it.each(['{', '{}', 'null', '[null]', JSON.stringify([post, post]), JSON.stringify([{ ...post, content: {} }])])(
    'denies malformed collection %s without repair for every operation', (raw) => {
      localStorage.setItem(STORAGE_KEYS.posts, raw);
      for (const result of [listPosts(), getPost('p1'), createPost(input, owner), updatePost('p1', input, owner), deletePost('p1', owner, true)]) {
        expect(result.error.code).toBe('MALFORMED');
      }
      expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(raw);
    },
  );

  it('returns unavailable for every read and mutation rather than overwriting existing data', () => {
    seed();
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    for (const result of [listPosts(), getPost('p1'), createPost(input, owner), updatePost('p1', input, owner), deletePost('p1', owner, true)]) {
      expect(result.error.code).toBe('UNAVAILABLE');
    }
    get.mockRestore();
    expect(readPosts().value).toEqual([post]);
  });
});

describe('validation and native identity', () => {
  it.each([undefined, null, 7, 'text', [], {}])('rejects nonrecord or missing input %j', (invalid) => {
    expect(validatePost(invalid)).toEqual({ title: 'Title is required.', content: 'Content is required.' });
    expect(createPost(invalid, owner).error.code).toBe('INVALID_INPUT');
    expect(updatePost('p1', invalid, owner).error.code).toBe('INVALID_INPUT');
    expect(localStorage.length).toBe(0);
  });

  for (const field of ['title', 'content']) {
    it.each([undefined, null, false, 1, {}, [], '', ' \n\t '])(`rejects invalid ${field} %j without changing stored state`, (invalid) => {
      seed();
      const values = { ...input, [field]: invalid };
      expect(Object.keys(validatePost(values))).toEqual([field]);
      expect(createPost(values, owner).error.code).toBe('INVALID_INPUT');
      expect(updatePost('p1', values, owner).error.code).toBe('INVALID_INPUT');
      expect(readPosts().value).toEqual([post]);
    });
  }

  it.each([undefined, null, 0, [], {}, { ...owner, role: 'admin' }, { ...owner, username: '' }, { ...owner, userId: ' ' }])(
    'denies invalid session %j for every mutation', (session) => {
      seed();
      expect(createPost(input, session).error.code).toBe('FORBIDDEN');
      expect(updatePost('p1', input, session).error.code).toBe('FORBIDDEN');
      expect(deletePost('p1', session, true).error.code).toBe('FORBIDDEN');
      expect(readPosts().value).toEqual([post]);
    },
  );

  it.each([undefined, null, 0, {}, [], '', ' '])('rejects invalid ID %j for lookup update and delete', (id) => {
    seed();
    expect(getPost(id).error.code).toBe('INVALID_INPUT');
    expect(updatePost(id, input, owner).error.code).toBe('INVALID_INPUT');
    expect(deletePost(id, owner, true).error.code).toBe('INVALID_INPUT');
    expect(readPosts().value).toEqual([post]);
  });

  it.each([undefined, {}, { randomUUID: null }, { randomUUID: () => '' }, { randomUUID: () => 5 },
    { randomUUID: () => { throw new Error('unsupported'); } }, { randomUUID: () => 'p1' }])(
    'fails explicitly for unavailable failing or conflicting native UUID %j', (crypto) => {
      seed();
      vi.stubGlobal('crypto', crypto);
      expect(createPost(input, owner).error.code).toBe('UNSUPPORTED_ID');
      expect(readPosts().value).toEqual([post]);
    },
  );
});

describe('confirmed lifecycle and permission boundaries', () => {
  it.each([owner, admin])('creates for $role with native identity timestamp and preserved author text', (session) => {
    seed();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-02-03T04:05:06Z'));
    const result = createPost({ ...input, userId: 'forged', id: 'forged' }, session);
    expect(result).toEqual({ ok: true, value: {
      ...input, id: 'new-id', createdAt: '2027-02-03T04:05:06.000Z',
      userId: session.userId, authorName: session.displayName, authorAvatar: session.displayName,
    } });
    expect(getPost('new-id').value).toEqual(result.value);
    expect(readPosts().value).toEqual([post, result.value]);
    expect(validatePost(input)).toEqual({});
  });

  it.each([owner, admin])('allows $role update and preserves every immutable metadata field', (session) => {
    seed([post, { ...post, id: 'p2' }]);
    const result = updatePost('p1', { title: 'Edited', content: 'New body', id: 'evil', userId: 'evil', createdAt: '?' }, session);
    expect(result).toEqual({ ok: true, value: { ...post, title: 'Edited', content: 'New body' } });
    expect(getPost('p1').value).toEqual(result.value);
    expect(getPost('p2').value).toEqual({ ...post, id: 'p2' });
  });

  it('rechecks current owner rather than accepting an earlier loaded target', () => {
    seed();
    expect(getPost('p1').value.userId).toBe(owner.userId);
    const changed = { ...post, userId: other.userId };
    seed([changed]);
    expect(updatePost('p1', input, owner).error.code).toBe('FORBIDDEN');
    expect(deletePost('p1', owner, true).error.code).toBe('FORBIDDEN');
    expect(readPosts().value).toEqual([changed]);
  });

  it('denies nonowner updates and deletes with no data changes', () => {
    seed();
    expect(updatePost('p1', input, other).error.code).toBe('FORBIDDEN');
    expect(deletePost('p1', other, true).error.code).toBe('FORBIDDEN');
    expect(readPosts().value).toEqual([post]);
  });

  it.each([false, undefined, null, 1, 'true', {}, []])('requires literal true confirmation, not %j', (confirmed) => {
    seed();
    expect(deletePost('p1', owner, confirmed).error.code).toBe('CONFIRMATION_REQUIRED');
    expect(readPosts().value).toEqual([post]);
  });

  it.each([owner, admin])('allows confirmed $role deletion and preserves other records', (session) => {
    seed([post, { ...post, id: 'p2' }]);
    expect(deletePost('p1', session, true)).toEqual({ ok: true, value: null });
    expect(getPost('p1').value).toBeNull();
    expect(readPosts().value).toEqual([{ ...post, id: 'p2' }]);
  });

  it('preserves large plain-text payloads without inventing a length limit', () => {
    const large = { title: 'Long note', content: 'word\n'.repeat(20000) };
    const created = createPost(large, owner);
    expect(created.ok).toBe(true);
    expect(getPost('new-id').value.content).toBe(large.content);
    const updated = updatePost('new-id', { ...large, content: large.content + 'end' }, owner);
    expect(updated.ok).toBe(true);
    expect(getPost('new-id').value.content).toBe(large.content + 'end');
  });

  it('returns safe not-found for missing mutation targets', () => {
    seed();
    expect(updatePost('missing', input, admin).error.code).toBe('NOT_FOUND');
    expect(deletePost('missing', admin, true).error.code).toBe('NOT_FOUND');
    expect(readPosts().value).toEqual([post]);
  });

  it.each(['create', 'update', 'delete'])('does not report %s success after a failed write', (operation) => {
    seed();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const result = operation === 'create' ? createPost(input, owner)
      : operation === 'update' ? updatePost('p1', input, owner) : deletePost('p1', owner, true);
    expect(result.error.code).toBe('WRITE_FAILED');
    expect(readPosts().value).toEqual([post]);
  });
});
