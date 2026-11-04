/** Read escaped post text and expose only permitted, explicitly confirmed actions. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar.jsx';
import { getPost, deletePost } from '../lib/posts.js';
import { canManagePost } from '../lib/permissions.js';

/** Keep missing or unreadable details usable through a real back link. */
export function PostNotFound({ message = '' }) {
  return (
    <main id="main-content" className="page-container space-y-6 py-16 sm:py-24">
      <h1 className="text-4xl">
        Post not found
      </h1>
      {message && (
        <p role="status" className="text-foreground-muted">
          {message} The stored data has not been changed.
        </p>
      )}
      <Link to="/blogs" className="action-secondary">
        Back to blogs
      </Link>
    </main>
  );
}

PostNotFound.propTypes = { message: PropTypes.string };

/** Load fresh details on route identity changes and retain the page after deletion failure. */
export default function ReadBlog({ session }) {
  const { id } = useParams();
  return <PostDetail key={id} id={id} session={session} />;
}

ReadBlog.propTypes = { session: PropTypes.object.isRequired };

/** Render a single mounted identity without ever interpreting text as HTML. */
function PostDetail({ id, session }) {
  const [result] = useState(() => getPost(id));
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const post = result.ok ? result.value : null;

  /** Confirm natively, then let the domain re-read current ownership before removal. */
  function handleDelete() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    const deleted = deletePost(id, session, true);
    if (!deleted.ok) {
      setMessage(deleted.error.message);
      return;
    }
    navigate('/blogs', { replace: true });
  }

  if (!post) return <PostNotFound message={result.ok ? '' : result.error.message} />;
  const date = new Date(post.createdAt);
  const validDate = Number.isFinite(date.getTime());
  const canManage = canManagePost(session, post);
  return (
    <main id="main-content" className="page-container py-16 sm:py-24">
      <article className="mx-auto max-w-prose space-y-8">
        <Link to="/blogs" className="text-primary-700 underline underline-offset-4">
          Back to blogs
        </Link>
        <h1 className="break-words text-4xl sm:text-5xl">
          {post.title}
        </h1>
        <div className="flex items-center gap-3 text-sm">
          <Avatar name={post.authorAvatar} />
          <div>
            <p className="break-words font-semibold">
              {post.authorName}
            </p>
            {validDate ? (
              <time dateTime={date.toISOString()} className="text-foreground-muted">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
              </time>
            ) : (
              <p className="text-foreground-muted">
                Date unavailable
              </p>
            )}
          </div>
        </div>
        <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">
          {post.content}
        </p>
        {message && (
          <p role="alert" className="text-sm text-error">
            {message}
          </p>
        )}
        {canManage && (
          <div className="flex flex-wrap gap-3 border-t border-border pt-6">
            <Link to={`/edit/${encodeURIComponent(id)}`} className="action-secondary">
              Edit
            </Link>
            <button type="button" onClick={handleDelete} className="action-secondary">
              Delete
            </button>
          </div>
        )}
      </article>
    </main>
  );
}

PostDetail.propTypes = { id: PropTypes.string.isRequired, session: PropTypes.object.isRequired };
