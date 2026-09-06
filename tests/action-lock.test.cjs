const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
test('local names preserve Japanese and Latin letters but strip markup',()=>{const line=source.split('\n').find(l=>l.includes('const safeName='));const f=vm.runInNewContext(line+';safeName');assert.equal(f('あお',0),'あお');assert.equal(f('Alice 2',0),'Alice 2');assert.equal(f('<あか>',1),'あか');assert.equal(f('',1),'プレイヤー2');});
const action=source.slice(source.indexOf('    function act('),source.indexOf('    function advance('));
function run(type,street,chips=100,due=20){
 const p={id:0,human:true,name:'P0',chips,bet:0,total:0,mods:[],silenced:true,allin:false,folded:false};
 const ctx={phase:'act',manualResolving:false,P:[p],actor:0,street,currentBet:due,minRaise:20,raiseTo:40,pending:new Set([0]),
  pay:(p,n)=>{const x=Math.min(p.chips,n);p.chips-=x;p.bet+=x;p.total+=x;p.allin=!p.chips;},
  live:()=>[p],effectContext:()=>({events:[]}),Rogue:{action:()=>{}},publishEffects:()=>{},flyChips:()=>{},raiseSignal:()=>{},pushLog:()=>{},flashAction:()=>{},render:()=>{},setTimeout:()=>{},$:()=>({textContent:''})};
 vm.runInNewContext(action+`;act('${type}');`,ctx);return p;
}
test('preflop jammer blocks raise and over-call all-in in the real action handler',()=>{assert.equal(run('raise','pre').chips,100);assert.equal(run('allin','pre').chips,100);});
test('jammer still permits a call-sized all-in, and expires after preflop',()=>{assert.equal(run('allin','pre',10,20).chips,0);assert.equal(run('raise','flop').chips,60);});
