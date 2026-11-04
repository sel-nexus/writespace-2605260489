/** Associate required form controls with labels and accessible inline feedback. */
import PropTypes from 'prop-types';

/**
 * Render a controlled native input without blocking paste or transforming values.
 * Args:
 *   id: Stable control identity, also used for its error association.
 *   label: Visible field name.
 *   error: Safe field-level message, if validation failed.
 * Returns:
 *   A labeled input with required and invalid states exposed to assistive technology.
 */
export function FormField({ id, label, type = 'text', value, onChange, error = '', autoComplete, required = true }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold dark:text-slate-100">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={[
          'min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:ring-2',
          'focus:ring-ring focus:ring-offset-2 focus:ring-offset-surface dark:border-slate-600 dark:bg-slate-900',
          'dark:text-slate-100 dark:focus:ring-primary-300 dark:focus:ring-offset-slate-900',
          'dark:placeholder:text-slate-400',
        ].join(' ')}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-error dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

FormField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  type: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  autoComplete: PropTypes.string,
  required: PropTypes.bool,
};
