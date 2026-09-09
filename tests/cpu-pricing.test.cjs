'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the shipped pre-flop evaluator, not a second copy of it.
const source = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const slice = source.slice(source.indexOf('    function preflopStrength('), source.indexOf('    function cpu('));
const preflopStrength = vm.runInNewContext(slice + '\npreflopStrength');
const hand = (text) => ({ hole: text.split(' ').map((c) => ({ r: ({ A: 14, K: 13, Q: 12, J: 11, T: 10 })[c[0]] || Number(c[0]), s: c[1] })) });

test('pre-flop hands score on the same 0-9 scale as a made hand', () => {
    // The old score was max(rank)/14, so nothing pre-flop ever cleared 2 and every CPU
    // folded to any large bet. These bounds are what the shared thresholds rely on.
    assert.ok(preflopStrength(hand('A♠ A♥')) >= 5.9, 'aces should read as a premium hand');
    assert.ok(preflopStrength(hand('2♠ 2♥')) >= 2, 'even the worst pair is worth a cheap call');
    assert.ok(preflopStrength(hand('7♠ 2♥')) < 1.2, 'the worst offsuit hand should stay foldable');
    assert.ok(preflopStrength(hand('A♠ K♠')) > preflopStrength(hand('A♠ K♥')), 'suited beats offsuit');
    assert.ok(preflopStrength(hand('9♠ 8♥')) > preflopStrength(hand('9♠ 3♥')), 'connected beats gapped');
});

test('a pair is read from the best rank, not the first two cards', () => {
    // POCKET EXPANSION deals a third hole card.
    assert.equal(preflopStrength(hand('4♠ 9♥ 9♦')), preflopStrength(hand('9♠ 9♥')));
    assert.ok(preflopStrength(hand('K♠ 5♥ K♦')) > preflopStrength(hand('5♠ 5♥ 2♦')));
});

test('an empty hand scores zero rather than throwing', () => {
    assert.equal(preflopStrength({ hole: [] }), 0);
});
