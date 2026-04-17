const express = require('express');
const router = express.Router();
const db = require('../db/index');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/picks/me
router.get('/me', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const rounds = db.prepare('SELECT * FROM rounds WHERE season_id = ? ORDER BY round_number').all(season.id);

    const result = rounds.map(round => {
      const series = db.prepare(`
        SELECT se.*,
          ht.name as ht_name, ht.abbreviation as ht_abbr, ht.seed as ht_seed,
          lt.name as lt_name, lt.abbreviation as lt_abbr, lt.seed as lt_seed,
          wt.name as wt_name,
          p.id as pick_id, p.pick_winner_team_id, p.pick_games, p.pick_leading_scorer, p.submitted_at,
          pt.name as pick_winner_name,
          sc.points_winner, sc.points_games, sc.points_scorer, sc.total as score_total
        FROM series se
        JOIN teams ht ON ht.id = se.higher_seed_team_id
        JOIN teams lt ON lt.id = se.lower_seed_team_id
        LEFT JOIN teams wt ON wt.id = se.result_winner_team_id
        LEFT JOIN picks p ON p.series_id = se.id AND p.user_id = ?
        LEFT JOIN teams pt ON pt.id = p.pick_winner_team_id
        LEFT JOIN scores sc ON sc.series_id = se.id AND sc.user_id = ?
        WHERE se.round_id = ?
        ORDER BY se.series_order
      `).all(req.user.id, req.user.id, round.id);

      return { ...round, series };
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('picks/me error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/picks/me/:roundId
router.get('/me/:roundId', (req, res) => {
  try {
    const { roundId } = req.params;
    const series = db.prepare(`
      SELECT se.*,
        ht.name as ht_name, ht.abbreviation as ht_abbr, ht.seed as ht_seed,
        lt.name as lt_name, lt.abbreviation as lt_abbr, lt.seed as lt_seed,
        p.id as pick_id, p.pick_winner_team_id, p.pick_games, p.pick_leading_scorer,
        pt.name as pick_winner_name,
        sc.points_winner, sc.points_games, sc.points_scorer, sc.total as score_total
      FROM series se
      JOIN teams ht ON ht.id = se.higher_seed_team_id
      JOIN teams lt ON lt.id = se.lower_seed_team_id
      LEFT JOIN picks p ON p.series_id = se.id AND p.user_id = ?
      LEFT JOIN teams pt ON pt.id = p.pick_winner_team_id
      LEFT JOIN scores sc ON sc.series_id = se.id AND sc.user_id = ?
      WHERE se.round_id = ?
      ORDER BY se.series_order
    `).all(req.user.id, req.user.id, roundId);

    return res.json({ success: true, data: series });
  } catch (err) {
    console.error('picks/me/:roundId error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/picks
router.post('/', (req, res) => {
  try {
    const { series_id, pick_selection, pick_leading_scorer } = req.body;
    if (!series_id || !pick_selection) {
      return res.status(400).json({ success: false, error: 'series_id and pick_selection are required' });
    }

    // Get series info — include BOTH series-level and round-level lock times
    const series = db.prepare(`
      SELECT se.*, se.picks_lock_datetime as series_lock, r.picks_lock_datetime as round_lock,
        ht.id as ht_id, ht.name as ht_name,
        lt.id as lt_id, lt.name as lt_name
      FROM series se
      JOIN rounds r ON r.id = se.round_id
      JOIN teams ht ON ht.id = se.higher_seed_team_id
      JOIN teams lt ON lt.id = se.lower_seed_team_id
      WHERE se.id = ?
    `).get(series_id);

    if (!series) return res.status(404).json({ success: false, error: 'Series not found' });

    // Check lock: series-level lock takes priority, then fall back to round-level
    const lockDatetime = series.series_lock || series.round_lock;
    if (lockDatetime) {
      const lockTime = new Date(lockDatetime);
      if (new Date() > lockTime) {
        return res.status(403).json({ success: false, error: 'Picks are locked for this series' });
      }
    }

    // Parse pick_selection: "TeamName in N"
    const inIdx = pick_selection.toLowerCase().lastIndexOf(' in ');
    if (inIdx === -1) {
      return res.status(400).json({ success: false, error: 'Invalid pick_selection format. Use "Team Name in N"' });
    }

    const teamNamePart = pick_selection.slice(0, inIdx).trim();
    const gamesPart = parseInt(pick_selection.slice(inIdx + 4).trim());

    if (isNaN(gamesPart) || gamesPart < 4 || gamesPart > 7) {
      return res.status(400).json({ success: false, error: 'Games must be between 4 and 7' });
    }

    // Match team name against series teams
    const htLower = series.ht_name.toLowerCase();
    const ltLower = series.lt_name.toLowerCase();
    const pickLower = teamNamePart.toLowerCase();

    let pick_winner_team_id = null;
    if (htLower.includes(pickLower) || pickLower.includes(htLower.split(' ').pop())) {
      pick_winner_team_id = series.ht_id;
    } else if (ltLower.includes(pickLower) || pickLower.includes(ltLower.split(' ').pop())) {
      pick_winner_team_id = series.lt_id;
    }

    if (!pick_winner_team_id) {
      // Try partial match on any word
      const htWords = htLower.split(' ');
      const ltWords = ltLower.split(' ');
      if (htWords.some(w => pickLower.includes(w) && w.length > 3)) pick_winner_team_id = series.ht_id;
      else if (ltWords.some(w => pickLower.includes(w) && w.length > 3)) pick_winner_team_id = series.lt_id;
    }

    if (!pick_winner_team_id) {
      return res.status(400).json({ success: false, error: `Could not match "${teamNamePart}" to either team in this series` });
    }

    // Upsert pick
    db.prepare(`
      INSERT INTO picks (user_id, series_id, pick_winner_team_id, pick_games, pick_leading_scorer, submitted_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, series_id) DO UPDATE SET
        pick_winner_team_id = excluded.pick_winner_team_id,
        pick_games = excluded.pick_games,
        pick_leading_scorer = excluded.pick_leading_scorer,
        submitted_at = excluded.submitted_at
    `).run(req.user.id, series_id, pick_winner_team_id, gamesPart, pick_leading_scorer || null);

    const pick = db.prepare('SELECT * FROM picks WHERE user_id = ? AND series_id = ?').get(req.user.id, series_id);
    return res.json({ success: true, data: pick });
  } catch (err) {
    console.error('picks POST error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
