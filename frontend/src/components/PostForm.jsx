/** Collect editable plain text through explicit submission, never render-time persistence. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { FormField } from './FormField.jsx';
import { validatePost } from '../lib/posts.js';

/**
 * Preserve controlled values and associated feedback after a failed save.
 * Args:
 *   initialInput: Current text for a new or existing post.
 *   onSave: Synchronous domain operation returning a confirmed result.
 *   onSaved: Navigation callback invoked only on successful persistence.
 * Returns:
 *   A labeled form with inline errors and a live Unicode character counter.
 */
export function PostForm({ initialInput = { title: '', content: '' }, onSave, onSaved, submitLabel = 'Save post', cancelTo = '/blogs' }) {
  const [input, setInput] = useState(initialInput);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');

  /** Update only the changed field, without writing or normalizing text. */
  function handleChange(event) {
    const { name, value } = event.target;
    setInput((current) => ({ ...current, [name]: value }));
  }

  /** Validate all fields and navigate only after a confirmed save. */
  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validatePost(input);
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length) return;
    const result = onSave(input);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    onSaved(result.value);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <FormField id="title" label="Title" value={input.title} onChange={handleChange} error={errors.title} />
      <div className="space-y-2">
        <label htmlFor="content" className="block text-sm font-semibold">
          Content
        </label>
        <textarea
          id="content"
          name="content"
          rows={12}
          value={input.content}
          onChange={handleChange}
          required
          aria-required="true"
          aria-invalid={Boolean(errors.content)}
          aria-describedby={errors.content ? 'content-error content-counter' : 'content-counter'}
          className="w-full rounded-control border border-border bg-surface px-3 py-2 leading-relaxed outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.content && (
          <p id="content-error" role="alert" className="text-sm text-error">
            {errors.content}
          </p>
        )}
        <p id="content-counter" role="status" className="text-sm tabular-nums text-foreground-muted">
          {Array.from(input.content).length} characters
        </p>
      </div>
      {message && (
        <p role="alert" className="text-sm text-error">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="action-primary">
          {submitLabel}
        </button>
        <Link to={cancelTo} className="action-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

PostForm.propTypes = {
  initialInput: PropTypes.shape({ title: PropTypes.string.isRequired, content: PropTypes.string.isRequired }),
  onSave: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
  submitLabel: PropTypes.string,
  cancelTo: PropTypes.string,
};
