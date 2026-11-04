/** Present every guarded post with shared metadata and newest-first previews. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard.jsx';
import { listPosts } from '../lib/posts.js';

/** Render an honest empty fallback without mutating unreadable storage. */
export default function Home() {
  const [result] = useState(listPosts);
  const posts = result.ok ? result.value : [];
  return (
    <main id="main-content" className="page-container py-16 sm:py-24">
      <header className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-3">
          <p className="section-label">
            From this browser
          </p>
          <h1 className="text-4xl sm:text-5xl">
            Your reading space.
          </h1>
          <p className="text-foreground-muted">
            Words to pause with, ideas to return to.
          </p>
        </div>
        {posts.length > 0 && (
          <Link to="/write" className="action-primary">
            Write a post
          </Link>
        )}
      </header>
      {!result.ok && (
        <p role="status" className="mb-6 text-sm text-foreground-muted">
          {result.error.message} The stored data has not been changed.
        </p>
      )}
      {posts.length ? (
        <section aria-label="All posts" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <BlogCard key={post.id} post={post} index={index} />
          ))}
        </section>
      ) : (
        <section className="space-y-4 border-t border-border py-12">
          <h2 className="text-3xl">
            No posts here yet.
          </h2>
          <p className="text-foreground-muted">
            Give your first thought a place on the page.
          </p>
          <Link to="/write" className="action-primary">
            Write a post
          </Link>
        </section>
      )}
    </main>
  );
}
