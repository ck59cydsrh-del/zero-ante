'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const block = source.slice(
    source.indexOf('    const SNAP = ['),
    source.indexOf('    function draftPayload()'),
);

function snapshot(forId, { phase = 'act', exposed = false } = {}) {
    const seat = (id) => ({
        id, name: 'P' + id, human: true, chips: 100, bet: 0, total: 0, folded: false, allin: false,
        last: 'CHECK', out: false, exposed: id === 1 ? exposed : false, mods: [{ id: 'vault' }],
        fired: {}, used: {}, rank: null, hole: [{ r: 9, s: '♥' }, { r: 4, s: '♣' }],
    });
    const ctx = {
        P: [seat(0), seat(1), seat(2)], N: 3, handNo: 2, level: 0, board: [], street: 'pre', phase,
        actor: 0, dealer: 0, sb: 1, bb: 2, currentBet: 20, minRaise: 20, raiseTo: 40,
        potHold: 0, riverHold: false, lastActionText: '', deck: [{ r: 12, s: '♠' }],
        logs: [{ copy: 'x', kind: 'system' }], performance: { now: () => 0 }, actDeadline: 0,
        draftPayload: () => null,
    };
    // vm の外に出た値は別realmなので、比べる前に素の JSON に均す
    return JSON.parse(JSON.stringify(vm.runInNewContext(block + `;snapshotFor(${forId});`, ctx)));
}

test('a snapshot never carries another seat\'s cards', () => {
    // 相手の手札を送ってしまうと、開発者ツールを開くだけで台無しになる
    const s = snapshot(0);
    assert.deepEqual(s.P[0].hole, [{ r: 9, s: '♥' }, { r: 4, s: '♣' }], 'your own hand comes through');
    assert.deepEqual(s.P[1].hole, [{ h: 1 }, { h: 1 }], 'the other seat is blanked but keeps its count');
    assert.equal(s.P[1].mods[0], 'vault', 'abilities travel as ids');
});

test('the showdown and an exposed hand are the only ways cards travel', () => {
    assert.deepEqual(snapshot(0, { phase: 'showdown' }).P[1].hole[0], { r: 9, s: '♥' });
    assert.deepEqual(snapshot(0, { exposed: true }).P[1].hole[0], { r: 9, s: '♥' });
});

test('the peeked card is the top of the deck, not the deck', () => {
    const s = snapshot(0);
    assert.deepEqual(s.peek, { r: 12, s: '♠' });
    assert.equal(s.deck, undefined, 'the rest of the deck must never leave the host');
});

test('a used manual ability leaves the rack', () => {
    const consume = source.slice(source.indexOf('    function consume(p, m)'), source.indexOf('    function renderScout('));
    const p = { name: 'P0', mods: [{ id: 'tax' }, { id: 'vault' }] };
    // 「制圧」を持たない棚では、撃った札はそのまま無くなる
    vm.runInNewContext(consume + `;consume(p, { id: 'tax', name: 'TAX' });`, { p, pushLog: () => {}, Rogue: { keepsCharge: () => false } });
    assert.deepEqual(p.mods.map((m) => m.id), ['vault']);
});

test('every ability icon is unique, so the rack can be read at a glance', () => {
    const Rogue = require('../rogue.js');
    const icons = Rogue.catalog.map((m) => m.icon);
    assert.equal(new Set(icons).size, icons.length, `duplicate icons: ${icons.filter((v, i) => icons.indexOf(v) !== i)}`);
});
