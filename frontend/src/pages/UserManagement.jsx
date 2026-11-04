/** Present explicit local account creation and protected confirmed deletion. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { FormField } from '../components/FormField.jsx';
import { Avatar } from '../components/Avatar.jsx';
import {
  listUsers, createAdminUser, validateAdminUser, deleteUser, deletionProtection, SEEDED_ADMIN,
} from '../lib/accounts.js';

const emptyForm = { displayName: '', username: '', password: '', role: '' };

/**
 * Render accounts as small-screen cards and a desktop table using one record list.
 * Args:
 *   session: Acting Admin identity supplied by the route guard.
 * Returns:
 *   Required account form, password-free list and accessible live feedback.
 */
export default function UserManagement({ session }) {
  const [result, setResult] = useState(() => listUsers(session));
  const [values, setValues] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const accounts = result.ok ? [SEEDED_ADMIN, ...result.value] : [SEEDED_ADMIN];

  /** Preserve entered fields and report success only after a confirmed account write. */
  function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    const validation = validateAdminUser(values);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const saved = createAdminUser(values, session);
    if (!saved.ok) {
      if (saved.error.code === 'DUPLICATE_USERNAME') setErrors({ username: saved.error.message });
      else setError(saved.error.message);
      return;
    }
    setResult(listUsers(session));
    setValues(emptyForm);
    setStatus('Account created.');
  }

  /** Confirm a specific eligible target and leave the list intact when deletion fails. */
  function handleDelete(account) {
    setError('');
    setStatus('');
    if (deletionProtection(account, session)) return;
    const confirmed = window.confirm('Delete this account? This cannot be undone.');
    if (confirmed !== true) return;
    const removed = deleteUser(account.id, session, confirmed);
    if (!removed.ok) {
      setError(removed.error.message);
      return;
    }
    setResult(listUsers(session));
    setStatus('Account deleted.');
  }

  return (
    <main id="main-content" className="page-container space-y-12 py-12 sm:py-16 dark:text-slate-100">
      <header className="space-y-4">
        <Link
          to="/admin"
          className={[
            'text-sm text-primary-700 hover:underline dark:text-primary-300',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'dark:focus-visible:ring-primary-300 dark:focus-visible:ring-offset-slate-950',
          ].join(' ')}
        >
          Back to dashboard
        </Link>
        <h1 className="text-4xl sm:text-5xl">
          Manage users.
        </h1>
        <p className="max-w-prose text-foreground-muted dark:text-slate-300">
          Local demo only. Passwords are stored as plain text. Do not use real passwords or sensitive data.
        </p>
      </header>
      <section aria-labelledby="create-account" className="max-w-xl space-y-6">
        <h2 id="create-account" className="text-3xl">
          Create account
        </h2>
        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          {['displayName', 'username', 'password'].map((field) => (
            <FormField
              key={field}
              id={field}
              label={{ displayName: 'Display name', username: 'Username', password: 'Password' }[field]}
              type={field === 'password' ? 'password' : 'text'}
              autoComplete={field === 'password' ? 'new-password' : 'off'}
              value={values[field]}
              onChange={(event) => setValues({ ...values, [field]: event.target.value })}
              error={errors[field]}
            />
          ))}
          <div className="space-y-2">
            <label htmlFor="role" className="block text-sm font-semibold dark:text-slate-100">
              Role
            </label>
            <select
              id="role"
              name="role"
              required
              aria-required="true"
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? 'role-error' : undefined}
              value={values.role}
              onChange={(event) => setValues({ ...values, role: event.target.value })}
              className={[
                'min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 focus:ring-2 focus:ring-ring',
                'focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100',
                'dark:focus:ring-primary-300 dark:focus:ring-offset-slate-900',
              ].join(' ')}
            >
              <option value="">
                Choose a role
              </option>
              <option value="Admin">
                Admin
              </option>
              <option value="user">
                user
              </option>
            </select>
            {errors.role && (
              <p id="role-error" role="alert" className="text-sm text-error dark:text-red-300">
                {errors.role}
              </p>
            )}
          </div>
          <button
            type="submit"
            className={[
              'action-primary dark:bg-primary-300 dark:text-primary-950 dark:hover:bg-primary-200',
              'dark:focus-visible:ring-primary-300 dark:focus-visible:ring-offset-slate-950',
            ].join(' ')}
          >
            Create account
          </button>
        </form>
      </section>
      <div role="status" aria-live="polite" className="text-sm text-foreground-muted dark:text-slate-300">
        {!result.ok && result.error.message}
        {status}
      </div>
      {error && (
        <p role="alert" className="text-sm text-error dark:text-red-300">
          {error}
        </p>
      )}
      <section aria-labelledby="local-accounts" className="space-y-6">
        <h2 id="local-accounts" className="text-3xl">
          Local accounts
        </h2>
        <p className="text-sm text-foreground-muted dark:text-slate-300">
          The seeded Admin is shown separately and is never stored in the account collection.
        </p>
        {(!result.ok || result.value.length === 0) && (
          <p className="text-foreground-muted dark:text-slate-300">
            No stored accounts yet.
          </p>
        )}
        <table className="block w-full md:table md:table-fixed">
          <caption className="sr-only">
            Local accounts and deletion controls
          </caption>
          <thead className="sr-only md:not-sr-only md:table-header-group">
            <tr>
              {['Account', 'Username', 'Role', 'Created', 'Actions'].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="p-4 text-left text-sm font-semibold text-foreground-muted dark:text-slate-300"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {accounts.map((account) => {
              const protection = deletionProtection(account, session);
              return (
                <tr
                  key={account.id}
                  className={[
                    'mb-4 block rounded-card border border-border bg-surface md:table-row md:border-x-0',
                    'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
                  ].join(' ')}
                >
                  <td className="block p-4 md:table-cell">
                    <div className="flex items-center gap-3">
                      <Avatar name={account.displayName} role={account.role} />
                      <span className="min-w-0 break-words font-semibold">
                        {account.displayName}
                      </span>
                    </div>
                  </td>
                  <td className="block break-words p-4 md:table-cell">
                    <span className="mr-2 text-sm text-foreground-muted md:hidden dark:text-slate-300">
                      Username:
                    </span>
                    {account.username}
                  </td>
                  <td className="block p-4 md:table-cell">
                    <span className="mr-2 text-sm text-foreground-muted md:hidden dark:text-slate-300">
                      Role:
                    </span>
                    <span
                      className={account.role === 'Admin'
                        ? 'dark:rounded-control dark:bg-primary-950 dark:px-2 dark:py-1 dark:text-primary-200'
                        : 'dark:rounded-control dark:bg-slate-800 dark:px-2 dark:py-1 dark:text-slate-200'}
                    >
                      {account.role}
                    </span>
                  </td>
                  <td className="block p-4 text-sm text-foreground-muted md:table-cell dark:text-slate-300">
                    {account.createdAt ? (
                      <time dateTime={account.createdAt}>
                        {new Date(account.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                      </time>
                    ) : (
                      <span>
                        Seeded demo account
                      </span>
                    )}
                  </td>
                  <td className="block p-4 md:table-cell">
                    <span title={protection || undefined}>
                      <button
                        type="button"
                        aria-label={`Delete ${account.username}`}
                        disabled={Boolean(protection)}
                        title={protection || undefined}
                        className={[
                          'action-secondary disabled:cursor-not-allowed disabled:opacity-60',
                          'dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950',
                          'dark:focus-visible:ring-red-300 dark:focus-visible:ring-offset-slate-900',
                          'dark:disabled:border-slate-600 dark:disabled:text-slate-400',
                          'dark:disabled:hover:bg-slate-900',
                        ].join(' ')}
                        onClick={() => handleDelete(account)}
                      >
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}

UserManagement.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['Admin', 'user']).isRequired,
  }).isRequired,
};
