const express = require('express');
const router = express.Router();
const db = require('../db/index');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { recalculateSeriesScores } = require('../services/scoringService');

router.use(authMiddleware, adminMiddleware);

// GET /api/admin/picks
router.get('/picks', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const series = db.prepare(`
      SELECT se.id, se.conference, se.series_order, se.is_complete, se.picks_lock_datetime as series_lock,
        ht.name as ht_name, ht.seed as ht_seed,
        lt.name as lt_name, lt.seed as lt_seed,
        r.name as round_name, r.round_number, r.picks_lock_datetime as round_lock
      FROM series se
      JOIN rounds r ON r.id = se.round_id
      JOIN teams ht ON ht.id = se.higher_seed_team_id
      JOIN teams lt ON lt.id = se.lower_seed_team_id
      WHERE r.season_id = ?
      ORDER BY r.round_number, se.series_order
    `).all(season.id);

    const result = series.map(s => {
      const picks = db.prepare(`
        SELECT p.*, u.name as user_name, u.email,
          pt.name as pick_winner_name
        FROM picks p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN teams pt ON pt.id = p.pick_winner_team_id
        WHERE p.series_id = ?
        ORDER BY u.name
      `).all(s.id);
      return { ...s, picks };
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('admin/picks error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/admin/series/:id/result
router.post('/series/:id/result', (req, res) => {
  try {
    const { id } = req.params;
    const { result_winner_team_id, result_games, result_leading_scorer, result_leading_scorer_points, is_complete } = req.body;

    db.prepare(`
      UPDATE series SET
        result_winner_team_id = ?,
        result_games = ?,
        result_leading_scorer = ?,
        result_leading_scorer_points = ?,
        is_complete = ?
      WHERE id = ?
    `).run(result_winner_team_id, result_games, result_leading_scorer, result_leading_scorer_points, is_complete ? 1 : 0, id);

    const count = recalculateSeriesScores(db, parseInt(id));
    const series = db.prepare('SELECT * FROM series WHERE id = ?').get(id);

    return res.json({ success: true, data: { series, scores_updated: count } });
  } catch (err) {
    console.error('admin/series/:id/result error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/admin/rounds/:id
router.put('/rounds/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { picks_lock_datetime, is_active, name } = req.body;

    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (picks_lock_datetime !== undefined) { fields.push('picks_lock_datetime = ?'); values.push(picks_lock_datetime); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (!fields.length) return res.status(400).json({ success: false, error: 'No fields to update' });

    values.push(id);
    db.prepare(`UPDATE rounds SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(id);
    return res.json({ success: true, data: round });
  } catch (err) {
    console.error('admin/rounds/:id error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/admin/rounds — all rounds with nested series matchups
router.get('/rounds', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const rounds = db.prepare(`
      SELECT * FROM rounds WHERE season_id = ? ORDER BY round_number
    `).all(season.id);

    for (const round of rounds) {
      round.series = db.prepare(`
        SELECT se.*, ht.name as ht_name, ht.abbreviation as ht_abbr, ht.seed as ht_seed,
          lt.name as lt_name, lt.abbreviation as lt_abbr, lt.seed as lt_seed
        FROM series se
        JOIN teams ht ON ht.id = se.higher_seed_team_id
        JOIN teams lt ON lt.id = se.lower_seed_team_id
        WHERE se.round_id = ?
        ORDER BY se.series_order
      `).all(round.id);
    }

    return res.json({ success: true, data: rounds });
  } catch (err) {
    console.error('admin/rounds GET error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/admin/series/:id
router.delete('/series/:id', (req, res) => {
  try {
    const { id } = req.params;
    const series = db.prepare('SELECT * FROM series WHERE id = ?').get(id);
    if (!series) return res.status(404).json({ success: false, error: 'Series not found' });

    // Delete associated picks and scores first
    db.prepare('DELETE FROM scores WHERE series_id = ?').run(id);
    db.prepare('DELETE FROM picks WHERE series_id = ?').run(id);
    db.prepare('DELETE FROM series WHERE id = ?').run(id);

    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('admin/series/:id DELETE error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/admin/rounds
router.post('/rounds', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const { round_number, name, picks_lock_datetime, is_active } = req.body;
    if (!round_number || !name) return res.status(400).json({ success: false, error: 'round_number and name are required' });

    const result = db.prepare(`
      INSERT INTO rounds (season_id, round_number, name, picks_lock_datetime, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(season.id, round_number, name, picks_lock_datetime || null, is_active ? 1 : 0);

    const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ success: true, data: round });
  } catch (err) {
    console.error('admin/rounds POST error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/admin/series — now supports picks_lock_datetime
router.post('/series', (req, res) => {
  try {
    const { round_id, higher_seed_team_id, lower_seed_team_id, conference, series_order, picks_lock_datetime } = req.body;
    if (!round_id || !higher_seed_team_id || !lower_seed_team_id || !conference) {
      return res.status(400).json({ success: false, error: 'round_id, higher_seed_team_id, lower_seed_team_id, conference are required' });
    }

    const result = db.prepare(`
      INSERT INTO series (round_id, higher_seed_team_id, lower_seed_team_id, conference, series_order, picks_lock_datetime)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(round_id, higher_seed_team_id, lower_seed_team_id, conference, series_order || 0, picks_lock_datetime || null);

    const series = db.prepare('SELECT * FROM series WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ success: true, data: series });
  } catch (err) {
    console.error('admin/series POST error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/admin/series/:id — now supports picks_lock_datetime
router.put('/series/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { round_id, higher_seed_team_id, lower_seed_team_id, conference, series_order, picks_lock_datetime } = req.body;

    const fields = [];
    const values = [];
    if (round_id !== undefined) { fields.push('round_id = ?'); values.push(round_id); }
    if (higher_seed_team_id !== undefined) { fields.push('higher_seed_team_id = ?'); values.push(higher_seed_team_id); }
    if (lower_seed_team_id !== undefined) { fields.push('lower_seed_team_id = ?'); values.push(lower_seed_team_id); }
    if (conference !== undefined) { fields.push('conference = ?'); values.push(conference); }
    if (series_order !== undefined) { fields.push('series_order = ?'); values.push(series_order); }
    if (picks_lock_datetime !== undefined) { fields.push('picks_lock_datetime = ?'); values.push(picks_lock_datetime); }

    if (!fields.length) return res.status(400).json({ success: false, error: 'No fields to update' });

    values.push(id);
    db.prepare(`UPDATE series SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const series = db.prepare('SELECT * FROM series WHERE id = ?').get(id);
    return res.json({ success: true, data: series });
  } catch (err) {
    console.error('admin/series/:id PUT error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/admin/teams
router.get('/teams', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const teams = db.prepare(`
      SELECT t.*, COUNT(p.id) as player_count
      FROM teams t
      LEFT JOIN players p ON p.team_id = t.id
      WHERE t.season_id = ?
      GROUP BY t.id
      ORDER BY t.conference, t.seed
    `).all(season.id);

    return res.json({ success: true, data: teams });
  } catch (err) {
    console.error('admin/teams error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/admin/rosters — teams with nested player arrays (for Rosters tab)
router.get('/rosters', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const teams = db.prepare(`
      SELECT id, name, abbreviation, conference, seed
      FROM teams WHERE season_id = ?
      ORDER BY conference, seed
    `).all(season.id);

    for (const team of teams) {
      team.players = db.prepare(
        'SELECT id, name, position FROM players WHERE team_id = ? ORDER BY position, name'
      ).all(team.id);
    }

    return res.json({ success: true, data: teams });
  } catch (err) {
    console.error('admin/rosters error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/admin/teams
router.post('/teams', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const { name, abbreviation, conference, seed } = req.body;
    if (!name || !abbreviation || !conference || !seed) {
      return res.status(400).json({ success: false, error: 'name, abbreviation, conference, seed are required' });
    }

    const result = db.prepare(`
      INSERT INTO teams (season_id, name, abbreviation, conference, seed)
      VALUES (?, ?, ?, ?, ?)
    `).run(season.id, name, abbreviation, conference, seed);

    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ success: true, data: team });
  } catch (err) {
    console.error('admin/teams POST error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/admin/teams/:id
router.put('/teams/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, abbreviation, conference, seed } = req.body;

    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (abbreviation !== undefined) { fields.push('abbreviation = ?'); values.push(abbreviation); }
    if (conference !== undefined) { fields.push('conference = ?'); values.push(conference); }
    if (seed !== undefined) { fields.push('seed = ?'); values.push(seed); }

    if (!fields.length) return res.status(400).json({ success: false, error: 'No fields to update' });

    values.push(id);
    db.prepare(`UPDATE teams SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    return res.json({ success: true, data: team });
  } catch (err) {
    console.error('admin/teams/:id PUT error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/admin/players
router.get('/players', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const players = db.prepare(`
      SELECT p.*, t.name as team_name, t.abbreviation as team_abbr
      FROM players p
      JOIN teams t ON t.id = p.team_id
      WHERE t.season_id = ?
      ORDER BY t.conference, t.seed, p.name
    `).all(season.id);

    return res.json({ success: true, data: players });
  } catch (err) {
    console.error('admin/players error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/admin/players
router.post('/players', (req, res) => {
  try {
    const { team_id, name, position } = req.body;
    if (!team_id || !name) return res.status(400).json({ success: false, error: 'team_id and name are required' });

    const result = db.prepare('INSERT INTO players (team_id, name, position) VALUES (?, ?, ?)').run(team_id, name, position || null);
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ success: true, data: player });
  } catch (err) {
    console.error('admin/players POST error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/admin/players/:id
router.put('/players/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, position, team_id } = req.body;

    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (position !== undefined) { fields.push('position = ?'); values.push(position); }
    if (team_id !== undefined) { fields.push('team_id = ?'); values.push(team_id); }

    if (!fields.length) return res.status(400).json({ success: false, error: 'No fields to update' });

    values.push(id);
    db.prepare(`UPDATE players SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    return res.json({ success: true, data: player });
  } catch (err) {
    console.error('admin/players/:id PUT error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/admin/players/:id
router.delete('/players/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM players WHERE id = ?').run(id);
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('admin/players/:id DELETE error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, is_admin, entry_fee_paid, created_at FROM users ORDER BY created_at').all();
    return res.json({ success: true, data: users });
  } catch (err) {
    console.error('admin/users error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { entry_fee_paid, is_admin } = req.body;

    const fields = [];
    const values = [];
    if (entry_fee_paid !== undefined) { fields.push('entry_fee_paid = ?'); values.push(entry_fee_paid ? 1 : 0); }
    if (is_admin !== undefined) { fields.push('is_admin = ?'); values.push(is_admin ? 1 : 0); }

    if (!fields.length) return res.status(400).json({ success: false, error: 'No fields to update' });

    values.push(id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const user = db.prepare('SELECT id, name, email, is_admin, entry_fee_paid, created_at FROM users WHERE id = ?').get(id);
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error('admin/users/:id PATCH error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/admin/payouts
router.get('/payouts', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const payouts = db.prepare(`
      SELECT py.*, u.name as user_name, u.email
      FROM payouts py
      JOIN users u ON u.id = py.user_id
      WHERE py.season_id = ?
      ORDER BY py.pool_type, py.place
    `).all(season.id);

    return res.json({ success: true, data: payouts });
  } catch (err) {
    console.error('admin/payouts error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/admin/payouts
router.post('/payouts', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const { user_id, pool_type, place, amount } = req.body;
    if (!user_id || !pool_type || !place || amount === undefined) {
      return res.status(400).json({ success: false, error: 'user_id, pool_type, place, amount are required' });
    }

    const result = db.prepare(`
      INSERT INTO payouts (season_id, user_id, pool_type, place, amount)
      VALUES (?, ?, ?, ?, ?)
    `).run(season.id, user_id, pool_type, place, amount);

    const payout = db.prepare('SELECT * FROM payouts WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ success: true, data: payout });
  } catch (err) {
    console.error('admin/payouts POST error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/admin/payouts/:id
router.put('/payouts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { is_paid } = req.body;

    db.prepare('UPDATE payouts SET is_paid = ? WHERE id = ?').run(is_paid ? 1 : 0, id);
    const payout = db.prepare('SELECT * FROM payouts WHERE id = ?').get(id);
    return res.json({ success: true, data: payout });
  } catch (err) {
    console.error('admin/payouts/:id PUT error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/admin/season
router.get('/season', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });
    return res.json({ success: true, data: season });
  } catch (err) {
    console.error('admin/season GET error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/admin/season
router.post('/season', (req, res) => {
  try {
    const { year, entry_fee_amount, prize_pool_total, main_event_payout, side_pot_payout } = req.body;

    const existing = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (existing) {
      const fields = [];
      const values = [];
      if (year !== undefined) { fields.push('year = ?'); values.push(year); }
      if (entry_fee_amount !== undefined) { fields.push('entry_fee_amount = ?'); values.push(entry_fee_amount); }
      if (prize_pool_total !== undefined) { fields.push('prize_pool_total = ?'); values.push(prize_pool_total); }
      if (main_event_payout !== undefined) { fields.push('main_event_payout = ?'); values.push(JSON.stringify(main_event_payout)); }
      if (side_pot_payout !== undefined) { fields.push('side_pot_payout = ?'); values.push(JSON.stringify(side_pot_payout)); }

      if (fields.length) {
        values.push(existing.id);
        db.prepare(`UPDATE seasons SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }

      const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(existing.id);
      return res.json({ success: true, data: season });
    } else {
      if (!year) return res.status(400).json({ success: false, error: 'year is required' });
      const result = db.prepare(`
        INSERT INTO seasons (year, is_active, entry_fee_amount, prize_pool_total, main_event_payout, side_pot_payout)
        VALUES (?, 1, ?, ?, ?, ?)
      `).run(year, entry_fee_amount || 0, prize_pool_total || 0, JSON.stringify(main_event_payout || []), JSON.stringify(side_pot_payout || []));
      const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(result.lastInsertRowid);
      return res.status(201).json({ success: true, data: season });
    }
  } catch (err) {
    console.error('admin/season POST error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const total_participants = db.prepare(`
      SELECT COUNT(DISTINCT u.id) as count FROM users u
      JOIN picks p ON p.user_id = u.id
      JOIN series se ON se.id = p.series_id
      JOIN rounds r ON r.id = se.round_id
      WHERE r.season_id = ?
    `).get(season.id);

    const fees_collected = db.prepare(`
      SELECT COUNT(*) as count, SUM(s.entry_fee_amount) as total
      FROM users u, seasons s
      WHERE u.entry_fee_paid = 1 AND s.id = ?
    `).get(season.id);

    // Most popular picks per series
    const series = db.prepare(`
      SELECT se.id, ht.name as ht_name, lt.name as lt_name
      FROM series se
      JOIN rounds r ON r.id = se.round_id
      JOIN teams ht ON ht.id = se.higher_seed_team_id
      JOIN teams lt ON lt.id = se.lower_seed_team_id
      WHERE r.season_id = ?
    `).all(season.id);

    const popular_picks = series.map(s => {
      const picks = db.prepare(`
        SELECT pt.name as team_name, p.pick_games, COUNT(*) as count
        FROM picks p
        JOIN teams pt ON pt.id = p.pick_winner_team_id
        WHERE p.series_id = ?
        GROUP BY p.pick_winner_team_id, p.pick_games
        ORDER BY count DESC
        LIMIT 3
      `).all(s.id);
      return { series_id: s.id, matchup: `${s.ht_name} vs ${s.lt_name}`, top_picks: picks };
    });

    return res.json({
      success: true,
      data: {
        total_participants: total_participants.count,
        fees_collected: fees_collected.total || 0,
        users_paid: fees_collected.count,
        popular_picks,
      }
    });
  } catch (err) {
    console.error('admin/stats error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
