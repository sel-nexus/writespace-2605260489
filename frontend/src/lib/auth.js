/** Manage demonstration-only accounts through the shared browser storage adapter. */
import { readJson, writeJson, removeKey, readSession, STORAGE_KEYS } from './storage.js';

/** @typedef {{userId: string, username: string, displayName: string, role: 'Admin'|'user'}} Session */
/** @typedef {{username: string, email: string, password: string, confirmPassword: string}} RegisterInput */
/** @typedef {{id: string, displayName: string, username: string, email?: string, password: string, role: 'Admin'|'user', createdAt: string}} User */
/** @template T @typedef {{ok: true, value: T}|{ok: false, error: {code: string, message: string}}} Result */

/** Accept required text without normalizing any credential. */
function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Return a safe domain error without echoing credentials. */
function failure(code, message) {
  return { ok: false, error: { code, message } };
}

/** Validate complete local account collections before lookup or replacement. */
function isUsers(value) {
  if (!Array.isArray(value)) return false;
  const ids = new Set();
  const usernames = new Set();
  return value.every((user) => {
    if (!user || typeof user !== 'object' || Array.isArray(user)) return false;
    if (!['id', 'displayName', 'username', 'password', 'createdAt'].every((field) => isText(user[field]))) return false;
    if (!['Admin', 'user'].includes(user.role) || !Number.isFinite(Date.parse(user.createdAt))) return false;
    if (user.email !== undefined && !isText(user.email)) return false;
    if (ids.has(user.id) || usernames.has(user.username)) return false;
    ids.add(user.id);
    usernames.add(user.username);
    return true;
  });
}

/** Construct only the public session fields, never a password-bearing record. */
function sessionFor(user) {
  return { userId: user.id, username: user.username, displayName: user.displayName, role: user.role };
}

/**
 * Authenticate exact demo credentials first, then validated local accounts.
 * Args:
 *   username: Case-sensitive account name, preserved verbatim.
 *   password: Untransformed demonstration password.
 * Returns:
 *   A session only after its write is confirmed, or a safe failure.
 * @param {string} username
 * @param {string} password
 * @returns {Result<Session>}
 */
export function login(username, password) {
  if (!isText(username) || !isText(password)) {
    return failure('INVALID_CREDENTIALS', 'Invalid username or password.');
  }
  if (username === 'admin' && password === 'admin') {
    return writeJson(STORAGE_KEYS.session, {
      userId: 'admin', username: 'admin', displayName: 'Admin', role: 'Admin',
    });
  }
  const users = readJson(STORAGE_KEYS.users, [], isUsers);
  if (!users.ok) return users;
  const user = users.value.find((account) => account.username === username && account.password === password);
  if (!user) return failure('INVALID_CREDENTIALS', 'Invalid username or password.');
  const session = sessionFor(user);
  return writeJson(STORAGE_KEYS.session, session);
}

/**
 * Report all invalid registration fields before any storage mutation.
 * Args:
 *   input: The four self-registration fields; credentials are never normalized.
 * Returns:
 *   Field messages, empty only when required fields and confirmation are valid.
 * @param {RegisterInput} input
 * @returns {Object<string, string>}
 */
export function validateRegistration(input) {
  const values = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const errors = {};
  const labels = { username: 'Username', email: 'Email', password: 'Password', confirmPassword: 'Password confirmation' };
  for (const field of Object.keys(labels)) {
    if (!isText(values[field])) errors[field] = `${labels[field]} is required.`;
  }
  if (!errors.password && !errors.confirmPassword && values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords must match.';
  }
  if (values.username === 'admin') errors.username = 'The username admin is reserved.';
  return errors;
}

/**
 * Persist a user and session only after validation and native UUID generation.
 * Args:
 *   input: Required self-registration values, preserved verbatim.
 * Returns:
 *   Both saved records or failure; a failed second write can leave the account saved.
 * Notes:
 *   Browser storage is not transactional. No rollback or blind retry is attempted.
 * @param {RegisterInput} input
 * @returns {Result<{user: User, session: Session}>}
 */
export function register(input) {
  const errors = validateRegistration(input);
  if (Object.keys(errors).length) return failure('INVALID_INPUT', Object.values(errors)[0]);
  const users = readJson(STORAGE_KEYS.users, [], isUsers);
  if (!users.ok) return users;
  if (users.value.some((user) => user.username === input.username)) {
    return failure('DUPLICATE_USERNAME', 'This username is already in use.');
  }
  let id;
  try {
    if (typeof globalThis.crypto?.randomUUID !== 'function') {
      return failure('UNSUPPORTED_ID', 'This browser cannot generate account IDs.');
    }
    id = globalThis.crypto.randomUUID();
    if (!isText(id) || id === 'admin' || users.value.some((user) => user.id === id)) {
      return failure('UNSUPPORTED_ID', 'This browser cannot generate account IDs.');
    }
  } catch {
    return failure('UNSUPPORTED_ID', 'This browser cannot generate account IDs.');
  }
  const user = {
    id, displayName: input.username, username: input.username, email: input.email,
    password: input.password, role: 'user', createdAt: new Date().toISOString(),
  };
  const saved = writeJson(STORAGE_KEYS.users, [...users.value, user]);
  if (!saved.ok) return saved;
  const session = sessionFor(user);
  const signedIn = writeJson(STORAGE_KEYS.session, session);
  if (!signedIn.ok) {
    return failure(signedIn.error.code, 'Registration is incomplete: the account may be saved, but sign-in could not be confirmed. Try signing in after resolving browser storage.');
  }
  return { ok: true, value: { user, session } };
}

/**
 * Read identity without repairing malformed or unavailable storage.
 * @returns {Result<Session|null>} Valid identity or a diagnosable read failure.
 */
export function getSession() {
  return readSession();
}

/**
 * Remove the active session without clearing other browser data.
 * @returns {Result<null>} Confirmed removal or failure; callers retain identity on failure.
 */
export function logout() {
  return removeKey(STORAGE_KEYS.session);
}
