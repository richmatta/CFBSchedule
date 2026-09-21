import { z } from 'zod';
import { getEspnSp } from './espn-source';
import { demoTeams, demoSeason } from './demo';
import { currentWeek, predict, relevantGames, summarize, weekKey } from './model';
import type { Game, Outlook, Team, Week } from './types';
const nullableNumber = z.number().nullable();
const gameSchema = z.object({id:z.number(),week:z.number(),seasonType:z.string(),startDate:z.string(),startTimeTBD:z.boolean(),completed:z.boolean(),neutralSite:z.boolean(),homeTeam:z.string(),awayTeam:z.string(),homeClassification:z.string().nullable().optional(),awayClassification:z.string().nullable().optional(),homeConference:z.string().nullable().optional(),awayConference:z.string().nullable().optional(),homePoints:nullableNumber,awayPoints:nullableNumber,venue:z.string().nullable().optional()});
const teamSchema = z.object({id:z.number(),school:z.string(),mascot:z.string().nullable().optional(),abbreviation:z.string().nullable().optional(),conference:z.string().nullable().optional(),color:z.string().nullable().optional()});
const weekSchema = z.object({week:z.number(),seasonType:z.string(),startDate:z.string(),endDate:z.string()});
const recordsSchema = z.object({team:z.string(),total:z.object({wins:z.number(),losses:z.number(),ties:z.number()})});
const spRank = z.number().int().positive().nullish();
const spSchema = z.object({team:z.string(),rating:nullableNumber,ranking:spRank,offense:z.object({ranking:spRank}).nullish(),defense:z.object({ranking:spRank}).nullish()});
const eloSchema = z.object({team:z.string(),elo:nullableNumber});
const liveSchema = z.object({id:z.number(),status:z.string(),period:nullableNumber.optional(),clock:z.string().nullable().optional(),homeTeam:z.object({points:nullableNumber}),awayTeam:z.object({points:nullableNumber})});
export const isDemo = () => process.env.DEMO_MODE === 'true' || !process.env.CFBD_API_KEY;
async function request<T>(path: string, params: Record<string,string|number>, schema: z.ZodType<T>, seconds = 300): Promise<T> {
  const query = new URLSearchParams(Object.entries(params).map(([k,v]) => [k,String(v)]));
  const response = await fetch(`https://api.collegefootballdata.com${path}?${query}`, {headers:{Authorization:`Bearer ${process.env.CFBD_API_KEY}`},next:{revalidate:seconds},signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`Data provider returned ${response.status} for ${path}. ${response.status === 401 ? 'Check the API key.' : response.status === 429 ? 'API quota reached; try again later.' : 'Check endpoint access and try again.'}`);
  return schema.parse(await response.json());
}
export async function getTeams(year: number): Promise<Team[]> {
  if (isDemo()) return demoTeams;
  const teams = await request('/teams/fbs',{year},z.array(teamSchema),86400);
  return teams.map(t=>({id:String(t.id),school:t.school,mascot:t.mascot??'',abbreviation:t.abbreviation??t.school.slice(0,3).toUpperCase(),conference:t.conference??'FBS',color:t.color??'#8c1515'})).sort((a,b)=>a.school.localeCompare(b.school));
}
// Keep the setup directory FBS-only, but allow visiting lower-division opponents.
export async function getTeam(school: string, year: number): Promise<Team | undefined> {
  const fbs = (await getTeams(year)).find(team => team.school === school);
  if (fbs) return fbs;
  if (isDemo()) return school === 'Montana State' ? {id:'demo-montana-state',school,mascot:'Bobcats',abbreviation:'MSU',conference:'Big Sky',color:'#003875'} : undefined;
  const team = (await request('/teams',{},z.array(teamSchema),86400)).find(team => team.school === school);
  return team ? {id:String(team.id),school:team.school,mascot:team.mascot??'',abbreviation:team.abbreviation??team.school.slice(0,3).toUpperCase(),conference:team.conference??'',color:team.color??'#8c1515'} : undefined;
}
export async function getOutlook(team: Team, year: number, requestedWeek?: string): Promise<Outlook> {
  const warnings: string[] = [];
  if (isDemo()) {
    const data = demoSeason(team,year);
    const selectedWeek = requestedWeek ?? 'regular:4';
    const week = Number(selectedWeek.split(':')[1]);
    const sampleGames = data.pool.map((opponent,i): Game => ({id:100000+i,week,seasonType:'regular',startDate:new Date(Date.UTC(year,8,5+(week-1)*7,19+i%3)).toISOString(),startTimeTBD:false,completed:i<3,neutralSite:false,homeTeam:opponent,awayTeam:`Sample opponent ${i+1}`,homePoints:i<5?21+i:null,awayPoints:i<5?14:null,status:i<3?'completed':i<5?'in_progress':'scheduled',period:i<5?3:null,clock:i<5?'08:24':null}));
    const ownGame = data.games.find(g=>g.week===week);
    const board = relevantGames(data.games, [...sampleGames.filter(g=>!ownGame || (g.homeTeam!==ownGame.homeTeam && g.homeTeam!==ownGame.awayTeam)),...(ownGame?[ownGame]:[])],team.school);
    const predictions = Object.fromEntries(data.games.filter(g=>!g.completed).map(g=>[g.id,predict(g,team.school,data.ratings)]));
    return {team,year,demo:true,spRatings:{},games:data.games,predictions,records:data.records,weeks:data.weeks,selectedWeek,currentWeek:'regular:4',scoreboard:board.games,idleTeams:board.idleTeams,...summarize(data.games,team.school,predictions),fetchedAt:new Date().toISOString(),warnings:['Illustrative schedules, scores, records, and ratings. These are not real game results. Demo team directory uses the 2025 FBS membership.']};
  }
  const optional = async <T>(promise: Promise<T>, fallback: T, message: string): Promise<T> => {try {return await promise;} catch {warnings.push(message);return fallback;}};
  const enableSp = process.env.CFBD_SP_ENABLED === 'true' && process.env.RATING_MODEL !== 'elo';
  const [rawGames,records,weeks,cfbdSp,elo,espn] = await Promise.all([
    request('/games',{year,team:team.school,seasonType:'both'},z.array(gameSchema)),
    optional(request('/records',{year},z.array(recordsSchema)),[],'Team records are temporarily unavailable.'),
    optional(request('/calendar',{year},z.array(weekSchema),3600),[],'Season calendar unavailable; week selection is based on the team schedule.'),
    enableSp ? optional(request('/ratings/sp',{year},z.array(spSchema),3600),[],'SP+ unavailable; using Elo where possible.') : Promise.resolve([]),
    optional(request('/ratings/elo',{year,seasonType:'both'},z.array(eloSchema),3600),[],'Elo ratings unavailable for this season.'),
    process.env.RATING_MODEL !== 'elo' ? getTeams(year).then(teams=>getEspnSp(year,teams)) : Promise.resolve(null)
  ]);
  const sp = espn?.snapshot.ratings ?? cfbdSp;
  const spSource = espn ? {name:'ESPN',publishedAt:espn.snapshot.publishedAt,retrievedAt:espn.snapshot.retrievedAt,url:espn.snapshot.sourceUrl} : sp.length ? {name:'CollegeFootballData',publishedAt:null} : undefined;
  if (espn) {
    const i=warnings.indexOf('SP+ unavailable; using Elo where possible.');if(i>=0)warnings.splice(i,1);
    if(espn.fallback)warnings.push('ESPN refresh unavailable or older than the saved snapshot. Using the saved SP+ publication.');
    if(Date.now()-Date.parse(espn.snapshot.publishedAt+'T00:00:00Z')>8*86400000)warnings.push('The available ESPN SP+ publication is more than eight days old. Predictions use the displayed publication date.');
  }
  const games: Game[] = rawGames.sort((a,b)=>a.startDate.localeCompare(b.startDate));
  let calendar: Week[] = weeks.filter(w=>['regular','postseason'].includes(w.seasonType));
  if (!calendar.length) calendar = [...new Map(games.map(g=>[weekKey(g),{week:g.week,seasonType:g.seasonType,startDate:g.startDate,endDate:new Date(Date.parse(g.startDate)+86400000).toISOString()}])).values()];
  calendar.sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const current = currentWeek(calendar);
  const selectedWeek = requestedWeek ?? (current ? weekKey(current) : 'regular:1');
  if (requestedWeek && calendar.length && !calendar.some(w=>weekKey(w)===requestedWeek)) throw new Error('Selected week is not available in this season.');
  const [seasonType,week] = selectedWeek.split(':');
  const weekGames: Game[] = calendar.length ? await request('/games',{year,week:Number(week),seasonType},z.array(gameSchema)) : [];
  // Scoreboard supplies in-progress scores; historical/future weeks use /games.
  const active = current && Date.now() >= Date.parse(current.startDate) && Date.now() <= Date.parse(current.endDate);
  if (active) {
    const live = await optional(request('/scoreboard',{},z.array(liveSchema),60),[],'Live score feed unavailable. Showing latest scheduled games and recorded results.');
    const overlay = new Map(live.map(g=>[g.id,g]));
    for (const game of [...games,...weekGames]) {
      const update = overlay.get(game.id);
      if (update) Object.assign(game,{homePoints:update.homeTeam.points,awayPoints:update.awayTeam.points,status:update.status,completed:game.completed || ['completed','final'].includes(update.status),period:update.period,clock:update.clock});
    }
  }
  const ratings = {sp:Object.fromEntries(sp.filter(r=>r.rating!==null).map(r=>[r.team,r.rating as number])),elo:Object.fromEntries(elo.filter(r=>r.elo!==null).map(r=>[r.team,r.elo as number]))};
  const predictions = Object.fromEntries(games.filter(g=>!g.completed).map(g=>[g.id,predict(g,team.school,ratings)]));
  const board = relevantGames(games,weekGames,team.school);
  return {team,year,demo:false,spSource,spRatings:Object.fromEntries(sp.map(r=>[r.team,{overallRank:r.ranking??null,offenseRank:r.offense?.ranking??null,defenseRank:r.defense?.ranking??null}])),games,predictions,records:Object.fromEntries(records.map(r=>[r.team,r.total])),weeks:calendar,selectedWeek,currentWeek:current?weekKey(current):'regular:1',scoreboard:board.games,idleTeams:board.idleTeams,...summarize(games,team.school,predictions),fetchedAt:new Date().toISOString(),warnings};
}
