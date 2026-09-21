import { load } from 'cheerio';
import type { Team } from './types';
export const ESPN_SP_URL = 'https://www.espn.com/college-football/story/_/id/49868647/2026-college-football-sp%2B-rankings-all-138-fbs-teams';
export type SpRow = {team:string;rating:number;ranking:number;offense:{ranking:number};defense:{ranking:number}};
export type SpSnapshot = {year:number;publishedAt:string;retrievedAt:string;sourceUrl:string;ratings:SpRow[]};
const aliases: Record<string,string> = {'S. Carolina':'South Carolina','Va. Tech':'Virginia Tech','Miss. St.':'Mississippi State','N. Dakota St':'North Dakota State','JMU':'James Madison','N. Carolina':'North Carolina','Ga. Tech':'Georgia Tech','W. Virginia':'West Virginia','USF':'South Florida','WMU':'Western Michigan',"J'ville St.":'Jacksonville State','Boston Coll.':'Boston College','Wash. St.':'Washington State','ECU':'East Carolina','ODU':'Old Dominion','FAU':'Florida Atlantic','Ga. Southern':'Georgia Southern','La. Tech':'Louisiana Tech','Coastal Caro.':'Coastal Carolina','S. Alabama':'South Alabama','FIU':'Florida International','Kennesaw':'Kennesaw State','CMU':'Central Michigan','New Mex. St.':'New Mexico State','WKU':'Western Kentucky','MTSU':'Middle Tennessee','EMU':'Eastern Michigan','So. Miss':'Southern Miss','N. Illinois':'Northern Illinois','UMass':'Massachusetts','Sac State':'Sacramento State','ULM':'UL Monroe'};
const normalize = (name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bst\.?\b/g,'state').replace(/[^a-z0-9]/g,'');
export function parseEspnSp(html:string,year:number,teams:Pick<Team,'school'>[],now=new Date()):SpSnapshot {
  const $=load(html);
  const heading=$('h1').map((_,e)=>$(e).text()).get().join(' ');
  if(!heading.includes(String(year))||!heading.includes('SP+'))throw new Error('Wrong ESPN season or article');
  const asOf=$('p').map((_,e)=>$(e).text()).get().join(' ').match(/updated\s+(\d{4})\s+SP\+ rankings as of\s+([A-Za-z.]+\s+\d{1,2},\s+\d{4})/i);
  if(!asOf||Number(asOf[1])!==year)throw new Error('Missing ratings publication date');
  const date=new Date(asOf[2].replace('Sept.','Sep')+' 12:00:00 GMT');
  if(!Number.isFinite(date.getTime())||date.getUTCFullYear()!==year||date.getTime()>now.getTime()+86400000)throw new Error('Invalid ratings date');
  const publishedAt=date.toISOString().slice(0,10);
  const directory=new Map(teams.map(t=>[normalize(t.school),t.school]));
  const table=$('table').filter((_,e)=>$(e).find('th').map((_,h)=>$(h).text().trim()).get().slice(0,4).join('|')==='Team|Rating|Offense|Defense');
  if(table.length!==1)throw new Error('Missing or ambiguous SP+ table');
  const ratings:SpRow[]=[];
  table.find('tbody tr').each((_,row)=>{
    const cells=$(row).find('td').map((_,e)=>$(e).text().trim()).get();
    const match=cells[0]?.match(/^(\d+)\.\s+(.+?)\s+\(\d+-\d+(?:-\d+)?\)$/);
    const offense=cells[2]?.match(/^[-+]?\d+(?:\.\d+)?\s+\((\d+)\)$/),defense=cells[3]?.match(/^[-+]?\d+(?:\.\d+)?\s+\((\d+)\)$/);
    if(!match||!offense||!defense||!/^[-+]?\d+(?:\.\d+)?$/.test(cells[1]??''))throw new Error('Malformed SP+ row');
    const team=directory.get(normalize(aliases[match[2]]??match[2]));
    if(!team)throw new Error(`Unknown ESPN team: ${match[2]}`);
    ratings.push({team,rating:Number(cells[1]),ranking:Number(match[1]),offense:{ranking:Number(offense[1])},defense:{ranking:Number(defense[1])}});
  });
  if(ratings.length!==teams.length||new Set(ratings.map(r=>r.team)).size!==teams.length)throw new Error('Incomplete or duplicate SP+ teams');
  for(const ranks of [ratings.map(r=>r.ranking),ratings.map(r=>r.offense.ranking),ratings.map(r=>r.defense.ranking)]){
    if(new Set(ranks).size!==teams.length||ranks.some(r=>r<1||r>teams.length))throw new Error('Invalid SP+ ranks');
  }
  if(ratings.some(r=>Math.abs(r.rating)>100))throw new Error('Invalid SP+ rating');
  return {year,publishedAt,retrievedAt:now.toISOString(),sourceUrl:ESPN_SP_URL,ratings};
}
