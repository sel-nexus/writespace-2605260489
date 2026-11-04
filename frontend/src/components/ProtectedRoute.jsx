/** Apply browser-local route redirects without mutating identity on render. */
import PropTypes from 'prop-types';
import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated, roleHome } from '../lib/permissions.js';

/**
 * Gate protected and guest-only routes using the current React identity.
 * Args:
 *   session: Untrusted local identity; invalid records are treated as guests.
 *   allowedRoles: Exact roles admitted to a protected route.
 *   guestOnly: Redirect valid identities away from authentication screens.
 *   children: Optional content; otherwise render the nested route outlet.
 * Returns:
 *   Allowed content or a replace redirect, never a storage mutation.
 */
export function ProtectedRoute({ session = null, allowedRoles = ['Admin', 'user'], guestOnly = false, children }) {
  const authenticated = isAuthenticated(session);
  if (guestOnly) {
    if (authenticated) return <Navigate to={roleHome(session)} replace />;
    return children ?? <Outlet />;
  }
  if (!authenticated) return <Navigate to="/login" replace />;
  if (!Array.isArray(allowedRoles) || !allowedRoles.includes(session.role)) {
    return <Navigate to={roleHome(session)} replace />;
  }
  return children ?? <Outlet />;
}

ProtectedRoute.propTypes = {
  session: PropTypes.object,
  allowedRoles: PropTypes.arrayOf(PropTypes.oneOf(['Admin', 'user'])),
  guestOnly: PropTypes.bool,
  children: PropTypes.node,
};
