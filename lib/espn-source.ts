import { unstable_cache } from 'next/cache';
import saved from './data/espn-sp-2026.json';
import { ESPN_SP_URL, parseEspnSp, type SpSnapshot } from './espn-sp';
import type { Team } from './types';
// Cache validated snapshots, not HTML: parsing failures retain the last successful cache entry.
const refresh = unstable_cache(async(year:number,schools:string[])=>{
  const response=await fetch(ESPN_SP_URL,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('ESPN unavailable');
  return parseEspnSp(await response.text(),year,schools.map(school=>({school})));
},['espn-sp-v1'],{revalidate:3600});
export async function getEspnSp(year:number,teams:Team[]):Promise<{snapshot:SpSnapshot;fallback:boolean}|null>{
  if(process.env.ESPN_SP_ENABLED==='false'||year!==2026||year!==new Date().getFullYear())return null;
  const baseline=saved as SpSnapshot;
  // A saved snapshot is usable only if it still matches the season's full directory.
  const validBaseline=baseline.ratings.length===teams.length&&teams.every(t=>baseline.ratings.some(r=>r.team===t.school));
  try {
    const snapshot=await refresh(year,teams.map(t=>t.school).sort());
    if(validBaseline&&snapshot.publishedAt<baseline.publishedAt)return {snapshot:baseline,fallback:true};
    return {snapshot,fallback:false};
  } catch {
    return validBaseline?{snapshot:baseline,fallback:true}:null;
  }
}
