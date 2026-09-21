import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEspnSp} from '../lib/espn-sp';
const teams=[{school:'San José State'},{school:'South Carolina'}];
const html=`<h1>ESPN</h1><h1>2026 college football SP+ rankings</h1><p>Below are the updated 2026 SP+ rankings as of Sept. 20, 2026.</p><table><thead><tr><th>Team</th><th>Rating</th><th>Offense</th><th>Defense</th></tr></thead><tbody><tr><td>1. San Jose St. (2-1)</td><td>4.2</td><td>30.1 (1)</td><td>25.9 (2)</td></tr><tr><td>2. S. Carolina (1-2)</td><td>-1.2</td><td>20.0 (2)</td><td>21.2 (1)</td></tr></tbody></table><table><th>Résumé</th></table>`;
const parse=(s=html,year=2026)=>parseEspnSp(s,year,teams,new Date('2026-09-21T12:00:00Z'));
test('parses predictive ratings, aliases, component ranks, and explicit publication date',()=>{const s=parse();assert.equal(s.publishedAt,'2026-09-20');assert.equal(s.ratings[0].team,'San José State');assert.equal(s.ratings[1].team,'South Carolina');assert.equal(s.ratings[1].rating,-1.2);assert.equal(s.ratings[0].defense.ranking,2);});
test('rejects wrong season, missing date, unknown teams, malformed numbers and duplicate ranks',()=>{assert.throws(()=>parse(html,2025));for(const s of [html.replace('as of','from'),html.replace('S. Carolina','Unknown'),html.replace('-1.2','N/A'),html.replace('2. S. Carolina','1. S. Carolina'),html.replace('Sept. 20','Dec. 20')])assert.throws(()=>parse(s));});
test('rejects partial or duplicate team tables',()=>{assert.throws(()=>parse(html.replace(/<tr><td>2\..*?<\/tr>/,'')));assert.throws(()=>parse(html.replace('S. Carolina','San Jose St.')));});
