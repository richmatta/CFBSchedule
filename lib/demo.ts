import teamsJson from './demo-teams.json';
import type { Game, Team, Week, RecordLine } from './types';
export const demoTeams: Team[] = teamsJson;
export function demoSeason(team: Team, year: number) {
  const pool = ['Montana State', 'Oklahoma State', 'Northwestern', 'Penn State', 'Indiana', 'Rutgers', 'Wisconsin', 'Iowa', 'Minnesota', 'USC', 'Washington', 'Oregon State'].filter(t => t !== team.school);
  if (pool.length < 12) pool.push('Oregon');
  const games: Game[] = pool.map((opponent, index) => ({ id: 90000 + index, week: index + 1, seasonType: 'regular', startDate: new Date(Date.UTC(year, 8, 5 + index * 7, 19, 30)).toISOString(), startTimeTBD: index > 3, completed: index < 3, neutralSite: false, homeTeam: index % 3 === 0 ? opponent : team.school, awayTeam: index % 3 === 0 ? team.school : opponent, homePoints: index < 3 ? (index % 3 === 0 ? 14 : 35) : null, awayPoints: index < 3 ? (index % 3 === 0 ? 42 : 17) : null, venue: index % 3 === 0 ? 'Opponent stadium' : 'Home stadium' }));
  const weeks: Week[] = Array.from({length: 15}, (_,i) => ({week:i+1,seasonType:'regular',startDate:new Date(Date.UTC(year,8,1+i*7)).toISOString(),endDate:new Date(Date.UTC(year,8,8+i*7)-1).toISOString()}));
  const elo: Record<string, number> = {[team.school]: 1750};
  const records: Record<string, RecordLine> = {[team.school]:{wins:3,losses:0,ties:0}};
  pool.forEach((t,i) => {elo[t] = 1400 + (i * 73) % 500; records[t] = {wins:i%4,losses:3-i%4,ties:0};});
  return {games,weeks,ratings:{sp:{},elo},records,pool};
}
