const express = require('express');
const router = express.Router();
const db = require('../db/index');

// GET /api/rounds/current
router.get('/current', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const round = db.prepare('SELECT * FROM rounds WHERE season_id = ? AND is_active = 1 LIMIT 1').get(season.id);
    if (!round) return res.status(404).json({ success: false, error: 'No active round' });

    const series = db.prepare(`
      SELECT se.*,
        ht.id as ht_id, ht.name as ht_name, ht.abbreviation as ht_abbr, ht.seed as ht_seed, ht.conference as ht_conf,
        lt.id as lt_id, lt.name as lt_name, lt.abbreviation as lt_abbr, lt.seed as lt_seed, lt.conference as lt_conf,
        wt.name as wt_name
      FROM series se
      JOIN teams ht ON ht.id = se.higher_seed_team_id
      JOIN teams lt ON lt.id = se.lower_seed_team_id
      LEFT JOIN teams wt ON wt.id = se.result_winner_team_id
      WHERE se.round_id = ?
      ORDER BY se.series_order
    `).all(round.id);

    const seriesWithTeams = series.map(s => ({
      id: s.id,
      round_id: s.round_id,
      conference: s.conference,
      series_order: s.series_order,
      is_complete: s.is_complete,
      picks_lock_datetime: s.picks_lock_datetime,
      result_winner_team_id: s.result_winner_team_id,
      result_games: s.result_games,
      result_leading_scorer: s.result_leading_scorer,
      result_leading_scorer_points: s.result_leading_scorer_points,
      result_winner_name: s.wt_name,
      higher_seed_team: { id: s.ht_id, name: s.ht_name, abbreviation: s.ht_abbr, seed: s.ht_seed, conference: s.ht_conf },
      lower_seed_team: { id: s.lt_id, name: s.lt_name, abbreviation: s.lt_abbr, seed: s.lt_seed, conference: s.lt_conf },
    }));

    return res.json({ success: true, data: { ...round, series: seriesWithTeams } });
  } catch (err) {
    console.error('rounds/current error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/rounds/:roundId/series
router.get('/:roundId/series', (req, res) => {
  try {
    const { roundId } = req.params;

    const series = db.prepare(`
      SELECT se.*,
        ht.id as ht_id, ht.name as ht_name, ht.abbreviation as ht_abbr, ht.seed as ht_seed,
        lt.id as lt_id, lt.name as lt_name, lt.abbreviation as lt_abbr, lt.seed as lt_seed
      FROM series se
      JOIN teams ht ON ht.id = se.higher_seed_team_id
      JOIN teams lt ON lt.id = se.lower_seed_team_id
      WHERE se.round_id = ?
      ORDER BY se.series_order
    `).all(roundId);

    const result = series.map(s => {
      const higherPlayers = db.prepare('SELECT * FROM players WHERE team_id = ? ORDER BY name').all(s.ht_id);
      const lowerPlayers = db.prepare('SELECT * FROM players WHERE team_id = ? ORDER BY name').all(s.lt_id);

      return {
        id: s.id,
        round_id: s.round_id,
        conference: s.conference,
        series_order: s.series_order,
        is_complete: s.is_complete,
        picks_lock_datetime: s.picks_lock_datetime,
        result_winner_team_id: s.result_winner_team_id,
        result_games: s.result_games,
        result_leading_scorer: s.result_leading_scorer,
        higher_seed_team: { id: s.ht_id, name: s.ht_name, abbreviation: s.ht_abbr, seed: s.ht_seed, players: higherPlayers },
        lower_seed_team: { id: s.lt_id, name: s.lt_name, abbreviation: s.lt_abbr, seed: s.lt_seed, players: lowerPlayers },
      };
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('rounds/:id/series error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
