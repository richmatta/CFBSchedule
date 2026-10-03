import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFei,parseSagarin} from '../lib/forecast-sources';
const teams=Array.from({length:120},(_,i)=>({school:`Team ${i+1}`}));
test('parses FEI overall and component ranks',()=>{
  const rows=teams.map((t,i)=>`<tr><td>${i+1}</td><td>${t.school}</td><td>1-0</td><td>1-0</td><td>${(1-i/100).toFixed(2)}</td><td></td><td>.1</td><td>${120-i}</td><td>.2</td><td>${i+1}</td><td>.0</td><td>${i+1}</td></tr>`).join('');
  const result=parseFei(`<h1>2026 FEI Ratings (through Week 4)</h1><table>${rows}</table>`,2026,teams);
  assert.equal(result.values['Team 1'],1);assert.deepEqual(result.summaries['Team 1'],{rank:1,offenseRank:120,defenseRank:1,specialTeamsRank:1});
});
test('parses Sagarin Predictor rating and rank',()=>{
  const rows=teams.map((t,i)=>`${String(i+1).padStart(4)}  ${t.school} A = ${(90-i/10).toFixed(2)}  1 0  50.00 ( 1) 0 0 | 0 0 | ${(88-i/10).toFixed(2)} ${i+1} | 80.00 1 | 80.00 1 | 80.00 1`).join('\n');
  const result=parseSagarin(`2026 College Football through games of September 26 Saturday - Week 4\n${rows}`,2026,teams);
  assert.equal(result.values['Team 1'],88);assert.equal(result.summaries['Team 1'].rank,1);assert.equal(result.source.publishedAt,'2026-09-26');
});
