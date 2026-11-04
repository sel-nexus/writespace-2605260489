/** Recheck route-level ownership and preserve post metadata while editing text. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { PostForm } from '../components/PostForm.jsx';
import { PostNotFound } from './ReadBlog.jsx';
import { getPost, updatePost } from '../lib/posts.js';
import { canManagePost } from '../lib/permissions.js';

/** Remount loaded form state when the requested post identity changes. */
export default function EditBlog({ session }) {
  const { id } = useParams();
  return <PostEditor key={id} id={id} session={session} />;
}

EditBlog.propTypes = { session: PropTypes.object.isRequired };

/** Deny nonowners on entry and again at submission without changing the record. */
function PostEditor({ id, session }) {
  const [result] = useState(() => getPost(id));
  const navigate = useNavigate();
  const post = result.ok ? result.value : null;

  /** Re-read the target through the domain and redirect only permission failures. */
  function handleSave(input) {
    const saved = updatePost(id, input, session);
    if (!saved.ok && saved.error.code === 'FORBIDDEN') navigate('/blogs', { replace: true });
    return saved;
  }

  /** Return to details only after a confirmed update. */
  function handleSaved(saved) {
    navigate(`/blog/${encodeURIComponent(saved.id)}`, { replace: true });
  }

  if (!post) return <PostNotFound message={result.ok ? '' : result.error.message} />;
  if (!canManagePost(session, post)) return <Navigate to="/blogs" replace />;
  return (
    <main id="main-content" className="page-container py-16 sm:py-24">
      <div className="mx-auto max-w-prose space-y-8">
        <h1 className="text-4xl sm:text-5xl">
          Edit your words.
        </h1>
        <PostForm
          initialInput={{ title: post.title, content: post.content }}
          onSave={handleSave}
          onSaved={handleSaved}
          submitLabel="Save changes"
          cancelTo={`/blog/${encodeURIComponent(id)}`}
        />
      </div>
    </main>
  );
}

PostEditor.propTypes = { id: PropTypes.string.isRequired, session: PropTypes.object.isRequired };
