const express = require('express');
const router = express.Router();
const db = require('../db/index');

// GET /api/teams
router.get('/', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const teams = db.prepare('SELECT * FROM teams WHERE season_id = ? ORDER BY conference, seed').all(season.id);
    return res.json({ success: true, data: teams });
  } catch (err) {
    console.error('teams error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
