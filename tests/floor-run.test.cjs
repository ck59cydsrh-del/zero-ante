'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createContext, seeded } = require('./dom-stub.cjs');

const gameSource = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const rogueSource = fs.readFileSync(path.join(__dirname, '..', 'rogue.js'), 'utf8');

const MODALS = ['#relic', '#result', '#round-result', '#pass', '#target-picker', '#backroom'];
const shown = ($, sel) => !$(sel).classList.contains('hidden');

// Plays one whole run headlessly. `style` decides how the player acts each turn.
function playRun(seed, style, stopAfterClears = Infinity, mode = 'solo', shopping = 'skip', rounds = 6) {
    const ctx = createContext({ random: seeded(seed) });
    vm.createContext(ctx.sandbox);
    vm.runInContext(rogueSource, ctx.sandbox);
    vm.runInContext(gameSource, ctx.sandbox);
    const $ = ctx.$;
    MODALS.forEach((sel) => $(sel).classList.add('hidden'));
    $('#mode').value = mode;
    $('#count').value = '2';
    $('#rounds').value = String(rounds);

    // Every line the game logs, deduplicated — the log element only keeps the last twelve.
    const logLines = new Set();
    Object.defineProperty($('#action-log'), 'innerHTML', {
        configurable: true,
        get: () => '',
        set: (v) => String(v).split('</span>').forEach((line) => line && logLines.add(line)),
    });

    const trace = [];
    const visits = new Map();
    // 画面の出た順を控える。ショウダウンより先に勝ちの告知が出ていないか見る。
    const fxOrder = [];
    const fxEl = $('#event-fx');
    // 卓の上で捲るようになったので、目印は body の data-showdown。
    const body = ctx.sandbox.document.body;
    body.dataset = new Proxy({}, {
        set: (t, k, v) => { t[k] = v; if (k === 'showdown') fxOrder.push('showdown'); return true; },
        deleteProperty: (t, k) => { delete t[k]; return true; },
    });
    const watch = (el, label, test) => {
        const add = el.classList.add, remove = el.classList.remove;
        el.classList.add = (...c) => { add(...c); if (test(el)) fxOrder.push(label); };
        el.classList.remove = (...c) => { remove(...c); if (test(el)) fxOrder.push(label); };
    };
    watch(fxEl, 'win', (el) => el.classList.contains('win') || el.classList.contains('defeat'));
    watch($('#round-result'), 'result', (el) => !el.classList.contains('hidden'));
    const drive = () => {
        if (shown($, '#result')) return false;
        if (shown($, '#backroom')) {
            const visit = $('#backroom-eyebrow').textContent;
            trace.push({
                kind: 'shop',
                visit,
                stack: Number($('#backroom-stack').textContent.replace(/[^\d]/g, '')),
                cards: $('#backroom-cards').innerHTML,
                owned: $('#backroom-owned').innerHTML,
                slots: $('#backroom-slots').innerHTML,
                reroll: $('#backroom-reroll').textContent,
                rerollOff: $('#backroom-reroll').disabled,
                scrap: Number($('#scrap-held').textContent),
            });
            const state = visits.get(visit) || { bought: 0, sold: 0 };
            visits.set(visit, state);
            const affordable = () => $('#backroom-cards').querySelectorAll('button').filter((b) => !b.disabled)[0];
            // A full rack asks which module to drop before the purchase completes.
            if ($('#backroom-owned').innerHTML.includes('data-cancel')) {
                const drop = $('#backroom-owned').querySelectorAll('button').filter((b) => !b.dataset.cancel)[0];
                if (drop) { drop.onclick(); return true; }
                $('#backroom-owned').querySelectorAll('button')[0]?.onclick();
                return true;
            }
            if (trace.filter((t) => t.kind === 'shop').length >= stopAfterClears * 3) return false;
            if (shopping === 'buy') {
                const buy = affordable();
                if (buy) { buy.onclick(); return true; }
            }
            if (shopping === 'reroll' && !$('#backroom-reroll').disabled) { $('#backroom-reroll').onclick(); return true; }
            if (shopping === 'sell') {
                if (!state.bought) { const buy = affordable(); if (buy) { state.bought++; buy.onclick(); return true; } }
                else if (!state.sold) {
                    const owned = $('#backroom-owned').querySelectorAll('button')[0];
                    if (owned) { state.sold++; owned.onclick(); return true; }
                }
            }
            $('#leave-backroom').onclick();
            return true;
        }
        if (shown($, '#round-result')) {
            trace.push({ kind: 'round', summary: $('#round-summary').textContent, title: $('#round-title').textContent });
            $('#to-rewards').onclick();
            return true;
        }
        if (shown($, '#relic')) {
            // 満杯のラックは「外す1枚」を先に聞いてくる。
            if ($('#relic-owned').innerHTML.includes('data-drop')) {
                const drop = $('#relic-owned').querySelectorAll('button').filter((b) => b.dataset.drop)[0];
                if (drop) { drop.onclick(); return true; }
            }
            const pick = $('#relic-cards').querySelectorAll('button').filter((b) => !b.disabled)[0];
            if (pick) pick.onclick();
            return true;
        }
        if (shown($, '#pass')) { $('#reveal').onclick(); return true; }
        if (!$('#fold').disabled) {
            trace.push({
                kind: 'act',
                msg: $('#turn-banner').textContent,
                cash: $('#cashline').textContent,
                floor: $('#level').textContent,
                seats: $('#seats').innerHTML,
                status: $('#viewer-status').innerHTML,
            });
            const button = style === 'fold' ? '#fold' : $('#allin').disabled ? '#checkcall' : '#allin';
            $(button).onclick();
            return true;
        }
        return true;
    };

    $('#start').onclick();
    // 実ページと同じく、最初の描画が来るまで操作は伏せておく（開始ドラフトを挟むため）。
    $('#fold').disabled = true;
    let guard = 0;
    while (guard++ < 400000) {
        if (!drive()) break;
        if (!ctx.step()) break;
    }
    assert.ok(guard < 400000, `seed ${seed} never terminated`);
    return {
        trace,
        fxOrder,
        logLines: [...logLines],
        rounds: trace.filter((t) => t.kind === 'round'),
        hands: Number(($('#level').textContent.split('/')[0] || '0').trim()),
        shops: trace.filter((t) => t.kind === 'shop'),
        stopped: !shown($, '#result'),
        ended: shown($, '#result'),
        eyebrow: $('#result-eyebrow').textContent,
        winner: $('#winner').textContent,
        copy: $('#result-copy').textContent,
        clears: trace.filter((t) => t.kind === 'shop'),
        standings: [...$('#standings').innerHTML.matchAll(/<strong>([\d,]+)<\/strong>/g)].map((m) => Number(m[1].replace(/,/g, ''))),
    };
}

