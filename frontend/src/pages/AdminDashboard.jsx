/** Present local administration without inventing metrics or mutating on render. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard.jsx';
import { listPosts, deletePost } from '../lib/posts.js';
import { listUsers, SEEDED_ADMIN } from '../lib/accounts.js';

const primaryAction = [
  'action-primary dark:bg-primary-300 dark:text-primary-950 dark:hover:bg-primary-200',
  'dark:focus-visible:ring-primary-300 dark:focus-visible:ring-offset-slate-950',
].join(' ');
const secondaryAction = [
  'action-secondary dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800',
  'dark:focus-visible:ring-primary-300 dark:focus-visible:ring-offset-slate-950',
].join(' ');

/**
 * Show four exact metrics and up to five newest posts with explicit actions.
 * Args:
 *   session: Complete Admin identity supplied by the protected route.
 * Returns:
 *   A responsive local dashboard with read and mutation failure feedback.
 */
export default function AdminDashboard({ session }) {
  const [postResult, setPostResult] = useState(listPosts);
  const [userResult] = useState(() => listUsers(session));
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const posts = postResult.ok ? postResult.value : [];
  const users = userResult.ok ? [SEEDED_ADMIN, ...userResult.value] : [SEEDED_ADMIN];
  // The case-variant label deliberately reuses the same total, not a new metric.
  const metrics = [
    ['Total Posts', posts.length], ['Total Users', users.length],
    ['Total Admins', users.filter((user) => user.role === 'Admin').length], ['Total users', users.length],
  ];

  /** Delete the selected post only after native confirmation and refresh on success. */
  function handleDelete(id) {
    setError('');
    setStatus('');
    const confirmed = window.confirm('Delete this post? This cannot be undone.');
    if (confirmed !== true) return;
    const result = deletePost(id, session, confirmed);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setPostResult(listPosts());
    setStatus('Post deleted.');
  }

  return (
    <main id="main-content" className="page-container space-y-12 py-12 sm:py-16 dark:text-slate-100">
      <header className="space-y-6">
        <p className="section-label dark:text-slate-300">
          Local administration
        </p>
        <h1 className="text-4xl sm:text-5xl">
          Admin dashboard.
        </h1>
        <p className="max-w-prose text-foreground-muted dark:text-slate-300">
          Posts and accounts stay in this browser. Client-side roles are not a security boundary.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/write" className={primaryAction}>
            Write New Post
          </Link>
          <Link to="/users" className={secondaryAction}>
            Manage Users
          </Link>
        </div>
      </header>
      <section aria-label="Local statistics" className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(([label, count]) => (
            <div
              key={label}
              className="rounded-card border border-border bg-surface p-6 dark:border-slate-700 dark:bg-slate-900"
            >
              <dt className="text-sm text-foreground-muted dark:text-slate-300">
                {label}
              </dt>
              <dd className="mt-3 text-3xl tabular-nums">
                {count}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-foreground-muted dark:text-slate-300">
          Total Users includes the separate seeded Admin. Total users repeats that same count.
        </p>
      </section>
      <div role="status" aria-live="polite" className="text-sm text-foreground-muted dark:text-slate-300">
        {!postResult.ok && postResult.error.message}
        {!userResult.ok && ` ${userResult.error.message}`}
        {status}
      </div>
      {error && (
        <p role="alert" className="text-sm text-error dark:text-red-300">
          {error}
        </p>
      )}
      <section aria-labelledby="newest-posts" className="space-y-6">
        <h2 id="newest-posts" className="text-3xl">
          Newest posts
        </h2>
        {posts.length === 0 ? (
          <p className="text-foreground-muted dark:text-slate-300">
            No posts here yet.
          </p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {posts.slice(0, 5).map((post, index) => (
              <li key={post.id} className="min-w-0 space-y-3">
                <BlogCard post={post} index={index} />
                <div className="flex flex-wrap gap-3">
                  <Link
                    to={`/edit/${encodeURIComponent(post.id)}`}
                    aria-label={`Edit ${post.title}`}
                    className={secondaryAction}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete ${post.title}`}
                    className={[
                      'action-secondary dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950',
                      'dark:focus-visible:ring-red-300 dark:focus-visible:ring-offset-slate-950',
                    ].join(' ')}
                    onClick={() => handleDelete(post.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

AdminDashboard.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['Admin', 'user']).isRequired,
  }).isRequired,
};
