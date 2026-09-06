const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const fn=code.slice(code.indexOf('    function playerStatuses('),code.indexOf('    function statusMarkup('));
function statuses(player,street='pre'){const ctx={};vm.runInNewContext(fn+`;result=playerStatuses(${JSON.stringify(player)},${JSON.stringify(street)});`,ctx);return ctx.result;}
test('active debuffs become plain persistent status labels',()=>{const out=statuses({silenced:true,guardJammed:true,fogged:true,exposed:true,allin:false});assert.deepEqual(Array.from(out,x=>x.code),['RAISE LOCK','GUARD OFF','NO INFO','OPEN CARD']);assert.ok(out.every(x=>x.copy&&x.kind==='debuff'));});
test('raise lock expires after pre-flop while all-in remains visible',()=>{const out=statuses({silenced:true,guardJammed:false,fogged:false,exposed:false,allin:true},'flop');assert.deepEqual(Array.from(out,x=>x.code),['ALL-IN']);});