test('every run ends on a stated reason, never mid-table', () => {
    for (const [seed, style] of [[1, 'push'], [2, 'push'], [3, 'fold'], [4, 'fold'], [5, 'fold'], [6, 'fold']]) {
        const run = playRun(seed, style);
        assert.ok(run.ended, `seed ${seed} left the run without a result screen`);
        assert.match(run.copy, /\d+回戦 \/ 最終チップ/);
        // 畳み方は3つだけ。飛ぶ / 飛ばしきる / 6回戦を終えて最多チップ。
        assert.ok(
            /チップが尽きました|卓の全員を飛ばしました|最多チップでした|回戦を勝ち抜きました/.test(run.copy),
            `seed ${seed} ended without a stated reason: ${run.copy}`,
        );
    }
});

test('local play keeps the legacy tournament, with no floor layer', () => {
    // Heads-up folding is a stalemate by design, so the local check pushes to a decision.
    const run = playRun(3, 'push', Infinity, 'local');
    assert.ok(run.ended, 'a local tournament still reaches its result screen');
    assert.match(run.winner, /の勝ち$/);
    assert.equal(run.clears.length, 0);
    const first = run.trace.find((t) => t.kind === 'act');
    assert.match(first.floor, /^01 \/ \d+$/);
    assert.match(first.msg, /手札で勝負|場札|配布中/);
});

