const express = require('express');
const router = express.Router();
const db = require('../db/index');

// GET /api/stats/leading-scorers
router.get('/leading-scorers', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const players = db.prepare(`
      SELECT player_name, team, games_played, total_points,
        CASE WHEN games_played > 0 THEN ROUND(CAST(total_points AS REAL) / games_played, 1) ELSE 0 END as ppg
      FROM playoff_player_stats
      WHERE season_id = ?
      ORDER BY total_points DESC
    `).all(season.id);

    return res.json({ success: true, data: players });
  } catch (err) {
    console.error('stats/leading-scorers error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
