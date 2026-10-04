import { load } from 'cheerio';
import type { RatingSource, RatingSummary, Team } from './types';

export type ForecastSnapshot = {values:Record<string,number>;summaries:Record<string,RatingSummary>;source:RatingSource};
const normalize=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bst\.?\b/g,'state').replace(/[^a-z0-9]/g,'');
const aliases:Record<string,string>={'miamiflorida':'Miami','miamiohio':'Miami (OH)','southerncalifornia':'USC','southernmississippi':'Southern Miss','brighamyoung':'BYU','texasam':'Texas A&M','northcarolinastate':'NC State','mississippi':'Ole Miss','centralfloridaucf':'UCF','armywestpoint':'Army','appalachianstate':'App State','flainternational':'Florida International','floridainternational':'Florida International','samhoustonstate':'Sam Houston','louisianalafayette':'Louisiana','louisianamonroeulm':'UL Monroe','louisianamonroe':'UL Monroe','massachusetts':'Massachusetts','connecticut':'UConn','hawaii':'Hawai’i'};
function directory(teams:Pick<Team,'school'>[]){const map=new Map(teams.map(t=>[normalize(t.school),t.school]));for(const [from,to] of Object.entries(aliases)){const match=map.get(normalize(to));if(match)map.set(from,match);}return map;}
function validate(values:Record<string,number>,teams:Pick<Team,'school'>[],minimum=120){
  const covered=teams.filter(t=>Number.isFinite(values[t.school])).length;
  if(covered<Math.min(minimum,teams.length))throw new Error(`Ratings covered only ${covered} FBS teams`);
}

export function parseFei(html:string,year:number,teams:Pick<Team,'school'>[],now=new Date()):ForecastSnapshot{
  const $=load(html),heading=$('title').first().text()||$('h1').first().text();
  if(!heading.includes(String(year))||!heading.includes('FEI'))throw new Error('Wrong FEI season');
  const values:Record<string,number>={},summaries:Record<string,RatingSummary>={},names=directory(teams);
  $('table tr').each((_,row)=>{const cells=$(row).find('td').map((_,cell)=>$(cell).text().trim()).get();if(!/^\d+$/.test(cells[0]??'')||cells.length<12)return;const team=names.get(normalize(cells[1]));const rating=Number(cells[4]),rank=Number(cells[0]);if(!team||!Number.isFinite(rating))return;values[team]=rating;summaries[team]={rank,offenseRank:Number(cells[7])||null,defenseRank:Number(cells[9])||null,specialTeamsRank:Number(cells[11])||null};});
  validate(values,teams);
  const asOf=$('body').text().match(/through\s+Week\s+\d+/i)?.[0];
  return {values,summaries,source:{name:'BCF Toys',publishedAt:null,retrievedAt:now.toISOString(),url:`https://bcftoys.com/${year}-fei`,asOf}};
}

export function parseSagarin(html:string,year:number,teams:Pick<Team,'school'>[],now=new Date()):ForecastSnapshot{
  const text=load(html).text().replace(/\u00a0/g,' '),header=text.match(new RegExp(`${year} College Football through games of ([^\\n]+)`,'i'));
  if(!header)throw new Error('Wrong Sagarin season');
  const values:Record<string,number>={},summaries:Record<string,RatingSummary>={},names=directory(teams);
  for(const line of text.split(/\r?\n/)){
    const match=line.match(/^\s*(\d+)\s+(.+?)\s+[A-Z-]+\s+=\s+([-+]?\d+(?:\.\d+)?).*?\|.*?\|\s*([-+]?\d+(?:\.\d+)?)\s+(\d+)\s*\|/);
    if(!match)continue;const team=names.get(normalize(match[2]));if(!team||team in values)continue;values[team]=Number(match[4]);summaries[team]={rank:Number(match[1])};
  }
  validate(values,teams);
  const dateParts=header[1].match(/^([A-Z]+)\s+(\d{1,2})/i);
  const date=new Date(`${dateParts?.[1]??''} ${dateParts?.[2]??''}, ${year} 12:00:00 UTC`);
  const asOf=`Through games of ${header[1].replace(/\s+(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s*-\s*/i,' · ')}`;
  return {values,summaries,source:{name:'Sagarin',publishedAt:Number.isFinite(+date)?date.toISOString().slice(0,10):null,retrievedAt:now.toISOString(),url:'http://sagarin.com/sports/cfsend.htm',asOf}};
}

export async function getExternalForecast(model:'fei'|'sagarin',year:number,teams:Team[],fresh=false):Promise<ForecastSnapshot>{
  const url=model==='fei'?`https://bcftoys.com/${year}-fei`:'http://sagarin.com/sports/cfsend.htm';
  const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; CFB-Schedule-Outlook/1.0)'},cache:fresh?'no-store':'force-cache',...(fresh?{}:{next:{revalidate:900}}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`${model==='fei'?'FEI':'Sagarin'} returned ${response.status}`);
  const html=await response.text();return model==='fei'?parseFei(html,year,teams):parseSagarin(html,year,teams);
}
