import { unstable_cache } from 'next/cache';
import saved from './data/espn-sp-2026.json';
import { ESPN_SP_URL, parseEspnSp, type SpSnapshot } from './espn-sp';
import type { Team } from './types';
async function loadLatest(year:number,schools:string[]){
  const response=await fetch(ESPN_SP_URL,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('ESPN unavailable');
  return parseEspnSp(await response.text(),year,schools.map(school=>({school})));
}
// Cache validated snapshots, not HTML: parsing failures retain the last successful cache entry.
const refresh = unstable_cache(loadLatest,['espn-sp-v4'],{revalidate:900});
const runtimeLastGood = new Map<number,SpSnapshot>();
export async function getEspnSp(year:number,teams:Team[],fresh=false):Promise<{snapshot:SpSnapshot;fallback:boolean;fallbackReason?:'older-publication'|'refresh-failed'}|null>{
  if(process.env.ESPN_SP_ENABLED==='false'||year!==2026||year!==new Date().getFullYear())return null;
  const baseline=saved as SpSnapshot;
  // A saved snapshot is usable only if it still matches the season's full directory.
  const validBaseline=baseline.ratings.length===teams.length&&teams.every(t=>baseline.ratings.some(r=>r.team===t.school));
  const schools=teams.map(t=>t.school).sort();
  const isComplete=(snapshot:SpSnapshot)=>snapshot.ratings.length===teams.length&&teams.every(t=>snapshot.ratings.some(r=>r.team===t.school));
  const newest=(snapshot:SpSnapshot)=>validBaseline&&snapshot.publishedAt<baseline.publishedAt?baseline:snapshot;
  try {
    const snapshot=await (fresh?loadLatest(year,schools):refresh(year,schools));
    runtimeLastGood.set(year,snapshot);
    if(validBaseline&&snapshot.publishedAt<baseline.publishedAt)return {snapshot:baseline,fallback:true,fallbackReason:'older-publication'};
    return {snapshot,fallback:false};
  } catch {
    // A forced refresh deliberately bypasses Next's 15-minute cache. If the
    // live request fails, recover the most recently validated cached snapshot
    // before dropping all the way back to the copy bundled with the app.
    if(fresh){
      try {
        const cached=await refresh(year,schools);
        if(isComplete(cached)){
          runtimeLastGood.set(year,cached);
          return {snapshot:newest(cached),fallback:true,fallbackReason:'refresh-failed'};
        }
      } catch {}
    }
    const lastGood=runtimeLastGood.get(year);
    if(lastGood&&isComplete(lastGood))return {snapshot:newest(lastGood),fallback:true,fallbackReason:'refresh-failed'};
    return validBaseline?{snapshot:baseline,fallback:true,fallbackReason:'refresh-failed'}:null;
  }
}
