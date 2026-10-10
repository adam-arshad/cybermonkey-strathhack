import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Run, offersFor, STARTER } from '../src/core/run.ts';
import { Battle, waveSpec } from '../src/core/combat.ts';
import { PADS } from '../src/core/map.ts';
import { scoreSelection } from '../src/core/controls.mjs';
import type { Scenario, Question } from '../src/core/types.ts';
const data=JSON.parse(readFileSync(new URL('../src/data/challenge.json',import.meta.url),'utf8')) as Scenario;
const questions=JSON.parse(readFileSync(new URL('../src/data/questions.json',import.meta.url),'utf8')).questions as Question[];
const qIds=['Q01','Q09','Q12','Q30'];
function ready(){const r=new Run(data);r.chosen=[...STARTER];r.lock();return r;}
function fight(r:Run){const b=new Battle(r.towers,r.health,r.phase,r.survivalWave);for(let i=0;i<20000&&!b.done;i++)b.step(1/60);assert.equal(b.done,true,'Wave must terminate');r.finishBattle(b.health,b.kills,b.leaks);return b;}

test('budget/category/duplicate validation preserves the supplied scoring engine',()=>{
 assert.throws(()=>scoreSelection(data,['P2','D4','D1','R2']),/Over budget/);
 assert.throws(()=>scoreSelection(data,['P1']),/Missing/);
 assert.throws(()=>scoreSelection(data,['P3','D3','R1','P3']),/chosen twice/);
 const result=scoreSelection(data,['P3','D3','R1']);
 assert.deepEqual(result.phases.map(p=>p.score),[2,5,4,3]);assert.equal(result.total,14);
});
test('shop blocks overspend, removal works, and locking freezes purchases',()=>{
 const r=new Run(data);r.toggle('P2');r.toggle('D4');r.toggle('D1');assert.throws(()=>r.toggle('R2'),/remaining budget/);
 r.toggle('D1');assert.equal(r.spent,2000000);r.toggle('R1');r.lock();assert.throws(()=>r.toggle('P3'),/locked/);
});
test('phase reveals have nine unique cards, exactly three in each category',()=>{
 for(let i=0;i<4;i++){const cards=offersFor(data,i);assert.equal(new Set(cards).size,9);for(const c of ['Prevent','Detect','Respond'])assert.equal(cards.filter(id=>data.controls.find(x=>x.id===id)?.category===c).length,3);}
});
test('matches cannot be claimed twice or claimed without owning a positive card',()=>{
 const r=ready();const id=r.eligible[0];assert.equal(r.claim(id),true);assert.equal(r.claim(id),false);assert.equal(r.claim('invalid'),false);
 assert.equal(r.towers.length,1);assert.equal(r.towers[0].level,data.phases[0].scores[id]);assert.throws(()=>r.finishMatching(),/Collect/);
});
test('only empty valid pads accept earned towers, and deployment is required',()=>{
 const r=ready();r.eligible.forEach(id=>r.claim(id));r.finishMatching();assert.throws(()=>r.startBattle(),/Place all/);
 assert.equal(r.place(r.pending[0].uid,-1),false);assert.equal(r.place(r.pending[0].uid,0),true);
 assert.equal(r.place(r.pending[0].uid,0),false);r.autoPlace();assert.equal(r.pending.length,0);
 assert.equal(new Set(r.towers.map(t=>t.pad)).size,r.towers.length);assert.ok(PADS.length>=36);
});
test('full four-phase run awards quizzes once, keeps official scores, and enters survival',()=>{
 const r=ready();
 for(let phase=0;phase<4;phase++){
  r.eligible.forEach(id=>r.claim(id));r.finishMatching();r.autoPlace();r.startBattle();fight(r);assert.equal(r.stage,'question');
  const q=questions.find(q=>q.id===qIds[phase])!;assert.equal(r.answer(q,q.correct),true);assert.equal(r.answer(q,q.correct),false);r.nextPhase();
 }
 assert.equal(r.stage,'intermission');assert.equal(r.behaviour,12);assert.equal(r.controlScore,scoreSelection(data,STARTER).total);
 r.startBattle();assert.equal(r.health,120);assert.equal(r.survivalWave,1);
 let loops=0;while(r.stage!=='gameover'&&loops++<60){fight(r);if(r.stage==='intermission')r.startBattle();}
 assert.equal(r.stage,'gameover');assert.ok(r.cleared>=1);assert.ok(r.survivalWave<60);
});
test('unanswered quiz grants no bonus and still allows the next phase',()=>{
 const r=ready();r.eligible.forEach(id=>r.claim(id));r.finishMatching();r.autoPlace();r.startBattle();fight(r);
 const q=questions.find(q=>q.id==='Q01')!;r.answer(q,null);assert.equal(r.behaviour,0);assert.equal(r.correctAnswers,0);r.nextPhase();assert.equal(r.phase,1);
});
test('zero towers never block rehearsal and survival eventually ends',()=>{
 const rehearsal=new Battle([],1,0,0);for(let i=0;i<10000&&!rehearsal.done;i++)rehearsal.step(1/60);assert.equal(rehearsal.done,true);assert.equal(rehearsal.health,1);
 const survival=new Battle([],20,3,1);for(let i=0;i<10000&&!survival.done;i++)survival.step(1/60);assert.equal(survival.done,true);assert.equal(survival.health,0);
});
test('survival increases enemy count and health, while practice waves stay gentle',()=>{
 assert.ok(waveSpec(3,2).hp>waveSpec(3,1).hp);assert.ok(waveSpec(3,2).count>waveSpec(3,1).count);assert.ok(waveSpec(3,0).hp<waveSpec(3,1).hp);
});
