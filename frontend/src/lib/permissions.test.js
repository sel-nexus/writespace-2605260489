/** Prove role and ownership predicates reject every malformed identity. */
import { describe, expect, it } from 'vitest';
import { canManagePost, canManageUsers, isAuthenticated, roleHome } from './permissions.js';

const user = { userId: 'user-1', username: 'writer', displayName: 'Writer', role: 'user' };
const admin = { ...user, userId: 'admin', role: 'Admin' };
const post = { userId: 'user-1' };

describe('validated identity and role policies', () => {
  it.each([user, admin])('admits complete identities %j', (session) => {
    expect(isAuthenticated(session)).toBe(true);
    expect(canManageUsers(session)).toBe(session.role === 'Admin');
    expect(roleHome(session)).toBe(session.role === 'Admin' ? '/admin' : '/blogs');
  });

  const invalid = [null, undefined, false, true, 1, 'Admin', [], {}, { role: 'Admin' },
    ...['userId', 'username', 'displayName'].flatMap((field) => [undefined, null, '', ' ', 3, {}, []].map((value) => ({ ...admin, [field]: value }))),
    ...['admin', 'User', '', null, undefined, {}, 1].map((role) => ({ ...admin, role })),
  ];
  it.each(invalid.map((value) => [value]))('fails closed for malformed or guest identity %j', (session) => {
    expect(isAuthenticated(session)).toBe(false);
    expect(canManageUsers(session)).toBe(false);
    expect(canManagePost(session, post)).toBe(false);
    expect(roleHome(session)).toBe('/login');
  });
});

describe('post management policy', () => {
  it('allows exact owner and complete Admin while denying another writer', () => {
    expect(canManagePost(user, post)).toBe(true);
    expect(canManagePost(admin, post)).toBe(true);
    expect(canManagePost({ ...user, userId: 'other' }, post)).toBe(false);
    expect(canManagePost(user, { userId: 'USER-1' })).toBe(false);
  });

  it.each([null, undefined, [], false, 42, 'post', {}, { userId: '' }, { userId: ' ' },
    { userId: 1 }, { userId: null }, { userId: {} }, { userId: [] }].map((value) => [value]))('denies malformed target %j even to Admin', (target) => {
    expect(canManagePost(user, target)).toBe(false);
    expect(canManagePost(admin, target)).toBe(false);
  });

  it('never mutates its identity or target arguments', () => {
    const identity = Object.freeze({ ...user });
    const target = Object.freeze({ ...post });
    expect(canManagePost(identity, target)).toBe(true);
    expect(canManageUsers(identity)).toBe(false);
    expect(roleHome(identity)).toBe('/blogs');
    expect(identity).toEqual(user);
    expect(target).toEqual(post);
  });
});
