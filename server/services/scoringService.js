/**
 * Scoring Service
 *
 * Points scale by round:
 *   Round 1:       winner=5  games=3  scorer=3  → 11 max/series
 *   Round 2:       winner=6  games=4  scorer=4  → 14 max/series
 *   Conf Finals:   winner=7  games=5  scorer=5  → 17 max/series  + 4 pts East MVP + 4 pts West MVP
 *   Finals:        winner=8  games=6  scorer=6  → 20 max/series  + 4 pts Finals MVP
 */

const MVP_POINTS = 4;

function getPointValues(roundNumber) {
  const rn = roundNumber || 1;
  return {
    winner: 4 + rn,  // R1=5, R2=6, R3=7, R4=8
    games: 2 + rn,   // R1=3, R2=4, R3=5, R4=6
    scorer: 2 + rn,  // R1=3, R2=4, R3=5, R4=6
  };
}

function maxSeriesPoints(roundNumber) {
  const pts = getPointValues(roundNumber);
  return pts.winner + pts.games + pts.scorer;
}

function calculateSeriesScore(pick, series, roundNumber) {
  const pts = getPointValues(roundNumber);
  const winnerCorrect = pick.pick_winner_team_id === series.result_winner_team_id;
  const points_winner = winnerCorrect ? pts.winner : 0;
  const points_games = (winnerCorrect && pick.pick_games === series.result_games) ? pts.games : 0;

  let points_scorer = 0;
  if (pick.pick_leading_scorer && series.result_leading_scorer) {
    const pickScorer = pick.pick_leading_scorer.trim().toLowerCase();
    const resultScorer = series.result_leading_scorer.trim().toLowerCase();
    points_scorer = pickScorer === resultScorer ? pts.scorer : 0;
  }

  const total = points_winner + points_games + points_scorer;
  return { points_winner, points_games, points_scorer, total };
}

function calculateMvpScore(pickMvp, resultMvp) {
  if (!pickMvp || !resultMvp) return 0;
  return pickMvp.trim().toLowerCase() === resultMvp.trim().toLowerCase() ? MVP_POINTS : 0;
}

function recalculateSeriesScores(db, seriesId) {
  const series = db.prepare(`
    SELECT se.*, r.round_number
    FROM series se
    JOIN rounds r ON r.id = se.round_id
    WHERE se.id = ?
  `).get(seriesId);
  if (!series || !series.is_complete) return 0;

  const picks = db.prepare('SELECT * FROM picks WHERE series_id = ?').all(seriesId);

  const upsert = db.prepare(`
    INSERT INTO scores (user_id, series_id, points_winner, points_games, points_scorer, total)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, series_id) DO UPDATE SET
      points_winner = excluded.points_winner,
      points_games = excluded.points_games,
      points_scorer = excluded.points_scorer,
      total = excluded.total
  `);

  const updateAll = db.transaction(() => {
    for (const pick of picks) {
      const score = calculateSeriesScore(pick, series, series.round_number);
      upsert.run(pick.user_id, seriesId, score.points_winner, score.points_games, score.points_scorer, score.total);
    }
  });

  updateAll();
  return picks.length;
}

