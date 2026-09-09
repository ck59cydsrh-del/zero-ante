const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const fn=code.slice(code.indexOf('    let signalTimer = 0;'),code.indexOf('    const mods ='));

// 撃った先を線で結ぶ（kozakiの指示でビームを復活させた）。
// 席の印は残したまま、source と target が違うときだけビームが飛ぶ。
function signal(owner,target,{reduced=false,cat='attack',scope,viewer=0}={}){
  const beams=[],pops=[],marked=[],cleanup=[];
  const node=id=>({dataset:{viewer:String(viewer)},classList:{add:(...c)=>c.forEach(x=>marked.push([id,x]))}});
  const pod=node('pod'),opponent=node('opponent'),board=node('board');
  const ctx={
    $:s=>s==='.active-pod'?pod:s==='#board'?board:opponent,
    beam:(from,to,c)=>{if(!reduced&&from&&to&&from!==to)beams.push(c)},
    popAt:(n,text)=>pops.push(text),
    matchMedia:()=>({matches:reduced}),
    // 印は自分で消える。消えないと最後の一発が墨のまま残る（実機で操作盤が真っ黒になった）
    setTimeout:(fn,ms)=>{cleanup.push(ms);return 1},
    clearTimeout:()=>{},
    document:{querySelectorAll:()=>[]},
  };
  vm.runInNewContext(fn+`;abilitySignal({owner:${owner},target:${target},name:'RANK DROP',cat:${JSON.stringify(cat)},scope:${JSON.stringify(scope)}});`,ctx);
  return{beams,pops,marked,cleanup};
}

test('an attack marks the caster, inverts the target and fires a beam',()=>{
  const r=signal(0,1,{viewer:0});
  assert.deepEqual(r.beams,['attack'],'a beam should travel from caster to target');
  assert.ok(r.marked.some(([id,c])=>id==='pod'&&c==='casting'));
  assert.ok(r.marked.some(([id,c])=>id==='opponent'&&c==='targeted'));
  assert.ok(r.marked.some(([id,c])=>id==='opponent'&&c==='debuff-hit'));
});

test('a self-cast marks but never fires a beam at itself',()=>{
  const r=signal(0,0,{viewer:0});
  assert.deepEqual(r.beams,[],'nothing should be fired at your own seat');
});

test('a friendly effect marks the target as a buff, not a debuff',()=>{
  const r=signal(0,1,{cat:'guard'});
  assert.ok(r.marked.some(([id,c])=>id==='opponent'&&c==='buff-hit'));
  assert.ok(!r.marked.some(([,c])=>c==='debuff-hit'));
});

test('a board-scope effect marks the board rather than a seat',()=>{
  const r=signal(0,1,{cat:'chaos',scope:'board'});
  assert.ok(r.marked.some(([id,c])=>id==='board'&&c==='board-hit'));
});

test('being hit yourself says so on your own rail',()=>{
  // 自分が撃たれたときは「何を受けたか」を手前に出す
  const r=signal(1,0,{viewer:0});
  assert.ok(r.pops.some((t)=>/RANK DROP/.test(t)),'the player must be told what hit them');
});

test('reduced motion keeps the marks and drops the beam',()=>{
  const r=signal(0,1,{reduced:true});
  assert.deepEqual(r.beams,[]);
  assert.ok(r.marked.some(([id,c])=>id==='opponent'&&c==='targeted'));
});

test('a mark clears itself instead of waiting for the next effect',()=>{
  // 演出の列が空のまま印が残ると、受けた側の板が墨に反転したまま戻らない
  const r=signal(1,0,{viewer:0});
  assert.deepEqual(r.cleanup,[1100]);
});
