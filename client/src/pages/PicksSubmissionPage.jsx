import React, { useEffect, useState, useRef } from 'react';
import { getRoundSeries, getCurrentRound, getMyPicksForRound, submitPick } from '../services/api';
import PlayerSearchDropdown from '../components/PlayerSearchDropdown';

function SeriesCard({ series, pickSelection, leadingScorer, savedPick, isLocked, lockDatetime, onChange }) {
  const { higher_seed_team, lower_seed_team } = series;

  const outcomes = [
    `${higher_seed_team.name} in 4`,
    `${higher_seed_team.name} in 5`,
    `${higher_seed_team.name} in 6`,
    `${higher_seed_team.name} in 7`,
    `${lower_seed_team.name} in 4`,
    `${lower_seed_team.name} in 5`,
    `${lower_seed_team.name} in 6`,
    `${lower_seed_team.name} in 7`,
  ];

  const allPlayers = [
    ...higher_seed_team.players.map(p => ({ ...p, team_name: higher_seed_team.abbreviation })),
    ...lower_seed_team.players.map(p => ({ ...p, team_name: lower_seed_team.abbreviation })),
  ];

  // Determine visual state
  const isSaved = !!savedPick;
  const hasUnsavedChanges = pickSelection && (
    !isSaved ||
    pickSelection !== savedPick?.pickSelection ||
    leadingScorer !== (savedPick?.leadingScorer || '')
  );

  const confBadge = series.conference === 'East'
    ? 'bg-blue-900/50 text-blue-300'
    : 'bg-red-900/50 text-red-300';

  // Border color: green if saved & no changes, orange if unsaved changes, default otherwise
  let borderClass = 'border-gray-700';
  if (isSaved && !hasUnsavedChanges) borderClass = 'border-green-700/60';
  else if (hasUnsavedChanges) borderClass = 'border-orange-700/60';

  return (
    <div className={`card relative ${borderClass} ${isLocked ? 'opacity-75' : ''}`}>
      {/* Saved badge */}
      {isSaved && !hasUnsavedChanges && (
        <div className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-900/40 px-2 py-0.5 rounded-full">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          Saved
        </div>
      )}
      {hasUnsavedChanges && (
        <div className="absolute top-3 right-3 text-xs font-semibold text-orange-400 bg-orange-900/40 px-2 py-0.5 rounded-full">
          Unsaved
        </div>
      )}

      {/* Header */}
      <div className="mb-4 pr-16">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${confBadge}`}>
          {series.conference}ern Conference
        </span>
        <h3 className="text-base font-bold text-white mt-1">
          ({higher_seed_team.seed}) {higher_seed_team.name}{' '}
          <span className="text-gray-500">vs</span>{' '}
          ({lower_seed_team.seed}) {lower_seed_team.name}
        </h3>
        {/* Per-series lock info */}
        {lockDatetime && (
          <p className="text-xs text-gray-500 mt-0.5">
            {isLocked ? 'Locked' : `Locks: ${new Date(lockDatetime).toLocaleString()}`}
          </p>
        )}
      </div>

      {isLocked ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Your pick:</span>
            <span className="text-white font-medium">{pickSelection || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Leading scorer pick:</span>
            <span className="text-white font-medium">{leadingScorer || '—'}</span>
          </div>
          {series.is_complete && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-400">Result:</span>
                <span className="text-green-400 font-medium">
                  {series.result_winner_name} in {series.result_games}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="label">Series Outcome</label>
            <select
              className="input"
              value={pickSelection}
              onChange={e => onChange(series.id, 'pickSelection', e.target.value)}
            >
              <option value="">-- Select winner and games --</option>
              <optgroup label={`${higher_seed_team.name} wins`}>
                {outcomes.slice(0, 4).map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </optgroup>
              <optgroup label={`${lower_seed_team.name} wins`}>
                {outcomes.slice(4).map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="label">Leading Scorer</label>
            <PlayerSearchDropdown
              players={allPlayers}
              value={leadingScorer}
              onChange={val => onChange(series.id, 'leadingScorer', val)}
              disabled={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PicksSubmissionPage() {
  const [round, setRound] = useState(null);
  const [seriesList, setSeriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Local draft state: { [seriesId]: { pickSelection, leadingScorer } }
  const [drafts, setDrafts] = useState({});
  // What the server has confirmed saved: same shape
  const [savedPicks, setSavedPicks] = useState({});

  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // { type: 'success'|'error', text }
  const bottomRef = useRef(null);

  // Per-series lock check: series lock takes priority, then round lock
  const getSeriesLockDatetime = (series) => {
    return series.picks_lock_datetime || round?.picks_lock_datetime || null;
  };

  const isSeriesLocked = (series) => {
    const lockDt = getSeriesLockDatetime(series);
    return lockDt ? new Date() > new Date(lockDt) : false;
  };

  // Check if ALL series are locked (for the overall banner)
  const allLocked = seriesList.length > 0 && seriesList.every(s => isSeriesLocked(s));

  useEffect(() => {
    const loadData = async () => {
      try {
        const rRes = await getCurrentRound();
        if (!rRes.success) { setError('No active round'); return; }
        const roundData = rRes.data;
        setRound(roundData);

        const [seriesRes, picksRes] = await Promise.all([
          getRoundSeries(roundData.id),
          getMyPicksForRound(roundData.id).catch(() => ({ success: true, data: [] })),
        ]);

        if (seriesRes.success) setSeriesList(seriesRes.data);

        if (picksRes.success && Array.isArray(picksRes.data)) {
          const draftMap = {};
          const savedMap = {};
          for (const s of picksRes.data) {
            if (s.pick_id) {
              // Reconstruct pick_selection string
              let teamName = '';
              // Find in seriesRes which team this is
              const matchedSeries = seriesRes.data?.find(sr => sr.id === s.id);
              if (matchedSeries) {
                if (s.pick_winner_team_id === matchedSeries.higher_seed_team.id) {
                  teamName = matchedSeries.higher_seed_team.name;
                } else if (s.pick_winner_team_id === matchedSeries.lower_seed_team.id) {
                  teamName = matchedSeries.lower_seed_team.name;
                }
              }
              const pickSelection = teamName ? `${teamName} in ${s.pick_games}` : '';
              const leadingScorer = s.pick_leading_scorer || '';
              draftMap[s.id] = { pickSelection, leadingScorer };
              savedMap[s.id] = { pickSelection, leadingScorer };
            }
          }
          setDrafts(draftMap);
          setSavedPicks(savedMap);
        }
      } catch (err) {
        setError('Failed to load picks data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleChange = (seriesId, field, value) => {
    setDrafts(prev => ({
      ...prev,
      [seriesId]: {
        ...prev[seriesId],
        pickSelection: prev[seriesId]?.pickSelection || '',
        leadingScorer: prev[seriesId]?.leadingScorer || '',
        [field]: value,
      },
    }));
    setSaveResult(null);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveResult(null);

    // Collect all series that have a pick selection AND are not locked
    const toSave = Object.entries(drafts).filter(
      ([seriesId, d]) => {
        if (!d.pickSelection) return false;
        const series = seriesList.find(s => s.id === parseInt(seriesId));
        if (series && isSeriesLocked(series)) return false;
        return true;
      }
    );

    if (toSave.length === 0) {
      setSaveResult({ type: 'error', text: 'No picks to save. Select an outcome for at least one unlocked series.' });
      setSaving(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const newSaved = { ...savedPicks };

    for (const [seriesId, draft] of toSave) {
      // Skip if nothing changed from what's already saved
      const existing = savedPicks[seriesId];
      if (
        existing &&
        existing.pickSelection === draft.pickSelection &&
        existing.leadingScorer === draft.leadingScorer
      ) {
        successCount++;
        continue;
      }

      try {
        await submitPick(parseInt(seriesId), draft.pickSelection, draft.leadingScorer);
        newSaved[seriesId] = { ...draft };
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    setSavedPicks(newSaved);

    if (failCount === 0) {
      setSaveResult({ type: 'success', text: `All ${successCount} pick${successCount !== 1 ? 's' : ''} saved successfully!` });
    } else {
      setSaveResult({ type: 'error', text: `${successCount} saved, ${failCount} failed. Try again.` });
    }

    setSaving(false);
  };

  // Count how many have picks vs total (only unlocked series)
  const unlockedSeries = seriesList.filter(s => !isSeriesLocked(s));
  const pickedCount = Object.entries(drafts).filter(([id, d]) => {
    if (!d.pickSelection) return false;
    const series = seriesList.find(s => s.id === parseInt(id));
    return series && !isSeriesLocked(series);
  }).length;
  const totalUnlocked = unlockedSeries.length;
  const unsavedCount = Object.entries(drafts).filter(([id, d]) => {
    if (!d.pickSelection) return false;
    const series = seriesList.find(s => s.id === parseInt(id));
    if (series && isSeriesLocked(series)) return false;
    const saved = savedPicks[id];
    if (!saved) return true;
    return saved.pickSelection !== d.pickSelection || saved.leadingScorer !== d.leadingScorer;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card text-center text-red-400">{error}</div>
      </div>
    );
  }

  const eastSeries = seriesList.filter(s => s.conference === 'East');
  const westSeries = seriesList.filter(s => s.conference === 'West');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{round?.name} — Submit Picks</h1>
          {allLocked && (
            <p className="text-red-400 text-sm mt-1">All picks are locked for this round.</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">
            <span className="text-orange-400 font-bold">{pickedCount}</span> / {totalUnlocked} picked
          </div>
          {unsavedCount > 0 && (
            <div className="text-xs text-orange-400 mt-0.5">{unsavedCount} unsaved</div>
          )}
        </div>
      </div>

      {allLocked && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 mb-6 text-red-300 text-sm">
          All picks are locked for this round. Results will be updated as series conclude.
        </div>
      )}

      {/* Eastern Conference */}
      <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">Eastern Conference</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {eastSeries.map(s => (
          <SeriesCard
            key={s.id}
            series={s}
            pickSelection={drafts[s.id]?.pickSelection || ''}
            leadingScorer={drafts[s.id]?.leadingScorer || ''}
            savedPick={savedPicks[s.id]}
            isLocked={isSeriesLocked(s)}
            lockDatetime={getSeriesLockDatetime(s)}
            onChange={handleChange}
          />
        ))}
      </div>

      {/* Western Conference */}
      <h2 className="text-sm font-bold text-red-400 uppercase tracking-widest mb-4">Western Conference</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {westSeries.map(s => (
          <SeriesCard
            key={s.id}
            series={s}
            pickSelection={drafts[s.id]?.pickSelection || ''}
            leadingScorer={drafts[s.id]?.leadingScorer || ''}
            savedPick={savedPicks[s.id]}
            isLocked={isSeriesLocked(s)}
            lockDatetime={getSeriesLockDatetime(s)}
            onChange={handleChange}
          />
        ))}
      </div>

      {/* Save All Button — only if at least one series is unlocked */}
      {!allLocked && (
        <div ref={bottomRef} className="sticky bottom-4 z-40">
          <div className="bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl p-4 shadow-2xl">
            {saveResult && (
              <div className={`text-sm mb-3 px-3 py-2 rounded-lg ${saveResult.type === 'success' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                {saveResult.text}
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-gray-400">
                {pickedCount === 0 && 'Make your picks above, then save them all here.'}
                {pickedCount > 0 && unsavedCount === 0 && (
                  <span className="text-green-400">All picks are saved!</span>
                )}
                {pickedCount > 0 && unsavedCount > 0 && (
                  <span>
                    <span className="text-orange-400 font-medium">{unsavedCount} unsaved</span> pick{unsavedCount !== 1 ? 's' : ''} ready to submit
                  </span>
                )}
              </div>
              <button
                onClick={handleSaveAll}
                disabled={saving || pickedCount === 0}
                className="btn-primary px-8 py-2.5 text-sm whitespace-nowrap"
              >
                {saving ? 'Saving...' : `Save All Picks (${pickedCount})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
