import React, { useEffect, useState } from 'react';
import { getLeaderboard, getScoringLeaders } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const ROUND_LABELS = { 1: 'R1', 2: 'R2', 3: 'CF', 4: 'Finals' };
const ALL_ROUNDS = [1, 2, 3, 4];

function MainEventTable({ data, currentUser }) {
  const [expanded, setExpanded] = useState({});

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (!data.length) {
    return <p className="text-gray-500 text-sm py-4">No picks submitted yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase border-b border-gray-700">
            <th className="text-left py-3 pr-4 w-8">Rank</th>
            <th className="text-left py-3 pr-4">Name</th>
            <th className="text-right py-3 pr-4">Total</th>
            {ALL_ROUNDS.map(r => (
              <th key={r} className="text-right py-3 pr-4">{ROUND_LABELS[r]}</th>
            ))}
            <th className="text-right py-3">Exact</th>
          </tr>
        </thead>
        <tbody>
          {data.map(entry => (
            <React.Fragment key={entry.user_id}>
              <tr
                className={`border-b border-gray-800 cursor-pointer hover:bg-gray-800 ${entry.user_id === currentUser?.id ? 'bg-orange-950/20' : ''}`}
                onClick={() => toggle(entry.user_id)}
              >
                <td className="py-3 pr-4 font-bold text-gray-400">#{entry.rank}</td>
                <td className="py-3 pr-4 font-semibold text-white">
                  {entry.name}
                  {entry.user_id === currentUser?.id && <span className="ml-1 text-orange-400 text-xs">(you)</span>}
                  <span className="ml-2 text-gray-600 text-xs">{expanded[entry.user_id] ? '▲' : '▼'}</span>
                </td>
                <td className="py-3 pr-4 text-right font-bold text-orange-400">{entry.total_points}</td>
                {ALL_ROUNDS.map(r => (
                  <td key={r} className="py-3 pr-4 text-right text-gray-300">
                    {entry.round_totals[r] ?? '—'}
                  </td>
                ))}
                <td className="py-3 text-right text-gray-300">{entry.exact_series_count}</td>
              </tr>
              {expanded[entry.user_id] && (
                <tr className="border-b border-gray-800">
                  <td colSpan={5 + ALL_ROUNDS.length} className="pb-3 px-2">
                    <div className="bg-gray-800/50 rounded-lg overflow-hidden mt-1">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 uppercase border-b border-gray-700">
                            <th className="text-left py-2 px-3">Matchup</th>
                            <th className="text-left py-2 px-3">Pick</th>
                            <th className="text-left py-2 px-3">Scorer Pick</th>
                            <th className="text-left py-2 px-3">Result</th>
                            <th className="text-right py-2 px-3">Win</th>
                            <th className="text-right py-2 px-3">Games</th>
                            <th className="text-right py-2 px-3">Scorer</th>
                            <th className="text-right py-2 px-3">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.series_details.map(sd => {
                            const pending = !sd.is_complete;
                            const pickStr = sd.pick_winner ? `${sd.pick_winner} in ${sd.pick_games}` : '—';
                            const resultStr = sd.result_winner ? `${sd.result_winner} in ${sd.result_games}` : '—';
                            return (
                              <tr key={sd.series_id} className="border-b border-gray-700/50">
                                <td className="py-2 px-3 text-gray-300">{sd.matchup}</td>
                                <td className="py-2 px-3 text-gray-200">{pickStr}</td>
                                <td className="py-2 px-3 text-gray-300">{sd.pick_leading_scorer || '—'}</td>
                                <td className={`py-2 px-3 ${pending ? 'text-gray-500' : 'text-green-400'}`}>
                                  {resultStr}
                                </td>
                                <td className={`py-2 px-3 text-right font-bold ${sd.points_winner > 0 ? 'text-green-400' : pending ? 'text-gray-500' : 'text-red-400'}`}>
                                  {pending ? '—' : sd.points_winner}
                                </td>
                                <td className={`py-2 px-3 text-right font-bold ${sd.points_games > 0 ? 'text-green-400' : pending ? 'text-gray-500' : 'text-red-400'}`}>
                                  {pending ? '—' : sd.points_games}
                                </td>
                                <td className={`py-2 px-3 text-right font-bold ${sd.points_scorer > 0 ? 'text-green-400' : pending ? 'text-gray-500' : 'text-red-400'}`}>
                                  {pending ? '—' : sd.points_scorer}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-white">
                                  {pending ? '—' : sd.points_total}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoringLeadersTable({ data, currentUser }) {
  if (!data.length) return <p className="text-gray-500 text-sm py-4">No data yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase border-b border-gray-700">
            <th className="text-left py-3 pr-4">Rank</th>
            <th className="text-left py-3 pr-4">Name</th>
            <th className="text-right py-3 pr-4">Correct Scorer Picks</th>
            <th className="text-right py-3">Tiebreaker Pts</th>
          </tr>
        </thead>
        <tbody>
          {data.map(entry => (
            <tr key={entry.user_id} className={`border-b border-gray-800 hover:bg-gray-800 ${entry.user_id === currentUser?.id ? 'bg-orange-950/20' : ''}`}>
              <td className="py-3 pr-4 font-bold text-gray-400">#{entry.rank}</td>
              <td className="py-3 pr-4 font-semibold text-white">
                {entry.name}
                {entry.user_id === currentUser?.id && <span className="ml-1 text-orange-400 text-xs">(you)</span>}
              </td>
              <td className="py-3 pr-4 text-right font-bold text-orange-400">{entry.correct_scorer_picks}</td>
              <td className="py-3 text-right text-gray-300">{entry.tiebreaker_points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LeaderboardPage() {
  const [mainData, setMainData] = useState([]);
  const [scorerData, setScorerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        const [lbRes, slRes] = await Promise.all([
          getLeaderboard(),
          getScoringLeaders(),
        ]);
        if (lbRes.success) setMainData(lbRes.data);
        if (slRes.success) setScorerData(slRes.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Leaderboard</h1>
        <div className="card"><div className="text-gray-400 py-4">Loading...</div></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Leaderboard</h1>

      {/* Main Event Leaderboard */}
      <div className="card">
        <h2 className="text-sm font-bold text-orange-400 uppercase mb-1">Main Event</h2>
        <div className="text-xs text-gray-500 mb-4">
          Click any row to expand per-series breakdown. Tiebreaker: Exact series picks (winner + games correct).
        </div>
        <MainEventTable data={mainData} currentUser={user} />
      </div>

      {/* Scoring Leaders */}
      <div className="card mt-6">
        <h2 className="text-sm font-bold text-orange-400 uppercase mb-1">Scoring Leaders</h2>
        <div className="text-xs text-gray-500 mb-4">
          Tiebreaker: total playoff points scored by correctly-picked scorers.
        </div>
        <ScoringLeadersTable data={scorerData} currentUser={user} />
      </div>

      {/* Scoring Guide — distinct background */}
      <div className="mt-6 rounded-xl border border-orange-900/40 bg-orange-950/20 p-5">
        <h2 className="text-sm font-bold text-orange-400 uppercase mb-3">Scoring Guide</h2>
        <p className="text-xs text-gray-400 mb-3">Points increase each round. Games bonus only counts if winner is correct.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase border-b border-orange-900/30">
                <th className="text-left py-2 pr-2">Round</th>
                <th className="text-right py-2 px-2">Winner</th>
                <th className="text-right py-2 px-2">Games</th>
                <th className="text-right py-2 px-2">Scorer</th>
                <th className="text-right py-2 px-2">MVP</th>
                <th className="text-right py-2 pl-2">Max</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-orange-900/20">
                <td className="py-1.5 pr-2 text-white">R1</td>
                <td className="py-1.5 px-2 text-right text-orange-400 font-bold">5</td>
                <td className="py-1.5 px-2 text-right">3</td>
                <td className="py-1.5 px-2 text-right">3</td>
                <td className="py-1.5 px-2 text-right text-gray-600">—</td>
                <td className="py-1.5 pl-2 text-right font-bold">88</td>
              </tr>
              <tr className="border-b border-orange-900/20">
                <td className="py-1.5 pr-2 text-white">R2</td>
                <td className="py-1.5 px-2 text-right text-orange-400 font-bold">6</td>
                <td className="py-1.5 px-2 text-right">4</td>
                <td className="py-1.5 px-2 text-right">4</td>
                <td className="py-1.5 px-2 text-right text-gray-600">—</td>
                <td className="py-1.5 pl-2 text-right font-bold">56</td>
              </tr>
              <tr className="border-b border-orange-900/20">
                <td className="py-1.5 pr-2 text-white">CF</td>
                <td className="py-1.5 px-2 text-right text-orange-400 font-bold">7</td>
                <td className="py-1.5 px-2 text-right">5</td>
                <td className="py-1.5 px-2 text-right">5</td>
                <td className="py-1.5 px-2 text-right text-green-400">4 × 2</td>
                <td className="py-1.5 pl-2 text-right font-bold">42</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-2 text-white">Finals</td>
                <td className="py-1.5 px-2 text-right text-orange-400 font-bold">8</td>
                <td className="py-1.5 px-2 text-right">6</td>
                <td className="py-1.5 px-2 text-right">6</td>
                <td className="py-1.5 px-2 text-right text-green-400">4</td>
                <td className="py-1.5 pl-2 text-right font-bold">24</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
