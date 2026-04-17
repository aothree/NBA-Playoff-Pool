require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db/index');

const PORT = process.env.PORT || 3000;

async function start() {
  // Initialize sql.js database before anything else
  await db.initDb();
  console.log('Database initialized');

  const app = express();

  // Middleware
  app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
  app.use(express.json());

  // Routes (loaded after db is ready)
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/seasons', require('./routes/seasons'));
  app.use('/api/rounds', require('./routes/rounds'));
  app.use('/api/picks', require('./routes/picks'));
  app.use('/api/leaderboard', require('./routes/leaderboard'));
  app.use('/api/stats', require('./routes/stats'));
  app.use('/api/teams', require('./routes/teams'));
  app.use('/api/admin', require('./routes/admin'));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  app.listen(PORT, () => {
    console.log(`NBA Playoff Pool server running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
