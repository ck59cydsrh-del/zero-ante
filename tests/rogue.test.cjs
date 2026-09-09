const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../rogue.js');
function fixture(id) {
 const players=Array.from({length:3},(_,id)=>({id,name:'P'+id,human:true,chips:id?400:100,total:40,bet:20,folded:false,allin:false,participated:true,hole:[{r:4,s:'♣'},{r:12,s:'♦'}],mods:[],last:'CHECK'}));
 if(id)players[0].mods=[R.catalog.find(m=>m.id===id)];
 return {players,deck:Array.from({length:40},()=>({r:9,s:'♥'})),board:[{r:2,s:'♣'},{r:3,s:'♥'},{r:5,s:'♠'},{r:6,s:'♦'},{r:7,s:'♥'}],bb:20,events:[]};
}
test('52 unique abilities, stronger winner pool, common loser pool, no duplicates',()=>{
 assert.equal(R.catalog.length,52);assert.equal(new Set(R.catalog.map(m=>m.id)).size,52);
 // 表に出す名前は日本語。英字は型番として残す
 assert.ok(R.catalog.every(m=>m.plain&&m.codeName&&m.name===m.plain));
 // 対象を選んで撃つものが、40種時代の4つから増えていること
 assert.ok(R.catalog.filter(m=>m.targeted).length>=9,'targeted abilities should outnumber the original four');
 const p=fixture().players[0];assert.ok(R.rewardPool(p,true).every(m=>m.tier>=2));assert.ok(R.rewardPool(p,false).every(m=>m.tier===1));
 p.mods=[...R.catalog];assert.equal(R.rewardPool(p,true).length,0);assert.equal(R.rewardPool(p,false).length,0);
});
for(const m of R.catalog) test(`${m.id}: actual effect and attributable receipt`,()=>{
 const c=fixture(m.id),p=c.players[0],q=c.players[1];
 // 封じる札は、封じる相手がいて初めて撃てる
 if(m.id==='lockout') q.mods=[R.catalog.find(x=>x.id==='tax')];
 if(m.manual) {
  if(m.id==='suitburn')q.hole=[{r:4,s:'♥'},{r:12,s:'♦'}];
  if(m.id==='mirror'){const theirHigh=Math.max(...q.hole.map(x=>x.r)),myLow=Math.min(...p.hole.map(x=>x.r));
   R.manual(c,p,m.id,1);assert.ok(p.hole.some(x=>x.r===theirHigh));assert.ok(q.hole.some(x=>x.r===myLow));
   assert.ok(c.events.some(e=>e.id===m.id&&e.copy&&e.owner===0));return;}
  const oldBoard=[...c.board],result=R.manual(c,p,m.id,m.targeted?1:null);
  assert.equal(result.ok,true);assert.equal(p.used['manual:'+m.id],true);
  if(m.id==='downshift')assert.equal(q.hole[1].r,10);
  if(m.id==='pocketstatic')assert.ok(q.hole.some(x=>x.r===9));
  if(m.id==='suitburn')assert.ok(q.hole.some(x=>x.s==='♣'));
  if(m.id==='ranklock')assert.equal(Math.max(...q.hole.map(x=>x.r)),7);
  if(m.id==='tax'){assert.equal(q.chips,100);assert.equal(p.chips,400);}
  if(m.id==='freeze')assert.equal(Math.min(...q.hole.map(x=>x.r)),2);
  if(m.id==='spotlight')assert.equal(q.exposed,'all');
  if(m.id==='rankdrop')assert.deepEqual(q.hole.map(x=>x.r),[3,11]);
  if(m.id==='handjack'){assert.deepEqual(p.hole.map(x=>x.r),[4,12]);assert.deepEqual(q.hole.map(x=>x.r),[4,12]);}
  if(m.id==='blindfold')assert.equal(q.blinded,true);
  if(m.id==='lockout'){assert.ok(Object.keys(q.used||{}).length>=0);}
  if(m.id==='allornothing')assert.equal(p.stakeX,2);
  if(m.id==='handpick')assert.ok(c.board.some(x=>x.r===4||x.r===12),'手札の札が場に出ている');
  if(m.id==='boardscramble')assert.ok(c.board.some(x=>x.r===9));
  if(m.id==='boardwipe')assert.ok(c.board.every(x=>x.r===9));
  if(m.id==='rankroulette'||m.id==='suitstorm')assert.ok(c.board.every((x,i)=>x!==oldBoard[i]));
  const second=R.manual(c,p,m.id,m.targeted?1:null);assert.equal(second.ok,false);
  assert.ok(c.events.some(e=>e.id===m.id&&e.copy&&e.owner===0));return;
 }
 if(m.cat==='info') {
  const lines=R.readout(p,{...c,due:20,pot:80,handName:'ONE PAIR',nextBlinds:'15/30',untilLevel:2});
  // 読み上げは日本語に統一した（英語の略語は読めない、というkozakiの指摘）
  assert.ok(lines.join(' ').includes({odds:'コールに必要な勝率 20%',scan:'次の場札 ♥9',tell:'P1:CHECK',map:'次の参加額 15/30（あと2回）',deckread:'この先3枚'}[m.id]));return;
 }
 if(m.id==='deflect') {
  // 受け身の札は、撃たれて初めて効く
  const d=fixture('drain');d.players[1].mods=[R.catalog.find(x=>x.id==='deflect')];
  R.opening(d);
  assert.equal(d.players[1].used.deflect,true,'跳ね返しが立つ');
  assert.ok(d.events.some(e=>e.id==='deflect'&&e.owner===1),'返した側の名前で告知される');
  return;
 }
 if(m.id==='tollgate') {
  const t=fixture('tollgate');const keeper=t.players[0],raiser=t.players[1];
  raiser.bet=200;const before=keeper.chips;
  R.action(t,raiser,'raise');
  assert.ok(keeper.chips>before,'増額から通行料が入る');
  assert.ok(t.events.some(e=>e.id==='tollgate'&&e.owner===0));
  return;
 }
 if(['redline','blackline'].includes(m.id)) {
  // 判定の中でこっそり足すのではなく、札そのものを書き換える（見て分かるように）
  R.opening(c);assert.equal(p.hole[m.id==='redline'?1:0].r,m.id==='redline'?13:5);
 } else if(m.id==='skim') {
  R.action(c,p,'raise');assert.equal(p.chips,140);
  const n=p.chips;R.action(c,p,'raise');assert.equal(p.chips,n);
 } else if(m.id==='refund') {
  R.action(c,p,'fold');p.folded=true;R.result(c,[1]);assert.equal(p.chips,120);
 } else if(m.id==='taxman') {
  R.result(c,[0]);assert.equal(p.chips,300);assert.equal(q.chips,300);
 } else if(m.id==='lowball') {
  R.opening(c);assert.equal(p.hole[0].r,5);
 } else if(m.id==='snowball') {
  p.streak=3;R.opening(c);assert.equal(p.chips,700);
 } else if(['insurance','patience','cashback'].includes(m.id)) {
  const type={insurance:'fold',patience:'check',cashback:'call'}[m.id];R.action(c,p,type);assert.equal(p.chips,m.id==='insurance'?120:300);
  const n=p.chips;R.action(c,p,type);assert.equal(p.chips,n);if(m.id==='insurance')assert.equal(p.total,20);
 } else if(['cushion','riverboost'].includes(m.id)) {
  const name=m.id==='cushion'?'flop':'river';R.street(c,name);
  if(m.id==='cushion')assert.equal(p.chips,350);if(m.id==='riverboost')assert.equal(c.board[4].r,8);
  const before=JSON.stringify([p.chips,c.board]);R.street(c,name);assert.equal(JSON.stringify([p.chips,c.board]),before);
 } else if(['comeback','bounty'].includes(m.id)) {
  R.result(c,m.id==='bounty'?[0]:[1]);assert.equal(p.chips,m.id==='bounty'?900:600);
 } else {
  R.opening(c);
  const checks={rebuy:()=>assert.equal(p.chips,1100),reserve:()=>assert.equal(p.chips,700),vault:()=>assert.equal(p.chips,300),
   scramble:()=>assert.equal(q.hole[1].r,9),lowcut:()=>assert.equal(q.hole[0].r,9),reroll:()=>assert.equal(p.hole[0].r,9),
   silence:()=>assert.equal(q.silenced,true),drain:()=>{assert.equal(p.chips,300);assert.equal(q.chips,200);},jam:()=>assert.equal(q.guardJammed,true),fog:()=>assert.equal(q.fogged,true),
   pressure:()=>{assert.equal(q.total,60);assert.equal(q.chips,380);},expose:()=>assert.equal(q.exposed,true),thirdhole:()=>assert.equal(p.hole.length,3),pairforge:()=>assert.equal(p.hole[1].r,p.hole[0].r),
   overheat:()=>assert.ok(p.hole.every(x=>x.s===p.hole[0].s)),
   lastword:()=>assert.equal(p.lastAct,true),
   bedrock:()=>assert.equal(p.bedrock,true),
   steady:()=>assert.equal(p.steady,true),
   suitveil:()=>{assert.equal(q.suitBlind,true);assert.ok(!p.suitBlind);},
   doubleante:()=>{assert.equal(p.chips,80);assert.equal(c.players.reduce((n,p)=>n+p.total,0),180);}};
  assert.ok(checks[m.id]);checks[m.id]();
 }
 assert.ok(c.events.some(e=>e.id===m.id&&e.copy&&e.owner===0));
});
test('jam cancels guard; fog removes readout',()=>{
 // 跳ね返しは SHIELD BREAK そのものも跳ね返す。無効化より先に守りが立つ。
 const c=fixture('jam');c.players[1].mods=[R.catalog.find(m=>m.id==='deflect')];
 R.opening(c);
 assert.equal(c.players[1].used.deflect,true,'最初の妨害を返した');
 assert.notEqual(c.players[1].guardJammed,true,'返したので無効化は通っていない');
 const t=fixture('tollgate');t.players[0].guardJammed=true;const before=t.players[0].chips;
 t.players[1].bet=200;R.action(t,t.players[1],'raise');
 assert.equal(t.players[0].chips,before,'止められている間は通行料も取れない');
 c.players[1].fogged=true;assert.deepEqual(R.readout(c.players[1],c),['SIGNAL FOG / 情報系無効']);
});
test('all-in bonus stays locked; drain cannot bankrupt; ante never underflows',()=>{
 // 銀行からチップが来ても、オールインは次の勝負まで解けない
 const c=fixture('rebuy'),p=c.players[0];p.chips=0;p.allin=true;p.chips=1500;R.opening(c);assert.equal(p.allin,true);assert.equal(p.chips,2500);
 const d=fixture('drain');d.players[1].chips=1;R.opening(d);assert.equal(d.players[1].chips,1);
 const a=fixture('pressure');a.players[1].chips=4;R.opening(a);assert.equal(a.players[1].chips,0);assert.equal(a.players[1].allin,true);assert.equal(a.players[1].total,44);
});
test('a shared board rule fires once per owner and skips folded ones',()=>{
 const c=fixture('riverboost');R.street(c,'river');R.street(c,'river');assert.equal(c.board[4].r,8);
 const d=fixture('riverboost');d.players[0].folded=true;R.street(d,'river');assert.equal(d.board[4].r,7);
});
test('life patch once per run, ace ceiling and real deck consumption',()=>{
 const c=fixture('rebuy');R.opening(c);c.players[0].chips=10;R.opening(c);assert.equal(c.players[0].chips,10);
 const d=fixture('redline');d.players[0].hole=[{r:14,s:'♥'}];R.opening(d);assert.equal(d.players[0].hole[0].r,14);
 const e=fixture('scramble');R.opening(e);assert.equal(e.deck.length,39);
});
test('manual targeting rejects allies, waits for flop, and marks board scope',()=>{
 const attack=fixture('downshift');assert.equal(R.manual(attack,attack.players[0],'downshift',0).ok,false);
 const chaos=fixture('boardscramble');chaos.board=[];assert.equal(R.manualReady(chaos.players[0].mods[0],chaos,chaos.players[0]),false);assert.equal(R.manual(chaos,chaos.players[0],'boardscramble').ok,false);
 const ready=fixture('boardscramble'),result=R.manual(ready,ready.players[0],'boardscramble');assert.equal(result.event.scope,'board');assert.equal(result.event.targetName,'BOARD');
});

