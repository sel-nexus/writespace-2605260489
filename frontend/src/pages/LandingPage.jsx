/** Introduce the browser-local writing space without fabricating sample posts. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard.jsx';
import { readPosts } from '../lib/storage.js';

const primaryAction = [
  'action-primary dark:bg-primary-300 dark:text-primary-950 dark:hover:bg-primary-200',
  'dark:focus-visible:ring-primary-300 dark:focus-visible:ring-offset-slate-950',
].join(' ');
const secondaryAction = [
  'action-secondary dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800',
  'dark:focus-visible:ring-primary-300 dark:focus-visible:ring-offset-slate-950',
].join(' ');
const footerLink = [
  'nav-link dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  'dark:focus-visible:ring-primary-300 dark:focus-visible:ring-offset-slate-950',
].join(' ');

const features = [
  { title: 'Room to write', text: 'Let an idea become a post. A simple plain-text space keeps the focus on your words.' },
  { title: 'A fresh perspective', text: 'Return to your recent posts and discover the writing already saved in this browser.' },
  { title: 'Your own collection', text: 'Keep your writing together locally. The next visit, in this browser, picks up where you left off.' },
];

/** Rank valid dates ahead of invalid timestamps while preserving ties. */
function timestamp(post) {
  const parsed = Date.parse(post.createdAt);
  return Number.isFinite(parsed) ? parsed : -Infinity;
}

/**
 * Render the public introduction and at most three newest local previews.
 * Returns:
 *   Content-first landing sections with safe empty and read-error states.
 * Notes:
 *   Reads once on mount; rendering, sorting and navigation never mutate storage.
 */
export default function LandingPage() {
  const [result] = useState(readPosts);
  const posts = result.ok ? result.value : [];
  const latest = [...posts].sort((a, b) => {
    const first = timestamp(a);
    const second = timestamp(b);
    return first === second ? 0 : first > second ? -1 : 1;
  }).slice(0, 3);

  return (
    <>
      <main id="main-content" className="dark:text-slate-100">
        <section
          className="hero-paper border-b border-border dark:border-slate-700 dark:bg-slate-900 dark:bg-none"
          aria-labelledby="hero-heading"
        >
          <div className="page-container grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.35fr_1fr]">
            <div>
              <p className="section-label dark:text-slate-300 mb-6">
                A quieter corner of the internet
              </p>
              <h1 id="hero-heading" className="max-w-xl text-5xl leading-[1.08] sm:text-6xl lg:text-7xl">
                Room for{' '}
                <br />
                your words.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-foreground-muted dark:text-slate-300">
                Welcome to WriteSpace. Put your thoughts into words, revisit a favorite idea,
                and make a little space for writing.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link to="/register" className={primaryAction}>
                  Start writing
                </Link>
                <Link to="/login" className={secondaryAction}>
                  Sign in
                </Link>
              </div>
              <p className="mt-5 text-sm text-foreground-muted dark:text-slate-300">
                A local writing demo. Your data stays in this browser.
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm px-3" aria-hidden="true">
              <div
                className="floating-note rounded-card border border-border bg-surface p-8 dark:border-slate-700 dark:bg-slate-900"
              >
                <p className="section-label dark:text-slate-300 mb-8">
                  A note to yourself
                </p>
                <p className="font-display text-3xl leading-snug">
                  Every good story
                  <br />
                  starts with a little space.
                </p>
                <div className="mt-8 space-y-3">
                  <div className="h-px w-full bg-border dark:bg-slate-700" />
                  <div className="h-px w-4/5 bg-border dark:bg-slate-700" />
                  <div className="h-px w-3/5 bg-border dark:bg-slate-700" />
                </div>
                <p className="mt-8 text-sm italic text-foreground-muted dark:text-slate-300">
                  One thought. One sentence. Begin there.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="page-container py-16 sm:py-20" aria-labelledby="features-heading">
          <p className="section-label dark:text-slate-300 mb-3">
            Made for the words that matter
          </p>
          <h2 id="features-heading" className="text-3xl sm:text-4xl">
            Less distraction. More expression.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {features.map((feature, index) => (
              <article key={feature.title} className="rounded-card border border-border p-6 dark:border-slate-700">
                <p className="mb-6 font-mono text-sm text-foreground-muted dark:text-slate-300" aria-hidden="true">
                  0{index + 1}
                </p>
                <h3 className="mb-3 text-2xl">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-foreground-muted dark:text-slate-300">
                  {feature.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="page-container pb-16 sm:pb-24" aria-labelledby="latest-heading">
          <div className="mb-8 border-t border-border pt-12 dark:border-slate-700">
            <p className="section-label dark:text-slate-300 mb-3">
              The latest pages
            </p>
            <h2 id="latest-heading" className="text-3xl sm:text-4xl">
              Recently written
            </h2>
            <p className="mt-3 text-foreground-muted dark:text-slate-300">
              The newest posts saved here, in this browser.
            </p>
          </div>
          {!result.ok && (
            <p role="status" className="mb-5 text-sm text-foreground-muted dark:text-slate-300">
              {result.error.code === 'UNAVAILABLE'
                ? 'Browser storage is unavailable. Local previews cannot be loaded.'
                : 'Local previews could not be read. The stored data has not been changed.'}
            </p>
          )}
          {latest.length ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {latest.map((post, index) => (
                <BlogCard key={post.id} post={post} index={index} />
              ))}
            </div>
          ) : (
            <div className="rounded-card border border-border py-12 text-center dark:border-slate-700">
              <h3 className="text-2xl">
                No posts here yet.
              </h3>
              <p className="mx-auto mt-3 max-w-md px-6 leading-relaxed text-foreground-muted dark:text-slate-300">
                A blank page is a good beginning. Posts saved in this browser will appear here.
              </p>
              <Link
                to="/register"
                className={[
                  'mt-6 inline-flex min-h-11 items-center font-semibold text-primary-700 underline underline-offset-4',
                  'dark:text-primary-300 dark:hover:text-primary-200',
                  'dark:focus-visible:ring-primary-300 dark:focus-visible:ring-offset-slate-950',
                ].join(' ')}
              >
                Write your first post
              </Link>
            </div>
          )}
        </section>
      </main>
      <footer className="border-t border-border dark:border-slate-700 dark:text-slate-100">
        <div className="page-container flex flex-col justify-between gap-8 py-10 sm:flex-row">
          <div className="max-w-xl">
            <p className="font-display text-2xl">
              WriteSpace.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted dark:text-slate-300">
              Browser-local demo only: no cross-device sync or backup. Demo passwords are
              stored in plain text; never use real passwords or sensitive data. Local roles
              are not production security.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-start gap-3">
            <Link to="/" className={footerLink}>
              Explore
            </Link>
            <Link to="/login" className={footerLink}>
              Sign in
            </Link>
            <Link to="/register" className={footerLink}>
              Register
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
