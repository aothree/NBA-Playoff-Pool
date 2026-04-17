CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  entry_fee_paid INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  entry_fee_amount REAL DEFAULT 0,
  prize_pool_total REAL DEFAULT 0,
  main_event_payout TEXT DEFAULT '[]',
  side_pot_payout TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  round_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  picks_lock_datetime TEXT,
  is_active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  conference TEXT NOT NULL,
  seed INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  name TEXT NOT NULL,
  position TEXT
);

CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL REFERENCES rounds(id),
  higher_seed_team_id INTEGER NOT NULL REFERENCES teams(id),
  lower_seed_team_id INTEGER NOT NULL REFERENCES teams(id),
  conference TEXT NOT NULL,
  result_winner_team_id INTEGER REFERENCES teams(id),
  result_games INTEGER,
  result_leading_scorer TEXT,
  result_leading_scorer_points INTEGER,
  is_complete INTEGER NOT NULL DEFAULT 0,
  series_order INTEGER NOT NULL DEFAULT 0,
  picks_lock_datetime TEXT
);

CREATE TABLE IF NOT EXISTS picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  series_id INTEGER NOT NULL REFERENCES series(id),
  pick_winner_team_id INTEGER REFERENCES teams(id),
  pick_games INTEGER,
  pick_leading_scorer TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, series_id)
);

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  series_id INTEGER NOT NULL REFERENCES series(id),
  points_winner INTEGER NOT NULL DEFAULT 0,
  points_games INTEGER NOT NULL DEFAULT 0,
  points_scorer INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, series_id)
);

CREATE TABLE IF NOT EXISTS playoff_player_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL,
  team TEXT NOT NULL,
  games_played INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  season_id INTEGER REFERENCES seasons(id),
  UNIQUE(player_name, season_id)
);

CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  pool_type TEXT NOT NULL,
  place INTEGER NOT NULL,
  amount REAL NOT NULL,
  is_paid INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mvp_picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  round_id INTEGER NOT NULL REFERENCES rounds(id),
  conference TEXT NOT NULL,
  pick_mvp TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, round_id, conference)
);

CREATE TABLE IF NOT EXISTS mvp_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL REFERENCES rounds(id),
  conference TEXT NOT NULL,
  result_mvp TEXT,
  UNIQUE(round_id, conference)
);