function getLeaderboard(db, seasonId) {
  // Get all users who have picks in this season
  const users = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.email
    FROM users u
    JOIN picks p ON p.user_id = u.id
    JOIN series se ON se.id = p.series_id
    JOIN rounds r ON r.id = se.round_id
    WHERE r.season_id = ?
  `).all(seasonId);

  // Also include users who only have MVP picks
  const mvpOnlyUsers = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.email
    FROM users u
    JOIN mvp_picks mp ON mp.user_id = u.id
    JOIN rounds r ON r.id = mp.round_id
    WHERE r.season_id = ? AND u.id NOT IN (
      SELECT DISTINCT p.user_id FROM picks p
      JOIN series se ON se.id = p.series_id
      JOIN rounds r2 ON r2.id = se.round_id
      WHERE r2.season_id = ?
    )
  `).all(seasonId, seasonId);

  const allUsers = [...users, ...mvpOnlyUsers];

  // Get all series for this season with round info
  const allSeries = db.prepare(`
    SELECT se.*, r.round_number, r.name as round_name,
      ht.name as higher_seed_name, ht.abbreviation as higher_seed_abbr, ht.seed as higher_seed,
      lt.name as lower_seed_name, lt.abbreviation as lower_seed_abbr, lt.seed as lower_seed,
      wt.name as winner_name
    FROM series se
    JOIN rounds r ON r.id = se.round_id
    JOIN teams ht ON ht.id = se.higher_seed_team_id
    JOIN teams lt ON lt.id = se.lower_seed_team_id
    LEFT JOIN teams wt ON wt.id = se.result_winner_team_id
    WHERE r.season_id = ?
    ORDER BY r.round_number, se.series_order
  `).all(seasonId);

  // Get all MVP results for this season
  const mvpResults = db.prepare(`
    SELECT mr.*, r.round_number
    FROM mvp_results mr
    JOIN rounds r ON r.id = mr.round_id
    WHERE r.season_id = ?
  `).all(seasonId);

  const mvpResultMap = {};
  for (const mr of mvpResults) {
    const key = `${mr.round_id}_${mr.conference}`;
    mvpResultMap[key] = mr.result_mvp;
  }

  const leaderboard = allUsers.map(user => {
    const picks = db.prepare(`
      SELECT p.*, s.points_winner, s.points_games, s.points_scorer, s.total as score_total,
        pt.name as pick_winner_name
      FROM picks p
      LEFT JOIN scores s ON s.user_id = p.user_id AND s.series_id = p.series_id
      LEFT JOIN teams pt ON pt.id = p.pick_winner_team_id
      WHERE p.user_id = ? AND p.series_id IN (
        SELECT se.id FROM series se JOIN rounds r ON r.id = se.round_id WHERE r.season_id = ?
      )
    `).all(user.id, seasonId);

    const pickMap = {};
    for (const p of picks) {
      pickMap[p.series_id] = p;
    }

    // Get this user's MVP picks
    const userMvpPicks = db.prepare(`
      SELECT mp.*, r.round_number
      FROM mvp_picks mp
      JOIN rounds r ON r.id = mp.round_id
      WHERE mp.user_id = ? AND r.season_id = ?
    `).all(user.id, seasonId);

    let total_points = 0;
    let exact_series_count = 0;
    const round_totals = {};
    const series_details = [];

    for (const ser of allSeries) {
      const pick = pickMap[ser.id];
      const pts_winner = pick ? (pick.points_winner || 0) : 0;
      const pts_games = pick ? (pick.points_games || 0) : 0;
      const pts_scorer = pick ? (pick.points_scorer || 0) : 0;
      const pts_total = pts_winner + pts_games + pts_scorer;

      total_points += pts_total;

      const rn = ser.round_number;
      if (!round_totals[rn]) round_totals[rn] = 0;
      round_totals[rn] += pts_total;

      // Exact series = winner AND games both correct (points > 0 for both)
      if (pick && pts_winner > 0 && pts_games > 0) {
        exact_series_count++;
      }

      series_details.push({
        series_id: ser.id,
        round_number: ser.round_number,
        round_name: ser.round_name,
        matchup: `(${ser.higher_seed}) ${ser.higher_seed_name} vs (${ser.lower_seed}) ${ser.lower_seed_name}`,
        conference: ser.conference,
        is_complete: ser.is_complete,
        result_winner: ser.winner_name || null,
        result_games: ser.result_games,
        result_leading_scorer: ser.result_leading_scorer,
        pick_winner: pick ? pick.pick_winner_name : null,
        pick_games: pick ? pick.pick_games : null,
        pick_leading_scorer: pick ? pick.pick_leading_scorer : null,
        points_winner: pts_winner,
        points_games: pts_games,
        points_scorer: pts_scorer,
        points_total: pts_total,
        has_pick: !!pick,
      });
    }

    // Calculate MVP points
    const mvp_details = [];
    for (const mp of userMvpPicks) {
      const key = `${mp.round_id}_${mp.conference}`;
      const resultMvp = mvpResultMap[key] || null;
      const pts = calculateMvpScore(mp.pick_mvp, resultMvp);
      total_points += pts;

      const rn = mp.round_number;
      if (!round_totals[rn]) round_totals[rn] = 0;
      round_totals[rn] += pts;

      mvp_details.push({
        round_id: mp.round_id,
        round_number: mp.round_number,
        conference: mp.conference,
        pick_mvp: mp.pick_mvp,
        result_mvp: resultMvp,
        points: pts,
        has_result: !!resultMvp,
      });
    }

    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      total_points,
      exact_series_count,
      round_totals,
      series_details,
      mvp_details,
    };
  });

  leaderboard.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    return b.exact_series_count - a.exact_series_count;
  });

  return leaderboard.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

function getScoringLeadersLeaderboard(db, seasonId) {
  const users = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.email
    FROM users u
    JOIN picks p ON p.user_id = u.id
    JOIN series se ON se.id = p.series_id
    JOIN rounds r ON r.id = se.round_id
    WHERE r.season_id = ?
  `).all(seasonId);

  const leaderboard = users.map(user => {
    const picks = db.prepare(`
      SELECT p.pick_leading_scorer, se.result_leading_scorer, se.result_leading_scorer_points, se.is_complete
      FROM picks p
      JOIN series se ON se.id = p.series_id
      JOIN rounds r ON r.id = se.round_id
      WHERE p.user_id = ? AND r.season_id = ?
    `).all(user.id, seasonId);

    let correct_scorer_picks = 0;
    let tiebreaker_points = 0;

    for (const p of picks) {
      if (!p.is_complete || !p.pick_leading_scorer || !p.result_leading_scorer) continue;
      if (p.pick_leading_scorer.trim().toLowerCase() === p.result_leading_scorer.trim().toLowerCase()) {
        correct_scorer_picks++;
        tiebreaker_points += p.result_leading_scorer_points || 0;
      }
    }

    return { user_id: user.id, name: user.name, correct_scorer_picks, tiebreaker_points };
  });

  leaderboard.sort((a, b) => {
    if (b.correct_scorer_picks !== a.correct_scorer_picks) return b.correct_scorer_picks - a.correct_scorer_picks;
    return b.tiebreaker_points - a.tiebreaker_points;
  });

  return leaderboard.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

module.exports = {
  getPointValues,
  maxSeriesPoints,
  calculateSeriesScore,
  calculateMvpScore,
  recalculateSeriesScores,
  getLeaderboard,
  getScoringLeadersLeaderboard,
  MVP_POINTS,
};
