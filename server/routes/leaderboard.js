const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { getLeaderboard, getScoringLeadersLeaderboard } = require('../services/scoringService');

// GET /api/leaderboard
router.get('/', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const leaderboard = getLeaderboard(db, season.id);
    return res.json({ success: true, data: leaderboard });
  } catch (err) {
    console.error('leaderboard error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/leaderboard/scoring-leaders
router.get('/scoring-leaders', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const leaderboard = getScoringLeadersLeaderboard(db, season.id);
    return res.json({ success: true, data: leaderboard });
  } catch (err) {
    console.error('scoring-leaders error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
