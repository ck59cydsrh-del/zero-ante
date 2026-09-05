(() => {
    const $ = (s) => document.querySelector(s),
        SUITS = ["♠", "♥", "♦", "♣"],
        RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        RN = {
            11: "J",
            12: "Q",
            13: "K",
            14: "A"
        },
        LEVELS = [
            [10, 20],
            [15, 30],
            [25, 50],
            [40, 80],
            [60, 120],
            [100, 200],
            [150, 300],
        ];
    let mode = "solo",
        N = 6,
        P = [],
        deck = [],
        board = [],
        dealer = -1,
        sb = 0,
        bb = 0,
        actor = 0,
        street = "idle",
        pending = new Set(),
        currentBet = 0,
        minRaise = 20,
        raiseTo = 40,
        handNo = 0,
        level = 0,
        phase = "setup",
        offers = [],
        deadline = 0,
        mainWinner = null,
        lastHoleKey = null,
        lastBoardKey = null,
        logs = [],
        fxQueue = [],
        fxBusy = false,
        actionPopTimer = 0,
        actionHideTimer = 0;

    function setTheme(value, remember = true) {
        const theme = value === "dark" ? "dark" : "light";
        document.body.dataset.theme = theme;
        document.querySelectorAll('input[name="theme"]').forEach((input) => {
            input.checked = input.value === theme;
        });
        const toggle = $("#theme-toggle");
        if (toggle) {
            toggle.querySelector("span").textContent = theme === "dark" ? "BLACK" : "WHITE";
            toggle.setAttribute("aria-pressed", String(theme === "dark"));
        }
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = theme === "dark" ? "#0b0c0f" : "#f6f5f0";
        if (remember) {
            try { localStorage.setItem("zero-ante-theme", theme); } catch (_) {}
        }
    }

    try { setTheme(localStorage.getItem("zero-ante-theme") || "light", false); }
    catch (_) { setTheme("light", false); }
    const mods = [{
            id: "odds",
            icon: "%POT",
            name: "POT CALC",
            desc: "コール額とポットから必要勝率を表示。",
            cat: "info",
        },
        {
            id: "scan",
            icon: "5/7",
            name: "HAND SCAN",
            desc: "現在できている最強の役を常時表示。",
            cat: "info",
        },
        {
            id: "tell",
            icon: "CPU?",
            name: "TELL TAP",
            desc: "CPUのアクション強度を解析表示。",
            cat: "info",
        },
        {
            id: "scramble",
            icon: "RIP",
            name: "CARD SCRAMBLE",
            desc: "各ハンド開始時、次のCPUの高い方のカードを強制交換。",
            cat: "attack",
        },
        {
            id: "silence",
            icon: "NO↑",
            name: "RAISE JAMMER",
            desc: "次のCPUはプリフロップでレイズ不能。",
            cat: "attack",
        },
        {
            id: "rebuy",
            icon: "+100",
            name: "LIFE PATCH",
            desc: "200チップ未満になった時、一度だけ100チップ回復。",
            cat: "guard",
        },
        {
            id: "insurance",
            icon: "1BB",
            name: "FOLD SHIELD",
            desc: "各ハンド最初のフォールド時、1BBを回収。",
            cat: "guard",
        },
        {
            id: "redline",
            icon: "RED+",
            name: "RED OVERCLOCK",
            desc: "ショーダウンで♥・♦の数字を1つ上として判定。",
            cat: "chaos",
        },
        {
            id: "sixboard",
            icon: "BOARD6",
            name: "SIXTH STREET",
            desc: "リバーにコミュニティカードを2枚公開。最強の5枚を選ぶ。",
            cat: "chaos",
        },
    ];
    const CAT = {
        info: "INFO / 情報",
        attack: "ATTACK / 妨害",
        guard: "GUARD / 防御",
        chaos: "CHAOS / 改変",
    };
    const active = () => P.filter((p) => p.chips > 0),
        live = () => P.filter((p) => !p.folded),
        next = (i, filter = (p) => p.chips > 0) => {
            for (let k = 1; k <= P.length; k++) {
                let j = (i + k) % P.length;
                if (filter(P[j])) return j;
            }
            return i;
        },
        makeDeck = () => SUITS.flatMap((s) => RANKS.map((r) => ({
            s,
            r
        })));

    function shuffle(a) {
        for (let i = a.length - 1; i; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function combos(a, k) {
        let o = [];

        function g(i, p) {
            if (p.length === k) {
                o.push(p);
                return;
            }
            for (let j = i; j <= a.length - k + p.length; j++) g(j + 1, [...p, a[j]]);
        }
        g(0, []);
        return o;
    }

    function rank5(c) {
        let rs = c.map((x) => x.r).sort((a, b) => b - a),
            ct = {};
        rs.forEach((r) => (ct[r] = (ct[r] || 0) + 1));
        let g = Object.entries(ct)
            .map(([r, n]) => ({
                r: +r,
                n
            }))
            .sort((a, b) => b.n - a.n || b.r - a.r),
            fl = c.every((x) => x.s === c[0].s),
            u = [...new Set(rs)];
        if (u[0] === 14) u.push(1);
        let st = 0;
        for (let i = 0; i <= u.length - 5; i++)
            if (u[i] - u[i + 4] === 4) st = Math.max(st, u[i]);
        let cat = 0,
            name = "HIGH CARD",
            tie = rs;
        if (g[0].n === 2) {
            cat = 1;
            name = "ONE PAIR";
            tie = [g[0].r, ...g.filter((x) => x.n === 1).map((x) => x.r)];
        }
        if (g[0].n === 2 && g[1]?.n === 2) {
            cat = 2;
            name = "TWO PAIR";
            tie = [
                Math.max(g[0].r, g[1].r),
                Math.min(g[0].r, g[1].r),
                g.find((x) => x.n === 1).r,
            ];
        }
        if (g[0].n === 3) {
            cat = 3;
            name = "THREE";
            tie = [g[0].r, ...g.filter((x) => x.n === 1).map((x) => x.r)];
        }
        if (st) {
            cat = 4;
            name = "STRAIGHT";
            tie = [st];
        }
        if (fl) {
            cat = 5;
            name = "FLUSH";
            tie = rs;
        }
        if (g[0].n === 3 && g[1]?.n === 2) {
            cat = 6;
            name = "FULL HOUSE";
            tie = [g[0].r, g[1].r];
        }
        if (g[0].n === 4) {
            cat = 7;
            name = "FOUR";
            tie = [g[0].r, g.find((x) => x.n === 1).r];
        }
        if (st && fl) {
            cat = 8;
            name = st === 14 ? "ROYAL FLUSH" : "STRAIGHT FLUSH";
            tie = [st];
        }
        return {
            cat,
            tie,
            name
        };
    }

    function cmp(a, b) {
        if (a.cat !== b.cat) return a.cat - b.cat;
        for (let i = 0; i < Math.max(a.tie.length, b.tie.length); i++)
            if ((a.tie[i] || 0) !== (b.tie[i] || 0))
                return (a.tie[i] || 0) - (b.tie[i] || 0);
        return 0;
    }

    function best7(cards) {
        return combos(cards, 5)
            .map((c) => rank5(c))
            .sort(cmp)
            .at(-1);
    }

    function handRank(p) {
        let cards = [...p.hole, ...board];
        if (p.mods.some((m) => m.id === "redline")) {
            cards = cards.map((c) =>
                c.s === "♥" || c.s === "♦" ? { ...c, r: Math.min(14, c.r + 1) } : c,
            );
        }
        return best7(cards);
    }

    function pushLog(copy, kind = "system") {
        logs.unshift({ copy, kind });
        logs = logs.slice(0, 6);
        const el = $("#action-log");
        if (el) el.innerHTML = logs.map((x) => `<span class="${x.kind}">${x.copy}</span>`).join("");
    }

    function announce(type, title, copy, kind = "system", duration = 1450) {
        fxQueue.push({ type, title, copy, kind, duration });
        if (!fxBusy) playNextFx();
    }

    function playNextFx() {
        const item = fxQueue.shift();
        if (!item) {
            fxBusy = false;
            return;
        }
        fxBusy = true;
        const el = $("#event-fx");
        el.className = `event-fx ${item.kind}`;
        $("#event-type").textContent = item.type;
        $("#event-title").textContent = item.title;
        $("#event-copy").textContent = item.copy;
        setTimeout(() => {
            el.classList.add("out");
            setTimeout(() => {
                el.className = "event-fx hidden";
                fxBusy = false;
                playNextFx();
            }, 220);
        }, item.duration);
    }

    function flashAction(title, player, kind = "action") {
        const el = $("#action-pop");
        clearTimeout(actionPopTimer);
        clearTimeout(actionHideTimer);
        $("#action-player").textContent = player;
        $("#action-name").textContent = title;
        el.className = `action-pop ${kind}`;
        requestAnimationFrame(() => el.classList.add("show"));
        actionPopTimer = setTimeout(() => {
            el.classList.remove("show");
            actionHideTimer = setTimeout(() => el.classList.add("hidden"), 320);
        }, 1200);
    }

    function init() {
        setTheme(document.querySelector('input[name="theme"]:checked')?.value || "light");
        mode = $("#mode").value;
        N = +$("#count").value;
        document.body.dataset.players = String(N);
        P = Array.from({
            length: N
        }, (_, i) => ({
            id: i,
            name: `PLAYER_${String(i + 1).padStart(2, "0")}`,
            human: mode === "local" || i === 0,
            chips: 1000,
            bet: 0,
            total: 0,
            folded: false,
            allin: false,
            hole: [],
            mods: [],
            last: "READY",
            silenced: false,
            shieldUsed: false,
            rebuyUsed: false,
        }));
        $("#setup").classList.add("hidden");
        handNo = 0;
        dealer = -1;
        logs = [];
        pushLog("TOURNAMENT START", "system");
        announce("SYSTEM", "TABLE OPEN", `${N}人テーブル / 能力ドラフト有効`, "system", 1700);
        newHand();
    }

    function pay(p, n) {
        let x = Math.min(p.chips, n);
        p.chips -= x;
        p.bet += x;
        p.total += x;
        if (!p.chips) p.allin = true;
        return x;
    }

    function payAnte(p, n) {
        let x = Math.min(p.chips, n);
        p.chips -= x;
        p.total += x;
        if (!p.chips) p.allin = true;
        return x;
    }

    function applyOpeningModules() {
        P.forEach((owner) => {
            if (owner.folded) return;
            if (owner.mods.some((m) => m.id === "rebuy") && owner.chips < 200 && !owner.rebuyUsed) {
                owner.chips += 100;
                owner.rebuyUsed = true;
                pushLog(`${owner.name} LIFE PATCH +100`, "guard");
                announce("GUARD TRIGGER", "LIFE PATCH", `${owner.name}が100チップ回復`, "guard");
            }
            const target = P.find((p) => !p.folded && !p.human && p.id !== owner.id);
            if (target && owner.mods.some((m) => m.id === "scramble")) {
                const hi = target.hole[0].r >= target.hole[1].r ? 0 : 1;
                target.hole[hi] = deck.pop();
                pushLog(`${owner.name} → ${target.name} CARD SCRAMBLE`, "attack");
                announce("ATTACK TRIGGER", "CARD SCRAMBLE", `${target.name}の高いカードを強制交換`, "attack");
            }
            if (target && owner.mods.some((m) => m.id === "silence")) {
                target.silenced = true;
                pushLog(`${target.name} RAISE LOCKED`, "attack");
                announce("JAMMING", "RAISE LOCK", `${target.name}はプリフロップでレイズ不能`, "attack");
            }
        });
    }

    function newHand() {
        if (active().length === 1) {
            finish(active()[0]);
            return;
        }
        handNo++;
        lastHoleKey = null;
        lastBoardKey = null;
        level = Math.min(LEVELS.length - 1, Math.floor((handNo - 1) / 3));
        let [S, B] = LEVELS[level];
        dealer = next(dealer);
        sb = active().length === 2 ? dealer : next(dealer);
        bb = next(sb);
        deck = shuffle(makeDeck());
        board = [];
        P.forEach((p) => {
            p.bet = p.total = 0;
            p.folded = p.chips <= 0;
            p.allin = false;
            p.silenced = false;
            p.shieldUsed = false;
            p.hole = p.folded ? [] : [deck.pop(), deck.pop()];
            p.last = p.folded ? "OUT" : "IN";
        });
        if (active().length >= 3) payAnte(P[bb], B);
        pay(P[sb], S);
        pay(P[bb], B);
        applyOpeningModules();
        street = "pre";
        currentBet = P[bb].bet;
        minRaise = B;
        raiseTo = currentBet + minRaise;
        pending = new Set(
            live()
            .filter((p) => !p.allin)
            .map((p) => p.id),
        );
        actor = next(bb, (p) => pending.has(p.id));
        phase = "act";
        pushLog(`HAND ${handNo} / PRE-FLOP`, "street");
        announce(`HAND ${String(handNo).padStart(2, "0")}`, "PRE-FLOP", "ホールカード2枚を配布", "street", 1500);
        showActor(true);
        render();
    }

    function showActor(first = false) {
        if (fxBusy || fxQueue.length) {
            phase = "transition";
            render();
            setTimeout(() => showActor(first), 120);
            return;
        }
        if (!pending.size) {
            advance();
            return;
        }
        let p = P[actor];
        if (!p.human) {
            phase = "cpu";
            render();
            setTimeout(cpu, 900);
            return;
        }
        if (mode === "local") {
            phase = "pass";
            $("#pass-title").textContent = `PASS TO ${p.name}`;
            $("#pass").classList.remove("hidden");
            render();
        } else {
            phase = "act";
            render();
        }
    }

    function act(type) {
        if (phase !== "act" && phase !== "cpu") return;
        let p = P[actor],
            due = Math.max(0, currentBet - p.bet);
        if (type === "fold") {
            p.folded = true;
            p.last = "FOLD";
            if (p.mods.some((m) => m.id === "insurance") && !p.shieldUsed) {
                const refund = Math.min(LEVELS[level][1], p.total);
                p.chips += refund;
                p.total -= refund;
                p.bet = Math.max(0, p.bet - refund);
                p.shieldUsed = true;
                pushLog(`${p.name} FOLD SHIELD +${refund}`, "guard");
                announce("GUARD TRIGGER", "FOLD SHIELD", `${refund}チップを緊急回収`, "guard");
            }
        } else if (type === "check" || type === "call") {
            pay(p, due);
            p.last = due ? "CALL" : "CHECK";
        } else if (type === "allin") {
            let old = currentBet;
            pay(p, p.chips);
            p.last = "ALL-IN";
            if (p.bet > old) {
                minRaise = Math.max(minRaise, p.bet - old);
                currentBet = p.bet;
                pending = new Set(
                    live()
                    .filter((x) => !x.allin && x.id !== p.id)
                    .map((x) => x.id),
                );
            }
        } else if (type === "raise") {
            let target = Math.min(
                    p.bet + p.chips,
                    Math.max(raiseTo, currentBet + minRaise),
                ),
                old = currentBet;
            pay(p, target - p.bet);
            currentBet = p.bet;
            minRaise = Math.max(minRaise, currentBet - old);
            p.last = `RAISE ${currentBet}`;
            pending = new Set(
                live()
                .filter((x) => !x.allin && x.id !== p.id)
                .map((x) => x.id),
            );
        }
        pending.delete(p.id);
        const kind = type === "raise" || type === "allin" ? "attack" : "action";
        pushLog(`${p.name} / ${p.last}`, kind);
        flashAction(p.last, p.name, kind);
        phase = "transition";
        render();
        setTimeout(() => {
            if (live().length === 1) {
                awardUncontested(live()[0]);
                return;
            }
            if (!pending.size) {
                advance();
                return;
            }
            actor = next(actor, (x) => pending.has(x.id));
            raiseTo = currentBet + minRaise;
            showActor();
        }, 720);
    }

    function advance() {
        if (street === "river") {
            phase = "transition";
            render();
            announce("BETTING CLOSED", "SHOWDOWN", "全員のホールカードを公開", "street", 1200);
            setTimeout(showdown, 1050);
            return;
        }
        P.forEach((p) => (p.bet = 0));
        currentBet = 0;
        minRaise = LEVELS[level][1];
        if (street === "pre") {
            deck.pop();
            board.push(deck.pop(), deck.pop(), deck.pop());
            street = "flop";
        } else if (street === "flop") {
            deck.pop();
            board.push(deck.pop());
            street = "turn";
        } else if (street === "turn") {
            deck.pop();
            board.push(deck.pop());
            if (live().some((p) => p.mods.some((m) => m.id === "sixboard"))) {
                board.push(deck.pop());
                pushLog("SIXTH STREET / BOARD +1", "chaos");
                announce("RULE OVERRIDE", "SIXTH STREET", "リバーを2枚公開。8枚から最強の5枚を選択", "chaos", 1800);
            }
            street = "river";
        }
        pending = new Set(
            live()
            .filter((p) => !p.allin)
            .map((p) => p.id),
        );
        if (live().filter((p) => !p.allin).length <= 1) {
            const targetBoard = live().some((p) => p.mods.some((m) => m.id === "sixboard")) ? 6 : 5;
            while (board.length < targetBoard) {
                deck.pop();
                board.push(deck.pop());
            }
            phase = "transition";
            render();
            announce("ALL-IN RUNOUT", "NO MORE BETS", "残りのカードを自動公開", "attack", 1500);
            setTimeout(showdown, 1300);
            return;
        }
        actor = next(dealer, (p) => pending.has(p.id));
        raiseTo = minRaise;
        phase = "transition";
        render();
        pushLog(`${street.toUpperCase()} OPEN`, "street");
        announce("STREET OPEN", street.toUpperCase(), `${board.length}枚のコミュニティカードを公開中`, "street", 1350);
        setTimeout(() => showActor(true), 1150);
    }

    function cpu() {
        let p = P[actor],
            due = Math.max(0, currentBet - p.bet),
            strength =
            board.length >= 3 ?
            handRank(p).cat :
            Math.max(...p.hole.map((c) => c.r)) / 14,
            roll = Math.random();
        p.tell = strength > 4 ? "STRONG" : strength > 1 ? "MIXED" : "WEAK";
        if (due > p.chips * 0.45 && strength < 2) act("fold");
        else if (!p.silenced && strength >= 4 && roll > 0.45) {
            raiseTo = currentBet + minRaise * (1 + Math.floor(Math.random() * 3));
            act("raise");
        } else act(due ? "call" : "check");
    }

    function pot() {
        return P.reduce((n, p) => n + p.total, 0);
    }

    function showdown() {
        street = "showdown";
        phase = "showdown";
        const awardedPot = pot();
        let eligible = live();
        eligible.forEach((p) => (p.rank = handRank(p)));
        let levels = [...new Set(P.map((p) => p.total).filter(Boolean))].sort(
                (a, b) => a - b,
            ),
            prev = 0,
            main = [];
        levels.forEach((lv, idx) => {
            let amount = (lv - prev) * P.filter((p) => p.total >= lv).length,
                can = eligible.filter((p) => p.total >= lv),
                best = can
                .map((p) => p.rank)
                .sort(cmp)
                .at(-1),
                wins = can.filter((p) => cmp(p.rank, best) === 0),
                share = Math.floor(amount / wins.length);
            wins.forEach((w) => (w.chips += share));
            for (let r = 0; r < amount - share * wins.length; r++)
                wins[r % wins.length].chips++;
            if (!idx) main = wins;
            prev = lv;
        });
        mainWinner = main[0];
        P.forEach((p) => (p.last = p.folded ? "FOLD" : p.rank.name));
        P.forEach((p) => {
            p.total = 0;
            p.bet = 0;
        });
        render(true);
        const names = main.map((p) => p.name).join(" + ");
        pushLog(`${names} WIN / ${main[0].rank.name}`, "win");
        announce("POT AWARDED", main[0].rank.name, `${names} +${awardedPot}`, "win", 2200);
        setTimeout(() => afterHand(main), 2400);
    }

    function awardUncontested(p) {
        const awardedPot = pot();
        p.chips += awardedPot;
        P.forEach((player) => {
            player.total = 0;
            player.bet = 0;
        });
        p.last = "POT WON";
        mainWinner = p;
        phase = "won";
        render();
        pushLog(`${p.name} UNCONTESTED WIN`, "win");
        announce("ALL OTHERS FOLDED", "POT CAPTURED", `${p.name}がポットを獲得`, "win", 1700);
        setTimeout(() => afterHand([p]), 1850);
    }

    function afterHand(w) {
        let human = w.find((x) => x.human);
        if (human) draft(human);
        else newHand();
    }

    function draft(p) {
        let pool = mods.filter((m) => !p.mods.some((x) => x.id === m.id));
        if (!pool.length) {
            newHand();
            return;
        }
        offers = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
        phase = "draft";
        $("#relic-title").textContent = `${p.name} / MODULE`;
        $("#relic-cards").innerHTML = offers
            .map(
                (m, i) =>
                `<button data-i="${i}" class="mod-${m.cat}"><span>${CAT[m.cat]}</span><i>${m.icon}</i><h3>${m.name}</h3><p>${m.desc}</p><em>SELECT MODULE_0${i + 1}</em></button>`,
            )
            .join("");
        $("#relic-cards")
            .querySelectorAll("button")
            .forEach((b) => (b.onclick = () => choose(p, +b.dataset.i)));
        $("#relic").classList.remove("hidden");
        deadline = performance.now() + 18000;
        announce("ROGUE REWARD", "MODULE DRAFT", "勝者は能力を1つインストール", "win", 1800);
    }

    function choose(p, i) {
        if (!offers[i]) return;
        const picked = offers[i];
        p.mods.push({ ...picked });
        $("#relic").classList.add("hidden");
        phase = "transition";
        pushLog(`${p.name} INSTALL ${picked.name}`, picked.cat);
        announce(CAT[picked.cat], picked.name, picked.desc, picked.cat, 2000);
        render();
        setTimeout(newHand, 2100);
    }

    function finish(p) {
        phase = "ended";
        $("#winner").textContent = `${p.name} WINS`;
        $("#result-copy").textContent =
            `${handNo} HANDS / ${p.chips} CHIPS / TDA CORE`;
        $("#result").classList.remove("hidden");
        render();
    }

    function card(c, i = 0, back = false) {
        if (back) return `<i class="card card-back back-${i % 4}" style="--i:${i}"><span></span></i>`;
        let hot = c.s === "♥" || c.s === "♦";
        let rank = RN[c.r] || c.r;
        let suit = { "♠": "s", "♥": "h", "♦": "d", "♣": "c" }[c.s];
        return `<i class="card suit-${suit} ${hot ? "hot" : ""}" style="--i:${i}"><span class="corner top"><b>${rank}</b><em>${c.s}</em></span><strong class="pip" aria-label="${c.s}"></strong><span class="corner bottom"><b>${rank}</b><em>${c.s}</em></span></i>`;
    }

    function render(show = false) {
        let [S, B] = LEVELS[level];
        $("#level").textContent = String(level + 1).padStart(2, "0");
        $("#blinds").textContent =
            `SB ${S} / BB ${B} / BBA ${active().length >= 3 ? B : 0}`;
        $("#pot").textContent = String(pot()).padStart(4, "0");
        const boardKey = board.map((c) => `${c.s}${c.r}`).join("|");
        if (boardKey !== lastBoardKey) {
            const container = $("#board");
            const count = live().some((p) => p.mods.some((m) => m.id === "sixboard")) ? 6 : 5;
            for (let i = 0; i < count; i++) {
                const c = board[i];
                const key = `${handNo}:${c ? c.s + c.r : "back"}`;
                const previous = container.children[i];
                if (previous?.dataset.cardKey === key) continue;
                const template = document.createElement("template");
                template.innerHTML = card(c, i, !c);
                const node = template.content.firstElementChild;
                node.dataset.cardKey = key;
                if (previous) previous.replaceWith(node);
                else container.appendChild(node);
            }
            while (container.children.length > count) container.lastElementChild.remove();
            lastBoardKey = boardKey;
        }
        $("#seats").innerHTML = P.map(
            (p, i) =>
            `<article class="h-seat pos-${i} ${i === actor && (phase === "act" || phase === "cpu") ? "acting" : ""} ${p.folded ? "folded" : ""} ${show && !p.folded ? "showing" : ""}"><div class="avatar">${i + 1}</div><header><b>${p.name}</b><span>${i === dealer ? "D " : ""}${i === sb ? "SB " : ""}${i === bb ? "BB" : ""}</span></header><div class="seat-bank"><span class="mini-chip chip-c${i % 4}"></span><strong>${p.chips}</strong></div><small>${p.last}</small><div class="seat-mods">${p.mods.map((m) => `<i class="${m.cat}" title="${m.name}">${m.icon}</i>`).join("")}</div><div class="tiny-cards">${show && !p.folded ? p.hole.map((c, j) => card(c, j)).join("") : p.hole.map((_, j) => card(null, j, true)).join("")}</div></article>`,
        ).join("");
        const actionPlayer = P[actor] || P[0];
        const viewer = mode === "solo" ? P[0] : actionPlayer;
        const canAct = phase === "act" && actionPlayer?.human;
        const canSee = mode === "solo" ?
            !!viewer && !viewer.folded && phase !== "setup" :
            canAct;
        const holeKey = `${handNo}:${viewer?.id}:${canSee}:${viewer?.hole.map((c) => `${c.s}${c.r}`).join("|")}`;
        if (holeKey !== lastHoleKey) {
            $("#hole").innerHTML = canSee ?
                viewer.hole.map((c, i) => card(c, i)).join("") :
                card(null, 0, true) + card(null, 1, true);
            lastHoleKey = holeKey;
        }
        $("#active-name").textContent = `${viewer?.name || "TABLE"} / YOUR CARDS`;
        $("#turn-info").textContent = phase === "showdown" ?
            "CARDS REVEALED" :
            phase === "won" ?
            "HAND WON" :
            phase === "transition" ?
            "RESOLVING..." :
            `${actionPlayer?.name || "TABLE"} TO ACT`;
        let due = Math.max(0, currentBet - (actionPlayer?.bet || 0));
        $("#checkcall").textContent = due ?
            `CALL ${Math.min(due, actionPlayer.chips)}` :
            "CHECK";
        $("#raise-value").textContent = raiseTo;
        const stackEl = $("#viewer-chips");
        const nextStack = (viewer?.chips || 0).toLocaleString("ja-JP");
        if (stackEl.textContent !== nextStack) {
            stackEl.textContent = nextStack;
            stackEl.classList.remove("bump");
            requestAnimationFrame(() => stackEl.classList.add("bump"));
        }
        $("#to-call").textContent = canAct ?
            Math.min(due, actionPlayer?.chips || 0).toLocaleString("ja-JP") :
            "—";
        $("#pot-mini").textContent = pot().toLocaleString("ja-JP");
        $("#position").textContent = viewer?.id === dealer ? "DEALER" : viewer?.id === sb ? "SB" : viewer?.id === bb ? "BB" : "—";
        ["fold", "checkcall", "raise", "allin", "minus", "plus"].forEach(
            (id) => ($("#" + id).disabled = !canAct),
        );
        let rank =
            (phase === "showdown" || viewer?.mods.some((m) => m.id === "scan")) && board.length >= 3 ?
            handRank(viewer).name :
            "—";
        $("#hand-name").textContent = rank;
        let data = [];
        if (viewer?.mods.some((m) => m.id === "odds") && due)
            data.push(`POT ODDS ${Math.round((due / (pot() + due)) * 100)}%`);
        if (viewer?.mods.some((m) => m.id === "tell"))
            data.push(
                P.filter((x) => !x.human && x.tell)
                .map((x) => `${x.name}:${x.tell}`)
                .join(" "),
            );
        if (viewer?.mods.some((m) => m.id === "map") && LEVELS[level + 1])
            data.push(`NEXT ${LEVELS[level + 1][0]}/${LEVELS[level + 1][1]}`);
        $("#module-readout").textContent =
            data.filter(Boolean).join(" / ") || "NO MODULE DATA";
        $("#module-tray").innerHTML = viewer?.mods.length ?
            viewer.mods.map((m) => `<span class="mod-chip ${m.cat}"><b>${m.icon}</b>${m.name}</span>`).join("") :
            `<span class="empty">MODULE SLOT / EMPTY — ハンド勝利で獲得</span>`;
        ["pre", "flop", "turn", "river"].forEach((s) =>
            $("#s-" + s)?.classList.toggle("on", street === s),
        );
        $("#table-msg").textContent =
            street === "showdown" ?
            "SHOWDOWN" :
            phase === "won" ?
            "POT CAPTURED" :
            `${street.toUpperCase()} / ${actionPlayer?.name || ""} TO ACT`;
        $("#message").textContent =
            phase === "pass" ?
            "PRIVATE HANDOFF" :
            phase === "cpu" ?
            "CPU THINKING" :
            phase === "showdown" ?
            "HAND COMPLETE" :
            phase === "won" ?
            "HAND COMPLETE" :
            phase === "transition" ?
            "RESOLVING EFFECTS" :
            "ACTION REQUIRED";
        const guide = $("#guidance");
        if (phase === "cpu") {
            guide.innerHTML = `<b>WAIT</b><span>CPUのアクション中。あなたのカードは下に表向きで固定表示されています。</span>`;
        } else if (phase === "act" && canAct) {
            guide.innerHTML = due ?
                `<b>YOUR TURN</b><span><strong>${due}</strong>をCALL、RAISE、またはFOLDを選んでください。</span>` :
                `<b>YOUR TURN</b><span>無料でCHECKできます。攻めるならRAISEを選んでください。</span>`;
        } else if (street === "showdown") {
            guide.innerHTML = `<b>SHOWDOWN</b><span>全員のカードを公開し、場の5枚と合わせた最強役を判定中です。</span>`;
        } else if (phase === "won") {
            guide.innerHTML = `<b>POT WON</b><span>全員がフォールド。カードを見せずにポットを獲得しました。</span>`;
        } else if (phase === "transition") {
            guide.innerHTML = `<b>RESOLVE</b><span>アクションと能力効果を処理中。中央の演出とLIVE FEEDを確認してください。</span>`;
        } else {
            guide.innerHTML = `<b>${street.toUpperCase()}</b><span>赤い♥・♦と黒い♠・♣を使い、7枚から最強の5枚を作ります。</span>`;
        }
    }
    $("#start").onclick = init;
    document.querySelectorAll('input[name="theme"]').forEach((input) => {
        input.addEventListener("change", () => setTheme(input.value));
    });
    $("#theme-toggle").onclick = () => setTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    window.addEventListener("keydown", (e) => {
        if (e.code === "Space" && phase === "setup" && !e.target.closest("button,input,select")) {
            e.preventDefault();
            init();
        }
    });
    $("#reveal").onclick = () => {
        $("#pass").classList.add("hidden");
        phase = "act";
        render();
    };
    $("#fold").onclick = () => act("fold");
    $("#checkcall").onclick = () =>
        act(currentBet > P[actor].bet ? "call" : "check");
    $("#raise").onclick = () => act("raise");
    $("#allin").onclick = () => act("allin");
    $("#minus").onclick = () => {
        raiseTo = Math.max(currentBet + minRaise, raiseTo - minRaise);
        render();
    };
    $("#plus").onclick = () => {
        raiseTo = Math.min(P[actor].bet + P[actor].chips, raiseTo + minRaise);
        render();
    };
    $("#restart").onclick = () => location.reload();
    let dlg = $("#manual");
    $("#help").onclick = () => dlg.showModal();
    dlg.querySelector(".close").onclick = () => dlg.close();

    function tick(t) {
        if (phase === "draft") {
            let s = Math.max(0, Math.ceil((deadline - t) / 1000));
            $("#draft-time").textContent = s;
            if (!s) choose(mainWinner, 0);
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();
