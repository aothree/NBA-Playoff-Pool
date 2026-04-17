const express = require('express');
const router = express.Router();
const db = require('../db/index');

// GET /api/seasons/current
router.get('/current', (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (!season) return res.status(404).json({ success: false, error: 'No active season' });

    const rounds = db.prepare('SELECT * FROM rounds WHERE season_id = ? ORDER BY round_number').all(season.id);

    return res.json({ success: true, data: { ...season, rounds } });
  } catch (err) {
    console.error('seasons/current error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
