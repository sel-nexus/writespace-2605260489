/** Render shared plain-text previews with a repeating quiet evergreen accent. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';

const accents = ['preview-accent-0', 'preview-accent-1', 'preview-accent-2'];

/**
 * Show a post title, author, date and an excerpt capped at 120 content characters.
 * Args:
 *   post: Validated browser-local post record.
 *   index: Position in the list, used for a repeating accent sequence.
 * Returns:
 *   A real detail link; invalid timestamps display a readable fallback.
 */
export function BlogCard({ post, index = 0 }) {
  const date = new Date(post.createdAt);
  const validDate = Number.isFinite(date.getTime());
  const characters = Array.from(post.content);
  const excerpt = characters.slice(0, 120).join('');
  const accent = accents[((index % accents.length) + accents.length) % accents.length];
  return (
    <article className={`flex min-w-0 flex-col rounded-card border border-border border-t-2 bg-surface p-6 ${accent}`}>
      <div className="mb-6 flex items-center gap-3">
        <Avatar name={post.authorAvatar} />
        <div className="min-w-0 text-sm">
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
      <h3 className="mb-3 break-words text-2xl leading-tight">
        <Link to={`/blog/${encodeURIComponent(post.id)}`} className="hover:text-primary-700 hover:underline">
          {post.title}
        </Link>
      </h3>
      <p className="break-words text-base leading-relaxed text-foreground-muted">
        {excerpt}{characters.length > 120 ? '…' : ''}
      </p>
      <p className="mt-auto pt-6 text-xs uppercase tracking-widest text-foreground-muted">
        From this browser
      </p>
    </article>
  );
}

BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    authorName: PropTypes.string.isRequired,
    authorAvatar: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number,
};
