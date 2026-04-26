import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  timeout: 15000,
});

// Request interceptor — attach token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ===== AUTH =====
export const login = (email, password) =>
  api.post('/api/auth/login', { email, password }).then(r => r.data);

export const register = (name, email, password) =>
  api.post('/api/auth/register', { name, email, password }).then(r => r.data);

export const getMe = () =>
  api.get('/api/auth/me').then(r => r.data);

// ===== PUBLIC =====
export const getCurrentSeason = () =>
  api.get('/api/seasons/current').then(r => r.data);

export const getLeaderboard = () =>
  api.get('/api/leaderboard').then(r => r.data);

export const getScoringLeaders = () =>
  api.get('/api/leaderboard/scoring-leaders').then(r => r.data);

export const getLeadingScorers = () =>
  api.get('/api/stats/leading-scorers').then(r => r.data);

export const getTeams = () =>
  api.get('/api/teams').then(r => r.data);

// ===== PICKS =====
export const getCurrentRound = () =>
  api.get('/api/rounds/current').then(r => r.data);

export const getRoundSeries = (roundId) =>
  api.get(`/api/rounds/${roundId}/series`).then(r => r.data);

export const getMyPicks = () =>
  api.get('/api/picks/me').then(r => r.data);

export const getMyPicksForRound = (roundId) =>
  api.get(`/api/picks/me/${roundId}`).then(r => r.data);

export const submitPick = (seriesId, pickSelection, pickLeadingScorer) =>
  api.post('/api/picks', {
    series_id: seriesId,
    pick_selection: pickSelection,
    pick_leading_scorer: pickLeadingScorer,
  }).then(r => r.data);

// ===== ADMIN =====
export const getAdminUsers = () =>
  api.get('/api/admin/users').then(r => r.data);

export const patchUser = (id, data) =>
  api.patch(`/api/admin/users/${id}`, data).then(r => r.data);

export const getAdminPicks = () =>
  api.get('/api/admin/picks').then(r => r.data);

export const postAdminPick = (data) =>
  api.post('/api/admin/picks', data).then(r => r.data);

export const postSeriesResult = (seriesId, data) =>
  api.post(`/api/admin/series/${seriesId}/result`, data).then(r => r.data);

export const putRound = (roundId, data) =>
  api.put(`/api/admin/rounds/${roundId}`, data).then(r => r.data);

export const postRound = (data) =>
  api.post('/api/admin/rounds', data).then(r => r.data);

export const postSeries = (data) =>
  api.post('/api/admin/series', data).then(r => r.data);

export const putSeries = (id, data) =>
  api.put(`/api/admin/series/${id}`, data).then(r => r.data);

export const getAdminTeams = () =>
  api.get('/api/admin/teams').then(r => r.data);

export const postTeam = (data) =>
  api.post('/api/admin/teams', data).then(r => r.data);

export const putTeam = (id, data) =>
  api.put(`/api/admin/teams/${id}`, data).then(r => r.data);

export const getAdminPlayers = () =>
  api.get('/api/admin/players').then(r => r.data);

export const postPlayer = (data) =>
  api.post('/api/admin/players', data).then(r => r.data);

export const putPlayer = (id, data) =>
  api.put(`/api/admin/players/${id}`, data).then(r => r.data);

export const deletePlayer = (id) =>
  api.delete(`/api/admin/players/${id}`).then(r => r.data);

export const postScrape = () =>
  api.post('/api/admin/scrape').then(r => r.data);

export const getAdminSeason = () =>
  api.get('/api/admin/season').then(r => r.data);

export const postSeason = (data) =>
  api.post('/api/admin/season', data).then(r => r.data);

export const getAdminPayouts = () =>
  api.get('/api/admin/payouts').then(r => r.data);

export const postPayout = (data) =>
  api.post('/api/admin/payouts', data).then(r => r.data);

export const putPayout = (id, data) =>
  api.put(`/api/admin/payouts/${id}`, data).then(r => r.data);

export const getAdminStats = () =>
  api.get('/api/admin/stats').then(r => r.data);

export const getAdminRosters = () => api.get('/api/admin/rosters').then(r => r.data);
export const addAdminPlayer = (data) => api.post('/api/admin/players', data).then(r => r.data);
export const deleteAdminPlayer = (id) => api.delete(`/api/admin/players/${id}`).then(r => r.data)

export const getAdminRounds = () => api.get('/api/admin/rounds').then(r => r.data);
export const deleteSeries = (id) => api.delete(`/api/admin/series/${id}`).then(r => r.data);

export default api;
