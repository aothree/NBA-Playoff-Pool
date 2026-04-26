import React from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PicksSubmissionPage from './pages/PicksSubmissionPage';
import LeaderboardPage from './pages/LeaderboardPage';
import StatsPage from './pages/StatsPage';
import MyPicksPage from './pages/MyPicksPage';
import AdminPanel from './pages/AdminPanel';

function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors ${
        location.pathname === to ? 'text-orange-400' : 'text-gray-300 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-gray-900 border-b border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🏀</span>
              <span className="font-bold text-white text-sm sm:text-base hidden sm:block">
                NBA Playoff Pool
              </span>
            </Link>
            <div className="flex items-center gap-4">
              {navLink('/leaderboard', 'Leaderboard')}
              {isAuthenticated && (
                <Link
                  to="/picks"
                  className={`text-sm font-semibold px-3 py-1 rounded-full transition-colors ${
                    location.pathname === '/picks'
                      ? 'bg-orange-500 text-white'
                      : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                  }`}
                >
                  Submit Picks
                </Link>
              )}
              {navLink('/stats', 'Stats')}
              {isAuthenticated && navLink('/my-picks', 'My Pick History')}
              {isAdmin && navLink('/admin', 'Admin')}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-gray-400 hidden sm:block">
                  {user?.name}
                  {isAdmin && <span className="ml-1 text-orange-400 text-xs">(admin)</span>}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-300 hover:text-white">Login</Link>
                <Link to="/register" className="btn-primary text-sm py-1.5 px-3">Register</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/leaderboard" replace /> : <LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/picks" element={
          <ProtectedRoute><PicksSubmissionPage /></ProtectedRoute>
        } />
        <Route path="/my-picks" element={
          <ProtectedRoute><MyPicksPage /></ProtectedRoute>
        } />
        <Route path="/admin/*" element={
          <ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>
        } />
      </Routes>
    </div>
  );
}
