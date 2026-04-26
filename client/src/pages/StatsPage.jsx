import React, { useEffect, useState } from 'react';
import { getLeadingScorers, getLeaderboard } from '../services/api';

export default function StatsPage() {
  const [scorers, setScorers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('scorers');

  useEffect(() => {
    const load = async () => {
      try {
        const [scRes, lbRes] = await Promise.all([
          getLeadingScorers().catch(() => ({ success: false })),
          getLeaderboard().catch(() => ({ success: false })),
        ]);
        if (scRes.success) setScorers(scRes.data);
        if (lbRes.success) setLeaderboard(lbRes.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Build popular picks from leaderboard series_details
  const popularPicks = React.useMemo(() => {
    if (!leaderboard.length) return [];
    const first = leaderboard[0];
    if (!first?.series_details) return [];

    return first.series_details.map(sd => {
      const picksForSeries = {};
      const scorerPicks = {};
      for (const entry of leaderboard) {
        const detail = entry.series_details.find(d => d.series_id === sd.series_id);
        if (detail && detail.has_pick && detail.pick_winner) {
          const key = `${detail.pick_winner} in ${detail.pick_games}`;
          picksForSeries[key] = (picksForSeries[key] || 0) + 1;
        }
        if (detail && detail.has_pick && detail.pick_leading_scorer) {
          scorerPicks[detail.pick_leading_scorer] = (scorerPicks[detail.pick_leading_scorer] || 0) + 1;
        }
      }
      const sorted = Object.entries(picksForSeries)
        .map(([pick, count]) => ({ pick, count, pct: Math.round((count / leaderboard.length) * 100) }))
        .sort((a, b) => b.count - a.count);

      const sortedScorers = Object.entries(scorerPicks)
        .map(([pick, count]) => ({ pick, count, pct: Math.round((count / leaderboard.length) * 100) }))
        .sort((a, b) => b.count - a.count);

      return { ...sd, topPicks: sorted.slice(0, 3), topScorers: sortedScorers.slice(0, 3), totalPickers: leaderboard.length };
    });
  }, [leaderboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Stats</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-6">
        <button
          onClick={() => setTab('scorers')}
          className={`px-6 pb-3 text-sm font-semibold transition-colors ${tab === 'scorers' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-white'}`}
        >
          Playoff Scoring Leaders
        </button>
        <button
          onClick={() => setTab('popular')}
          className={`px-6 pb-3 text-sm font-semibold transition-colors ${tab === 'popular' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-white'}`}
        >
          Popular Picks
        </button>
      </div>

      {tab === 'scorers' && (
        <div className="card">
          <p className="text-xs text-gray-500 mb-4">
            Actual playoff scoring leaders so far this postseason.
          </p>
          {scorers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase border-b border-gray-700">
                    <th className="text-left py-3 pr-4 w-8">#</th>
                    <th className="text-left py-3 pr-4">Player</th>
                    <th className="text-left py-3 pr-4">Team</th>
                    <th className="text-right py-3 pr-4">GP</th>
                    <th className="text-right py-3 pr-4">Total Pts</th>
                    <th className="text-right py-3">PPG</th>
                  </tr>
                </thead>
                <tbody>
                  {scorers.map((p, i) => (
                    <tr key={p.player_name} className="border-b border-gray-800 hover:bg-gray-800">
                      <td className="py-2.5 pr-4 text-gray-500 font-medium">{i + 1}</td>
                      <td className="py-2.5 pr-4 text-white font-semibold">{p.player_name}</td>
                      <td className="py-2.5 pr-4 text-gray-400">{p.team}</td>
                      <td className="py-2.5 pr-4 text-right text-gray-300">{p.games_played}</td>
                      <td className="py-2.5 pr-4 text-right font-bold text-orange-400">{p.total_points}</td>
                      <td className="py-2.5 text-right text-gray-300">{p.ppg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm py-4">No scoring data available yet. Stats will populate once playoff games begin.</p>
          )}
        </div>
      )}

      {tab === 'popular' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Most popular picks across all {leaderboard.length} participants.
          </p>
          {popularPicks.length > 0 ? (
            popularPicks.map(s => (
              <div key={s.series_id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white">{s.matchup}</h3>
                  <span className="text-xs text-gray-500">{s.conference}</span>
                </div>
                {s.topPicks.length > 0 ? (
                  <div className="space-y-2">
                    {s.topPicks.map((tp, i) => (
                      <div key={tp.pick} className="flex items-center gap-3">
                        <span className={`text-xs font-bold w-5 ${i === 0 ? 'text-orange-400' : 'text-gray-500'}`}>
                          {i + 1}.
                        </span>
                        <div className="flex-1 bg-gray-800 rounded-full h-6 overflow-hidden">
                          <div
                            className={`h-full rounded-full flex items-center px-3 text-xs font-semibold ${i === 0 ? 'bg-orange-500/30 text-orange-300' : 'bg-gray-700 text-gray-300'}`}
                            style={{ width: `${Math.max(tp.pct, 15)}%` }}
                          >
                            {tp.pick}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 w-16 text-right">
                          {tp.count} ({tp.pct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs">No picks yet</p>
                )}
                {s.topScorers.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-xs text-gray-500 mb-2">Leading Scorer Picks</p>
                    <div className="space-y-1.5">
                      {s.topScorers.map((tp, i) => (
                        <div key={tp.pick} className="flex items-center gap-3">
                          <span className={`text-xs font-bold w-5 ${i === 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                            {i + 1}.
                          </span>
                          <div className="flex-1 bg-gray-800 rounded-full h-6 overflow-hidden">
                            <div
                              className={`h-full rounded-full flex items-center px-3 text-xs font-semibold ${i === 0 ? 'bg-blue-500/30 text-blue-300' : 'bg-gray-700 text-gray-300'}`}
                              style={{ width: `${Math.max(tp.pct, 15)}%` }}
                            >
                              {tp.pick}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 w-16 text-right">
                            {tp.count} ({tp.pct}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {s.is_complete ? (
                  <div className="mt-3 pt-3 border-t border-gray-800 text-xs">
                    <span className="text-gray-500">Result: </span>
                    <span className="text-green-400 font-semibold">
                      {s.result_winner} in {s.result_games}
                    </span>
                    {s.result_leading_scorer && (
                      <span className="text-gray-500 ml-3">
                        Leading scorer: <span className="text-white">{s.result_leading_scorer}</span>
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="card">
              <p className="text-gray-500 text-sm py-4">No picks data available yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
