import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyPicks } from '../services/api';
import { useAuth } from '../hooks/useAuth';

function PickCard({ s }) {
  const hasPick = !!s.pick_id;
  const hasResult = !!s.wt_name;
  const pending = !s.is_complete;

  const pickStr = hasPick ? `${s.pick_winner_name} in ${s.pick_games}` : null;
  const resultStr = hasResult ? `${s.wt_name} in ${s.result_games}` : null;

  const winnerCorrect = hasPick && hasResult && s.pick_winner_team_id === s.result_winner_team_id;
  const gamesCorrect = winnerCorrect && s.pick_games === s.result_games;

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border ${hasResult ? (winnerCorrect ? 'border-green-700/50' : 'border-red-700/50') : 'border-gray-700'}`}>
      {/* Matchup header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-gray-500 uppercase font-semibold">{s.conference}</span>
          <h3 className="text-sm font-bold text-white mt-0.5">
            ({s.ht_seed}) {s.ht_name} vs ({s.lt_seed}) {s.lt_name}
          </h3>
        </div>
        {hasResult && (
          <div className={`text-xs font-bold px-2 py-1 rounded ${winnerCorrect ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
            {s.score_total != null ? `${s.score_total} pts` : '—'}
          </div>
        )}
      </div>

      {/* Pick + Result rows */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-xs w-20">Your pick:</span>
          {hasPick ? (
            <span className="text-white font-medium">{pickStr}</span>
          ) : (
            <span className="text-gray-600 italic">No pick submitted</span>
          )}
        </div>
        {hasPick && s.pick_leading_scorer && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs w-20">Scorer:</span>
            <span className="text-gray-300">{s.pick_leading_scorer}</span>
          </div>
        )}
        {hasResult && (
          <>
            <div className="border-t border-gray-700 pt-2 flex items-center justify-between">
              <span className="text-gray-500 text-xs w-20">Result:</span>
              <span className="text-green-400 font-medium">{resultStr}</span>
            </div>
            {s.result_leading_scorer && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs w-20">Scorer:</span>
                <span className="text-green-300">{s.result_leading_scorer}</span>
              </div>
            )}
            {/* Point breakdown */}
            <div className="border-t border-gray-700 pt-2 flex items-center gap-4 text-xs">
              <div>
                <span className="text-gray-500">Winner: </span>
                <span className={s.points_winner > 0 ? 'text-green-400 font-bold' : 'text-red-400'}>
                  {s.points_winner > 0 ? `+${s.points_winner}` : '0'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Games: </span>
                <span className={s.points_games > 0 ? 'text-green-400 font-bold' : 'text-red-400'}>
                  {s.points_games > 0 ? `+${s.points_games}` : '0'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Scorer: </span>
                <span className={s.points_scorer > 0 ? 'text-green-400 font-bold' : 'text-red-400'}>
                  {s.points_scorer > 0 ? `+${s.points_scorer}` : '0'}
                </span>
              </div>
            </div>
          </>
        )}
        {pending && hasPick && (
          <div className="text-xs text-gray-500 italic pt-1">Series in progress — awaiting result</div>
        )}
      </div>
    </div>
  );
}

export default function MyPicksPage() {
  const { user } = useAuth();
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getMyPicks();
        if (res.success) setRounds(res.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Compute total points across all series
  const totalPoints = rounds.reduce((sum, r) =>
    sum + r.series.reduce((s2, s) => s2 + (s.score_total || 0), 0), 0
  );

  const totalPicks = rounds.reduce((sum, r) =>
    sum + r.series.filter(s => s.pick_id).length, 0
  );

  const totalSeries = rounds.reduce((sum, r) => sum + r.series.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Pick History</h1>
          <p className="text-gray-400 text-sm mt-1">{user?.name}'s playoff picks</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-extrabold text-orange-400">{totalPoints}</div>
            <div className="text-xs text-gray-500">Total Pts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-extrabold text-white">{totalPicks}/{totalSeries}</div>
            <div className="text-xs text-gray-500">Picks Made</div>
          </div>
        </div>
      </div>

      {rounds.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 mb-4">You haven't submitted any picks yet.</p>
          <Link to="/picks" className="btn-primary inline-block text-sm">Submit Picks</Link>
        </div>
      ) : (
        rounds.map(round => {
          const roundPts = round.series.reduce((s, sr) => s + (sr.score_total || 0), 0);
          const isLocked = round.picks_lock_datetime && new Date() > new Date(round.picks_lock_datetime);

          return (
            <div key={round.id} className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-white">{round.name}</h2>
                  {isLocked ? (
                    <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded font-medium">Locked</span>
                  ) : (
                    <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded font-medium">Open</span>
                  )}
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Round total: </span>
                  <span className="text-orange-400 font-bold">{roundPts} pts</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {round.series.map(s => (
                  <PickCard key={s.id} s={s} />
                ))}
              </div>

              {!isLocked && (
                <div className="mt-3 text-right">
                  <Link to="/picks" className="text-orange-400 hover:text-orange-300 text-sm font-medium">
                    Edit Picks →
                  </Link>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
