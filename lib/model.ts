import type { ForecastModel, Game, Prediction, Week } from './types';
export type Ratings = { sp: Record<string, number>; fei?: Record<string, number>; sagarin?: Record<string, number> };
const labels: Record<ForecastModel, Prediction['model']> = {sp:'SP+',fei:'FEI',sagarin:'Sagarin'};
export function predict(game: Game, team: string, ratings: Ratings, selected: ForecastModel = 'sp'): Prediction {
  const home = game.homeTeam === team;
  const opponent = home ? game.awayTeam : game.homeTeam;
  const location = game.neutralSite ? 0 : home ? 1 : -1;
  const values = ratings[selected] ?? {};
  if (Number.isFinite(values[team]) && Number.isFinite(values[opponent])) {
    // FEI is scoring advantage per possession; 12 possessions converts it to an estimated game margin.
    const scale = selected === 'fei' ? 12 : 1;
    const homeField = selected === 'sagarin' ? 4.28 : 2.5;
    const margin = (values[team] - values[opponent]) * scale + homeField * location;
    return { probability: 1 / (1 + Math.exp(-margin / 9)), model: labels[selected] };
  }
  // Explicit user assumption, restricted to confirmed cross-division games.
  const lowerDivisions = new Set(['fcs', 'ii', 'ii/iii', 'iii']);
  const powerConferences = new Set(['ACC', 'Big Ten', 'Big 12', 'SEC', 'Pac-12']);
  const qualifies = (name: string, classification?: string | null, conference?: string | null) =>
    classification === 'fbs' && (Number.isFinite(values[name]) || powerConferences.has(conference ?? ''));
  const unratedLower = (name: string, classification?: string | null) =>
    lowerDivisions.has(classification ?? '') && !Number.isFinite(values[name]);
  if (qualifies(game.homeTeam, game.homeClassification, game.homeConference) && unratedLower(game.awayTeam, game.awayClassification)) {
    return { probability: home ? 0.99 : 0.01, model: '99% assumption' };
  }
  if (qualifies(game.awayTeam, game.awayClassification, game.awayConference) && unratedLower(game.homeTeam, game.homeClassification)) {
    return { probability: home ? 0.01 : 0.99, model: '99% assumption' };
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
export function scheduleForTeam(games: Game[], team: string) {
  return games.filter(game => game.homeTeam === team || game.awayTeam === team).sort((a,b) => a.startDate.localeCompare(b.startDate));
}
export function gamesForWeek(games: Game[], key: string) {
  return games.filter(game => weekKey(game) === key).sort((a,b) => a.startDate.localeCompare(b.startDate));
}
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
