/** Create a local post through the shared explicit plain-text form. */
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { PostForm } from '../components/PostForm.jsx';
import { createPost } from '../lib/posts.js';

/** Navigate only after the domain confirms persistence of the current author's post. */
export default function WriteBlog({ session }) {
  const navigate = useNavigate();

  /** Supply the current acting identity without creating anything during input. */
  function handleSave(input) {
    return createPost(input, session);
  }

  /** Open the exact saved record rather than assuming an ID before the write. */
  function handleSaved(post) {
    navigate(`/blog/${encodeURIComponent(post.id)}`, { replace: true });
  }

  return (
    <main id="main-content" className="page-container py-16 sm:py-24">
      <div className="mx-auto max-w-prose space-y-8">
        <header className="space-y-3">
          <p className="section-label">
            A blank page
          </p>
          <h1 className="text-4xl sm:text-5xl">
            Write a post.
          </h1>
          <p className="text-foreground-muted">
            Plain text, saved only in this browser. Do not include sensitive data.
          </p>
        </header>
        <PostForm onSave={handleSave} onSaved={handleSaved} />
      </div>
    </main>
  );
}

WriteBlog.propTypes = { session: PropTypes.object.isRequired };
