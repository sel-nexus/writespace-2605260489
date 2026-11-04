# WriteSpace

A content-first writing demonstration built with React 18, Vite, JavaScript JSX, React Router v6 and Tailwind. Explore recent posts, register/sign in, write and manage plain-text posts, or use the Admin dashboard to manage local accounts.

## Important limitations
This is intentionally a **browser-local demo**, not secure production authentication. Posts, accounts and sessions are saved only in this browser profile and origin. Passwords are plaintext; the fixed demo credential is **admin / admin**. Never enter real passwords or sensitive data. Client-side roles and ownership checks can be bypassed by anyone controlling the browser. There is no backend, database, cross-device synchronization or backup. Clearing storage loses the only copy. Multiple tabs can overwrite stale data. Registration writes two keys without a transaction; failures are reported rather than claiming success.

## Run locally
Requires Node 20+ and npm. From `frontend/`:

```sh
npm ci --no-bin-links
cp .env.example .env
npm run dev -- --host 0.0.0.0
```

`VITE_PORT` and `VITE_BASE_URL` configure the development/test server. These are public build/test settings, never secrets. The SPA itself makes no application API requests. Font stylesheets are downloaded from Google Fonts with local font fallbacks.

## Checks
From `frontend/`:

```sh
npm test
npm run build
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e -- --workers=1
```

The Node entry scripts work without npm binary symlinks. If npm suppresses esbuild postinstall in a restricted environment, run `node node_modules/esbuild/install.js` to install its native binary before building.

Verified in this change run: 680 unit/component tests passed (594 baseline plus 86 new cases). All 162 browser cases passed across the full run and a targeted rerun at 390, 768 and 1280px: the initial run passed 159, and a corrected dynamic-name test locator resolved the remaining three. No assertions were removed. Tests capture uncaught browser/console errors. Independent critic passed in round two with score 1.0 and zero high failures. Production build succeeded. Rendered accessibility/HTML/style evidence and screenshots are separate pipeline artifacts.

## Theme preference
Use “Switch to dark mode” or “Switch to light mode” in public or signed-in navigation (open the mobile menu on small screens). The root-owned preference changes immediately and is saved as the raw `light`/`dark` string under `writespace_theme`. Missing, invalid or unreadable values default to light; failed writes retain the current view but cannot guarantee reload persistence. Logout does not clear the preference. There is no operating-system or cross-tab synchronization. Existing account fields, post records, permissions and routes are unchanged; the content counter remains informational without a maximum.

Dependency installation reported nine inherited npm audit findings (2 moderate, 5 high, 2 critical). This scoped UI change does not force dependency upgrades; review those before broader production use.

## Routes and code
Public `/`, `/login`, `/register`; signed-in `/blogs`, `/blog/:id`, `/write`, `/edit/:id`; Admin `/admin`, `/users`. Unknown paths provide a return link. One router owns navigation. `src/lib/storage.js` centralizes guarded localStorage operations; auth/posts/accounts enforce repeated domain validation and permissions; page components own explicit input actions. Keys are `writespace_posts`, `writespace_users`, `writespace_session`. UUIDs use browser `crypto.randomUUID()` and require a supported secure context.

The Admin metric `Total users` deliberately repeats `Total Users`; its separate meaning was not defined upstream. The seeded Admin is presented separately from stored accounts and protected from deletion; the active account is also protected.

## Static container and AWS handoff
From repository root:

```sh
docker build -t writespace frontend
docker run --rm -p 8080:80 writespace
```

The multistage Dockerfile builds Vite assets and nginx serves them on `0.0.0.0:80`. `/` serves the SPA entry; nginx `try_files` handles direct client routes without a backend proxy. Docker image execution was not verified in this stage. The downstream AWS pipeline owns ECR, ECS, ALB, CloudFront and CloudFormation. HTTPS, edge caching, deployed health checks and deep-route smoke checks must be verified there; no deployment is claimed here. Static task restarts neither back up nor synchronize browser data.

The repository includes the final code graph. Pipeline plan, worklist, test report and publication metadata are separate workspace deliverables and excluded from Git.
