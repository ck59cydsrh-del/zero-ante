const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../rogue.js');
function fixture(id) {
 const players=Array.from({length:3},(_,id)=>({id,name:'P'+id,human:true,chips:id?400:100,total:40,bet:20,folded:false,allin:false,participated:true,hole:[{r:4,s:'♣'},{r:12,s:'♦'}],mods:[],last:'CHECK'}));
 if(id)players[0].mods=[R.catalog.find(m=>m.id===id)];
 return {players,deck:Array.from({length:40},()=>({r:9,s:'♥'})),board:[{r:2,s:'♣'},{r:3,s:'♥'},{r:5,s:'♠'},{r:6,s:'♦'},{r:7,s:'♥'}],bb:20,events:[]};
}
test('40 unique abilities, stronger winner pool, common loser pool, no duplicates',()=>{
 assert.equal(R.catalog.length,40);assert.equal(new Set(R.catalog.map(m=>m.id)).size,40);
 const p=fixture().players[0];assert.ok(R.rewardPool(p,true).every(m=>m.tier>=2));assert.ok(R.rewardPool(p,false).every(m=>m.tier===1));
 p.mods=[...R.catalog];assert.equal(R.rewardPool(p,true).length,0);assert.equal(R.rewardPool(p,false).length,0);
});
for(const m of R.catalog) test(`${m.id}: actual effect and attributable receipt`,()=>{
 const c=fixture(m.id),p=c.players[0],q=c.players[1];
 if(m.manual) {
  if(m.id==='suitburn')q.hole=[{r:4,s:'♥'},{r:12,s:'♦'}];
  const oldBoard=[...c.board],result=R.manual(c,p,m.id,m.targeted?1:null);
  assert.equal(result.ok,true);assert.equal(p.used['manual:'+m.id],true);
  if(m.id==='downshift')assert.equal(q.hole[1].r,10);
  if(m.id==='pocketstatic')assert.ok(q.hole.some(x=>x.r===9));
  if(m.id==='suitburn')assert.ok(q.hole.some(x=>x.s==='♣'));
  if(m.id==='ranklock')assert.equal(Math.max(...q.hole.map(x=>x.r)),7);
  if(m.id==='boardscramble')assert.ok(c.board.some(x=>x.r===9));
  if(m.id==='boardwipe')assert.ok(c.board.every(x=>x.r===9));
  if(m.id==='rankroulette'||m.id==='suitstorm')assert.ok(c.board.every((x,i)=>x!==oldBoard[i]));
  const second=R.manual(c,p,m.id,m.targeted?1:null);assert.equal(second.ok,false);
  assert.ok(c.events.some(e=>e.id===m.id&&e.copy&&e.owner===0));return;
 }
 if(m.cat==='info') {
  const lines=R.readout(p,{...c,due:20,pot:80,handName:'ONE PAIR',nextBlinds:'15/30',untilLevel:2});
  assert.ok(lines.join(' ').includes({odds:'POT ODDS 20%',scan:'ONE PAIR',tell:'P1 CHECK',map:'NEXT 15/30 / 2 HANDS'}[m.id]));return;
 }
 if(['redline','blackline'].includes(m.id)) {
  const cards=R.rankCards(p,c.board);assert.equal(cards[m.id==='redline'?1:0].r,m.id==='redline'?13:5);assert.equal(p.hole[1].r,12);R.rankEvents(c);
 } else if(['insurance','patience','cashback'].includes(m.id)) {
  const type={insurance:'fold',patience:'check',cashback:'call'}[m.id];R.action(c,p,type);assert.equal(p.chips,m.id==='insurance'?120:110);
  const n=p.chips;R.action(c,p,type);assert.equal(p.chips,n);if(m.id==='insurance')assert.equal(p.total,20);
 } else if(['cushion','flopshift','riverboost','sixboard'].includes(m.id)) {
  const name=['cushion','flopshift'].includes(m.id)?'flop':'river';R.street(c,name);
  if(m.id==='cushion')assert.equal(p.chips,115);if(m.id==='flopshift')assert.equal(c.board[2].r,9);if(m.id==='riverboost')assert.equal(c.board[4].r,8);if(m.id==='sixboard')assert.equal(c.board.length,6);
  const before=JSON.stringify([p.chips,c.board]);R.street(c,name);assert.equal(JSON.stringify([p.chips,c.board]),before);
 } else if(['comeback','bounty'].includes(m.id)) {
  R.result(c,m.id==='bounty'?[0]:[1]);assert.equal(p.chips,m.id==='bounty'?180:140);
 } else {
  R.opening(c);
  const checks={rebuy:()=>assert.equal(p.chips,200),reserve:()=>assert.equal(p.chips,160),vault:()=>assert.equal(p.chips,120),
   scramble:()=>assert.equal(q.hole[1].r,9),lowcut:()=>assert.equal(q.hole[0].r,9),reroll:()=>assert.equal(p.hole[0].r,9),
   silence:()=>assert.equal(q.silenced,true),drain:()=>{assert.equal(p.chips,120);assert.equal(q.chips,380);},jam:()=>assert.equal(q.guardJammed,true),fog:()=>assert.equal(q.fogged,true),
   pressure:()=>{assert.equal(q.total,60);assert.equal(q.chips,380);},expose:()=>assert.equal(q.exposed,true),thirdhole:()=>assert.equal(p.hole.length,3),pairforge:()=>assert.equal(p.hole[1].r,p.hole[0].r),
   hearts:()=>assert.ok(p.hole.every(x=>x.s==='♥')),spades:()=>assert.ok(p.hole.every(x=>x.s==='♠')),
   doubleante:()=>{assert.equal(p.chips,80);assert.equal(c.players.reduce((n,p)=>n+p.total,0),180);}};
  assert.ok(checks[m.id]);checks[m.id]();
 }
 assert.ok(c.events.some(e=>e.id===m.id&&e.copy&&e.owner===0));
});
test('jam cancels guard; fog removes readout',()=>{
 const c=fixture('jam');c.players[1].mods=[R.catalog.find(m=>m.id==='vault')];R.opening(c);assert.equal(c.players[1].chips,400);
 c.players[1].mods.push(R.catalog.find(m=>m.id==='patience'));R.action(c,c.players[1],'check');assert.equal(c.players[1].chips,400);
 c.players[1].fogged=true;assert.deepEqual(R.readout(c.players[1],c),['SIGNAL FOG / 情報系無効']);
});
test('all-in bonus stays locked; drain cannot bankrupt; ante never underflows',()=>{
 const c=fixture('cashback'),p=c.players[0];p.chips=0;p.allin=true;R.action(c,p,'call');assert.equal(p.allin,true);assert.equal(p.chips,10);
 const d=fixture('drain');d.players[1].chips=1;R.opening(d);assert.equal(d.players[1].chips,1);
 const a=fixture('pressure');a.players[1].chips=4;R.opening(a);assert.equal(a.players[1].chips,0);assert.equal(a.players[1].allin,true);assert.equal(a.players[1].total,44);
});
test('sixth street is shared once and excludes folded owners',()=>{
 const c=fixture('sixboard');c.players[1].mods=[R.catalog.find(m=>m.id==='sixboard')];R.street(c,'river');assert.equal(c.board.length,6);
 const d=fixture('sixboard');d.players[0].folded=true;R.street(d,'river');assert.equal(d.board.length,5);
});
test('life patch once per run, ace ceiling and real deck consumption',()=>{
 const c=fixture('rebuy');R.opening(c);c.players[0].chips=10;R.opening(c);assert.equal(c.players[0].chips,10);
 const d=fixture('redline');d.players[0].hole=[{r:14,s:'♥'}];assert.equal(R.rankCards(d.players[0],[])[0].r,14);
 const e=fixture('scramble');R.opening(e);assert.equal(e.deck.length,39);
});
test('manual targeting rejects allies, waits for flop, and marks board scope',()=>{
 const attack=fixture('downshift');assert.equal(R.manual(attack,attack.players[0],'downshift',0).ok,false);
 const chaos=fixture('boardscramble');chaos.board=[];assert.equal(R.manualReady(chaos.players[0].mods[0],chaos,chaos.players[0]),false);assert.equal(R.manual(chaos,chaos.players[0],'boardscramble').ok,false);
 const ready=fixture('boardscramble'),result=R.manual(ready,ready.players[0],'boardscramble');assert.equal(result.event.scope,'board');assert.equal(result.event.targetName,'BOARD');
});
