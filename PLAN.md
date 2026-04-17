# NBA Playoff Pool — Build Plan

**Status:** Not started. Full spec provided by user. Build everything from scratch.

## Working Directory
`C:\Users\aorfa\Aothree_repos\NBA Playoff Pool`

## Tech Stack
- Frontend: React (Vite) + Tailwind CSS → localhost:5173
- Backend: Node.js + Express → localhost:3000
- Database: SQLite via better-sqlite3
- Auth: JWT (jsonwebtoken + bcryptjs)
- Vite proxies `/api/*` → localhost:3000

## File Structure to Build
```
NBA Playoff Pool/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── SearchableDropdown.jsx   ← custom component for leading scorer
│   │   │   ├── CountdownTimer.jsx
│   │   │   └── SeriesCard.jsx
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── PicksSubmissionPage.jsx
│   │   │   ├── LeaderboardPage.jsx
│   │   │   ├── StatsPage.jsx
│   │   │   ├── MyPicksPage.jsx
│   │   │   └── AdminPanel.jsx
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
├── server/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── seasons.js
│   │   ├── rounds.js
│   │   ├── picks.js
│   │   ├── leaderboard.js
│   │   ├── stats.js
│   │   ├── teams.js
│   │   └── admin.js
│   ├── middleware/
│   │   ├── auth.js       ← JWT verification, attach req.user
│   │   └── admin.js      ← check req.user.is_admin
│   ├── services/
│   │   ├── scoringService.js
│   │   └── nbaDataService.js
│   ├── db/
│   │   ├── schema.sql
│   │   ├── seed.js
│   │   └── index.js
│   └── index.js
├── data/                 ← created at runtime, holds pool.db
├── package.json          ← root, concurrently runs both
├── .env.example
└── PLAN.md               ← this file
```

## Build Order
1. Root `package.json` + `.env.example`
2. `server/db/schema.sql`
3. `server/db/index.js`
4. `server/db/seed.js` (see seed data below)
5. `server/middleware/auth.js` + `server/middleware/admin.js`
6. `server/services/scoringService.js`
7. `server/services/nbaDataService.js`
8. All server routes (auth, seasons, rounds, picks, leaderboard, stats, teams, admin)
9. `server/index.js`
10. `client/package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`
11. `client/src/services/api.js`
12. `client/src/hooks/useAuth.js`
13. All pages and components
14. `client/src/App.jsx` + `client/src/main.jsx`

---

## Database Schema (complete)

Tables: users, seasons, rounds, teams, players, series, picks, scores, playoff_player_stats, payouts

See full schema details in the user's original spec message. Key constraints:
- picks: UNIQUE(user_id, series_id)
- scores: UNIQUE(user_id, series_id)
- playoff_player_stats: UNIQUE(player_name, season_id)
- Foreign keys ON

---

## Scoring Rules (critical — must be exact)
- Correct winner: 5 pts
- Correct # games: 3 pts — ONLY awarded if winner is ALSO correct
- Correct leading scorer: 3 pts (case-insensitive string match)
- Max per series: 11 pts | Max total: 165 pts (15 series)

**Main Event tiebreaker:** most "exact series results" (correct winner AND correct games)
**Scoring Leaders tiebreaker:** sum of result_leading_scorer_points for correctly-picked scorers

---

## Seed Data (2025-26 Round 1)

### Eastern Conference
| Order | Higher Seed | Lower Seed | Conf |
|-------|-------------|------------|------|
| 1 | (1) Cleveland Cavaliers | (8) Miami Heat | East |
| 2 | (2) Boston Celtics | (7) Orlando Magic | East |
| 3 | (3) New York Knicks | (6) Detroit Pistons | East |
| 4 | (4) Milwaukee Bucks | (5) Indiana Pacers | East |

### Western Conference
| Order | Higher Seed | Lower Seed | Conf |
|-------|-------------|------------|------|
| 5 | (1) Oklahoma City Thunder | (8) Memphis Grizzlies | West |
| 6 | (2) Houston Rockets | (7) Golden State Warriors | West |
| 7 | (3) Los Angeles Lakers | (6) Minnesota Timberwolves | West |
| 8 | (4) Denver Nuggets | (5) Los Angeles Clippers | West |

