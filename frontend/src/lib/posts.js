/** Manage plain-text posts without repairing failed reads or trusting visible controls. */
import { readPosts, writeJson, STORAGE_KEYS } from './storage.js';
import { isAuthenticated, canManagePost } from './permissions.js';

/** @typedef {{id: string, title: string, content: string, createdAt: string, userId: string, authorName: string, authorAvatar: string}} Post */
/** @typedef {{title: string, content: string}} PostInput */
/** @typedef {import('./auth.js').Session} Session */
/** @template T @typedef {{ok: true, value: T}|{ok: false, error: {code: string, message: string}}} Result */

/** Return a safe failure without echoing post content. */
function failure(code, message) {
  return { ok: false, error: { code, message } };
}

/** Accept nonempty text without normalizing its stored value. */
function isText(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

/**
 * Report both required plain-text fields before any write.
 * @param {PostInput} input Entered values, preserved verbatim.
 * @returns {Object<string, string>} Inline messages or an empty object.
 */
export function validatePost(input) {
  const values = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const errors = {};
  if (!isText(values.title)) errors.title = 'Title is required.';
  if (!isText(values.content)) errors.content = 'Content is required.';
  return errors;
}

/**
 * Order a copy newest first, retaining source order for ties and malformed times.
 * @returns {Result<Post[]>} Guarded records or the original diagnosable read failure.
 */
export function listPosts() {
  const result = readPosts();
  if (!result.ok) return result;
  const ordered = result.value.map((post, index) => ({ post, index, time: Date.parse(post.createdAt) }));
  ordered.sort((a, b) => {
    const aValid = Number.isFinite(a.time);
    const bValid = Number.isFinite(b.time);
    if (aValid !== bValid) return aValid ? -1 : 1;
    if (aValid && a.time !== b.time) return b.time - a.time;
    return a.index - b.index;
  });
  return { ok: true, value: ordered.map(({ post }) => post) };
}

/**
 * Find an exact ID without changing missing or unreadable data.
 * @param {string} id Requested local identity.
 * @returns {Result<Post|null>} A record, null when absent, or failure.
 */
export function getPost(id) {
  if (!isText(id)) return failure('INVALID_INPUT', 'A post ID is required.');
  const result = readPosts();
  if (!result.ok) return result;
  return { ok: true, value: result.value.find((post) => post.id === id) ?? null };
}

/**
 * Append a native-UUID post only after validating identity, fields and current storage.
 * Args:
 *   input: Plain text to preserve, including meaningful whitespace.
 *   session: Complete local author identity, not a trusted security boundary.
 * Returns:
 *   The new post only after a confirmed single-key write; never retries.
 * @param {PostInput} input
 * @param {Session} session
 * @returns {Result<Post>}
 */
export function createPost(input, session) {
  if (!isAuthenticated(session)) return failure('FORBIDDEN', 'Sign in to write a post.');
  const errors = validatePost(input);
  if (Object.keys(errors).length) return failure('INVALID_INPUT', Object.values(errors)[0]);
  const posts = readPosts();
  if (!posts.ok) return posts;
  let id;
  try {
    if (typeof globalThis.crypto?.randomUUID !== 'function') {
      return failure('UNSUPPORTED_ID', 'This browser cannot generate post IDs.');
    }
    id = globalThis.crypto.randomUUID();
    if (!isText(id) || posts.value.some((post) => post.id === id)) {
      return failure('UNSUPPORTED_ID', 'This browser cannot generate post IDs.');
    }
  } catch {
    return failure('UNSUPPORTED_ID', 'This browser cannot generate post IDs.');
  }
  const post = {
    id, title: input.title, content: input.content, createdAt: new Date().toISOString(),
    userId: session.userId, authorName: session.displayName, authorAvatar: session.displayName,
  };
  const saved = writeJson(STORAGE_KEYS.posts, [...posts.value, post]);
  return saved.ok ? { ok: true, value: post } : saved;
}

/**
 * Re-read ownership at submission and replace only editable text fields.
 * @param {string} id Exact existing identity.
 * @param {PostInput} input Replacement title and content.
 * @param {Session} session Complete owner or Admin identity.
 * @returns {Result<Post>} Saved record with immutable identity, author and creation time.
 */
export function updatePost(id, input, session) {
  if (!isAuthenticated(session)) return failure('FORBIDDEN', 'You cannot manage this post.');
  if (!isText(id)) return failure('INVALID_INPUT', 'A post ID is required.');
  const errors = validatePost(input);
  if (Object.keys(errors).length) return failure('INVALID_INPUT', Object.values(errors)[0]);
  const posts = readPosts();
  if (!posts.ok) return posts;
  const target = posts.value.find((post) => post.id === id);
  if (!target) return failure('NOT_FOUND', 'Post not found');
  if (!canManagePost(session, target)) return failure('FORBIDDEN', 'You cannot manage this post.');
  const updated = { ...target, title: input.title, content: input.content };
  const saved = writeJson(STORAGE_KEYS.posts, posts.value.map((post) => post.id === id ? updated : post));
  return saved.ok ? { ok: true, value: updated } : saved;
}

/**
 * Delete only with literal confirmation and freshly checked owner or Admin permission.
 * @param {string} id Exact target identity.
 * @param {Session} session Complete acting identity.
 * @param {boolean} confirmed Native confirmation result; only true permits mutation.
 * @returns {Result<null>} Confirmed removal or a safe failure with no retry.
 */
export function deletePost(id, session, confirmed) {
  if (!isAuthenticated(session)) return failure('FORBIDDEN', 'You cannot manage this post.');
  if (!isText(id)) return failure('INVALID_INPUT', 'A post ID is required.');
  if (confirmed !== true) return failure('CONFIRMATION_REQUIRED', 'Deletion was not confirmed.');
  const posts = readPosts();
  if (!posts.ok) return posts;
  const target = posts.value.find((post) => post.id === id);
  if (!target) return failure('NOT_FOUND', 'Post not found');
  if (!canManagePost(session, target)) return failure('FORBIDDEN', 'You cannot manage this post.');
  const saved = writeJson(STORAGE_KEYS.posts, posts.value.filter((post) => post.id !== id));
  return saved.ok ? { ok: true, value: null } : saved;
}