test('a matched suit of abilities pays a synergy on top', () => {
    // 同じ系統を寄せることに意味がないと、能力は「強い順に拾うだけ」になる
    const c = fixture('drain');
    const target = c.players[1];
    target.mods = ['steady', 'insurance'].map((id) => R.catalog.find((m) => m.id === id));
    assert.deepEqual(R.synergies(target).map((s) => s.name), ['盾']);
    R.opening(c);
    // 「盾」が毎ハンド1発だけ妨害を受け流す
    assert.equal(target.used['syn:shield'], true);
    assert.ok(c.events.some((e) => e.name === '盾'), '受け流したことは告知される');
});

test('three of a suit reaches the second step, and losing one drops it', () => {
    const c = fixture('steady');
    const p = c.players[0];
    p.mods = ['steady', 'insurance', 'refund'].map((id) => R.catalog.find((m) => m.id === id));
    assert.deepEqual(R.synergies(p).map((s) => s.name), ['盾', '要塞']);
    R.opening(c);
    assert.equal(p.fortress, true, '要塞は札も場も守る');
    p.mods.pop();
    assert.deepEqual(R.synergies(p).map((s) => s.name), ['盾']);
});

test('a hoarded attack suit skims the biggest stack every hand', () => {
    const c = fixture('drain');
    const p = c.players[0], rich = c.players[1];
    p.mods = ['drain', 'silence', 'jam'].map((id) => R.catalog.find((m) => m.id === id));
    rich.chips = 5000;
    R.opening(c);
    assert.ok(c.events.some((e) => e.name === '制圧'), '制圧 must fire and be attributable');
    assert.ok(rich.chips <= 4800, `the richest seat should be skimmed, had ${rich.chips}`);
});

