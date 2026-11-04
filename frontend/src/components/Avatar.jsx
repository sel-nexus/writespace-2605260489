/** Present initials as name metadata, never as proof of identity. */
import PropTypes from 'prop-types';

/**
 * Show up to two initials with an accessible name.
 * @param {{name: string, role?: string}} props Name and optional local role.
 * @returns {JSX.Element} Compact avatar presentation.
 */
export function Avatar({ name, role }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase() || '?';
  return (
    <span
      role="img"
      aria-label={`${name || 'Unknown author'}${role ? `, ${role}` : ''}`}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-100 text-sm font-semibold text-primary-800"
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