// A full run is expensive, so the shove-strategy checks share one set of them.
const shoveRuns = [];
const shoves = () => {
    if (!shoveRuns.length) for (let seed = 1; seed <= 24; seed++) shoveRuns.push(playRun(seed, 'push'));
    return shoveRuns;
};

test('LIFE PATCH stays once per run across floor changes', () => {
    let fired = 0;
    for (let seed = 1; seed <= 120; seed++) {
        // BLOCKED の通知は発動ではない
        const mine = playRun(seed, 'call', Infinity, 'solo', 'buy').logLines
            .filter((line) => /あなた → あなた \/ ピンチで1000枚/.test(line) && !/BLOCKED/.test(line));
        assert.ok(mine.length <= 1, `seed ${seed} fired LIFE PATCH ${mine.length} times in one run:\n${mine.map((l) => l.replace(/<[^>]*>/g, '')).join('\n')}`);
        fired += mine.length;
    }
    assert.ok(fired > 0, 'no seed ever triggered LIFE PATCH, so the once-per-run rule went unchecked');
});

test('an all-in is not free money — opponents do call it', () => {
    let showdowns = 0, hands = 0;
    for (const run of shoves()) {
        for (const round of run.rounds) {
            hands++;
            if (!/全員FOLD/.test(round.summary)) showdowns++;
        }
    }
    assert.ok(hands > 40, `not enough hands played to judge (${hands})`);
    // Before the pricing fix a pre-flop shove was folded to every single time.
    assert.ok(showdowns / hands > 0.15, `only ${showdowns} of ${hands} shoved hands were contested`);
});

test('every hand hands a module to everyone who played it', () => {
    let checked = 0;
    for (let seed = 1; seed <= 8; seed++) {
        const run = playRun(seed, 'call', Infinity, 'solo', 'buy');
        const installs = run.logLines.filter((l) => /を装着/.test(l));
        if (!run.rounds.length) continue;
        checked++;
        // 開始ドラフト1枚 + 各ハンド分。CPUの分も同じログに出る。
        assert.ok(installs.length >= run.rounds.length, `seed ${seed} drafted ${installs.length} times over ${run.rounds.length} hands`);
        assert.ok(run.logLines.some((l) => /あなたが「.+」を装着/.test(l)), 'the player must be drafting too');
        for (const shop of run.shops) assert.ok(/BACK ROOM \/ 第\d+回戦のあと/.test(shop.visit));
    }
    assert.ok(checked > 0, 'no seed played a hand');
    const legacy = playRun(3, 'push', Infinity, 'local');
    assert.ok(legacy.logLines.some((l) => /を装着/.test(l)), 'local play should still draft modules');
});

test('walking past the shop never spends a chip', () => {
    let visits = 0;
    for (let seed = 1; seed <= 12; seed++) {
        const run = playRun(seed, 'call');
        visits += run.shops.length;
        assert.ok(!run.logLines.some((l) => /BACK ROOM \/ .+ を [\d,]+枚で購入/.test(l)), 'skipping must not buy');
        assert.ok(!run.logLines.some((l) => /BACK ROOM \/ REROLL/.test(l)), 'skipping must not reroll');
    }
    assert.ok(visits > 0, 'no seed reached a shop');
});

