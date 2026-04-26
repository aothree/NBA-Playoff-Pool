require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('./db/index');

const PORT = process.env.PORT || 3000;

/**
 * Safe auto-initialization for empty databases.
 * This ONLY runs when the database has no tables (fresh volume).
 * It NEVER deletes or overwrites existing data.
 */
async function autoInitIfEmpty() {
  // Check if the users table exists
  let hasUsers = false;
  try {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    hasUsers = !!result;
  } catch (e) {
    hasUsers = false;
  }

  if (hasUsers) {
    console.log('Database already initialized — skipping auto-init');
    return;
  }

  console.log('Empty database detected — running safe auto-initialization...');

  // 1. Run schema (all CREATE TABLE IF NOT EXISTS — safe on existing DBs)
  const schemaPath = path.join(__dirname, 'db', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('FATAL: schema.sql not found at', schemaPath);
    process.exit(1);
  }
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  console.log('Schema created');

  // 2. Seed the base data (season, round, teams, players, series, admin user)
  const seedAll = db.transaction(() => {
    // ── Season
    const seasonId = db.prepare(`
      INSERT INTO seasons (year, is_active, entry_fee_amount, prize_pool_total, main_event_payout, side_pot_payout)
      VALUES ('2025-26', 1, 50, 0, '[]', '[]')
    `).run().lastInsertRowid;

    // ── Round 1 (no auto-lock — admin controls locks manually)
    const roundId = db.prepare(`
      INSERT INTO rounds (season_id, round_number, name, picks_lock_datetime, is_active)
      VALUES (?, 1, 'First Round', NULL, 1)
    `).run(seasonId).lastInsertRowid;

    // ── Teams
    const t = db.prepare(`INSERT INTO teams (season_id, name, abbreviation, conference, seed) VALUES (?, ?, ?, ?, ?)`);
    const team = {};

    // EAST
    team.DET = t.run(seasonId, 'Detroit Pistons',        'DET', 'East', 1).lastInsertRowid;
    team.BOS = t.run(seasonId, 'Boston Celtics',         'BOS', 'East', 2).lastInsertRowid;
    team.NYK = t.run(seasonId, 'New York Knicks',        'NYK', 'East', 3).lastInsertRowid;
    team.CLE = t.run(seasonId, 'Cleveland Cavaliers',    'CLE', 'East', 4).lastInsertRowid;
    team.TOR = t.run(seasonId, 'Toronto Raptors',        'TOR', 'East', 5).lastInsertRowid;
    team.ATL = t.run(seasonId, 'Atlanta Hawks',          'ATL', 'East', 6).lastInsertRowid;
    team.PHI = t.run(seasonId, 'Philadelphia 76ers',     'PHI', 'East', 7).lastInsertRowid;
    team.ORL = t.run(seasonId, 'Orlando Magic',          'ORL', 'East', 8).lastInsertRowid;

    // WEST
    team.OKC = t.run(seasonId, 'Oklahoma City Thunder',  'OKC', 'West', 1).lastInsertRowid;
    team.SAS = t.run(seasonId, 'San Antonio Spurs',      'SAS', 'West', 2).lastInsertRowid;
    team.DEN = t.run(seasonId, 'Denver Nuggets',         'DEN', 'West', 3).lastInsertRowid;
    team.LAL = t.run(seasonId, 'Los Angeles Lakers',     'LAL', 'West', 4).lastInsertRowid;
    team.HOU = t.run(seasonId, 'Houston Rockets',        'HOU', 'West', 5).lastInsertRowid;
    team.MIN = t.run(seasonId, 'Minnesota Timberwolves', 'MIN', 'West', 6).lastInsertRowid;
    team.POR = t.run(seasonId, 'Portland Trail Blazers', 'POR', 'West', 7).lastInsertRowid;
    team.PHX = t.run(seasonId, 'Phoenix Suns',           'PHX', 'West', 8).lastInsertRowid;

    // EXTRAS
    team.CHA = t.run(seasonId, 'Charlotte Hornets',      'CHA', 'East', 0).lastInsertRowid;
    team.LAC = t.run(seasonId, 'LA Clippers',            'LAC', 'West', 0).lastInsertRowid;
    team.GSW = t.run(seasonId, 'Golden State Warriors',  'GSW', 'West', 0).lastInsertRowid;
    team.MIA = t.run(seasonId, 'Miami Heat',             'MIA', 'East', 0).lastInsertRowid;
    console.log('Created 20 teams');

    // ── Players
    const p = db.prepare(`INSERT INTO players (team_id, name, position) VALUES (?, ?, ?)`);

    // Detroit Pistons
    p.run(team.DET, 'Cade Cunningham', 'G'); p.run(team.DET, 'Jalen Duren', 'C');
    p.run(team.DET, 'Tobias Harris', 'F'); p.run(team.DET, 'Ronald Holland II', 'F');
    p.run(team.DET, 'Kevin Huerter', 'G'); p.run(team.DET, 'Caris LeVert', 'G');
    p.run(team.DET, 'Javonte Green', 'G'); p.run(team.DET, 'Daniss Jenkins', 'G');
    p.run(team.DET, 'Bobi Klintman', 'F'); p.run(team.DET, 'Chaz Lanier', 'G');
    p.run(team.DET, 'Ausar Thompson', 'F'); p.run(team.DET, 'Isaiah Stewart', 'C');

    // Boston Celtics
    p.run(team.BOS, 'Jayson Tatum', 'F'); p.run(team.BOS, 'Jaylen Brown', 'G');
    p.run(team.BOS, 'Kristaps Porzingis', 'C'); p.run(team.BOS, 'Jrue Holiday', 'G');
    p.run(team.BOS, 'Derrick White', 'G'); p.run(team.BOS, 'Payton Pritchard', 'G');
    p.run(team.BOS, 'Al Horford', 'C'); p.run(team.BOS, 'Sam Hauser', 'F');
    p.run(team.BOS, 'Luke Kornet', 'C'); p.run(team.BOS, 'Xavier Tillman', 'F');
    p.run(team.BOS, 'Baylor Scheierman', 'F');

    // Philadelphia 76ers
    p.run(team.PHI, 'Joel Embiid', 'C'); p.run(team.PHI, 'Tyrese Maxey', 'G');
    p.run(team.PHI, 'Paul George', 'F'); p.run(team.PHI, 'Caleb Martin', 'F');
    p.run(team.PHI, 'Kelly Oubre Jr.', 'G'); p.run(team.PHI, 'Kyle Lowry', 'G');
    p.run(team.PHI, 'Andre Drummond', 'C'); p.run(team.PHI, 'Guerschon Yabusele', 'F');
    p.run(team.PHI, 'Eric Gordon', 'G'); p.run(team.PHI, 'Jared McCain', 'G');
    p.run(team.PHI, 'KJ Martin', 'F');

    // New York Knicks
    p.run(team.NYK, 'Jalen Brunson', 'G'); p.run(team.NYK, 'Karl-Anthony Towns', 'C');
    p.run(team.NYK, 'Mikal Bridges', 'F'); p.run(team.NYK, 'OG Anunoby', 'F');
    p.run(team.NYK, 'Josh Hart', 'G'); p.run(team.NYK, 'Miles McBride', 'G');
    p.run(team.NYK, 'Mitchell Robinson', 'C'); p.run(team.NYK, 'Precious Achiuwa', 'F');
    p.run(team.NYK, 'Cameron Payne', 'G'); p.run(team.NYK, 'Landry Shamet', 'G');
    p.run(team.NYK, 'Tyler Kolek', 'G');

    // Atlanta Hawks
    p.run(team.ATL, 'Trae Young', 'G'); p.run(team.ATL, 'Jalen Johnson', 'F');
    p.run(team.ATL, "De'Andre Hunter", 'F'); p.run(team.ATL, 'Dyson Daniels', 'G');
    p.run(team.ATL, 'Clint Capela', 'C'); p.run(team.ATL, 'Bogdan Bogdanovic', 'G');
    p.run(team.ATL, 'Zaccharie Risacher', 'F'); p.run(team.ATL, 'Onyeka Okongwu', 'C');
    p.run(team.ATL, 'Garrison Mathews', 'G'); p.run(team.ATL, 'Kobe Bufkin', 'G');
    p.run(team.ATL, 'Larry Nance Jr.', 'F');

    // Cleveland Cavaliers
    p.run(team.CLE, 'Donovan Mitchell', 'G'); p.run(team.CLE, 'Darius Garland', 'G');
    p.run(team.CLE, 'Evan Mobley', 'F'); p.run(team.CLE, 'Jarrett Allen', 'C');
    p.run(team.CLE, 'James Harden', 'G'); p.run(team.CLE, 'Max Strus', 'G');
    p.run(team.CLE, 'Dean Wade', 'F'); p.run(team.CLE, 'Sam Merrill', 'G');
    p.run(team.CLE, 'Georges Niang', 'F'); p.run(team.CLE, 'Isaac Okoro', 'F');
    p.run(team.CLE, 'Ty Jerome', 'G');

    // Toronto Raptors
    p.run(team.TOR, 'Scottie Barnes', 'F'); p.run(team.TOR, 'RJ Barrett', 'G');
    p.run(team.TOR, 'Immanuel Quickley', 'G'); p.run(team.TOR, 'Jakob Poeltl', 'C');
    p.run(team.TOR, 'Gradey Dick', 'G'); p.run(team.TOR, 'Ochai Agbaji', 'G');
    p.run(team.TOR, 'Kelly Olynyk', 'C'); p.run(team.TOR, 'Bruce Brown', 'G');
    p.run(team.TOR, "Ja'Kobe Walter", 'G'); p.run(team.TOR, 'Trayce Jackson-Davis', 'F');
    p.run(team.TOR, 'Chris Boucher', 'F');

    // Orlando Magic
    p.run(team.ORL, 'Paolo Banchero', 'F'); p.run(team.ORL, 'Franz Wagner', 'F');
    p.run(team.ORL, 'Jalen Suggs', 'G'); p.run(team.ORL, 'Wendell Carter Jr.', 'C');
    p.run(team.ORL, 'Cole Anthony', 'G'); p.run(team.ORL, 'Jonathan Isaac', 'F');
    p.run(team.ORL, 'Kentavious Caldwell-Pope', 'G'); p.run(team.ORL, 'Gary Harris', 'G');
    p.run(team.ORL, 'Moritz Wagner', 'C'); p.run(team.ORL, 'Anthony Black', 'G');

    // Oklahoma City Thunder
    p.run(team.OKC, 'Shai Gilgeous-Alexander', 'G'); p.run(team.OKC, 'Jalen Williams', 'F');
    p.run(team.OKC, 'Chet Holmgren', 'C'); p.run(team.OKC, 'Luguentz Dort', 'G');
    p.run(team.OKC, 'Isaiah Hartenstein', 'C'); p.run(team.OKC, 'Alex Caruso', 'G');
    p.run(team.OKC, 'Aaron Wiggins', 'G'); p.run(team.OKC, 'Kenrich Williams', 'F');
    p.run(team.OKC, 'Jaylin Williams', 'F'); p.run(team.OKC, 'Isaiah Joe', 'G');
    p.run(team.OKC, 'Cason Wallace', 'G'); p.run(team.OKC, 'Dillon Jones', 'G');

    // Portland Trail Blazers
    p.run(team.POR, 'Anfernee Simons', 'G'); p.run(team.POR, 'Scoot Henderson', 'G');
    p.run(team.POR, 'Shaedon Sharpe', 'G'); p.run(team.POR, 'Deandre Ayton', 'C');
    p.run(team.POR, 'Jerami Grant', 'F'); p.run(team.POR, 'Deni Avdija', 'F');
    p.run(team.POR, 'Donovan Clingan', 'C'); p.run(team.POR, 'Toumani Camara', 'F');
    p.run(team.POR, 'Dalano Banton', 'G'); p.run(team.POR, 'Robert Williams III', 'C');
    p.run(team.POR, 'Duop Reath', 'C');

    // San Antonio Spurs
    p.run(team.SAS, 'Victor Wembanyama', 'C'); p.run(team.SAS, 'Stephon Castle', 'G');
    p.run(team.SAS, 'Dylan Harper', 'G'); p.run(team.SAS, 'Chris Paul', 'G');
    p.run(team.SAS, 'Devin Vassell', 'G'); p.run(team.SAS, 'Keldon Johnson', 'F');
    p.run(team.SAS, 'Harrison Barnes', 'F'); p.run(team.SAS, 'Jeremy Sochan', 'F');
    p.run(team.SAS, 'Zach Collins', 'C'); p.run(team.SAS, 'Carter Bryant', 'F');
    p.run(team.SAS, 'Julian Champagnie', 'F'); p.run(team.SAS, 'Kam Jones', 'G');

    // Phoenix Suns
    p.run(team.PHX, 'Kevin Durant', 'F'); p.run(team.PHX, 'Devin Booker', 'G');
    p.run(team.PHX, 'Bradley Beal', 'G'); p.run(team.PHX, 'Mark Williams', 'C');
    p.run(team.PHX, 'Tyus Jones', 'G'); p.run(team.PHX, 'Ryan Dunn', 'F');
    p.run(team.PHX, "Royce O'Neale", 'F'); p.run(team.PHX, 'Oso Ighodaro', 'C');
    p.run(team.PHX, 'Grayson Allen', 'G'); p.run(team.PHX, 'Mason Plumlee', 'C');
    p.run(team.PHX, 'Monte Morris', 'G');

    // Denver Nuggets
    p.run(team.DEN, 'Nikola Jokic', 'C'); p.run(team.DEN, 'Jamal Murray', 'G');
    p.run(team.DEN, 'Michael Porter Jr.', 'F'); p.run(team.DEN, 'Aaron Gordon', 'F');
    p.run(team.DEN, 'Christian Braun', 'G'); p.run(team.DEN, 'Russell Westbrook', 'G');
    p.run(team.DEN, 'Peyton Watson', 'F'); p.run(team.DEN, 'Julian Strawther', 'G');
    p.run(team.DEN, 'Dario Saric', 'F'); p.run(team.DEN, 'Hunter Tyson', 'F');
    p.run(team.DEN, 'DeAndre Jordan', 'C');

    // Minnesota Timberwolves
    p.run(team.MIN, 'Anthony Edwards', 'G'); p.run(team.MIN, 'Julius Randle', 'F');
    p.run(team.MIN, 'Rudy Gobert', 'C'); p.run(team.MIN, 'Jaden McDaniels', 'F');
    p.run(team.MIN, 'Naz Reid', 'C'); p.run(team.MIN, 'Donte DiVincenzo', 'G');
    p.run(team.MIN, 'Nickeil Alexander-Walker', 'G'); p.run(team.MIN, 'Rob Dillingham', 'G');
    p.run(team.MIN, 'Josh Minott', 'F'); p.run(team.MIN, 'Leonard Miller', 'F');
    p.run(team.MIN, 'Joe Ingles', 'F');

    // Los Angeles Lakers
    p.run(team.LAL, 'LeBron James', 'F'); p.run(team.LAL, 'Anthony Davis', 'C');
    p.run(team.LAL, 'Luka Doncic', 'G'); p.run(team.LAL, 'Austin Reaves', 'G');
    p.run(team.LAL, 'Rui Hachimura', 'F'); p.run(team.LAL, 'Dalton Knecht', 'G');
    p.run(team.LAL, 'Max Christie', 'G'); p.run(team.LAL, 'Gabe Vincent', 'G');
    p.run(team.LAL, 'Jarred Vanderbilt', 'F'); p.run(team.LAL, 'Jaxson Hayes', 'C');
    p.run(team.LAL, 'Christian Wood', 'C');

    // Houston Rockets
    p.run(team.HOU, 'Jalen Green', 'G'); p.run(team.HOU, 'Alperen Sengun', 'C');
    p.run(team.HOU, 'Fred VanVleet', 'G'); p.run(team.HOU, 'Jabari Smith Jr.', 'F');
    p.run(team.HOU, 'Amen Thompson', 'F'); p.run(team.HOU, 'Dillon Brooks', 'F');
    p.run(team.HOU, 'Tari Eason', 'F'); p.run(team.HOU, 'Reed Sheppard', 'G');
    p.run(team.HOU, 'Cam Whitmore', 'F'); p.run(team.HOU, 'Jeff Green', 'F');
    p.run(team.HOU, 'Steven Adams', 'C');

    // ── Extra Team Rosters
    // Charlotte Hornets
    p.run(team.CHA, 'LaMelo Ball', 'G'); p.run(team.CHA, 'Miles Bridges', 'F');
    p.run(team.CHA, 'Coby White', 'G'); p.run(team.CHA, 'Josh Green', 'G');
    p.run(team.CHA, 'Grant Williams', 'F'); p.run(team.CHA, 'Kon Knueppel', 'G');
    p.run(team.CHA, 'Nick Smith Jr.', 'G'); p.run(team.CHA, 'Pat Connaughton', 'G');
    p.run(team.CHA, 'Liam McNeeley', 'F'); p.run(team.CHA, 'Mike Conley', 'G');
    p.run(team.CHA, 'Moussa Diabate', 'F'); p.run(team.CHA, 'Sion James', 'G');

    // LA Clippers
    p.run(team.LAC, 'James Harden', 'G'); p.run(team.LAC, 'Ivica Zubac', 'C');
    p.run(team.LAC, 'Norman Powell', 'G'); p.run(team.LAC, 'Terance Mann', 'F');
    p.run(team.LAC, 'Kris Dunn', 'G'); p.run(team.LAC, 'Derrick Jones Jr.', 'F');
    p.run(team.LAC, 'Amir Coffey', 'G'); p.run(team.LAC, 'Bones Hyland', 'G');
    p.run(team.LAC, 'Brandon Boston Jr.', 'G'); p.run(team.LAC, 'P.J. Tucker', 'F');

    // Golden State Warriors
    p.run(team.GSW, 'Stephen Curry', 'G'); p.run(team.GSW, 'Andrew Wiggins', 'F');
    p.run(team.GSW, 'Draymond Green', 'F'); p.run(team.GSW, 'Jonathan Kuminga', 'F');
    p.run(team.GSW, 'Brandin Podziemski', 'G'); p.run(team.GSW, 'Kevon Looney', 'C');
    p.run(team.GSW, 'Gary Payton II', 'G'); p.run(team.GSW, 'Moses Moody', 'G');
    p.run(team.GSW, 'Buddy Hield', 'G'); p.run(team.GSW, 'Lindy Waters III', 'G');

    // Miami Heat
    p.run(team.MIA, 'Bam Adebayo', 'C'); p.run(team.MIA, 'Tyler Herro', 'G');
    p.run(team.MIA, 'Terry Rozier', 'G'); p.run(team.MIA, 'Jaime Jaquez Jr.', 'F');
    p.run(team.MIA, 'Nikola Jovic', 'F'); p.run(team.MIA, 'Haywood Highsmith', 'F');
    p.run(team.MIA, 'Duncan Robinson', 'G'); p.run(team.MIA, 'Josh Richardson', 'G');
    p.run(team.MIA, 'Kevin Love', 'C'); p.run(team.MIA, 'Pelle Larsson', 'G');

    console.log('Created rosters for all 20 teams');

    // ── Series Matchups (Round 1)
    const s = db.prepare(`INSERT INTO series (round_id, higher_seed_team_id, lower_seed_team_id, conference, series_order) VALUES (?, ?, ?, ?, ?)`);
    s.run(roundId, team.DET, team.ORL, 'East', 1);  // (1) Pistons vs (8) Magic
    s.run(roundId, team.BOS, team.PHI, 'East', 2);  // (2) Celtics vs (7) 76ers
    s.run(roundId, team.NYK, team.ATL, 'East', 3);  // (3) Knicks vs (6) Hawks
    s.run(roundId, team.CLE, team.TOR, 'East', 4);  // (4) Cavaliers vs (5) Raptors
    s.run(roundId, team.OKC, team.PHX, 'West', 5);  // (1) Thunder vs (8) Suns
    s.run(roundId, team.SAS, team.POR, 'West', 6);  // (2) Spurs vs (7) Blazers
    s.run(roundId, team.DEN, team.MIN, 'West', 7);  // (3) Nuggets vs (6) Wolves
    s.run(roundId, team.LAL, team.HOU, 'West', 8);  // (4) Lakers vs (5) Rockets
    console.log('Created 8 Round 1 series matchups');

    // ── Admin User
    const pw = bcrypt.hashSync('password123', 10);
    db.prepare(`INSERT INTO users (name, email, password_hash, is_admin, entry_fee_paid) VALUES (?, ?, ?, ?, ?)`).run('Admin User', 'admin@test.com', pw, 1, 1);
    console.log('Created admin user (admin@test.com / password123)');
  });

  seedAll();
  console.log('Auto-initialization complete!');
}

async function start() {
  // Initialize sql.js database before anything else
  await db.initDb();
  console.log('Database initialized');

  // Auto-seed if database is empty (fresh volume)
  await autoInitIfEmpty();

  const app = express();

  // Middleware
  if (process.env.NODE_ENV === 'production') {
    app.use(cors());
  } else {
    app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
  }
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

  // Production: serve React build
  if (process.env.NODE_ENV === 'production') {
    const clientBuild = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(clientBuild));

    app.get('*', (req, res) => {
      res.sendFile(path.join(clientBuild, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`NBA Playoff Pool server running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
