/** Keep unknown routes honest and provide a real return destination. */
import { Link } from 'react-router-dom';

/** Render the route fallback without inventing future feature pages. */
export default function NotFound() {
  return (
    <main id="main-content" className="page-container py-24 dark:text-slate-100">
      <p className="section-label mb-4 dark:text-slate-300">
        Page not found
      </p>
      <h1 className="text-4xl sm:text-5xl">
        This page isn’t here.
      </h1>
      <p className="mt-5 max-w-lg text-lg text-foreground-muted dark:text-slate-300">
        Return to WriteSpace to explore the writing saved in this browser.
      </p>
      <Link
        to="/"
        className={[
          'action-primary mt-8 dark:bg-primary-300 dark:text-primary-950 dark:hover:bg-primary-200',
          'dark:focus-visible:ring-primary-300 dark:focus-visible:ring-offset-slate-950',
        ].join(' ')}
      >
        Back to WriteSpace
      </Link>
    </main>
  );
}
