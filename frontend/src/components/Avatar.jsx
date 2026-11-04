/** Present initials as name metadata, never as proof of identity. */
import PropTypes from 'prop-types';

const roleStyles = {
  Admin: 'dark:ring-2 dark:ring-primary-300',
  user: 'dark:bg-slate-800 dark:text-slate-100',
};

/**
 * Show up to two initials with an accessible name.
 * Args:
 *   name: Author or account name used for initials.
 *   role: Optional local role, exposed as metadata rather than authorization.
 * Returns:
 *   Compact initials with an accessible name and a distinct Admin outline.
 */
export function Avatar({ name, role }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase() || '?';
  return (
    <span
      role="img"
      aria-label={`${name || 'Unknown author'}${role ? `, ${role}` : ''}`}
      className={[
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control',
        'bg-primary-100 text-sm font-semibold text-primary-800',
        role === 'user' ? roleStyles.user : 'dark:bg-primary-900 dark:text-primary-100',
        role === 'Admin' ? roleStyles.Admin : '',
      ].join(' ')}
    >
      <span aria-hidden="true">
        {initials}
      </span>
    </span>
  );
}

Avatar.propTypes = {
  name: PropTypes.string.isRequired,
  role: PropTypes.oneOf(['Admin', 'user']),
};
