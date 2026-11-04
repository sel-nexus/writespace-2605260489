/** Present explicit demonstration login without render-time authentication. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField.jsx';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';
import { login } from '../lib/auth.js';
import { roleHome } from '../lib/permissions.js';

/** Submit exact credentials and update identity only after a confirmed write. */
export default function LoginPage({ session = null, onSessionChange }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  /** Preserve credentials and show safe feedback when explicit submission fails. */
  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!username.trim()) nextErrors.username = 'Username is required.';
    if (!password.trim()) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length) return;
    const result = login(username, password);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    onSessionChange(result.value);
    navigate(roleHome(result.value), { replace: true });
  }

  return (
    <ProtectedRoute session={session} guestOnly>
      <main id="main-content" className="page-container py-16 sm:py-24">
        <div className="mx-auto max-w-md space-y-8">
          <header className="space-y-3">
            <p className="section-label">
              Your writing space
            </p>
            <h1 className="text-4xl sm:text-5xl">
              Welcome back.
            </h1>
            <p className="text-foreground-muted">
              Sign in to your browser-local account.
            </p>
          </header>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <FormField
              id="username"
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              error={errors.username}
              autoComplete="username"
            />
            <FormField
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
              autoComplete="current-password"
            />
            {message && (
              <p role="alert" className="text-sm text-error">
                {message}
              </p>
            )}
            <button type="submit" className="action-primary w-full">
              Sign in
            </button>
          </form>
          <aside className="space-y-2 border-t border-border pt-6 text-sm text-foreground-muted" aria-label="Demo limitations">
            <p>
              Demo Admin: username <strong>admin</strong>, password <strong>admin</strong>.
            </p>
            <p>
              Demo only: accounts stay in this browser, passwords are stored as plain text, and client-side route checks are not production security. Do not use real passwords or sensitive data.
            </p>
          </aside>
          <p className="text-sm">
            New here?{' '}
            <Link to="/register" className="text-primary-700 underline underline-offset-4">
              Join WriteSpace
            </Link>
          </p>
        </div>
      </main>
    </ProtectedRoute>
  );
}

LoginPage.propTypes = {
  session: PropTypes.object,
  onSessionChange: PropTypes.func.isRequired,
};