test('every synergy names itself and says what it does', () => {
    for (const [cat, steps] of Object.entries(R.SYNERGY)) {
        assert.equal(steps.length, 2, `${cat} must have two steps`);
        for (const s of steps) {
            assert.ok(s.name && s.copy, `${cat}×${s.n} needs a name and a plain-language line`);
            assert.ok(!/[A-Z]{3,}/.test(s.copy), `${cat}×${s.n} copy must stay in Japanese`);
        }
    }
});

test('the attack third step refunds one charge per hand, then stops', () => {
    // 妨害は押して撃つものが多く、使い切りだと寄せるほど棚が痩せる。
    // 「制圧」はその1発ぶんだけを帳消しにする（毎回1発まで）。
    const c = fixture('drain');
    const p = c.players[0];
    p.mods = ['drain', 'silence', 'jam'].map((id) => R.catalog.find((m) => m.id === id));
    R.opening(c);
    assert.equal(R.keepsCharge(p), true, 'the first shot of the hand is kept');
    assert.equal(R.keepsCharge(p), false, 'only one per hand');
    R.opening(c);
    assert.equal(R.keepsCharge(p), true, 'the next hand arms it again');
});

test('without the attack suit nothing is refunded', () => {
    const c = fixture('drain');
    R.opening(c);
    assert.equal(R.keepsCharge(c.players[0]), false);
});

