import type { Game, Prediction, Week } from './types';
export type Ratings = { sp: Record<string, number>; elo: Record<string, number> };
export function predict(game: Game, team: string, ratings: Ratings): Prediction {
  const home = game.homeTeam === team;
  const opponent = home ? game.awayTeam : game.homeTeam;
  const location = game.neutralSite ? 0 : home ? 1 : -1;
  if (Number.isFinite(ratings.sp[team]) && Number.isFinite(ratings.sp[opponent])) {
    // Logistic margin model; transparent heuristic, not an official SP+ probability.
    const margin = ratings.sp[team] - ratings.sp[opponent] + 2.5 * location;
    return { probability: 1 / (1 + Math.exp(-margin / 9)), model: 'SP+' };
  }
  if (Number.isFinite(ratings.elo[team]) && Number.isFinite(ratings.elo[opponent])) {
    return { probability: 1 / (1 + 10 ** (-(ratings.elo[team] - ratings.elo[opponent] + 55 * location) / 400)), model: 'Elo' };
  }
  return { probability: null, model: 'Unavailable' };
}
export function outcome(game: Game, team: string): 'W' | 'L' | 'T' | null {
  if (!game.completed || game.homePoints === null || game.awayPoints === null) return null;
  const diff = (game.homePoints - game.awayPoints) * (game.homeTeam === team ? 1 : -1);
  return diff > 0 ? 'W' : diff < 0 ? 'L' : 'T';
}
export function summarize(games: Game[], team: string, predictions: Record<number, Prediction>) {
  let wins = 0, losses = 0, knownExpectedWins = 0, missingPredictions = 0;
  for (const game of games) {
    const result = outcome(game, team);
    if (result === 'W') { wins++; knownExpectedWins++; }
    else if (result === 'L') losses++;
    else if (result === 'T') continue;
    else if (game.completed) missingPredictions++;
    else if (['canceled', 'cancelled'].includes(game.status ?? '')) continue;
    else { const p = predictions[game.id]?.probability; if (p == null) missingPredictions++; else knownExpectedWins += p; }
  }
  return { wins, losses, knownExpectedWins, missingPredictions, expectedWins: missingPredictions || !games.length ? null : knownExpectedWins };
}
export const weekKey = (week: Pick<Week, 'seasonType' | 'week'>) => `${week.seasonType}:${week.week}`;
export function currentWeek(weeks: Week[], now = new Date()) {
  const sorted = [...weeks].sort((a,b) => Date.parse(a.startDate) - Date.parse(b.startDate));
  const active = sorted.find(w => Date.parse(w.startDate) <= +now && Date.parse(w.endDate) >= +now);
  return active ?? sorted.find(w => Date.parse(w.startDate) > +now) ?? sorted.at(-1);
}
export function relevantGames(schedule: Game[], games: Game[], team: string) {
  const teams = new Set(schedule.map(g => g.homeTeam === team ? g.awayTeam : g.homeTeam));
  teams.add(team);
  const unique = new Map(games.filter(g => teams.has(g.homeTeam) || teams.has(g.awayTeam)).map(g => [g.id, g]));
  return { games: [...unique.values()].sort((a,b) => a.startDate.localeCompare(b.startDate)), idleTeams: [...teams].filter(t => ![...unique.values()].some(g => g.homeTeam === t || g.awayTeam === t)).sort() };
}
