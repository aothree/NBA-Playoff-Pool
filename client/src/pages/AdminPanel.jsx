import React, { useEffect, useState, useCallback } from 'react';
import {
  getAdminUsers, patchUser,
  getAdminPicks, postSeriesResult,
  getCurrentRound, getRoundSeries, putRound, postRound,
  getAdminTeams, getAdminStats, getAdminSeason, postSeason,
  getAdminPayouts, postPayout, putPayout,
  getAdminRosters, addAdminPlayer, deleteAdminPlayer,
  getAdminRounds, postSeries, deleteSeries, putSeries,
} from '../services/api';

// ─── Results Tab ──────────────────────────────────────────────────────────────
function ResultsTab() {
  const [seriesData, setSeriesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState(null);
  const [forms, setForms] = useState({});
  const [teams, setTeams] = useState([]);

  const load = useCallback(async () => {
    try {
      const [picksRes, teamsRes] = await Promise.all([
        getAdminPicks(),
        getAdminTeams(),
      ]);
      if (picksRes.success) setSeriesData(picksRes.data);
      if (teamsRes.success) setTeams(teamsRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const initForm = (s) => {
    if (forms[s.id]) return;
    setForms(prev => ({
      ...prev,
      [s.id]: {
        result_winner_team_id: '',
        result_games: '4',
        result_leading_scorer: '',
        result_leading_scorer_points: '',
        is_complete: false,
      }
    }));
  };

  const updateForm = (seriesId, field, value) => {
    setForms(prev => ({
      ...prev,
      [seriesId]: { ...prev[seriesId], [field]: value }
    }));
  };

  const handleSubmitResult = async (seriesId) => {
    const form = forms[seriesId];
    if (!form.result_winner_team_id) {
      setMsg({ type: 'error', text: 'Select a winner' });
      return;
    }
    setSaving(seriesId);
    setMsg(null);
    try {
      const res = await postSeriesResult(seriesId, {
        result_winner_team_id: parseInt(form.result_winner_team_id),
        result_games: parseInt(form.result_games),
        result_leading_scorer: form.result_leading_scorer || null,
        result_leading_scorer_points: form.result_leading_scorer_points ? parseFloat(form.result_leading_scorer_points) : null,
        is_complete: form.is_complete,
      });
      if (res.success) {
        setMsg({ type: 'success', text: `Result saved. ${res.data.scores_updated} scores recalculated.` });
        setForms(prev => { const copy = { ...prev }; delete copy[seriesId]; return copy; });
        load();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to save result' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="text-gray-400 py-4">Loading...</div>;

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${msg.type === 'success' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
          {msg.text}
        </div>
      )}
      {seriesData.map(s => {
        const htTeam = teams.find(t => t.name === s.ht_name);
        const ltTeam = teams.find(t => t.name === s.lt_name);
        const editing = !!forms[s.id];

        return (
          <div key={s.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs text-gray-500">{s.round_name} — {s.conference}</span>
                <h3 className="text-sm font-bold text-white">
                  ({s.ht_seed}) {s.ht_name} vs ({s.lt_seed}) {s.lt_name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {s.is_complete ? (
                  <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded font-medium">Complete</span>
                ) : (
                  <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded font-medium">Pending</span>
                )}
                {!editing && (
                  <button onClick={() => initForm(s)} className="text-xs text-orange-400 hover:text-orange-300">
                    {s.is_complete ? 'Edit Result' : 'Enter Result'}
                  </button>
                )}
              </div>
            </div>

            {/* Picks summary */}
            <div className="text-xs text-gray-500 mb-2">
              {s.picks.length} pick{s.picks.length !== 1 ? 's' : ''} submitted
            </div>
            {s.picks.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {s.picks.map(p => (
                  <span key={p.id} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                    {p.user_name}: {p.pick_winner_name} in {p.pick_games}
                    {p.pick_leading_scorer && ` (${p.pick_leading_scorer})`}
                  </span>
                ))}
              </div>
            )}

            {/* Result form */}
            {editing && (
              <div className="border-t border-gray-700 pt-3 mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Winner</label>
                    <select
                      className="input text-sm"
                      value={forms[s.id].result_winner_team_id}
                      onChange={e => updateForm(s.id, 'result_winner_team_id', e.target.value)}
                    >
                      <option value="">Select winner</option>
                      {htTeam && <option value={htTeam.id}>{s.ht_name}</option>}
                      {ltTeam && <option value={ltTeam.id}>{s.lt_name}</option>}
                    </select>
                  </div>
                  <div>
                    <label className="label">Games</label>
                    <select
                      className="input text-sm"
                      value={forms[s.id].result_games}
                      onChange={e => updateForm(s.id, 'result_games', e.target.value)}
                    >
                      {[4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Leading Scorer (name)</label>
                    <input
                      className="input text-sm"
                      value={forms[s.id].result_leading_scorer}
                      onChange={e => updateForm(s.id, 'result_leading_scorer', e.target.value)}
                      placeholder="e.g. Donovan Mitchell"
                    />
                  </div>
                  <div>
                    <label className="label">Scorer Total Pts</label>
                    <input
                      className="input text-sm"
                      type="number"
                      value={forms[s.id].result_leading_scorer_points}
                      onChange={e => updateForm(s.id, 'result_leading_scorer_points', e.target.value)}
                      placeholder="e.g. 187"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded"
                      checked={forms[s.id].is_complete}
                      onChange={e => updateForm(s.id, 'is_complete', e.target.checked)}
                    />
                    Mark series complete (triggers scoring)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-primary text-sm py-1.5 px-4"
                    onClick={() => handleSubmitResult(s.id)}
                    disabled={saving === s.id}
                  >
                    {saving === s.id ? 'Saving...' : 'Save Result'}
                  </button>
                  <button
                    className="btn-secondary text-sm py-1.5 px-4"
                    onClick={() => setForms(prev => { const copy = { ...prev }; delete copy[s.id]; return copy; })}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {seriesData.length === 0 && (
        <p className="text-gray-500 text-sm py-4">No series found for the current season.</p>
      )}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getAdminUsers();
      if (res.success) setUsers(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleFee = async (userId, current) => {
    setMsg(null);
    try {
      const res = await patchUser(userId, { entry_fee_paid: !current });
      if (res.success) load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const toggleAdmin = async (userId, current) => {
    setMsg(null);
    try {
      const res = await patchUser(userId, { is_admin: !current });
      if (res.success) load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed' });
    }
  };

  if (loading) return <div className="text-gray-400 py-4">Loading...</div>;

  return (
    <div>
      {msg && (
        <div className={`text-sm px-4 py-2 rounded-lg mb-4 ${msg.type === 'success' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
          {msg.text}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase border-b border-gray-700">
              <th className="text-left py-3 pr-4">Name</th>
              <th className="text-left py-3 pr-4">Email</th>
              <th className="text-center py-3 pr-4">Fee Paid</th>
              <th className="text-center py-3 pr-4">Admin</th>
              <th className="text-left py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800">
                <td className="py-3 pr-4 text-white font-medium">{u.name}</td>
                <td className="py-3 pr-4 text-gray-400">{u.email}</td>
                <td className="py-3 pr-4 text-center">
                  <button
                    onClick={() => toggleFee(u.id, u.entry_fee_paid)}
                    className={`text-xs font-bold px-3 py-1 rounded transition-colors ${u.entry_fee_paid ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60' : 'bg-red-900/40 text-red-400 hover:bg-red-900/60'}`}
                  >
                    {u.entry_fee_paid ? 'Paid' : 'Unpaid'}
                  </button>
                </td>
                <td className="py-3 pr-4 text-center">
                  <button
                    onClick={() => toggleAdmin(u.id, u.is_admin)}
                    className={`text-xs font-bold px-3 py-1 rounded transition-colors ${u.is_admin ? 'bg-orange-900/40 text-orange-400 hover:bg-orange-900/60' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                  >
                    {u.is_admin ? 'Admin' : 'User'}
                  </button>
                </td>
                <td className="py-3 text-gray-500 text-xs">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Rounds Tab ───────────────────────────────────────────────────────────────
function RoundsTab() {
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', picks_lock_datetime: '', is_active: true });
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getCurrentRound().catch(() => null);
      if (res?.success) {
        setRound(res.data);
        setForm({
          name: res.data.name || '',
          picks_lock_datetime: res.data.picks_lock_datetime ? res.data.picks_lock_datetime.slice(0, 16) : '',
          is_active: !!res.data.is_active,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setMsg(null);
    try {
      const payload = {
        name: form.name,
        picks_lock_datetime: form.picks_lock_datetime ? new Date(form.picks_lock_datetime).toISOString() : null,
        is_active: form.is_active,
      };
      const res = await putRound(round.id, payload);
      if (res.success) {
        setMsg({ type: 'success', text: 'Round updated' });
        setEditing(false);
        load();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed' });
    }
  };

  if (loading) return <div className="text-gray-400 py-4">Loading...</div>;

  if (!round) {
    return <p className="text-gray-500 text-sm py-4">No active round. Create one from the Season settings.</p>;
  }

  const isLocked = round.picks_lock_datetime && new Date() > new Date(round.picks_lock_datetime);

  return (
    <div>
      {msg && (
        <div className={`text-sm px-4 py-2 rounded-lg mb-4 ${msg.type === 'success' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">{round.name}</h3>
            <span className="text-xs text-gray-500">Round {round.round_number}</span>
          </div>
          <div className="flex items-center gap-2">
            {isLocked ? (
              <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded font-medium">Locked</span>
            ) : (
              <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded font-medium">Open</span>
            )}
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-orange-400 hover:text-orange-300">
                Edit
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="label">Round Name</label>
              <input
                className="input text-sm"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Default Picks Lock (fallback for series without their own lock time)</label>
              <input
                className="input text-sm"
                type="datetime-local"
                value={form.picks_lock_datetime}
                onChange={e => setForm(f => ({ ...f, picks_lock_datetime: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              />
              Active round
            </label>
            <div className="flex items-center gap-2">
              <button className="btn-primary text-sm py-1.5 px-4" onClick={save}>Save</button>
              <button className="btn-secondary text-sm py-1.5 px-4" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-300 space-y-1">
            <p>
              <span className="text-gray-500">Default lock time: </span>
              {round.picks_lock_datetime
                ? new Date(round.picks_lock_datetime).toLocaleString()
                : 'Not set'}
            </p>
            <p className="text-xs text-gray-500">
              Individual series can override this with their own lock time (set in Matchups tab).
            </p>
            <p>
              <span className="text-gray-500">Status: </span>
              {round.is_active ? 'Active' : 'Inactive'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Tab ────────────────────────────────────────────────────────────
function SettingsTab() {
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    entry_fee_amount: '',
    prize_pool_total: '',
    main_event_payout: [{ place: 1, pct: 60 }, { place: 2, pct: 30 }, { place: 3, pct: 10 }],
    side_pot_payout: [{ place: 1, pct: 100 }],
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAdminSeason();
        if (res.success) {
          const s = res.data;
          setSeason(s);
          let mainPayout = [];
          let sidePayout = [];
          try { mainPayout = typeof s.main_event_payout === 'string' ? JSON.parse(s.main_event_payout) : s.main_event_payout || []; } catch {}
          try { sidePayout = typeof s.side_pot_payout === 'string' ? JSON.parse(s.side_pot_payout) : s.side_pot_payout || []; } catch {}
          setForm({
            entry_fee_amount: s.entry_fee_amount || 0,
            prize_pool_total: s.prize_pool_total || 0,
            main_event_payout: mainPayout.length ? mainPayout : [{ place: 1, pct: 60 }, { place: 2, pct: 30 }, { place: 3, pct: 10 }],
            side_pot_payout: sidePayout.length ? sidePayout : [{ place: 1, pct: 100 }],
          });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updatePayout = (type, index, value) => {
    setForm(prev => {
      const arr = [...prev[type]];
      arr[index] = { ...arr[index], pct: parseFloat(value) || 0 };
      return { ...prev, [type]: arr };
    });
  };

  const addPayoutSlot = (type) => {
    setForm(prev => {
      const arr = [...prev[type]];
      arr.push({ place: arr.length + 1, pct: 0 });
      return { ...prev, [type]: arr };
    });
  };

  const removePayoutSlot = (type, index) => {
    setForm(prev => {
      const arr = prev[type].filter((_, i) => i !== index).map((p, i) => ({ ...p, place: i + 1 }));
      return { ...prev, [type]: arr };
    });
  };

  const totalPct = (arr) => arr.reduce((sum, p) => sum + (p.pct || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await postSeason({
        entry_fee_amount: parseFloat(form.entry_fee_amount) || 0,
        prize_pool_total: parseFloat(form.prize_pool_total) || 0,
        main_event_payout: form.main_event_payout,
        side_pot_payout: form.side_pot_payout,
      });
      if (res.success) {
        setSeason(res.data);
        setMsg({ type: 'success', text: 'Season settings saved.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-gray-400 py-4">Loading...</div>;
  if (!season) return <div className="text-gray-400 py-4">No active season found.</div>;

  const renderPayoutEditor = (type, label) => {
    const arr = form[type];
    const total = totalPct(arr);
    const isValid = Math.abs(total - 100) < 0.01;
    return (
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase">{label}</h3>
          <button
            onClick={() => addPayoutSlot(type)}
            className="text-xs text-orange-400 hover:text-orange-300"
          >
            + Add Place
          </button>
        </div>
        <div className="space-y-2">
          {arr.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm text-gray-400 w-12">#{p.place}</span>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="number"
                  className="input text-sm w-24"
                  value={p.pct}
                  min={0}
                  max={100}
                  onChange={e => updatePayout(type, i, e.target.value)}
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <span className="text-xs text-gray-500 w-20 text-right">
                ${((p.pct / 100) * (parseFloat(form.prize_pool_total) || 0)).toFixed(0)}
              </span>
              {arr.length > 1 && (
                <button
                  onClick={() => removePayoutSlot(type, i)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <div className={`mt-3 text-xs font-medium ${isValid ? 'text-green-400' : 'text-yellow-400'}`}>
          Total: {total.toFixed(1)}%{!isValid && ' (should equal 100%)'}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${msg.type === 'success' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {/* Core settings */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Season Settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Entry Fee ($)</label>
            <input
              type="number"
              className="input text-sm"
              value={form.entry_fee_amount}
              min={0}
              onChange={e => setForm(f => ({ ...f, entry_fee_amount: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Prize Pool Total ($)</label>
            <input
              type="number"
              className="input text-sm"
              value={form.prize_pool_total}
              min={0}
              onChange={e => setForm(f => ({ ...f, prize_pool_total: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">
              Update as fees are collected. Auto-calc: {season ? `$${form.entry_fee_amount} × participants` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Payout structures */}
      {renderPayoutEditor('main_event_payout', 'Main Event Payout Split')}
      {renderPayoutEditor('side_pot_payout', 'Side Pot Payout Split')}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          className="btn-primary text-sm py-2 px-6"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <span className="text-xs text-gray-500">
          Season: {season.year}
        </span>
      </div>
    </div>
  );
}

// ─── Matchups Tab ────────────────────────────────────────────────────────────
function MatchupsTab() {
  const [rounds, setRounds] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [showNewRound, setShowNewRound] = useState(false);
  const [newRound, setNewRound] = useState({ name: '', round_number: '', picks_lock_datetime: '' });
  const [addSeriesForms, setAddSeriesForms] = useState({});
  // Track which series are being edited for lock time
  const [editLockForms, setEditLockForms] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rRes, tRes] = await Promise.all([
        getAdminRounds(),
        getAdminTeams(),
      ]);
      if (rRes.success) setRounds(rRes.data);
      if (tRes.success) setTeams(tRes.data);
    } catch {
      setMsg({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleCreateRound = async () => {
    if (!newRound.name || !newRound.round_number) {
      setMsg({ type: 'error', text: 'Round name and number are required' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await postRound({
        name: newRound.name,
        round_number: parseInt(newRound.round_number),
        picks_lock_datetime: newRound.picks_lock_datetime
          ? new Date(newRound.picks_lock_datetime).toISOString()
          : null,
        is_active: 0,
      });
      if (res.success) {
        setMsg({ type: 'success', text: `Created "${newRound.name}"` });
        setNewRound({ name: '', round_number: '', picks_lock_datetime: '' });
        setShowNewRound(false);
        load();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to create round' });
    } finally {
      setSaving(false);
    }
  };

  const handleActivateRound = async (roundId, currentlyActive) => {
    setSaving(true);
    setMsg(null);
    try {
      for (const r of rounds) {
        if (r.is_active && r.id !== roundId) {
          await putRound(r.id, { is_active: false });
        }
      }
      await putRound(roundId, { is_active: !currentlyActive });
      setMsg({ type: 'success', text: currentlyActive ? 'Round deactivated' : 'Round activated' });
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to update round' });
    } finally {
      setSaving(false);
    }
  };

  const initAddSeries = (roundId) => {
    setAddSeriesForms(prev => ({
      ...prev,
      [roundId]: { higher_seed_team_id: '', lower_seed_team_id: '', conference: 'East', series_order: '', picks_lock_datetime: '' },
    }));
  };

  const updateSeriesForm = (roundId, field, value) => {
    setAddSeriesForms(prev => ({
      ...prev,
      [roundId]: { ...prev[roundId], [field]: value },
    }));
    // Auto-detect conference from selected team
    if (field === 'higher_seed_team_id' && value) {
      const team = teams.find(t => t.id === parseInt(value));
      if (team) {
        setAddSeriesForms(prev => ({
          ...prev,
          [roundId]: { ...prev[roundId], higher_seed_team_id: value, conference: team.conference },
        }));
      }
    }
  };

  const handleAddSeries = async (roundId) => {
    const form = addSeriesForms[roundId];
    if (!form?.higher_seed_team_id || !form?.lower_seed_team_id) {
      setMsg({ type: 'error', text: 'Select both teams' });
      return;
    }
    if (form.higher_seed_team_id === form.lower_seed_team_id) {
      setMsg({ type: 'error', text: 'Teams must be different' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const round = rounds.find(r => r.id === roundId);
      const existingCount = round?.series?.length || 0;
      const res = await postSeries({
        round_id: roundId,
        higher_seed_team_id: parseInt(form.higher_seed_team_id),
        lower_seed_team_id: parseInt(form.lower_seed_team_id),
        conference: form.conference,
        series_order: parseInt(form.series_order) || existingCount + 1,
        picks_lock_datetime: form.picks_lock_datetime
          ? new Date(form.picks_lock_datetime).toISOString()
          : null,
      });
      if (res.success) {
        setMsg({ type: 'success', text: 'Matchup added' });
        setAddSeriesForms(prev => { const c = { ...prev }; delete c[roundId]; return c; });
        load();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to add matchup' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSeries = async (seriesId, matchupLabel) => {
    if (!window.confirm(`Delete matchup "${matchupLabel}"? This will also delete all picks for this series.`)) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await deleteSeries(seriesId);
      if (res.success) {
        setMsg({ type: 'success', text: 'Matchup deleted' });
        load();
      }
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete matchup' });
    } finally {
      setSaving(false);
    }
  };

  // Per-series lock time editing
  const initEditLock = (seriesId, currentLock) => {
    setEditLockForms(prev => ({
      ...prev,
      [seriesId]: currentLock ? currentLock.slice(0, 16) : '',
    }));
  };

  const handleSaveLock = async (seriesId) => {
    setSaving(true);
    setMsg(null);
    try {
      const val = editLockForms[seriesId];
      const res = await putSeries(seriesId, {
        picks_lock_datetime: val ? new Date(val).toISOString() : null,
      });
      if (res.success) {
        setMsg({ type: 'success', text: 'Lock time updated' });
        setEditLockForms(prev => { const c = { ...prev }; delete c[seriesId]; return c; });
        load();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update lock time' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-gray-400 py-4">Loading...</div>;

  const eastTeams = teams.filter(t => t.conference === 'East').sort((a, b) => a.seed - b.seed);
  const westTeams = teams.filter(t => t.conference === 'West').sort((a, b) => a.seed - b.seed);
  const teamOptions = (conf) => {
    const list = conf === 'West' ? westTeams : conf === 'East' ? eastTeams : teams;
    return list.map(t => (
      <option key={t.id} value={t.id}>({t.seed}) {t.name}</option>
    ));
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${msg.type === 'success' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {/* Create new round */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">{rounds.length} round{rounds.length !== 1 ? 's' : ''} configured</div>
        <button
          onClick={() => setShowNewRound(!showNewRound)}
          className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
        >
          {showNewRound ? 'Cancel' : '+ New Round'}
        </button>
      </div>

      {showNewRound && (
        <div className="bg-gray-800 rounded-lg p-4 border border-orange-700/50 space-y-3">
          <h3 className="text-sm font-bold text-white">Create New Round</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Round #</label>
              <input
                className="input text-sm"
                type="number"
                min={1}
                max={4}
                value={newRound.round_number}
                onChange={e => setNewRound(f => ({ ...f, round_number: e.target.value }))}
                placeholder="2"
              />
            </div>
            <div>
              <label className="label">Name</label>
              <input
                className="input text-sm"
                value={newRound.name}
                onChange={e => setNewRound(f => ({ ...f, name: e.target.value }))}
                placeholder="Second Round"
              />
            </div>
            <div>
              <label className="label">Default Lock</label>
              <input
                className="input text-sm"
                type="datetime-local"
                value={newRound.picks_lock_datetime}
                onChange={e => setNewRound(f => ({ ...f, picks_lock_datetime: e.target.value }))}
              />
            </div>
          </div>
          <button onClick={handleCreateRound} disabled={saving} className="btn-primary text-sm py-1.5 px-4">
            {saving ? 'Creating...' : 'Create Round'}
          </button>
        </div>
      )}

      {/* Rounds list */}
      {rounds.map(round => {
        const isOpen = expanded[round.id];
        const seriesList = round.series || [];
        const adding = !!addSeriesForms[round.id];

        return (
          <div key={round.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            {/* Round header */}
            <button
              onClick={() => toggle(round.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-750 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-500 w-8">R{round.round_number}</span>
                <div>
                  <span className="text-sm font-bold text-white">{round.name}</span>
                  {round.picks_lock_datetime && (
                    <span className="text-xs text-gray-500 ml-2">
                      Default lock: {new Date(round.picks_lock_datetime).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {round.is_active ? (
                  <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded font-medium">Active</span>
                ) : (
                  <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded font-medium">Inactive</span>
                )}
                <span className="text-xs text-gray-500">{seriesList.length} matchup{seriesList.length !== 1 ? 's' : ''}</span>
                <span className="text-gray-600 text-xs">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-700 px-4 py-3 space-y-3">
                {/* Activate / Deactivate */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleActivateRound(round.id, round.is_active)}
                    disabled={saving}
                    className={`text-xs font-semibold px-3 py-1 rounded transition-colors ${
                      round.is_active
                        ? 'bg-red-900/40 text-red-400 hover:bg-red-900/60'
                        : 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
                    }`}
                  >
                    {round.is_active ? 'Deactivate Round' : 'Activate Round'}
                  </button>
                </div>

                {/* Series list */}
                {seriesList.length > 0 ? (
                  <div className="space-y-2">
                    {seriesList.map(s => {
                      const isEditingLock = editLockForms[s.id] !== undefined;
                      const seriesLocked = s.picks_lock_datetime && new Date() > new Date(s.picks_lock_datetime);
                      const roundLocked = round.picks_lock_datetime && new Date() > new Date(round.picks_lock_datetime);
                      const effectiveLock = s.picks_lock_datetime || round.picks_lock_datetime;
                      const isLocked = effectiveLock && new Date() > new Date(effectiveLock);

                      return (
                        <div key={s.id} className="py-2 px-3 rounded bg-gray-900/50 group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                s.conference === 'East' ? 'bg-blue-900/50 text-blue-300' : 'bg-red-900/50 text-red-300'
                              }`}>
                                {s.conference === 'East' ? 'E' : 'W'}
                              </span>
                              <span className="text-sm text-gray-200">
                                ({s.ht_seed}) {s.ht_name} <span className="text-gray-500">vs</span> ({s.lt_seed}) {s.lt_name}
                              </span>
                              {s.is_complete && (
                                <span className="text-xs bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded">Complete</span>
                              )}
                              {isLocked && !s.is_complete && (
                                <span className="text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded">Locked</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => initEditLock(s.id, s.picks_lock_datetime)}
                                className="text-xs text-orange-400 hover:text-orange-300 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Set Lock
                              </button>
                              <button
                                onClick={() => handleDeleteSeries(s.id, `${s.ht_name} vs ${s.lt_name}`)}
                                disabled={saving}
                                className="text-xs text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2"
                              >
                                ✕ Remove
                              </button>
                            </div>
                          </div>
                          {/* Lock time display */}
                          <div className="mt-1 ml-10 text-xs text-gray-500">
                            {s.picks_lock_datetime
                              ? <>Lock: {new Date(s.picks_lock_datetime).toLocaleString()} <span className="text-gray-600">(series-specific)</span></>
                              : round.picks_lock_datetime
                                ? <>Lock: {new Date(round.picks_lock_datetime).toLocaleString()} <span className="text-gray-600">(from round default)</span></>
                                : <span className="text-gray-600">No lock time set</span>
                            }
                          </div>
                          {/* Inline lock time editor */}
                          {isEditingLock && (
                            <div className="mt-2 ml-10 flex items-center gap-2">
                              <input
                                type="datetime-local"
                                className="input text-xs py-1 w-56"
                                value={editLockForms[s.id] || ''}
                                onChange={e => setEditLockForms(prev => ({ ...prev, [s.id]: e.target.value }))}
                              />
                              <button
                                onClick={() => handleSaveLock(s.id)}
                                disabled={saving}
                                className="btn-primary text-xs py-1 px-3"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  // Clear the lock time
                                  setEditLockForms(prev => ({ ...prev, [s.id]: '' }));
                                }}
                                className="text-xs text-gray-400 hover:text-gray-300"
                              >
                                Clear
                              </button>
                              <button
                                onClick={() => setEditLockForms(prev => { const c = { ...prev }; delete c[s.id]; return c; })}
                                className="text-xs text-gray-400 hover:text-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 py-2">No matchups added yet</p>
                )}

                {/* Add matchup form */}
                {adding ? (
                  <div className="border-t border-gray-700 pt-3 space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase">Add Matchup</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="label">Conference</label>
                        <select
                          className="input text-sm"
                          value={addSeriesForms[round.id]?.conference || 'East'}
                          onChange={e => updateSeriesForm(round.id, 'conference', e.target.value)}
                        >
                          <option value="East">East</option>
                          <option value="West">West</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Higher Seed</label>
                        <select
                          className="input text-sm"
                          value={addSeriesForms[round.id]?.higher_seed_team_id || ''}
                          onChange={e => updateSeriesForm(round.id, 'higher_seed_team_id', e.target.value)}
                        >
                          <option value="">Select team...</option>
                          {teamOptions(addSeriesForms[round.id]?.conference)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Lower Seed</label>
                        <select
                          className="input text-sm"
                          value={addSeriesForms[round.id]?.lower_seed_team_id || ''}
                          onChange={e => updateSeriesForm(round.id, 'lower_seed_team_id', e.target.value)}
                        >
                          <option value="">Select team...</option>
                          {teamOptions(addSeriesForms[round.id]?.conference)}
                        </select>
                      </div>
                    </div>
                    {/* Lock time for new series */}
                    <div>
                      <label className="label">Lock Date/Time (optional — overrides round default)</label>
                      <input
                        type="datetime-local"
                        className="input text-sm"
                        value={addSeriesForms[round.id]?.picks_lock_datetime || ''}
                        onChange={e => updateSeriesForm(round.id, 'picks_lock_datetime', e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave blank to use the round's default lock time{round.picks_lock_datetime ? ` (${new Date(round.picks_lock_datetime).toLocaleString()})` : ''}.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleAddSeries(round.id)} disabled={saving} className="btn-primary text-xs py-1.5 px-4">
                        {saving ? 'Adding...' : 'Add Matchup'}
                      </button>
                      <button
                        onClick={() => setAddSeriesForms(prev => { const c = { ...prev }; delete c[round.id]; return c; })}
                        className="btn-secondary text-xs py-1.5 px-4"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => initAddSeries(round.id)}
                    className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
                  >
                    + Add Matchup
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {rounds.length === 0 && (
        <p className="text-gray-500 text-sm py-4">No rounds created yet. Create one above.</p>
      )}
    </div>
  );
}

// ─── Rosters Tab ─────────────────────────────────────────────────────────────
function RostersTab() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [confFilter, setConfFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [addForms, setAddForms] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getAdminRosters();
      if (res.success) setTeams(res.data);
    } catch {
      setMsg({ type: 'error', text: 'Failed to load rosters' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleDelete = async (playerId, playerName, teamName) => {
    if (!window.confirm(`Remove ${playerName} from ${teamName}?`)) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await deleteAdminPlayer(playerId);
      if (res.success) {
        setMsg({ type: 'success', text: `Removed ${playerName}` });
        load();
      }
    } catch {
      setMsg({ type: 'error', text: `Failed to remove ${playerName}` });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (teamId) => {
    const form = addForms[teamId];
    if (!form?.name?.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await addAdminPlayer({
        team_id: teamId,
        name: form.name.trim(),
        position: form.position || 'G',
      });
      if (res.success) {
        setMsg({ type: 'success', text: `Added ${form.name.trim()}` });
        setAddForms(prev => ({ ...prev, [teamId]: { name: '', position: 'G' } }));
        load();
      }
    } catch {
      setMsg({ type: 'error', text: `Failed to add player` });
    } finally {
      setSaving(false);
    }
  };

  const updateAddForm = (teamId, field, value) => {
    setAddForms(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], name: prev[teamId]?.name || '', position: prev[teamId]?.position || 'G', [field]: value },
    }));
  };

  if (loading) return <div className="text-gray-400 py-4">Loading...</div>;

  const filtered = teams
    .filter(t => confFilter === 'All' || t.conference === confFilter)
    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.abbreviation.toLowerCase().includes(search.toLowerCase()));

  const east = filtered.filter(t => t.conference === 'East').sort((a, b) => (a.seed || 99) - (b.seed || 99));
  const west = filtered.filter(t => t.conference === 'West').sort((a, b) => (a.seed || 99) - (b.seed || 99));

  const totalPlayers = teams.reduce((sum, t) => sum + (t.players?.length || 0), 0);

  const renderTeam = (t) => {
    const isOpen = expanded[t.id];
    const players = t.players || [];
    return (
      <div key={t.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <button
          onClick={() => toggle(t.id)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-750 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500 w-6 text-right">
              {t.seed > 0 ? `#${t.seed}` : '—'}
            </span>
            <div>
              <span className="text-sm font-bold text-white">{t.name}</span>
              <span className="text-xs text-gray-500 ml-2">{t.abbreviation}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${players.length >= 10 ? 'bg-green-900/40 text-green-400' : players.length >= 5 ? 'bg-yellow-900/40 text-yellow-400' : 'bg-red-900/40 text-red-400'}`}>
              {players.length} players
            </span>
            <span className="text-gray-600 text-xs">{isOpen ? '▲' : '▼'}</span>
          </div>
        </button>

        {isOpen && (
          <div className="border-t border-gray-700 px-4 py-3">
            {players.length > 0 ? (
              <div className="space-y-1 mb-3">
                {players.map(pl => (
                  <div key={pl.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-700/50 group">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-mono w-6 text-center">{pl.position}</span>
                      <span className="text-sm text-gray-200">{pl.name}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(pl.id, pl.name, t.name)}
                      disabled={saving}
                      className="text-xs text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5"
                      title={`Remove ${pl.name}`}
                    >
                      ✕ Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 mb-3 py-2">No players on roster</p>
            )}

            {/* Add player form */}
            <div className="border-t border-gray-700 pt-3 flex items-center gap-2">
              <input
                className="input text-sm flex-1"
                placeholder="Player name"
                value={addForms[t.id]?.name || ''}
                onChange={e => updateAddForm(t.id, 'name', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(t.id); }}
              />
              <select
                className="input text-sm w-16"
                value={addForms[t.id]?.position || 'G'}
                onChange={e => updateAddForm(t.id, 'position', e.target.value)}
              >
                <option value="G">G</option>
                <option value="F">F</option>
                <option value="C">C</option>
              </select>
              <button
                onClick={() => handleAdd(t.id)}
                disabled={saving || !addForms[t.id]?.name?.trim()}
                className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap"
              >
                + Add
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${msg.type === 'success' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {/* Stats + filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="text-xs text-gray-500">
          {teams.length} teams · {totalPlayers} total players
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input text-sm w-48"
            placeholder="Search teams..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {['All', 'East', 'West'].map(c => (
            <button
              key={c}
              onClick={() => setConfFilter(c)}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${confFilter === c ? 'bg-orange-900/40 text-orange-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Eastern Conference */}
      {(confFilter === 'All' || confFilter === 'East') && east.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Eastern Conference</h3>
          <div className="space-y-2">
            {east.map(renderTeam)}
          </div>
        </div>
      )}

      {/* Western Conference */}
      {(confFilter === 'All' || confFilter === 'West') && west.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Western Conference</h3>
          <div className="space-y-2">
            {west.map(renderTeam)}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-gray-500 text-sm py-4">No teams match your search.</p>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [stRes, seRes] = await Promise.all([
          getAdminStats().catch(() => ({ success: false })),
          getAdminSeason().catch(() => ({ success: false })),
        ]);
        if (stRes.success) setStats(stRes.data);
        if (seRes.success) setSeason(seRes.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="text-gray-400 py-4">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 text-center border border-gray-700">
          <div className="text-2xl font-extrabold text-orange-400">{stats?.total_participants || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Participants</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center border border-gray-700">
          <div className="text-2xl font-extrabold text-green-400">{stats?.users_paid || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Fees Paid</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center border border-gray-700">
          <div className="text-2xl font-extrabold text-white">${stats?.fees_collected || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Collected</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center border border-gray-700">
          <div className="text-2xl font-extrabold text-white">${season?.entry_fee_amount || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Entry Fee</div>
        </div>
      </div>

      {/* Season info */}
      {season && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Season</h3>
          <div className="text-sm text-gray-300 space-y-1">
            <p><span className="text-gray-500">Year: </span>{season.year}</p>
            <p><span className="text-gray-500">Entry fee: </span>${season.entry_fee_amount}</p>
            <p><span className="text-gray-500">Prize pool: </span>${season.prize_pool_total}</p>
          </div>
        </div>
      )}

      {/* Popular picks */}
      {stats?.popular_picks && stats.popular_picks.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Pick Distribution</h3>
          <div className="space-y-3">
            {stats.popular_picks.map(sp => (
              <div key={sp.series_id}>
                <p className="text-xs text-gray-400 mb-1">{sp.matchup}</p>
                <div className="flex flex-wrap gap-2">
                  {sp.top_picks.map((tp, i) => (
                    <span key={i} className={`text-xs px-2 py-1 rounded ${i === 0 ? 'bg-orange-900/40 text-orange-300' : 'bg-gray-700 text-gray-300'}`}>
                      {tp.team_name} in {tp.pick_games} ({tp.count})
                    </span>
                  ))}
                  {sp.top_picks.length === 0 && (
                    <span className="text-xs text-gray-600">No picks</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Admin Panel Container ────────────────────────────────────────────────────
export default function AdminPanel() {
  const [tab, setTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'results', label: 'Results' },
    { id: 'matchups', label: 'Matchups' },
    { id: 'users', label: 'Users' },
    { id: 'rosters', label: 'Rosters' },
    { id: 'rounds', label: 'Rounds' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Admin Panel</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 pb-3 text-sm font-semibold transition-colors ${tab === t.id ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'results' && <ResultsTab />}
        {tab === 'matchups' && <MatchupsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'rosters' && <RostersTab />}
        {tab === 'rounds' && <RoundsTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}
