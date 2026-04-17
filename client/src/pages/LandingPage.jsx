import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login as apiLogin, register as apiRegister } from '../services/api';
import { useAuth } from '../hooks/useAuth';

function LoginForm({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      if (res.success) onSuccess(res.data.token);
      else setError(res.error || 'Login failed');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}

function RegisterForm({ onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRegister(name, email, password);
      if (res.success) onSuccess(res.data.token);
      else setError(res.error || 'Registration failed');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Full Name</label>
        <input className="input" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="John Smith" />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 characters" minLength={6} />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
  );
}

export default function LandingPage() {
  const [tab, setTab] = useState('login');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSuccess = (token) => {
    login(token);
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="text-6xl mb-4">🏀</div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-3">
            2025-26 NBA Playoff Pool
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Pick your winners, predict the upsets, and compete with friends across the entire NBA playoffs.
          </p>
        </div>
      </div>

      {/* Auth + Rules */}
      <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-10">
        {/* Auth Card */}
        <div className="card">
          <div className="flex border-b border-gray-700 mb-6">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors ${tab === 'login' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors ${tab === 'register' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-white'}`}
            >
              Register
            </button>
          </div>
          {tab === 'login' ? (
            <LoginForm onSuccess={handleSuccess} />
          ) : (
            <RegisterForm onSuccess={handleSuccess} />
          )}
        </div>

        {/* Rules */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-bold text-white mb-4">How It Works</h2>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex gap-3">
                <span className="text-orange-400 font-bold">1.</span>
                Pay your entry fee to participate in the main pool.
              </li>
              <li className="flex gap-3">
                <span className="text-orange-400 font-bold">2.</span>
                Before each round locks, pick the winner, number of games, and leading scorer for every series.
              </li>
              <li className="flex gap-3">
                <span className="text-orange-400 font-bold">3.</span>
                Accumulate points as the playoffs progress. Tiebreaker: most exact series predictions.
              </li>
              <li className="flex gap-3">
                <span className="text-orange-400 font-bold">4.</span>
                Top finishers are rewarded at the end. A separate scoring leaders side contest runs alongside!
              </li>
            </ul>
          </div>

          <div className="card">
            <h2 className="text-lg font-bold text-white mb-4">Scoring System</h2>
            <p className="text-xs text-gray-500 mb-3">Points increase each round — later rounds are worth more.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase border-b border-gray-700">
                    <th className="text-left py-2 pr-3">Round</th>
                    <th className="text-right py-2 px-2">Winner</th>
                    <th className="text-right py-2 px-2">Games</th>
                    <th className="text-right py-2 px-2">Scorer</th>
                    <th className="text-right py-2 px-2">MVP</th>
                    <th className="text-right py-2 pl-2">Max</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800">
                    <td className="py-2 pr-3 text-white font-medium">Round 1</td>
                    <td className="py-2 px-2 text-right">5</td>
                    <td className="py-2 px-2 text-right">3</td>
                    <td className="py-2 px-2 text-right">3</td>
                    <td className="py-2 px-2 text-right text-gray-600">—</td>
                    <td className="py-2 pl-2 text-right font-bold text-orange-400">88</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 pr-3 text-white font-medium">Round 2</td>
                    <td className="py-2 px-2 text-right">6</td>
                    <td className="py-2 px-2 text-right">4</td>
                    <td className="py-2 px-2 text-right">4</td>
                    <td className="py-2 px-2 text-right text-gray-600">—</td>
                    <td className="py-2 pl-2 text-right font-bold text-orange-400">56</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 pr-3 text-white font-medium">Conf Finals</td>
                    <td className="py-2 px-2 text-right">7</td>
                    <td className="py-2 px-2 text-right">5</td>
                    <td className="py-2 px-2 text-right">5</td>
                    <td className="py-2 px-2 text-right text-green-400">4 × 2</td>
                    <td className="py-2 pl-2 text-right font-bold text-orange-400">42</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-white font-medium">Finals</td>
                    <td className="py-2 px-2 text-right">8</td>
                    <td className="py-2 px-2 text-right">6</td>
                    <td className="py-2 px-2 text-right">6</td>
                    <td className="py-2 px-2 text-right text-green-400">4</td>
                    <td className="py-2 pl-2 text-right font-bold text-orange-400">24</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500 space-y-1">
              <p><span className="text-green-400 font-semibold">MVP Bonus:</span> Pick the Conference Finals MVPs (East & West) and Finals MVP for 4 pts each.</p>
              <p><span className="text-gray-400">Games bonus</span> only applies if you picked the correct winner.</p>
              <p><span className="text-gray-400">Tiebreaker:</span> most exact series predictions (winner + games correct).</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
