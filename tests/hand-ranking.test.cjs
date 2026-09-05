const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual shipped evaluator without browser globals or a second implementation.
const source = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const evaluator = source.slice(source.indexOf('    function combos('), source.indexOf('    function handRank('));
const { rank5, cmp, best7, combos } = vm.runInNewContext(evaluator + '\n({rank5, cmp, best7, combos})');
const cards = (text) => text.split(' ').map((c) => ({ r: ({A:14,K:13,Q:12,J:11,T:10})[c[0]] || Number(c[0]), s:c[1] }));

test('all nine hand categories ascend correctly', () => {
  const hands = ['A♠ J♥ 9♦ 5♣ 2♠','A♠ A♥ 9♦ 5♣ 2♠','A♠ A♥ 9♦ 9♣ 2♠','A♠ A♥ A♦ 5♣ 2♠','9♠ 8♥ 7♦ 6♣ 5♠','A♠ J♠ 9♠ 5♠ 2♠','A♠ A♥ A♦ 5♣ 5♠','A♠ A♥ A♦ A♣ 2♠','9♠ 8♠ 7♠ 6♠ 5♠'];
  const ranks = hands.map((h) => rank5(cards(h)));
  ranks.forEach((r,i) => assert.equal(r.cat,i));
  ranks.slice(1).forEach((r,i) => assert.ok(cmp(r,ranks[i]) > 0));
});
test('ace-low straight is lower than six-high', () => {
  const wheel = rank5(cards('A♠ 2♥ 3♦ 4♣ 5♠'));
  assert.equal(wheel.cat,4);
  assert.equal(wheel.tie[0],5);
  assert.ok(cmp(wheel,rank5(cards('2♠ 3♥ 4♦ 5♣ 6♠'))) < 0);
});
test('king ace two cannot wrap', () => assert.equal(rank5(cards('Q♠ K♥ A♦ 2♣ 3♠')).cat,0));
test('suits do not break an otherwise equal hand', () => assert.equal(cmp(rank5(cards('A♠ A♥ K♦ Q♣ 9♠')),rank5(cards('A♦ A♣ K♥ Q♠ 9♥'))),0));
test('pair ties are resolved by all kickers', () => assert.ok(cmp(rank5(cards('A♠ A♥ K♦ Q♣ 9♠')),rank5(cards('A♦ A♣ K♥ Q♠ 8♥'))) > 0));
test('full house compares trips before pair', () => assert.ok(cmp(rank5(cards('3♠ 3♥ 3♦ 2♣ 2♠')),rank5(cards('2♠ 2♥ 2♦ A♣ A♠'))) > 0));
test('seven cards produce 21 candidates and choose the best five', () => {
  const hand=cards('A♠ K♠ Q♠ J♠ T♠ 2♥ 3♦');
  assert.equal(combos(hand,5).length,21);
  assert.equal(best7(hand).name,'ROYAL FLUSH');
});
test('sixth-street module can choose five from eight cards', () => {
  const hand=cards('2♥ 3♦ A♠ K♠ Q♠ J♠ 9♣ T♠');
  assert.equal(combos(hand,5).length,56);
  assert.equal(best7(hand).name,'ROYAL FLUSH');
});
test('explicit rogue rank rewriting supports five of a kind without crashing',()=>{
 const hand=Array.from({length:5},()=>({r:14,s:'♥'}));assert.equal(rank5(hand).name,'FIVE OF A KIND');assert.equal(rank5(hand).cat,9);
});