test('a purchase comes straight out of the stack, and shows up as owned', () => {
    let purchases = 0;
    for (let seed = 1; seed <= 12; seed++) {
        const run = playRun(seed, 'call', Infinity, 'solo', 'buy');
        for (let i = 1; i < run.shops.length; i++) {
            const before = run.shops[i - 1], after = run.shops[i];
            if (before.visit !== after.visit) continue;
            // A step can also be the swap prompt, which spends nothing yet.
            assert.ok(after.stack <= before.stack, 'the shop must never hand chips back while buying');
            if (after.stack === before.stack) continue;
            purchases++;
            assert.ok(before.stack - after.stack <= 3800, 'no module costs more than the legendary price');
            assert.match(after.owned, /半額が戻ります|外す能力を選んでください/);
        }
    }
    assert.ok(purchases > 0, 'no seed ever completed a purchase');
});

test('selling returns half of the list price', () => {
    let sales = 0;
    for (let seed = 1; seed <= 12; seed++) {
        for (const line of playRun(seed, 'call', Infinity, 'solo', 'sell').logLines) {
            const m = /BACK ROOM \/ .+ を売却 \+(\d+)枚/.exec(line);
            if (!m) continue;
            sales++;
            assert.ok([350, 750, 1400].includes(+m[1]), `unexpected refund ${m[1]}`);
        }
    }
    assert.ok(sales > 0, 'no seed ever sold a module');
});

test('rerolls escalate and stop after three', () => {
    let seenCap = false;
    for (let seed = 1; seed <= 12; seed++) {
        const run = playRun(seed, 'call', Infinity, 'solo', 'reroll');
        const byVisit = new Map();
        for (const shop of run.shops) {
            const list = byVisit.get(shop.visit) || [];
            list.push(shop.reroll);
            byVisit.set(shop.visit, list);
        }
        for (const labels of byVisit.values()) {
            const costs = labels.map((l) => /(\d+)枚/.exec(l)).map((m) => (m ? +m[1] : null));
            const paid = costs.filter((c) => c !== null);
            assert.deepEqual(paid, [400, 800, 1600].slice(0, paid.length), 'reroll prices must escalate 400 / 800 / 1600');
            if (labels.some((l) => /上限/.test(l))) seenCap = true;
            assert.ok(labels.length <= 4, 'a visit offered more than three rerolls');
        }
    }
    assert.ok(seenCap, 'no visit ever reached the reroll cap');
});

test('SCRAP is what a lost hand pays, and the shop counts it', () => {
    let paid = 0, carried = 0;
    for (let seed = 1; seed <= 24; seed++) {
        const run = playRun(seed, 'call');
        let earned = 0;
        for (const round of run.rounds) {
            const m = /SCRAP \+(\d)/.exec(round.summary);
            if (!m) continue;
            paid++;
            assert.ok([1, 2].includes(+m[1]), 'a lost hand pays 1 for a fold, 2 for a showdown');
            earned += +m[1];
        }
        for (const shop of run.shops) {
            carried += shop.scrap;
            // The bare-pass bonus adds 3 on top, so the shop can only hold more, never less.
            assert.ok(shop.scrap >= 0 && shop.scrap <= earned + 3 * (run.clears.length || 1), 'scrap total is out of range');
        }
    }
    assert.ok(paid > 0, 'no lost hand ever paid scrap');
    assert.ok(carried > 0, 'no run ever carried scrap into a shop');
});

test('the rack never exceeds its slot cap', () => {
    let seen = 0;
    for (let seed = 1; seed <= 20; seed++) {
        for (const shop of playRun(seed, 'push', Infinity, 'solo', 'buy').shops) {
            const m = /(\d+) \/ (\d+) SLOTS/.exec(shop.slots);
            assert.ok(m, 'the shop states how many slots are in use');
            const [, held, cap] = m.map(Number);
            seen++;
            assert.ok([5, 6, 7].includes(cap), `unexpected slot cap ${cap}`);
            assert.ok(held <= cap, `${held} modules in ${cap} slots`);
        }
    }
    assert.ok(seen > 0, 'no shop was ever inspected');
});

