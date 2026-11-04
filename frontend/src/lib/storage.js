/** Guard browser-local JSON access without repairing or overwriting failed reads. */
export const STORAGE_KEYS = Object.freeze({
  posts: 'writespace_posts',
  users: 'writespace_users',
  session: 'writespace_session',
});

/**
 * Describe a recoverable storage failure without exposing stored content.
 * @param {string} code Failure category for callers to handle.
 * @returns {{ok: false, error: {code: string, message: string}}} Diagnosable failure.
 */
function failure(code) {
  const messages = {
    UNAVAILABLE: 'Browser storage is unavailable.',
    MALFORMED: 'Stored data could not be read safely.',
    WRITE_FAILED: 'The storage change could not be confirmed.',
  };
  return { ok: false, error: { code, message: messages[code] } };
}

/**
 * Read a JSON value, using the fallback only when the key is absent.
 * Args:
 *   key: Browser-local record key.
 *   fallback: Missing-key value; collection fallbacks require an array shape.
 *   validate: Optional record-shape predicate for untrusted stored data.
 * Returns:
 *   A value on success or an explicit failure; this never writes or removes data.
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @param {(value: T) => boolean} [validate]
 * @returns {{ok: true, value: T} | {ok: false, error: {code: string, message: string}}}
 */
export function readJson(key, fallback, validate) {
  let raw;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return failure('UNAVAILABLE');
  }
  if (raw === null) return { ok: true, value: fallback };
  try {
    const value = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(value)) return failure('MALFORMED');
    if (validate && !validate(value)) return failure('MALFORMED');
    return { ok: true, value };
  } catch {
    return failure('MALFORMED');
  }
}

/**
 * Confirm a single-key JSON write without retries or success on exceptions.
 * Args:
 *   key: Browser-local record key.
 *   value: Serializable replacement value.
 * Returns:
 *   The supplied value only after setItem succeeds, otherwise a safe failure.
 * @template T
 * @param {string} key
 * @param {T} value
 * @returns {{ok: true, value: T} | {ok: false, error: {code: string, message: string}}}
 */
export function writeJson(key, value) {
  let storage;
  try {
    storage = window.localStorage;
    if (!storage) return failure('UNAVAILABLE');
  } catch {
    return failure('UNAVAILABLE');
  }
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') return failure('WRITE_FAILED');
    storage.setItem(key, serialized);
    return { ok: true, value };
  } catch {
    return failure('WRITE_FAILED');
  }
}

/**
 * Remove one key idempotently, reporting an unconfirmed removal as failure.
 * @param {string} key Browser-local record key.
 * @returns {{ok: true, value: null} | {ok: false, error: {code: string, message: string}}}
 */
export function removeKey(key) {
  let storage;
  try {
    storage = window.localStorage;
    if (!storage) return failure('UNAVAILABLE');
  } catch {
    return failure('UNAVAILABLE');
  }
  try {
    storage.removeItem(key);
    return { ok: true, value: null };
  } catch {
    return failure('WRITE_FAILED');
  }
}

/** Accept a nonempty text field while preserving its original value. */
function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate only the session fields needed for safe navbar initialization.
 * Notes:
 *   This is presentation validation, not authentication or trusted authorization.
 * @param {unknown} value Untrusted stored session.
 * @returns {boolean} Whether the session is null or has the expected record fields.
 */
export function isSession(value) {
  return value === null || (
    typeof value === 'object' && !Array.isArray(value) &&
    ['userId', 'username', 'displayName'].every((field) => isText(value[field])) &&
    ['Admin', 'user'].includes(value.role)
  );
}

/** Read a nullable session without touching account records or repairing storage. */
export function readSession() {
  return readJson(STORAGE_KEYS.session, null, isSession);
}

/**
 * Accept renderable preview records, retaining invalid date strings for safe display.
 * @param {unknown} value Untrusted post collection.
 * @returns {boolean} Whether every record can render as escaped plain text.
 */
function isPostCollection(value) {
  if (!Array.isArray(value)) return false;
  const ids = new Set();
  return value.every((post) => {
    if (!post || typeof post !== 'object' || Array.isArray(post)) return false;
    const fields = ['id', 'title', 'content', 'userId', 'authorName', 'authorAvatar'];
    if (!fields.every((field) => isText(post[field]))) return false;
    if (typeof post.createdAt !== 'string' || ids.has(post.id)) return false;
    ids.add(post.id);
    return true;
  });
}

/** Read safe preview records without implementing post mutations or account logic. */
export function readPosts() {
  return readJson(STORAGE_KEYS.posts, [], isPostCollection);
}
