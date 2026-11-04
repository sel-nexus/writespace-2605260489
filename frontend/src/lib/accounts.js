/** Manage local accounts with repeated Admin checks and single, confirmed storage writes. */
import { readJson, writeJson, STORAGE_KEYS } from './storage.js';
import { canManageUsers } from './permissions.js';

// The demo identity is presentation-only, never inserted into the users collection.
export const SEEDED_ADMIN = Object.freeze({
  id: 'admin', displayName: 'Admin', username: 'admin', role: 'Admin', createdAt: null,
});

/** Accept required text without changing case or password whitespace. */
function isText(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

/** Return safe diagnostics without including password-bearing inputs. */
function failure(code, message) {
  return { ok: false, error: { code, message } };
}

/** Validate stored accounts before presenting or replacing the entire collection. */
function isUsers(value) {
  if (!Array.isArray(value)) return false;
  const ids = new Set();
  const names = new Set();
  return value.every((user) => {
    if (!user || typeof user !== 'object' || Array.isArray(user)) return false;
    const fields = ['id', 'displayName', 'username', 'password', 'createdAt'];
    if (!fields.every((field) => isText(user[field]))) return false;
    if (!['Admin', 'user'].includes(user.role) || !Number.isFinite(Date.parse(user.createdAt))) return false;
    if (user.email !== undefined && !isText(user.email)) return false;
    if (ids.has(user.id) || names.has(user.username)) return false;
    ids.add(user.id);
    names.add(user.username);
    return true;
  });
}

/**
 * Read only persisted accounts, keeping the seeded identity separate.
 * Args:
 *   session: Complete Admin context; other identities fail closed.
 * Returns:
 *   Validated stored records or a diagnosable failure, without repairs or writes.
 * @param {import('./auth.js').Session} session
 * @returns {object} Guarded collection result.
 */
export function listUsers(session) {
  if (!canManageUsers(session)) return failure('FORBIDDEN', 'Only Admin can manage accounts.');
  return readJson(STORAGE_KEYS.users, [], isUsers);
}

/**
 * Report every required field and exact-role violation before a mutation.
 * Args:
 *   input: Display name, username, demo password and exact role.
 * Returns:
 *   Associated field messages; credentials are preserved verbatim.
 * @param {object} input
 * @returns {Object<string, string>} Inline validation messages.
 */
export function validateAdminUser(input) {
  const values = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const errors = {};
  const labels = { displayName: 'Display name', username: 'Username', password: 'Password' };
  for (const field of Object.keys(labels)) {
    if (!isText(values[field])) errors[field] = `${labels[field]} is required.`;
  }
  if (!isText(values.role)) errors.role = 'Role is required.';
  else if (!['Admin', 'user'].includes(values.role)) errors.role = 'Choose Admin or user.';
  if (values.username === 'admin') errors.username = 'The username admin is reserved.';
  return errors;
}

/**
 * Append an account only after permission, validation, fresh read and native UUID checks.
 * Args:
 *   input: Required creation fields; email and extra fields are not copied.
 *   session: Complete acting Admin identity.
 * Returns:
 *   The saved account or failure; no session change or automatic retry occurs.
 * @param {object} input
 * @param {import('./auth.js').Session} session
 * @returns {object} Confirmed account result.
 */
export function createAdminUser(input, session) {
  if (!canManageUsers(session)) return failure('FORBIDDEN', 'Only Admin can manage accounts.');
  const errors = validateAdminUser(input);
  if (Object.keys(errors).length) return failure('INVALID_INPUT', Object.values(errors)[0]);
  const users = listUsers(session);
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
  const account = {
    id, displayName: input.displayName, username: input.username, password: input.password,
    role: input.role, createdAt: new Date().toISOString(),
  };
  const saved = writeJson(STORAGE_KEYS.users, [...users.value, account]);
  return saved.ok ? { ok: true, value: account } : saved;
}

/**
 * Explain fixed and active identity protections for both UI and domain checks.
 * Args:
 *   account: Target record, including the presentation-only demo identity.
 *   session: Acting local identity.
 * Returns:
 *   A protection explanation, or empty text for an eligible target.
 * @param {object} account
 * @param {import('./auth.js').Session} session
 * @returns {string} Disabled-control tooltip.
 */
export function deletionProtection(account, session) {
  if (account.id === 'admin' || account.username === 'admin') return 'The default admin account is protected.';
  if (account.id === session?.userId) return 'You cannot delete your currently signed-in account.';
  return '';
}

/**
 * Remove only an eligible freshly read account after literal confirmation.
 * Args:
 *   id: Exact target identity.
 *   session: Complete Admin context, checked even when controls were enabled.
 *   confirmed: Native confirmation result; truthy substitutes are rejected.
 * Returns:
 *   Confirmed removal or failure with no write on rejected actions and no retry.
 * @param {string} id
 * @param {import('./auth.js').Session} session
 * @param {boolean} confirmed
 * @returns {object} Guarded removal result.
 */
export function deleteUser(id, session, confirmed) {
  if (!canManageUsers(session)) return failure('FORBIDDEN', 'Only Admin can manage accounts.');
  if (!isText(id)) return failure('INVALID_INPUT', 'An account ID is required.');
  if (id === 'admin' || id === session.userId) return failure('FORBIDDEN', 'This account is protected.');
  if (confirmed !== true) return failure('CONFIRMATION_REQUIRED', 'Deletion was not confirmed.');
  const users = listUsers(session);
  if (!users.ok) return users;
  const target = users.value.find((user) => user.id === id);
  if (!target) return failure('NOT_FOUND', 'Account not found.');
  if (deletionProtection(target, session)) return failure('FORBIDDEN', 'This account is protected.');
  const saved = writeJson(STORAGE_KEYS.users, users.value.filter((user) => user.id !== id));
  return saved.ok ? { ok: true, value: null } : saved;
}
