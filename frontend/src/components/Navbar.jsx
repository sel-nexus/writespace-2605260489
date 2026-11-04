/** Provide state-driven public navigation and local role presentation. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';

/**
 * Toggle mobile navigation explicitly and close it on route navigation.
 * Args:
 *   session: Validated local presentation record, or null for guests.
 *   onLogout: Explicit action delegated to the identity-owning route shell.
 * Returns:
 *   A header with native links; no authentication or storage mutations occur here.
 */
export function Navbar({ session = null, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash, session]);

  return (
    <header className="border-b border-border bg-background">
      <div className="page-container flex min-h-20 flex-wrap items-center justify-between gap-4 py-3">
        <Link to="/" className="font-display text-2xl font-semibold tracking-tight" aria-label="WriteSpace home">
          WriteSpace
          <span className="text-primary-700">
            .
          </span>
        </Link>
        <button
          type="button"
          className="nav-link sm:hidden"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d={menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>
        <nav
          id="primary-navigation"
          aria-label="Primary"
          className={`${menuOpen ? 'flex' : 'hidden'} w-full flex-col gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center sm:gap-4`}
        >
          <NavLink to="/" end className="nav-link" onClick={() => setMenuOpen(false)}>
            Explore
          </NavLink>
          {session ? (
            <>
              <NavLink to={session.role === 'Admin' ? '/admin' : '/blogs'} className="nav-link">
                {session.role === 'Admin' ? 'Admin dashboard' : 'Your reading space'}
              </NavLink>
              <div className="flex items-center gap-3 px-3 py-2">
                <Avatar name={session.displayName} role={session.role} />
                <div>
                  <p className="font-semibold">
                    {session.displayName}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {session.role === 'Admin' ? 'Admin' : 'Writer'}
                  </p>
                </div>
              </div>
              {onLogout && (
                <button type="button" className="nav-link" onClick={onLogout}>
                  Log out
                </button>
              )}
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-link">
                Sign in
              </NavLink>
              <Link to="/register" className="action-secondary">
                Join WriteSpace
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

Navbar.propTypes = {
  onLogout: PropTypes.func,
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['Admin', 'user']).isRequired,
  }),
};
