'use client';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import type { Game, Outlook, Team } from '@/lib/types';
import { outcome, weekKey } from '@/lib/model';
import { teamTheme } from '@/lib/theme';

const formatSpRank = (rank: number | null | undefined) => rank == null ? '—' : `#${rank}`;
const initialYear = new Date().getFullYear();
const date = (value: string) => new Date(value).toLocaleDateString('en-US',{month:'short',day:'numeric'});
const weekLabel = (key: string) => `${key.startsWith('postseason') ? 'Postseason · ' : ''}Week ${key.split(':')[1]}`;
function Badge({name,large=false}:{name:string;large?:boolean}) {return <span className={`team-badge ${large?'large':''}`} aria-hidden="true">{name.split(' ').map(n=>n[0]).join('').slice(0,3)}</span>;}
function gameStatus(game: Game) {
  if (game.completed) return 'Final';
  if (game.status && ['canceled','cancelled','postponed'].includes(game.status)) return game.status;
  if (game.status === 'in_progress') return `Q${game.period ?? '–'} · ${game.clock ?? 'In progress'}`;
  if (game.startTimeTBD) return `${date(game.startDate)} · Time TBA`;
  if (Date.parse(game.startDate)<Date.now()) return `${date(game.startDate)} · Awaiting result`;
  return `${date(game.startDate)} · ${new Date(game.startDate).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`;
}
export default function OutlookApp({view}:{view:'setup'|'schedule'|'scoreboard'}) {
  const [year,setYear] = useState(initialYear),[team,setTeam] = useState('');
  const [teams,setTeams] = useState<Team[]>([]),[query,setQuery] = useState('');
  const [ready,setReady] = useState(false),[teamLoading,setTeamLoading] = useState(true);
  const [demo,setDemo] = useState(false),[data,setData] = useState<Outlook|null>(null);
  const [error,setError] = useState(''),[loading,setLoading] = useState(false),[week,setWeek] = useState('');
  const [retry,setRetry] = useState(0);
  const [favorites,setFavorites] = useState<string[]>([]);
  const [storageNotice,setStorageNotice] = useState('');
  const [searchOpen,setSearchOpen] = useState(false);
  useEffect(()=>{
    const url = new URLSearchParams(window.location.search);
    let saved: {team?:string;year?:number} = {};
    try {
      const value = JSON.parse(localStorage.getItem('saturday-preferences')??'{}');
      if (value && typeof value === 'object') saved = {team:typeof value.team === 'string' ? value.team : undefined,year:typeof value.year === 'number' ? value.year : undefined};
      const storedFavorites = JSON.parse(localStorage.getItem('saturday-my-teams')??'[]');
      if (Array.isArray(storedFavorites)) setFavorites([...new Set(storedFavorites.filter((name): name is string => typeof name === 'string' && name.length > 0))]);
    } catch {}
    const y = Number(url.get('year')??saved.year??initialYear);
    setYear([initialYear-1,initialYear].includes(y)?y:initialYear);
    setTeam(url.get('team')??saved.team??'');setReady(true);
  },[]);
  useEffect(()=>{
    if (!ready) return;
    const controller = new AbortController();setTeamLoading(true);setError('');setTeams([]);
    fetch(`/api/teams?year=${year}`,{signal:controller.signal}).then(async r=>{const value = await r.json();if(!r.ok)throw new Error(value.error);return value;}).then(value=>{
      setTeams(value.teams);setDemo(value.demo);if(view==='setup')setTeam(t=>value.teams.some((x:Team)=>x.school===t)?t:'');
    }).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setTeamLoading(false);});
    return ()=>controller.abort();
  },[year,ready,retry,view]);
  useEffect(()=>{if(ready)try{localStorage.setItem('saturday-preferences',JSON.stringify({team,year}));}catch{}},[team,year,ready]);
  useEffect(()=>{
    if (!ready) return;
    try {localStorage.setItem('saturday-my-teams',JSON.stringify(favorites));setStorageNotice('');}
    catch {setStorageNotice('Your browser cannot save My Teams. Changes will last only for this visit.');}
  },[favorites,ready]);
  useEffect(()=>{
    if (!ready || view==='setup') return;
    const url = new URL(window.location.href);
    url.searchParams.set('team',team);url.searchParams.set('year',String(year));
    window.history.replaceState(window.history.state,'',url);
  },[team,year,ready,view]);
  const load = useCallback(async(signal:AbortSignal,background=false)=>{
    if(!ready||teamLoading||!team||view==='setup')return;
    if(!background)setLoading(true);
    try {
      const params = new URLSearchParams({team,year:String(year)});if(week&&view==='scoreboard')params.set('week',week);
      const response=await fetch(`/api/outlook?${params}`,{signal});const value=await response.json();
      if(!response.ok)throw new Error(value.error);setData(value);setError('');
    } catch(e){if(!signal.aborted)setError(e instanceof Error?e.message:'Could not refresh.');}
    finally{if(!signal.aborted)setLoading(false);}
  },[ready,teamLoading,teams,team,year,week,view]);
  useEffect(()=>{
    const controller=new AbortController();setData(null);load(controller.signal);
    const timer=setInterval(()=>{if(document.visibilityState==='visible')load(controller.signal,true);},60000);
    return()=>{controller.abort();clearInterval(timer);};
  },[load]);
  const href = (path:string)=>`${path}?${new URLSearchParams({team,year:String(year)})}`;
  const selected=teams.find(t=>t.school===team) ?? (data?.team.school===team ? data.team : undefined);
  const changeYear=(value:number)=>{setData(null);setWeek('');setYear(value);};
  const changeTeam=(value:string)=>{setData(null);setWeek('');setTeam(value);setQuery('');setSearchOpen(false);};
  const isFavorite = favorites.includes(team);
  const favoriteButton = <button type="button" className="favorite-toggle" disabled={!selected||teamLoading} aria-pressed={isFavorite} aria-label={`${isFavorite?'Remove':'Add'} ${team} ${isFavorite?'from':'to'} My Teams`} title={`${isFavorite?'Remove from':'Add to'} My Teams`} onClick={()=>setFavorites(current=>current.includes(team)?current.filter(name=>name!==team):[...current,team])}><span aria-hidden="true">{isFavorite?'★':'☆'}</span></button>;
  const myTeams = <section className="my-teams" aria-label="My Teams"><div className="my-teams-heading"><h2>My Teams</h2><span>Saved in this browser</span></div>{favorites.length?<div className="favorite-list">{favorites.map(name=>{
    const available=teams.some(t=>t.school===name);
    return <div className="favorite-chip" key={name}><button type="button" className="favorite-switch" aria-pressed={team===name} disabled={teamLoading||!available} title={!teamLoading&&!available?`${name} is not listed as FBS in ${year}`:undefined} onClick={()=>changeTeam(name)}>{name}{!teamLoading&&!available&&<span> · Unavailable in {year}</span>}</button><button type="button" className="favorite-remove" aria-label={`Remove ${name} from My Teams`} onClick={()=>setFavorites(current=>current.filter(t=>t!==name))}>×</button></div>;
  })}</div>:<p className="muted">Use the star beside your team to save it here.</p>}{storageNotice&&<p className="muted" role="status">{storageNotice}</p>}</section>;
  const record=data?.records[team];
  const displayedTeams=teams.filter(t=>`${t.school} ${t.mascot} ${t.conference}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>Number(favorites.includes(b.school))-Number(favorites.includes(a.school)) || a.school.localeCompare(b.school));
  const nextGame=data?.games.find(g=>!g.completed&&!['canceled','cancelled'].includes(g.status??''));
  const nextOpponent=nextGame&&(nextGame.homeTeam===team?nextGame.awayTeam:nextGame.homeTeam);
  const nextPrediction=nextGame&&data?.predictions[nextGame.id];
  return <div className="team-theme" style={teamTheme(selected?.school==='Stanford'?'#8c1515':selected?.color)}>
    <header className="topbar"><div className="topbar-inner"><Link className="brand" href="/" aria-label="CFB Schedule Outlook home"><span className="brand-mark">C</span><span>CFB SCHEDULE<span className="brand-light"> OUTLOOK</span></span></Link><span className="edition">COLLEGE FOOTBALL</span></div></header>
    <main className={view==='setup'?'setup-main':undefined}>
      {view==='setup'?<>
        <div className="setup-heading"><p className="intro">Use advanced metrics (SP+) to forecast your team's performance against its schedule.</p></div>
        <section className="setup-card" aria-labelledby="setup-title"><div className="section-heading"><div><p className="eyebrow">01 / MAKE IT YOURS</p><h1 id="setup-title">Pick your team</h1></div><span className="pill">FBS</span></div>
          <label className="field">Season<select value={year} onChange={e=>changeYear(Number(e.target.value))}>{[initialYear-1,initialYear].map(y=><option key={y}>{y}</option>)}</select></label>
          <div className="team-search">
            <label className="field">Choose your team<input type="search" value={query} onFocus={()=>setSearchOpen(true)} onChange={e=>{setQuery(e.target.value);setSearchOpen(true);}} onKeyDown={e=>{if(e.key==='Escape'){setSearchOpen(false);e.currentTarget.blur();}if(e.key==='Enter'&&displayedTeams.length===1){changeTeam(displayedTeams[0].school);e.currentTarget.blur();}}} placeholder={selected?`Change from ${selected.school}`:'Search schools or conferences'} aria-controls="team-search-results" autoComplete="off"/></label>
            {teamLoading?<p className="muted" role="status">Loading FBS teams…</p>:(searchOpen||!selected)&&<div id="team-search-results" className="team-search-results">
              <p className="search-hint" role="status">{displayedTeams.length?query.trim()?`${displayedTeams.length} matching ${displayedTeams.length===1?'team':'teams'} · Tap to choose`:'Tap a team, or type to narrow the list':'No matching teams. Try another school or conference.'}</p>
              <ul aria-label="Matching teams">{displayedTeams.map(t=><li key={t.id}><button type="button" onClick={()=>changeTeam(t.school)}><span><strong>{t.school} {t.mascot}</strong><small>{t.conference}{favorites.includes(t.school)?' · My Teams':''}</small></span><span aria-hidden="true">→</span></button></li>)}</ul>
            </div>}
          </div>
          {selected&&<div className="selected-team"><Badge name={selected.abbreviation} large/><div><h3>{selected.school} {selected.mascot}</h3><p>{selected.conference}</p></div>{favoriteButton}</div>}
          {myTeams}
          {selected&&!teamLoading&&<Link className="primary-button" href={href('/schedule')}>See my season <span aria-hidden="true">→</span></Link>}
          {demo&&<p className="demo-note">Demo mode · Explore with illustrative football data.</p>}
        </section>
      </>:<>
        <div className="workspace-heading"><div><p className="eyebrow">THE SEASON, IN PERSPECTIVE</p><h1>{team || 'Your team'}<span className="year-label"> / {year}</span></h1><p className="muted">{selected?.mascot} {selected?.conference&&`· ${selected.conference}`}</p></div><div className="quick-controls"><label>Team<select aria-label="Team" value={team} disabled={teamLoading} onChange={e=>changeTeam(e.target.value)}><option value="" disabled>Choose a team</option>{team&&!teams.some(t=>t.school===team)&&<option>{team}</option>}{teams.map(t=><option key={t.id}>{t.school}</option>)}</select></label>{favoriteButton}<label>Season<select aria-label="Season" value={year} onChange={e=>changeYear(Number(e.target.value))}>{[initialYear-1,initialYear].map(y=><option key={y}>{y}</option>)}</select></label></div></div>
        {myTeams}
        <nav className="tabs" aria-label="Season pages"><Link className={view==='schedule'?'active':''} aria-current={view==='schedule'?'page':undefined} href={href('/schedule')}>Schedule & outlook</Link><Link className={view==='scoreboard'?'active':''} aria-current={view==='scoreboard'?'page':undefined} href={href('/scoreboard')}>Opponent scoreboard</Link></nav>
        {!team&&!teamLoading&&<div className="empty"><h3>Choose your team</h3><p>Select a team above to see its season outlook.</p></div>}
        {data?.demo&&<div className="notice demo-notice"><strong>Demo season</strong> · All schedules, scores, and projections below are illustrative.</div>}
        {(loading||teamLoading)&&<div className="loading" role="status"><span className="loading-line"/>Loading your season…</div>}
        {data&&!loading&&view==='schedule'&&<>
          <section className="summary-grid" aria-label="Season summary"><div className="outlook-card"><p className="eyebrow">EXPECTED TOTAL WINS</p><div className="big-stat">{data.expectedWins?.toFixed(1)??'—'}<span> / {data.games.filter(g=>!['canceled','cancelled'].includes(g.status??'')).length} scheduled</span></div><div className="win-track">{data.games.map(g=><span key={g.id} title={`${g.homeTeam===team?g.awayTeam:g.homeTeam}: ${outcome(g,team)??`${Math.round((data.predictions[g.id]?.probability??0)*100)}%`}`} className={outcome(g,team)==='W'?'won':outcome(g,team)==='L'?'lost':''} style={{opacity:g.completed?1:0.25+(data.predictions[g.id]?.probability??0)*0.75}}/>)}</div><p>{data.missingPredictions?`${data.missingPredictions} game${data.missingPredictions===1?'':'s'} without a projection. Total unavailable.`:`${data.wins} wins in the books + ${(data.knownExpectedWins-data.wins).toFixed(1)} projected ahead`}</p></div><div className="stat-card"><p className="eyebrow">CURRENT RECORD</p><div className="record-stat">{record?`${record.wins}–${record.losses}`:data.games.length?`${data.wins}–${data.losses}`:'—'}</div><p>{record?'Overall season record':'From available results'}</p></div><div className="stat-card next-card"><p className="eyebrow">NEXT ON THE SCHEDULE</p>{nextGame?<><h2>{nextGame.neutralSite?'vs.':nextGame.homeTeam===team?'vs.':'at'} {nextOpponent}</h2><p>{date(nextGame.startDate)} · {weekLabel(weekKey(nextGame))}</p><strong className="next-chance">{nextPrediction?.probability!=null?`${Math.round(nextPrediction.probability*100)}% win chance`:'Projection unavailable'}</strong></>:<><h2>{data.games.length?'Season complete':'Stay tuned'}</h2><p>{data.games.length?'All available games are final.':'Schedule not yet available.'}</p></>}</div></section>
          <section className="sp-panel" aria-label="Team SP+ rankings"><div className="sp-heading"><h2>{team} SP+ rankings</h2><p>{data.spSource?.publishedAt?`Published ${new Date(data.spSource.publishedAt+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}`:`Latest available for ${year} · Publication date not provided`}{data.spSource&&<> · {data.spSource.url?<a href={data.spSource.url} target="_blank" rel="noreferrer">{data.spSource.name} ↗</a>:data.spSource.name}</>}</p></div><dl className="sp-metrics"><div><dt>SP+</dt><dd>{formatSpRank(data.spRatings[team]?.overallRank)}</dd></div><div><dt>Offensive SP+</dt><dd>{formatSpRank(data.spRatings[team]?.offenseRank)}</dd></div><div><dt>Defensive SP+</dt><dd>{formatSpRank(data.spRatings[team]?.defenseRank)}</dd></div></dl><p className="sp-note">National rankings · #1 is best in each category. — means unavailable.</p></section>
          <section className="schedule-panel"><div className="section-heading"><div><p className="eyebrow">THE ROAD AHEAD</p><h2>Season schedule</h2></div><span className="muted">{data.games.length} games</span></div><div className="table-labels"><span>WEEK / DATE</span><span>MATCHUP</span><span>RESULT / WIN CHANCE</span></div>
            {data.games.length===0?<div className="empty"><h3>No games published yet</h3><p>Try another season, or check back when the schedule is released.</p></div>:data.games.map(g=>{
              const home=g.homeTeam===team,opponent=home?g.awayTeam:g.homeTeam,r=data.records[opponent],result=outcome(g,team),p=data.predictions[g.id];
              return <article className="game-row" key={g.id}><div className="game-date"><span>{g.seasonType==='postseason'?'POST · ':''}WK {g.week}</span><strong>{date(g.startDate)}</strong></div><div className="matchup"><Badge name={opponent}/><div><h3><span className="venue-prefix">{g.neutralSite?'vs.':home?'vs.':'at'}</span> <a className="opponent-link" href={`/schedule?${new URLSearchParams({team:opponent,year:String(year)})}`} aria-label={`View ${opponent} schedule for ${year}`}>{opponent}</a></h3><p>{r?`${r.wins}–${r.losses}${r.ties?`–${r.ties}`:''}`:'Record unavailable'} <span>· {g.neutralSite?'Neutral site':home?'Home':'Away'}</span><span className="opponent-sp"> · SP+ {formatSpRank(data.spRatings[opponent]?.overallRank)}</span></p></div></div><div className="game-outlook">{result?<><strong className={`result ${result==='W'?'win':''}`}><span>{result}</span>{home?g.homePoints:g.awayPoints}–{home?g.awayPoints:g.homePoints}</strong><p>Final</p></>:['canceled','cancelled','postponed'].includes(g.status??'')?<p>{g.status}</p>:<><div className="probability"><strong>{p?.probability!=null?`${Math.round(p.probability*100)}%`:'—'}</strong><span>{p?.probability!=null?p.model==='99% assumption'?p.model:`${p.model} model`:'No rating'}</span></div><div className="probability-track"><span style={{width:`${(p?.probability??0)*100}%`}}/></div><p>{g.status==='in_progress'?'In progress · pregame estimate':g.startTimeTBD?'Kickoff TBA':new Date(g.startDate).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</p></>}</div></article>;
            })}
          </section>
          <details className="methodology"><summary>How the outlook is calculated</summary><p>Expected wins = completed wins + win probabilities for all remaining scheduled games, including announced postseason games. Unannounced playoff or bowl games are not projected. The total stays unavailable if any game lacks ratings.</p><p>SP+ differences are adjusted by 2.5 points for home field, then converted using 1 / (1 + exp(−margin / 9)). For a confirmed lower-division opponent without SP+, a rated or power-conference FBS team is assigned a 99% win chance (1% for the opponent), labeled “99% assumption.” Otherwise, if either team lacks SP+, Elo is used: 1 / (1 + 10^(−adjusted difference / 400)), with a 55-point home adjustment. Neutral sites have no home advantage.</p><p>These are transparent, uncalibrated model estimates, not official SP+ probabilities. Ratings are the latest available for the selected season; past seasons are not historical prediction backtests. In-progress games retain their pregame estimate until marked final.</p></details>
        </>}
        {data&&!loading&&view==='scoreboard'&&<><section className="scoreboard-heading"><div><p className="eyebrow">KEEP AN EYE ON THE COMPETITION</p><h2>Your opponents this week</h2><p className="muted">Every scheduled opponent, plus {team}. Times shown in your local time.</p></div><label className="week-control">Week<select aria-label="Week" value={data.selectedWeek} onChange={e=>setWeek(e.target.value)}>{data.weeks.map(w=><option key={weekKey(w)} value={weekKey(w)}>{weekLabel(weekKey(w))}{weekKey(w)===data.currentWeek?' · Current / nearest':''}</option>)}</select></label></section><div className="score-grid">{data.scoreboard.map(g=><article className="score-card" key={g.id}><div className={`score-status ${g.status==='in_progress'?'live':''}`}>{gameStatus(g)}</div>{[g.awayTeam,g.homeTeam].map((name,i)=><div className={`score-team ${name===team?'your-team':''}`} key={name}><Badge name={name}/><div><strong>{name}</strong><p>{data.records[name]?`${data.records[name].wins}–${data.records[name].losses}`:i?'Home':'Away'}</p></div><b>{(i?g.homePoints:g.awayPoints)??'—'}</b></div>)}<div className="score-footer">{g.venue??'Venue to be announced'}</div></article>)}</div>{!data.scoreboard.length&&<div className="empty"><h3>No games listed for this week</h3><p>Pick another week to see your opponents in action.</p></div>}{data.idleTeams.length>0&&<section className="idle-teams"><h3>No game listed this week</h3><p>{data.idleTeams.join(' · ')}</p></section>}</>}
        {data&&<div className="data-footer"><span>{data.demo?'Illustrative demo':'CollegeFootballData'} · Retrieved {new Date(data.fetchedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</span><button className="text-button" disabled={loading} onClick={()=>load(new AbortController().signal)}>↻ Refresh</button></div>}
        {data?.warnings.filter(w=>!data.demo).map(w=><p className="notice" key={w}>{w}</p>)}
      </>}
      {error&&<div className="notice error" role="alert"><strong>Couldn’t update football data.</strong><p>{error}</p>{data&&<p>The last retrieved data is still shown above.</p>}<button onClick={()=>setRetry(r=>r+1)}>Try again</button></div>}
      <footer className="site-footer"><span>CFB SCHEDULE OUTLOOK</span><span>One team. Every Saturday.</span><a href="https://collegefootballdata.com" target="_blank" rel="noreferrer">Data source ↗</a></footer>
    </main>
  </div>;
}