### Key Players (10-12 per team)
- **Cavaliers**: Donovan Mitchell, Darius Garland, Evan Mobley, Jarrett Allen, Max Strus, Caris LeVert, Dean Wade, Georges Niang, Craig Porter Jr., Sam Merrill
- **Heat**: Jimmy Butler, Bam Adebayo, Tyler Herro, Terry Rozier, Nikola Jovic, Haywood Highsmith, Duncan Robinson, Josh Richardson, Jaime Jaquez Jr., Kevin Love
- **Celtics**: Jayson Tatum, Jaylen Brown, Kristaps Porzingis, Jrue Holiday, Al Horford, Payton Pritchard, Sam Hauser, Luke Kornet, Derrick White, Xavier Tillman
- **Magic**: Paolo Banchero, Franz Wagner, Wendell Carter Jr., Jalen Suggs, Cole Anthony, Markelle Fultz, Gary Harris, Jonathan Isaac, Moritz Wagner, Kentavious Caldwell-Pope
- **Knicks**: Jalen Brunson, Karl-Anthony Towns, Mikal Bridges, Josh Hart, OG Anunoby, Precious Achiuwa, Donte DiVincenzo, Miles McBride, Isaiah Hartenstein, Mitchell Robinson
- **Pistons**: Cade Cunningham, Jalen Duren, Tim Hardaway Jr., Tobias Harris, Malik Beasley, Ausar Thompson, Bojan Bogdanovic, Marcus Sasser, Ron Holland II, Isaiah Stewart
- **Bucks**: Giannis Antetokounmpo, Damian Lillard, Brook Lopez, Khris Middleton, Bobby Portis, Pat Connaughton, MarJon Beauchamp, Andre Jackson Jr., AJ Green, Malik Beasley
- **Pacers**: Tyrese Haliburton, Pascal Siakam, Myles Turner, Andrew Nembhard, Bennedict Mathurin, Obi Toppin, Isaiah Jackson, T.J. McConnell, Aaron Nesmith, James Johnson
- **Thunder**: Shai Gilgeous-Alexander, Jalen Williams, Chet Holmgren, Luguentz Dort, Isaiah Joe, Josh Giddey, Kenrich Williams, Ousmane Dieng, Aaron Wiggins, Jaylin Williams
- **Grizzlies**: Ja Morant, Desmond Bane, Jaren Jackson Jr., Zach Edey, Marcus Smart, Scotty Pippen Jr., Luke Kennard, GG Jackson II, Brandon Clarke, Jaylen Wells
- **Rockets**: Alperen Sengun, Jalen Green, Fred VanVleet, Dillon Brooks, Amen Thompson, Jabari Smith Jr., Tari Eason, Jeff Green, Cam Whitmore, Aaron Holiday
- **Warriors**: Stephen Curry, Andrew Wiggins, Draymond Green, Jonathan Kuminga, Brandin Podziemski, Kyle Anderson, Moses Moody, Kevon Looney, Gary Payton II, Trayce Jackson-Davis
- **Lakers**: LeBron James, Anthony Davis, Austin Reaves, D'Angelo Russell, Rui Hachimura, Gabe Vincent, Christian Wood, Taurean Prince, Spencer Dinwiddie, Cam Reddish
- **Timberwolves**: Anthony Edwards, Rudy Gobert, Mike Conley, Jaden McDaniels, Naz Reid, Nickeil Alexander-Walker, Monte Morris, Leonard Miller, Josh Minott, Shake Milton
- **Nuggets**: Nikola Jokic, Jamal Murray, Michael Porter Jr., Aaron Gordon, Kentavious Caldwell-Pope, Peyton Watson, Christian Braun, Reggie Jackson, Justin Holiday, DeAndre Jordan
- **Clippers**: James Harden, Ivica Zubac, Norman Powell, Nicolas Batum, Terance Mann, Russell Westbrook, Amir Coffey, Kobe Brown, Brandon Boston Jr., Kevin Porter Jr.

### Test Users
| email | password | name | is_admin | fee_paid |
|-------|----------|------|----------|----------|
| admin@test.com | password123 | Admin User | 1 | 1 |
| alice@test.com | password123 | Alice Johnson | 0 | 1 |
| bob@test.com | password123 | Bob Smith | 0 | 1 |
| carol@test.com | password123 | Carol Davis | 0 | 0 |

Create sample picks for alice and bob covering all 8 series (varied, not all correct).

### Season Settings
- year: '2025-26', is_active: 1
- entry_fee_amount: 50
- prize_pool_total: 0 (updates as fees come in)
- Round 1 picks_lock_datetime: '2026-04-19T17:30:00.000Z'

---

## API Response Format
All routes return: `{ success: true, data: ... }` or `{ success: false, error: "message" }`

---

## Key Frontend Details

### SearchableDropdown component (for leading scorer)
- Text input that filters player list as user types
- Dropdown appears showing filtered players with "(TeamName)" suffix
- Click player name to select — sets value, closes dropdown
- NOT a free-text field — must select from list
- Show selected player in input after selection
- Clear button to reset

### CountdownTimer component
- Props: targetDatetime (ISO string)
- Shows: "Xd Xh Xm Xs remaining"
- When past: "Picks Locked"
- Updates every second via setInterval

### Pick parsing (backend)
- "Lakers in 6" → split(" in ") → ["Lakers", "6"]
- Match "Lakers" against higher_seed team name and lower_seed team name (case-insensitive contains)
- pick_winner_team_id = matched team id, pick_games = 6

### Design
- Dark theme: bg-gray-950 (page), bg-gray-900 (cards), bg-gray-800 (inputs/rows)
- Accent: orange-500 for buttons, orange-400 for highlights
- Success: green-400, Error: red-400
- Tailwind throughout, no external UI libraries

---

## Environment Variables (.env.example)
```
JWT_SECRET=change-me-in-production
BALLDONTLIE_API_KEY=your-key-here
PORT=3000
```

---

## Start Commands (after build)
```bash
cd "NBA Playoff Pool"
npm install
cd client && npm install && cd ..
node server/db/seed.js
npm run dev
```

Then open http://localhost:5173
