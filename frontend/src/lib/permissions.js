/** Keep browser-local role and owner policies pure and fail closed. */
import { isSession } from './storage.js';

/**
 * Reject guests and malformed identity records.
 * @param {unknown} session Untrusted identity.
 * @returns {boolean} Whether all required session fields and the exact role are valid.
 */
export function isAuthenticated(session) {
  return session !== null && isSession(session);
}

/**
 * Allow account management only for a complete Admin session.
 * @param {unknown} session Untrusted identity.
 * @returns {boolean} Client-side presentation permission, not trusted authorization.
 */
export function canManageUsers(session) {
  return isAuthenticated(session) && session.role === 'Admin';
}

/**
 * Allow post management only for a valid Admin or matching owner.
 * Args:
 *   session: Complete local identity.
 *   post: A target carrying a nonempty owner identity.
 * @param {unknown} session
 * @param {unknown} post
 * @returns {boolean} False for any malformed session or target.
 */
export function canManagePost(session, post) {
  if (!isAuthenticated(session)) return false;
  if (!post || typeof post !== 'object' || Array.isArray(post)) return false;
  if (typeof post.userId !== 'string' || !post.userId.trim()) return false;
  return canManageUsers(session) || session.userId === post.userId;
}

/**
 * Select a validated account's role home, defaulting guests to login.
 * @param {unknown} session Untrusted identity.
 * @returns {string} A fail-closed route destination.
 */
export function roleHome(session) {
  if (!isAuthenticated(session)) return '/login';
  return canManageUsers(session) ? '/admin' : '/blogs';
}