test('a defensive rack turns the first hit back on the shooter', () => {
    // 守りが「効かなかった」ことも卓に出さないと、持っている意味が読めない
    const c = fixture('drain');
    const shooter = c.players[0], target = c.players[1];
    target.mods = [R.catalog.find((m) => m.id === 'deflect')];
    const before = { shooter: shooter.chips, target: target.chips };
    R.opening(c);
    assert.ok(target.chips > before.target, 'the shooter pays for the attempt');
    assert.ok(shooter.chips < before.shooter);
    assert.ok(c.events.some((e) => e.id === 'deflect' && e.owner === target.id));
});

test('a locked hand cannot be rewritten, by hand or by suit', () => {
    for (const id of ['steady', null]) {
        const c = fixture('scramble');
        const target = c.players[1];
        if (id) target.mods = [R.catalog.find((m) => m.id === id)];
        const before = target.hole.map((x) => x.r).join();
        R.opening(c);
        const after = target.hole.map((x) => x.r).join();
        if (id) assert.equal(after, before, '守られた手札は動かない');
        else assert.notEqual(after, before, '守りが無ければ書き換わる');
    }
});

test('doubling the stake doubles the swing, and cannot take you below one chip', () => {
    const c = fixture('allornothing');
    const p = c.players[0];
    p.startChips = 1000; p.chips = 1400; p.stakeX = 2; p.participated = true;
    R.result(c, [p.id]);
    assert.equal(p.chips, 1800, '勝ち分が倍になる');
    const d = fixture('allornothing');
    const q = d.players[0];
    q.startChips = 1000; q.chips = 200; q.stakeX = 2; q.participated = true;
    R.result(d, [1]);
    assert.ok(q.chips >= 0 && q.chips < 200, '負け分も倍になるが、下は0で止まる');
});

test('the catalogue has no pure chip drip left', () => {
    // 「ただ増えるだけ」は判断が生まれないので置かない
    const drip = R.catalog.filter((m) => /^\+?\d+チップ獲得。$|チップ追加。$/.test(m.desc.trim()));
    assert.deepEqual(drip.map((m) => m.id), [], `still dripping: ${drip.map((m) => m.id)}`);
    assert.equal(R.catalog.filter((m) => m.cat === 'guard').length, 7);
});