test('information and defensive modules stay capped', () => {
    for (let seed = 1; seed <= 20; seed++) {
        for (const shop of playRun(seed, 'push', Infinity, 'solo', 'buy').shops) {
            // ヒントは5種しかないので、系統シナジーの3段目に届くよう上限を3に。
            // 守りは受け身の札なので、寄せても盤面を支配しない。上限4。
            const info = /ヒント (\d+)\/3/.exec(shop.slots);
            const guard = /守り (\d+)\/4/.exec(shop.slots);
            assert.ok(info && guard, 'the shop states both category caps');
            assert.ok(+info[1] <= 3, `${info[1]} information modules held`);
            assert.ok(+guard[1] <= 4, `${guard[1]} defensive modules held`);
        }
    }
});

test('a full rack drops a module rather than selling it', () => {
    let swaps = 0;
    for (let seed = 1; seed <= 30; seed++) {
        const run = playRun(seed, 'push', Infinity, 'solo', 'buy');
        swaps += run.logLines.filter((l) => /を外した/.test(l)).length;
        // The discard is not a sale, so it must never appear as a refund.
        for (const line of run.logLines) assert.ok(!/を外した.*\+\d+枚/.test(line), 'a discard must not refund');
    }
    assert.ok(swaps > 0, 'no run ever filled its rack, so the swap path went unchecked');
});

test('a reroll cancels a pending swap instead of pointing at a gone offer', () => {
    // Buying with a full rack parks a pending swap on an offer index. Rerolling replaces
    // the offers, so the index has to be released or the shop renders a missing module.
    const source = gameSource.slice(gameSource.indexOf('    function rerollShop('), gameSource.indexOf('\n    }', gameSource.indexOf('    function rerollShop(')));
    assert.match(source, /run\.replacing = null/, 'rerollShop must clear a pending swap');
    const render = gameSource.slice(gameSource.indexOf('    function renderBackroom('), gameSource.indexOf('\n    }', gameSource.indexOf('    function renderBackroom(')));
    assert.match(render, /!run\.offers\[run\.replacing\]/, 'renderBackroom must fold an out-of-range swap');
});

test('a showdown turns the hands over before the pot is announced', () => {
    // 全員降りた局に捲る手札は無いので、局ごとに区切って見る。
    let checked = 0;
    for (let seed = 1; seed <= 10; seed++) {
        const order = playRun(seed, 'call').fxOrder;
        const hands = [];
        let current = [];
        for (const step of order) {
            if (step === 'result') { hands.push(current); current = []; }
            else current.push(step);
        }
        hands.push(current);
        for (const hand of hands) {
            const sd = hand.indexOf('showdown');
            if (sd < 0) continue;
            checked++;
            const win = hand.indexOf('win');
            assert.ok(win < 0 || sd < win, `seed ${seed} announced the winner before turning the hands over`);
        }
    }
    assert.ok(checked > 0, 'no seed reached a showdown');
});

test('a run stops on the round count the table was set to', () => {
    // 長さを選べるようにした以上、選んだ数を必ず守る（超えても、勝手に短くしてもいけない）
    for (const rounds of [3, 6, 9, 12]) {
        for (let seed = 1; seed <= 4; seed++) {
            const run = playRun(seed, 'call', Infinity, 'solo', 'skip', rounds);
            assert.ok(run.ended, `${rounds}回戦 seed ${seed} never reached a result`);
            assert.ok(run.hands <= rounds, `${rounds}回戦 seed ${seed} played ${run.hands} hands`);
            assert.match(run.copy, new RegExp(`\\d+回戦 / 最終チップ`));
        }
    }
});

test('the final board ranks every seat by chips, winner first', () => {
    const chips = playRun(2, 'call', Infinity, 'solo', 'skip', 3).standings;
    assert.ok(chips.length >= 2, 'the standings list is filled in');
    assert.deepEqual(chips, [...chips].sort((a, b) => b - a), 'seats must be listed richest first');
});
