const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');const start=source.indexOf('    function rewardChoices(');const end=source.indexOf('\n    }',start)+6;const pick=vm.runInNewContext(source.slice(start,end)+';rewardChoices');
const pool=[{id:'a',tier:2},{id:'b',tier:2},{id:'c',tier:2},{id:'d',tier:3},{id:'e',tier:3},{id:'f',tier:2}];
test('winner gets a legendary candidate without duplicates',()=>{const r=pick(pool,true);assert.equal(r.length,3);assert.ok(r.some(m=>m.tier===3));assert.equal(new Set(r.map(m=>m.id)).size,3);});
test('reroll prioritizes unseen abilities and keeps the winner guarantee',()=>{const r=pick(pool,true,['a','b','d']);assert.ok(r.every(m=>!['a','b','d'].includes(m.id)));assert.ok(r.some(m=>m.tier===3));});
test('small or exhausted-tier pools remain valid',()=>{assert.equal(pick([],true).length,0);assert.equal(pick(pool.slice(0,1),true).length,1);assert.ok(pick(pool.slice(0,3),false).every(m=>m.tier===2));});
