import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getCurrentRound, getLeaderboard, getScoringLeaders } from '../services/api';

function Countdown({ lockDatetime }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [locked, setLocked] = useState(false);

  const calc = useCallback(() => {
    const now = new Date();
    const lock = new Date(lockDatetime);
    const diff = lock - now;
    if (diff <= 0) {
      setLocked(true);
      setTimeLeft(null);
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    setTimeLeft({ days, hours, minutes, seconds });
  }, [lockDatetime]);

  useEffect(() => {
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [calc]);

  if (locked) {
    return (
      <div className="text-red-400 font-semibold text-sm">
        Picks are locked
      </div>
    );
  }

  if (!timeLeft) return null;

  const pad = n => String(n).padStart(2, '0');

  return (
    <div className="flex items-center gap-3">
      {[
        { label: 'Days', val: timeLeft.days },
        { label: 'Hrs', val: timeLeft.hours },
        { label: 'Min', val: timeLeft.minutes },
        { label: 'Sec', val: timeLeft.seconds },
      ].map(({ label, val }) => (
        <div key={label} className="text-center">
          <div className="text-2xl font-bold text-orange-400 tabular-nums">{pad(val)}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [round, setRound] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [scoringLeaders, setScoringLeaders] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [rRes, lbRes, slRes] = await Promise.all([
          getCurrentRound().catch(() => null),
          getLeaderboard().catch(() => ({ data: [] })),
          getScoringLeaders().catch(() => ({ data: [] })),
        ]);
        if (rRes?.success) setRound(rRes.data);
        if (lbRes?.success) {
          setLeaderboard(lbRes.data.slice(0, 5));
          const me = lbRes.data.find(e => e.user_id === user?.id);
          if (me) setMyRank(me);
        }
        if (slRes?.success) setScoringLeaders(slRes.data.slice(0, 5));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const isLocked = round && round.picks_lock_datetime && new Date() > new Date(round.picks_lock_datetime);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white">
          Welcome back, <span className="text-orange-400">{user?.name}</span>!
        </h1>
        <p className="text-gray-400 mt-1">2025-26 NBA Playoff Pool</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Current Round Card */}
        <div className="card">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide font-semibold mb-3">Current Round</h2>
          {round ? (
            <>
              <h3 className="text-xl font-bold text-white mb-2">{round.name}</h3>
              {round.picks_lock_datetime ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    {isLocked ? 'Locked on' : 'Locks in'}
                  </p>
                  <Countdown lockDatetime={round.picks_lock_datetime} />
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No lock time set</p>
              )}
              {!isLocked && (
                <Link to="/picks" className="btn-primary inline-block mt-4 text-sm">
                  Submit Picks
                </Link>
              )}
              {isLocked && (
                <Link to="/my-picks" className="btn-secondary inline-block mt-4 text-sm">
                  View My Picks
                </Link>
              )}
            </>
          ) : (
            <p className="text-gray-400">No active round</p>
          )}
        </div>

        {/* My Standing */}
        <div className="card">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide font-semibold mb-3">My Standing</h2>
          {myRank ? (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl font-extrabold text-orange-400">#{myRank.rank}</div>
                <div className="text-xs text-gray-500 mt-1">Rank</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-extrabold text-white">{myRank.total_points}</div>
                <div className="text-xs text-gray-500 mt-1">Points</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-extrabold text-green-400">{myRank.exact_series_count}</div>
                <div className="text-xs text-gray-500 mt-1">Exact Picks</div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-400 text-sm mb-3">No picks submitted yet</p>
              <Link to="/picks" className="btn-primary inline-block text-sm">Make Your Picks</Link>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboards — Main Event + Side Pot */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Main Event Top 5 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm text-gray-400 uppercase tracking-wide font-semibold">Main Event — Top 5</h2>
            <Link to="/leaderboard" className="text-orange-400 text-sm hover:text-orange-300">View All →</Link>
          </div>
          {leaderboard.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase">
                    <th className="text-left py-2 pr-4">Rank</th>
                    <th className="text-left py-2 pr-4">Name</th>
                    <th className="text-right py-2 pr-4">Points</th>
                    <th className="text-right py-2">Exact</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <tr key={entry.user_id} className={`border-t border-gray-800 hover:bg-gray-800 ${entry.user_id === user?.id ? 'bg-orange-950/30' : ''}`}>
                      <td className="py-2 pr-4 font-bold text-gray-300">#{entry.rank}</td>
                      <td className="py-2 pr-4 text-white font-medium">
                        {entry.name}
                        {entry.user_id === user?.id && <span className="ml-1 text-orange-400 text-xs">(you)</span>}
                      </td>
                      <td className="py-2 pr-4 text-right font-bold text-orange-400">{entry.total_points}</td>
                      <td className="py-2 text-right text-gray-400">{entry.exact_series_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No picks submitted yet. Be the first!</p>
          )}
        </div>

        {/* Side Pot Top 5 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm text-gray-400 uppercase tracking-wide font-semibold">Scoring Leaders — Top 5</h2>
            <Link to="/leaderboard" className="text-orange-400 text-sm hover:text-orange-300">View All →</Link>
          </div>
          {scoringLeaders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase">
                    <th className="text-left py-2 pr-4">Rank</th>
                    <th className="text-left py-2 pr-4">Name</th>
                    <th className="text-right py-2 pr-4">Correct</th>
                    <th className="text-right py-2">TB Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {scoringLeaders.map((entry) => (
                    <tr key={entry.user_id} className={`border-t border-gray-800 hover:bg-gray-800 ${entry.user_id === user?.id ? 'bg-orange-950/30' : ''}`}>
                      <td className="py-2 pr-4 font-bold text-gray-300">#{entry.rank}</td>
                      <td className="py-2 pr-4 text-white font-medium">
                        {entry.name}
                        {entry.user_id === user?.id && <span className="ml-1 text-orange-400 text-xs">(you)</span>}
                      </td>
                      <td className="py-2 pr-4 text-right font-bold text-orange-400">{entry.correct_scorer_picks}</td>
                      <td className="py-2 text-right text-gray-400">{entry.tiebreaker_points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No scoring data yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
