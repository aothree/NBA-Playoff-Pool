/**
 * NBA Data Service
 * Attempts to fetch playoff data from balldontlie.io API.
 *
 * TODO LIMITATIONS:
 * - The free tier of balldontlie.io may have rate limits and may not include
 *   all playoff game data in real-time.
 * - The API does not directly provide "series" data — we must aggregate games
 *   by teams to determine series outcomes.
 * - Leading scorer per series must be aggregated manually from game box scores.
 * - This service is best-effort; admin should always verify and override manually.
 * - The API endpoint for games uses season year (e.g., 2025 for the 2025-26 season).
 * - Pagination may be required for large result sets (cursor-based pagination).
 */

const fetch = require('node-fetch');

const BASE_URL = 'https://api.balldontlie.io/v1';

function getHeaders() {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey) {
    throw new Error('BALLDONTLIE_API_KEY environment variable is not set');
  }
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Fetch all playoff games for a given season year.
 * seasonYear: e.g., 2025 (for the 2025-26 season)
 *
 * TODO: The free API tier may not include postseason games. Check your subscription level.
 * TODO: Handle pagination — the API returns cursor-based pages.
 */
async function fetchPlayoffGames(seasonYear) {
  const games = [];
  let cursor = null;

  try {
    do {
      let url = `${BASE_URL}/games?seasons[]=${seasonYear}&postseason=true&per_page=100`;
      if (cursor) url += `&cursor=${cursor}`;

      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
      }

      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        games.push(...json.data);
      }

      // TODO: balldontlie v1 uses cursor pagination
      cursor = json.meta && json.meta.next_cursor ? json.meta.next_cursor : null;
    } while (cursor);

    return games;
  } catch (err) {
    console.error('Error fetching playoff games:', err.message);
    return [];
  }
}

/**
 * Aggregate game results into series outcomes.
 * Returns array of series-like objects with team win counts.
 *
 * TODO: This is a naive aggregation. The API doesn't provide series IDs.
 * We match by team pair. If teams play across multiple rounds, this could be wrong.
 */
async function fetchPlayoffSeriesResults(seasonYear) {
  const games = await fetchPlayoffGames(seasonYear);
  if (!games.length) return [];

  // Group games by team matchup (sort team IDs so order doesn't matter)
  const seriesMap = {};

  for (const game of games) {
    if (!game.home_team || !game.visitor_team) continue;
    const ids = [game.home_team.id, game.visitor_team.id].sort((a, b) => a - b);
    const key = `${ids[0]}_${ids[1]}`;

    if (!seriesMap[key]) {
      seriesMap[key] = {
        team_a_id: game.home_team.id,
        team_a_name: game.home_team.full_name,
        team_b_id: game.visitor_team.id,
        team_b_name: game.visitor_team.full_name,
        team_a_wins: 0,
        team_b_wins: 0,
        games: [],
      };
    }

    const entry = seriesMap[key];
    if (game.status === 'Final') {
      if (game.home_team_score > game.visitor_team_score) {
        if (game.home_team.id === entry.team_a_id) entry.team_a_wins++;
        else entry.team_b_wins++;
      } else {
        if (game.visitor_team.id === entry.team_a_id) entry.team_a_wins++;
        else entry.team_b_wins++;
      }
      entry.games.push(game);
    }
  }

  return Object.values(seriesMap).map(s => ({
    ...s,
    total_games: s.team_a_wins + s.team_b_wins,
    is_complete: s.team_a_wins >= 4 || s.team_b_wins >= 4,
    winner_id: s.team_a_wins >= 4 ? s.team_a_id : (s.team_b_wins >= 4 ? s.team_b_id : null),
    winner_name: s.team_a_wins >= 4 ? s.team_a_name : (s.team_b_wins >= 4 ? s.team_b_name : null),
  }));
}

/**
 * Fetch player stats for playoff games and aggregate by player.
 * Returns array of {player_name, team, games_played, total_points}
 *
 * TODO: Stats endpoint may require pagination. Free tier may be limited.
 * TODO: Player team association may be tricky if players were traded mid-season.
 */
async function fetchPlayoffPlayerStats(seasonYear) {
  const stats = [];
  let cursor = null;

  try {
    do {
      let url = `${BASE_URL}/stats?seasons[]=${seasonYear}&postseason=true&per_page=100`;
      if (cursor) url += `&cursor=${cursor}`;

      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
      }

      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        stats.push(...json.data);
      }

      cursor = json.meta && json.meta.next_cursor ? json.meta.next_cursor : null;
    } while (cursor);
  } catch (err) {
    console.error('Error fetching player stats:', err.message);
    return [];
  }

  // Aggregate by player
  const playerMap = {};
  for (const stat of stats) {
    if (!stat.player || !stat.team) continue;
    const key = `${stat.player.id}`;
    if (!playerMap[key]) {
      playerMap[key] = {
        player_name: `${stat.player.first_name} ${stat.player.last_name}`,
        team: stat.team.abbreviation,
        games_played: 0,
        total_points: 0,
      };
    }
    playerMap[key].games_played++;
    playerMap[key].total_points += stat.pts || 0;
  }

  return Object.values(playerMap).sort((a, b) => b.total_points - a.total_points);
}

/**
 * Main scrape function called by admin route.
 * Returns structured data for admin review before saving.
 */
async function scrapeAndUpdate(db, seasonId) {
  // Get the season year
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(seasonId);
  if (!season) throw new Error('Season not found');

  // Extract the start year (e.g., "2025-26" → 2025)
  const seasonYear = parseInt(season.year.split('-')[0]);

  const [seriesResults, playerStats] = await Promise.all([
    fetchPlayoffSeriesResults(seasonYear),
    fetchPlayoffPlayerStats(seasonYear),
  ]);

  return {
    series_results: seriesResults,
    player_stats: playerStats,
    fetched_at: new Date().toISOString(),
    note: 'Review these results before saving. Use admin panel to manually confirm/override each series result.',
  };
}

module.exports = { fetchPlayoffSeriesResults, fetchPlayoffPlayerStats, scrapeAndUpdate };
