/** Collect four required demo account fields through an explicit form. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField.jsx';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';
import { register, validateRegistration } from '../lib/auth.js';

/** Preserve form state on failed saves and establish identity only on success. */
export default function RegisterPage({ session = null, onSessionChange }) {
  const [input, setInput] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  /** Report validation and incomplete cross-key writes without navigating. */
  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateRegistration(input);
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length) return;
    const result = register(input);
    if (!result.ok) {
      if (result.error.code === 'DUPLICATE_USERNAME') {
        setErrors({ username: result.error.message });
      } else {
        setMessage(result.error.message);
      }
      return;
    }
    onSessionChange(result.value.session);
    navigate('/blogs', { replace: true });
  }

  /** Update only the explicitly changed field without normalization or persistence. */
  function handleChange(event) {
    const { name, value } = event.target;
    setInput((current) => ({ ...current, [name]: value }));
  }

  return (
    <ProtectedRoute session={session} guestOnly>
      <main id="main-content" className="page-container py-16 sm:py-24">
        <div className="mx-auto max-w-md space-y-8">
          <header className="space-y-3">
            <p className="section-label">
              A place for your words
            </p>
            <h1 className="text-4xl sm:text-5xl">
              Join WriteSpace.
            </h1>
            <p className="text-foreground-muted">
              Create a local demo account and start exploring.
            </p>
          </header>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <FormField
              id="username"
              label="Username"
              value={input.username}
              onChange={handleChange}
              error={errors.username}
              autoComplete="username"
            />
            <FormField
              id="email"
              label="Email"
              type="email"
              value={input.email}
              onChange={handleChange}
              error={errors.email}
              autoComplete="email"
            />
            <FormField
              id="password"
              label="Password"
              type="password"
              value={input.password}
              onChange={handleChange}
              error={errors.password}
              autoComplete="new-password"
            />
            <FormField
              id="confirmPassword"
              label="Confirm password"
              type="password"
              value={input.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
            {message && (
              <p role="alert" className="text-sm text-error">
                {message}
              </p>
            )}
            <button type="submit" className="action-primary w-full">
              Create account
            </button>
          </form>
          <aside className="border-t border-border pt-6 text-sm text-foreground-muted" aria-label="Demo limitations">
            <p>
              Demo only: accounts stay in this browser, passwords are stored as plain text, and client-side route checks are not production security. Do not use real passwords or sensitive data.
            </p>
          </aside>
          <p className="text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-700 underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </ProtectedRoute>
  );
}

RegisterPage.propTypes = {
  session: PropTypes.object,
  onSessionChange: PropTypes.func.isRequired,
};
