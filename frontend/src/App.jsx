/** Own the single router and read-only local session presentation. */
import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar.jsx';
import LandingPage from './pages/LandingPage.jsx';
import NotFound from './pages/NotFound.jsx';
import { readSession } from './lib/storage.js';

/** Initialize navbar identity safely without implementing the account lifecycle. */
function initialSession() {
  const result = readSession();
  return result.ok ? result.value : null;
}

/** Render only landing and not-found routes in this public exploration slice. */
export default function App() {
  const [session] = useState(initialSession);
  return (
    <BrowserRouter>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-surface focus:p-4">
        Skip to content
      </a>
      <Navbar session={session} />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
