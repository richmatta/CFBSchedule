import { test } from 'node:test';
import assert from 'node:assert/strict';
import { predict, outcome, summarize, currentWeek, gamesForWeek, relevantGames, scheduleForTeam, weekKey } from '../lib/model';
import type { Game, Week } from '../lib/types';
const game: Game = {id:1,week:0,seasonType:'regular',startDate:'2026-08-29T19:00:00Z',startTimeTBD:false,completed:false,neutralSite:true,homeTeam:'A',awayTeam:'B',homePoints:null,awayPoints:null};
test('equal neutral ratings produce 50%; home and away are complementary',()=>{
  const ratings={sp:{A:20,B:20},elo:{}};
  assert.equal(predict(game,'A',ratings).probability,.5);
  const home=predict({...game,neutralSite:false},'A',ratings).probability!;
  const away=predict({...game,neutralSite:false},'B',ratings).probability!;
  assert.ok(home>.5);assert.ok(Math.abs(home+away-1)<1e-10);
});
test('Stanford–Elon assumption contributes 0.99 to expected wins and is symmetric',()=>{
  const matchup={...game,homeTeam:'Stanford',awayTeam:'Elon',homeClassification:'fbs',awayClassification:'fcs',homeConference:'ACC'};
  const ratings={sp:{Stanford:5},elo:{Stanford:1500,Elon:1400}};
  assert.deepEqual(predict(matchup,'Stanford',ratings),{probability:.99,model:'99% assumption'});
  assert.equal(predict(matchup,'Elon',ratings).probability,.01);
  assert.equal(predict({...matchup,homeTeam:'Elon',awayTeam:'Stanford',homeClassification:'fcs',awayClassification:'fbs',homeConference:null,awayConference:'ACC'},'Stanford',ratings).probability,.99);
  assert.equal(summarize([matchup],'Stanford',{1:predict(matchup,'Stanford',ratings)}).expectedWins,.99);
  assert.equal(predict(matchup,'Stanford',{sp:{},elo:{}}).probability,.99);
});
test('lower-division assumption requires evidence; normal rating models stay intact',()=>{
  const ratings={sp:{A:10},elo:{}};
  assert.equal(predict({...game,homeClassification:'fbs',awayClassification:'fcs'},'A',ratings).probability,.99);
  assert.equal(predict({...game,homeClassification:'fbs',awayClassification:'fbs'},'A',ratings).probability,null);
  assert.equal(predict(game,'A',ratings).probability,null);
  assert.equal(predict({...game,homeClassification:'fbs',awayClassification:'fcs'},'A',{sp:{},elo:{}}).probability,null);
  assert.equal(predict({...game,homeClassification:'fbs',awayClassification:'fcs'},'A',{sp:{A:10,B:5},elo:{}}).model,'SP+');
});
test('SP+ takes precedence; Elo fallback uses both ratings from the same model',()=>{
  assert.equal(predict(game,'A',{sp:{A:20,B:10},elo:{A:1400,B:1800}}).model,'SP+');
  assert.equal(predict(game,'A',{sp:{A:20},elo:{A:1500,B:1500}}).probability,.5);
  assert.equal(predict(game,'A',{sp:{A:20},elo:{B:1500}}).probability,null);
});
test('final wins replace probabilities; live scores do not count as wins',()=>{
  const live={...game,homePoints:21,awayPoints:0};
  assert.equal(outcome(live,'A'),null);
  const final={...live,completed:true};
  assert.equal(outcome(final,'A'),'W');assert.equal(outcome(final,'B'),'L');
  assert.equal(summarize([final,{...game,id:2}],'A',{2:{probability:.75,model:'SP+'}}).expectedWins,1.75);
  assert.equal(summarize([live],'A',{1:{probability:.6,model:'Elo'}}).expectedWins,.6);
});
test('missing ratings cannot silently create a full-season total; cancellations excluded',()=>{
  assert.equal(summarize([game],'A',{}).expectedWins,null);
  assert.equal(summarize([],'A',{}).expectedWins,null);
  assert.equal(summarize([{...game,status:'canceled'}],'A',{}).missingPredictions,0);
});
test('calendar handles week zero, postseason in January, pre- and offseason',()=>{
  const weeks:Week[]=[{week:0,seasonType:'regular',startDate:'2026-08-25',endDate:'2026-08-31'},{week:1,seasonType:'postseason',startDate:'2026-12-15',endDate:'2027-01-22'}];
  assert.equal(currentWeek(weeks,new Date('2026-07-01'))?.week,0);
  assert.equal(weekKey(currentWeek(weeks,new Date('2027-01-10'))!),'postseason:1');
  assert.equal(currentWeek(weeks,new Date('2027-03-01'))?.seasonType,'postseason');
});
test('opponent scoreboard includes FCS opponents, selected team, and deduplicates head-to-head games',()=>{
  const schedule=[game,{...game,id:2,awayTeam:'FCS'}];
  const other={...game,id:3,homeTeam:'FCS',awayTeam:'C'};
  const unrelated={...game,id:4,homeTeam:'D',awayTeam:'E'};
  const board=relevantGames(schedule,[game,game,other,unrelated],'A');
  assert.deepEqual(board.games.map(g=>g.id),[1,3]);assert.deepEqual(board.idleTeams,[]);
  assert.deepEqual(relevantGames(schedule,[],'A').idleTeams,['A','B','FCS']);
});
test('one season-wide game response supplies team schedules and weekly scoreboards',()=>{
  const weekOne={...game,id:10,week:1,homeTeam:'A',awayTeam:'B',startDate:'2026-09-05T16:00:00Z'};
  const weekTwo={...game,id:11,week:2,homeTeam:'C',awayTeam:'A',startDate:'2026-09-12T16:00:00Z'};
  const unrelated={...game,id:12,week:1,homeTeam:'C',awayTeam:'D',startDate:'2026-09-05T20:00:00Z'};
  assert.deepEqual(scheduleForTeam([unrelated,weekTwo,weekOne],'A').map(g=>g.id),[10,11]);
  assert.deepEqual(gamesForWeek([weekTwo,unrelated,weekOne],'regular:1').map(g=>g.id),[10,12]);
});
