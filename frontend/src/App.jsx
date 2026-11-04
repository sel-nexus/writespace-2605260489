/** Own the single router and confirmed browser-local identity lifecycle. */
import { useState } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import LandingPage from './pages/LandingPage.jsx';
import NotFound from './pages/NotFound.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import Home from './pages/Home.jsx';
import ReadBlog from './pages/ReadBlog.jsx';
import WriteBlog from './pages/WriteBlog.jsx';
import EditBlog from './pages/EditBlog.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import UserManagement from './pages/UserManagement.jsx';
import { getSession, logout } from './lib/auth.js';

/** Initialize identity without repairing storage or authenticating on render. */
function initialSession() {
  const result = getSession();
  return result.ok ? result.value : null;
}

/** Wire public and protected destinations to the confirmed local session. */
function AppRoutes() {
  const [session, setSession] = useState(initialSession);
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();

  /** Retain identity and location if session removal cannot be confirmed. */
  function handleLogout() {
    const result = logout();
    if (!result.ok) {
      setLogoutError(result.error.message);
      return;
    }
    setLogoutError('');
    setSession(null);
    navigate('/', { replace: true });
  }

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-surface focus:p-4">
        Skip to content
      </a>
      <Navbar session={session} onLogout={handleLogout} />
      {logoutError && (
        <p role="alert" className="page-container py-4 text-sm text-error">
          Logout failed. {logoutError}
        </p>
      )}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage session={session} onSessionChange={setSession} />} />
        <Route path="/register" element={<RegisterPage session={session} onSessionChange={setSession} />} />
        <Route element={<ProtectedRoute session={session} />}>
          <Route path="/blogs" element={<Home />} />
          <Route path="/blog/:id" element={session ? <ReadBlog session={session} /> : null} />
          <Route path="/write" element={session ? <WriteBlog session={session} /> : null} />
          <Route path="/edit/:id" element={session ? <EditBlog session={session} /> : null} />
        </Route>
        <Route element={<ProtectedRoute session={session} allowedRoles={['Admin']} />}>
          <Route path="/admin" element={session ? <AdminDashboard session={session} /> : null} />
          <Route path="/users" element={session ? <UserManagement session={session} /> : null} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

/** Provide exactly one browser router for public and protected paths. */
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
