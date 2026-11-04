/** Keep unknown routes honest and provide a real return destination. */
import { Link } from 'react-router-dom';

/** Render the route fallback without inventing future feature pages. */
export default function NotFound() {
  return (
    <main id="main-content" className="page-container py-24">
      <p className="section-label mb-4">
        Page not found
      </p>
      <h1 className="text-4xl sm:text-5xl">
        This page isn’t here.
      </h1>
      <p className="mt-5 max-w-lg text-lg text-foreground-muted">
        Return to WriteSpace to explore the writing saved in this browser.
      </p>
      <Link to="/" className="action-primary mt-8">
        Back to WriteSpace
      </Link>
    </main>
  );
}
