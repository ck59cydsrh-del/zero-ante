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
            [25, 50],
            [40, 80],
            [60, 120],
            [100, 200],
            [150, 300],
            [250, 500],
            [400, 800],
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
        actionHideTimer = 0,
        manualResolving = false,
        pendingModule = null;

    function setTheme(value, remember = true) {
        const theme = "light";
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
    const soundEngine = typeof GameSound !== "undefined" ? GameSound.create(window.AudioContext || window.webkitAudioContext) : null;
    let soundEnabled = false;
    function cue(kind) {
        if (!soundEnabled || !soundEngine) return false;
        const played=soundEngine.play(kind);
        const patterns={raise:18,allin:[24,35,70],attack:[16,28],chaos:[12,25,12],reward:[12,22],win:[18,35,18,60],defeat:28};
        if(played&&patterns[kind]&&navigator.vibrate)navigator.vibrate(patterns[kind]);
        return played;
    }
    function impact(kind) {
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const table = $(".circuit-table");
        table.classList.remove("pulse", "win-pulse");
        requestAnimationFrame(() => table.classList.add(kind === "win" ? "win-pulse" : "pulse"));
        if (kind !== "win" && kind !== "attack" && kind !== "chaos") return;
        const area = $(".game").getBoundingClientRect(), center = $("#pot").getBoundingClientRect();
        const particles=kind==="win"?76:36;
        for(let r=0;r<(kind==="win"?3:2);r++){
            const ring=document.createElement("i");ring.className="electro-ring";
            ring.style.cssText=`--cx:${center.x+center.width/2-area.x}px;--cy:${center.y+center.height/2-area.y}px;--delay:${r*.12}s`;
            $("#burst").append(ring);setTimeout(()=>ring.remove(),1600);
        }
        for (let i = 0; i < particles; i++) {
            const spark = document.createElement("i"), angle = i * Math.PI * 2 / particles;
            spark.className = "spark";
            spark.style.cssText = `--cx:${center.x + center.width / 2 - area.x}px;--cy:${center.y + center.height / 2 - area.y}px;--tx:${Math.cos(angle) * (kind==="win"?350:220)}px;--ty:${Math.sin(angle) * (kind==="win"?210:140)}px`;
            $("#burst").append(spark); setTimeout(() => spark.remove(), 1100);
        }
    }
    function flyChips(player) {
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const area = $(".game").getBoundingClientRect();
        const source = (player.human ? $("#viewer-chips") : $(`.pos-${player.id} .seat-bank`))?.getBoundingClientRect();
        const target = $("#pot").getBoundingClientRect();
        if (!source) return;
        for (let i = 0; i < 4; i++) {
            const chip = document.createElement("i");
            chip.className = "flying-chip";
            chip.style.cssText = `--from-x:${source.x + source.width / 2 - area.x}px;--from-y:${source.y - area.y}px;--dx:${target.x + target.width / 2 - source.x - source.width / 2}px;--dy:${target.y + target.height / 2 - source.y}px;--delay:${i * .055}s`;
            $("#chip-flight").append(chip); setTimeout(() => chip.remove(), 1100);
        }
    }
    function abilitySignal(effect) {
        const pod=$(".active-pod"), viewer=Number(pod.dataset.viewer);
        const node=id=>id===viewer?pod:$(`.pos-${id}`);
        const source=node(effect.owner), target=effect.scope==="board"?$("#board"):node(effect.target);
        source?.classList.add("casting");
        target?.classList.add("targeted",effect.scope==="board"?"board-hit":effect.cat==="attack"?"debuff-hit":"buff-hit");
        if(!source||!target||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
        const area=$(".game").getBoundingClientRect(), a=source.getBoundingClientRect(), b=target.getBoundingClientRect();
        const x=a.x+a.width/2-area.x,y=a.y+a.height/2-area.y,tx=b.x+b.width/2-area.x,ty=b.y+b.height/2-area.y;
        const wave=document.createElement("i");wave.className=`ability-wave ${effect.cat}`;wave.style.cssText=`--x:${tx}px;--y:${ty}px`;$("#burst").append(wave);setTimeout(()=>wave.remove(),1100);
        if(source!==target){const ray=document.createElement("i");ray.className=`ability-ray ${effect.cat}`;ray.style.cssText=`--x:${x}px;--y:${y}px;--distance:${Math.hypot(tx-x,ty-y)}px;--angle:${Math.atan2(ty-y,tx-x)}rad`;$("#burst").append(ray);setTimeout(()=>ray.remove(),900);}
    }
    function raiseSignal(player, amount) {
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const area=$(".game").getBoundingClientRect();
        const source=(player.human?$("#viewer-chips"):$(`.pos-${player.id} .seat-bank`))?.getBoundingClientRect();
        const target=$("#pot").getBoundingClientRect();
        if(!source)return;
        const x=source.x+source.width/2-area.x,y=source.y+source.height/2-area.y;
        const tx=target.x+target.width/2-area.x,ty=target.y+target.height/2-area.y;
        for(let i=0;i<5;i++){
            const trace=document.createElement("i");trace.className="raise-trace";
            trace.style.cssText=`--x:${x}px;--y:${y+(i-2)*6}px;--distance:${Math.hypot(tx-x,ty-y)}px;--angle:${Math.atan2(ty-y,tx-x)}rad;--delay:${i*.035}s`;
            $("#burst").append(trace);setTimeout(()=>trace.remove(),950);
        }
        const stamp=document.createElement("div");stamp.className="raise-stamp";stamp.style.cssText=`--x:${tx}px;--y:${ty}px`;stamp.innerHTML=`<small>POT SIGNAL</small><b>+${amount}</b>`;
        $("#burst").append(stamp);setTimeout(()=>stamp.remove(),1250);
        $(".circuit-table").classList.remove("raise-charge");requestAnimationFrame(()=>$(".circuit-table").classList.add("raise-charge"));
    }
    const mods = Rogue.catalog;
    let rewardQueue = [], rewardOwner = null, roundWinners=[], lastActionText="", localNames=[], rewardWon=false, rerollsLeft=0;
    function rewardChoices(pool,won,previous=[]) {
        const fresh=pool.filter(m=>!previous.includes(m.id));
        const ordered=[...fresh,...pool.filter(m=>previous.includes(m.id))];
        const selected=ordered.slice(0,3);
        const legendary=ordered.find(m=>m.tier===3);
        if(won&&legendary&&!selected.some(m=>m.tier===3))selected[selected.length-1]=legendary;
        return selected;
    }
    const safeName=(value,i)=>String(value||"").replace(/[^\p{L}\p{N} _ー・-]/gu,"").trim().slice(0,12)||`プレイヤー${i+1}`;
    const roleName = name => ({"HIGH CARD":"ハイカード","ONE PAIR":"ワンペア","TWO PAIR":"ツーペア","THREE":"スリーカード","STRAIGHT":"ストレート","FLUSH":"フラッシュ","FULL HOUSE":"フルハウス","FOUR":"フォーカード","STRAIGHT FLUSH":"ストレートフラッシュ","ROYAL FLUSH":"ロイヤルフラッシュ","FIVE OF A KIND":"ファイブカード"})[name]||name;
    function nameFields(){
        const el=$("#local-names"); el.classList.toggle("hidden",$("#mode").value!=="local");
        el.innerHTML=Array.from({length:+$("#count").value},(_,i)=>`<label>${i+1}人目<input id="player-name-${i}" maxlength="12" aria-label="${i+1}人目の名前" value="${safeName(localNames[i],i)}"></label>`).join("");
        el.querySelectorAll("input").forEach((input,i)=>input.addEventListener("input",()=>localNames[i]=input.value));
    }
    $("#mode").addEventListener("change",nameFields);$("#count").addEventListener("change",nameFields);nameFields();
    function effectContext() { return {players:P, deck, board, street, bb:LEVELS[level][1],events:[]}; }
    function publishEffects(ctx) {
        for (const e of ctx.events) {
            pushLog(`${e.ownerName} → ${e.targetName} / ${e.name} / ${e.copy}`, e.cat);
            fxQueue.push({type:`${e.cat.toUpperCase()} MODULE`,title:e.name,copy:e.copy,kind:e.cat,duration:e.cat==="attack"?2100:1850,effect:e});
        }
        if (!fxBusy) playNextFx();
    }
    function afterEffects(fn) { if(fxBusy || fxQueue.length) setTimeout(()=>afterEffects(fn),120); else fn(); }
    const CAT = {
        info: "ヒント",
        attack: "相手を妨害",
        guard: "チップ補助",
        chaos: "カード・ルール変更",
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
        if (g[0].n === 5) {cat=9;name="FIVE OF A KIND";tie=[g[0].r];}
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

    function handRank(p) { return best7(Rogue.rankCards(p, board)); }

    function pushLog(copy, kind = "system") {
        logs.unshift({ copy, kind });
        logs = logs.slice(0, 12);
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
        cue(item.kind);
        impact(item.kind);
        const el = $("#event-fx");
        el.className = `event-fx ${item.kind}`;
        $("#event-type").textContent = item.type;
        $("#event-title").textContent = item.title;
        $("#event-copy").textContent = item.copy;
        const route=$("#event-route");
        route.hidden=!item.effect;
        document.querySelectorAll(".targeted,.fired,.casting,.debuff-hit,.buff-hit,.board-hit").forEach(n=>n.classList.remove("targeted","fired","casting","debuff-hit","buff-hit","board-hit"));
        if(item.effect){
            const e=item.effect;
            el.classList.add("ability-hit");
            el.dataset.category=e.cat;
            $("#effect-source").textContent=e.ownerName;
            $("#effect-target").textContent=e.targetName;
            abilitySignal(e);
            $("#effect-receipt").className=`effect-receipt receipt-${e.cat}`;
            $("#effect-receipt").innerHTML=`<header><em>${e.cat.toUpperCase()}</em><b>${e.ownerName} → ${e.targetName}</b></header><strong>${e.name}</strong><span>${e.copy}</span>`;
            $(`.pos-${e.target}`)?.classList.add("targeted");
            $(`[data-module="${e.id}"]`)?.classList.add("fired");
        }else{
            delete el.dataset.category;
        }
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
        cue(title==="ALL-IN"?"allin":title.startsWith("RAISE")?"raise":title==="CHECK"?"check":title==="FOLD"?"fold":title==="CALL"?"call":kind);
        if(kind==="attack") impact(kind);
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
        const names=Array.from({length:N},(_,i)=>safeName(localNames[i],i));
        P = Array.from({
            length: N
        }, (_, i) => ({
            id: i,
            name: mode==="solo"?(i===0?"あなた":`CPU ${i}`):names[i]+(names.filter(n=>n===names[i]).length>1?` (${i+1})`:""),
            human: mode === "local" || i === 0,
            chips: 600,
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

    function applyOpeningModules() { const ctx=effectContext(); Rogue.opening(ctx); publishEffects(ctx); }

    function newHand() {
        if (active().length === 1) {
            finish(active()[0]);
            return;
        }
        lastActionText="";
        handNo++;
        $("#effect-receipt").innerHTML="";
        lastHoleKey = null;
        lastBoardKey = null;
        level = Math.min(LEVELS.length - 1, Math.floor((handNo - 1) / 2));
        let [S, B] = LEVELS[level];
        dealer = next(dealer);
        sb = active().length === 2 ? dealer : next(dealer);
        bb = next(sb);
        deck = shuffle(makeDeck());
        board = [];
        P.forEach((p) => {
            p.startChips=p.chips; p.payout=0; p.rank=null; p.bestCards=[];
            p.bet = p.total = 0;
            p.folded = p.chips <= 0;
            p.participated = !p.folded;
            p.allin = false;
            p.silenced = false;
            p.shieldUsed = false;
            p.hole = p.folded ? [] : [deck.pop(), deck.pop()];
            p.last = p.folded ? "OUT" : "IN";
        });
        applyOpeningModules();
        if (active().length >= 3) payAnte(P[bb], B);
        pay(P[sb], S);
        pay(P[bb], B);
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
            $("#effect-receipt").innerHTML="";
            phase = "pass";
            $("#pass-title").textContent = `${p.name} の番です`;
            $("#pass").classList.remove("hidden");
            render();
        } else {
            phase = "act";
            render();
        }
    }

    function act(type) {
        if ((phase !== "act" && phase !== "cpu") || manualResolving) return;
        let p = P[actor],
            beforeChips = p.chips,
            due = Math.max(0, currentBet - p.bet);
        if (p.silenced && street === "pre" && (type === "raise" || (type === "allin" && p.chips > due))) return;
        if (type === "fold") {
            p.folded = true;
            p.last = "FOLD";
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
        const actionCtx=effectContext(); Rogue.action(actionCtx,p,type); publishEffects(actionCtx);
        pending.delete(p.id);
        if (p.chips < beforeChips) flyChips(p);
        const kind = type === "allin" ? "attack" : type === "raise" ? "raise" : "action";
        pushLog(`${p.name} / ${p.last}`, kind);
        const spent=Math.max(0,beforeChips-p.chips);
        const actionDescriptions={fold:"勝負から降りました",check:"追加のチップなしで続けました",call:`${Math.min(due,beforeChips)}枚を出して続けました`,raise:`合計${p.bet}枚に増額しました`,allin:`残りのチップをすべて賭けました`};
        lastActionText=`${p.name}が${actionDescriptions[type]}。所持 ${beforeChips} → ${p.chips}枚`;
        pushLog(lastActionText,kind);
        flashAction(p.last,p.name,kind);
        if(type==="raise")raiseSignal(p,spent);
        $("#action-detail").textContent=type==="check"?"追加 0枚":type==="fold"?"この勝負は見送る":`所持 ${beforeChips} → ${p.chips}枚`;
        if(spent) $("#action-detail").textContent+=`（−${spent}）`;
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
            afterEffects(showdown);
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
            street = "river";
        }
        $("#effect-receipt").innerHTML="";
        const streetCtx=effectContext(); Rogue.street(streetCtx,street); publishEffects(streetCtx);
        pending = new Set(
            live()
            .filter((p) => !p.allin)
            .map((p) => p.id),
        );
        if (live().filter((p) => !p.allin).length <= 1) {
            phase = "transition";
            render();
            announce("ALL-IN RUNOUT", street.toUpperCase(), `${board.length}枚公開 / 能力を解決して次の場札へ`, "street", 1600);
            afterEffects(advance);
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

    function cpu(skipManual = false) {
        let p = P[actor];
        if(!skipManual){
            const ctx=effectContext(),ready=p.mods.filter(m=>m.manual&&Rogue.manualReady(m,ctx,p));
            if(ready.length&&Math.random()>.45){
                const m=ready[Math.floor(Math.random()*ready.length)],targets=live().filter(q=>q.id!==p.id);
                const target=m.targeted?targets[Math.floor(Math.random()*targets.length)]?.id:null;
                const result=Rogue.manual(ctx,p,m.id,target);
                if(result.ok){
                    lastHoleKey=null;lastBoardKey=null;phase="transition";
                    lastActionText=`${p.name} が ${m.name} を発動。${result.event.copy}`;
                    publishEffects(ctx);render();
                    afterEffects(()=>{phase="cpu";render();setTimeout(()=>cpu(true),420);});
                    return;
                }
            }
        }
        let
            due = Math.max(0, currentBet - p.bet),
            strength =
            board.length >= 3 ?
            handRank(p).cat :
            Math.max(...p.hole.map((c) => c.r)) / 14,
            roll = Math.random();
        p.tell = strength > 4 ? "STRONG" : strength > 1 ? "MIXED" : "WEAK";
        if (due > p.chips * 0.45 && strength < 2) act("fold");
        else if (!(p.silenced && street === "pre") && strength >= 4 && roll > 0.45) {
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
        const rankCtx=effectContext(); Rogue.rankEvents(rankCtx); publishEffects(rankCtx);
        eligible.forEach(p=>{p.rank=handRank(p);p.bestCards=combos(Rogue.rankCards(p,board),5).sort((a,b)=>cmp(rank5(a),rank5(b))).at(-1);});
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
            wins.forEach(w=>{w.chips+=share;w.payout+=share;});
            for (let r = 0; r < amount - share * wins.length; r++)
                {wins[r % wins.length].chips++;wins[r % wins.length].payout++;}
            if (!idx) main = wins;
            prev = lv;
        });
        mainWinner = main[0];
        P.forEach(p=>p.handWon=main.includes(p));
        P.forEach((p) => (p.last = p.folded ? "FOLD" : p.rank.name));
        P.forEach((p) => {
            p.total = 0;
            p.bet = 0;
        });
        render(true);
        const names = main.map((p) => p.name).join(" + ");
        pushLog(`${names} WIN / ${main[0].rank.name}`, "win");
        const lost=mode==="solo"&&!main.some(p=>p.human);
        announce("POT AWARDED / " + main[0].rank.name, lost?"OPPONENT WINS":"WIN +"+awardedPot.toLocaleString(), `${names} +${awardedPot} / ${lost?"あなたにも通常能力":"レア・伝説の能力を獲得"}`, lost?"defeat":"win", 3000);
        setTimeout(() => afterHand(main), 2400);
    }

    function awardUncontested(p) {
        const awardedPot = pot();
        p.chips += awardedPot;
        p.payout=awardedPot;
        P.forEach((player) => {
            player.total = 0;
            player.bet = 0;
        });
        p.last = "POT WON";
        mainWinner = p;
        P.forEach(q=>q.handWon=q===p);
        phase = "won";
        render();
        pushLog(`${p.name} UNCONTESTED WIN`, "win");
        const lost=mode==="solo"&&!p.human;
        announce("ALL OTHERS FOLDED", lost?"OPPONENT WINS":"WIN +"+awardedPot.toLocaleString(), `${p.name} +${awardedPot} / ${lost?"あなたにも通常能力":"レア・伝説の能力を獲得"}`, lost?"defeat":"win", 2800);
        setTimeout(() => afterHand([p]), 1850);
    }

    function afterHand(winners) {
        afterEffects(()=>{
            P.filter(p=>p.participated).forEach(p=>{p.streak=winners.includes(p)?(p.streak||0)+1:0;});
            roundWinners=winners; phase="round-result";
            const lost=mode==="solo"&&!winners.some(p=>p.human);
            $("#round-eyebrow").textContent=`HAND ${String(handNo).padStart(2,"0")} / RESULT`;
            $("#round-title").textContent=mode==="solo"?(lost?"あなたの負け":"あなたの勝ち！"):`${winners.map(p=>p.name).join("・")} の勝ち！`;
            $("#round-result").dataset.outcome=lost?"lost":"won";
            const chain=Math.max(...winners.map(p=>p.streak));
            $("#round-result").dataset.streak=String(Math.min(chain,3));
            if(chain>1)$("#round-title").textContent+=` / ${chain} WIN STREAK`;
            $("#round-summary").textContent=`${winners.map(p=>p.name).join(" / ")} — ${winners[0].rank?roleName(winners[0].rank.name):"全員FOLD"}`;
            const runner=P.filter(p=>p.rank&&!winners.includes(p)).sort((a,b)=>cmp(b.rank,a.rank))[0];
            if(runner && winners[0].rank.cat===runner.rank.cat){
                const win=winners[0], k=win.rank.tie.findIndex((r,i)=>r!==runner.rank.tie[i]);
                const label=r=>({14:"A",13:"K",12:"Q",11:"J"}[r]||r);
                if(k>=0)$("#round-summary").textContent+=` / ${label(win.rank.tie[k])} ＞ ${label(runner.rank.tie[k])}`;
            }
            $("#round-board").innerHTML=board.length?`<small>全員共通の場札</small><div>${board.map((c,i)=>card(c,i)).join("")}</div>`:"";
            $("#round-players").innerHTML=P.filter(p=>p.participated).map(p=>{
                const delta=p.chips-p.startChips;
                const hand=p.rank?p.bestCards.map((c,i)=>card(c,i)).join(""):"";
                return `<article class="${p.handWon?"round-winner":""}"><header><b>${p.name}</b><strong>${p.handWon?"WIN":p.payout>0?"SIDE POT":"LOSS"}</strong></header><div class="result-hand">${hand||`<span>${p.folded?"FOLD":"—"}</span>`}</div><div class="result-numbers"><b>${delta>=0?"+":""}${delta}</b><small>${p.chips} STACK</small></div></article>`;
            }).join("");
            $("#round-result").classList.remove("hidden");
            $("#turn-banner").innerHTML="<strong>今回の勝負が決まりました</strong><span>カードとチップの増減を確認してください</span>";
        });
    }
    $("#to-rewards").onclick=()=>{
        if(phase!=="round-result")return;
        $("#round-result").classList.add("hidden");phase="transition";queueRewards(roundWinners);
    };
    function queueRewards(winners) {
        afterEffects(() => {
            const ctx=effectContext(); Rogue.result(ctx,winners.map(p=>p.id)); publishEffects(ctx);
            rewardQueue=P.filter(p=>p.participated && p.human).map(p=>({p,won:winners.includes(p)}));
            P.filter(p=>p.participated && !p.human).forEach(p=>{
                const pool=Rogue.rewardPool(p,winners.includes(p));
                if(pool.length) {const m=pool[Math.floor(Math.random()*pool.length)];p.mods.push({...m});pushLog(`${p.name} INSTALL ${m.name} / ${Rogue.tiers[m.tier]}`,m.cat);}
            });
            afterEffects(nextReward);
        });
    }
    function nextReward() {
        const reward=rewardQueue.shift();
        if(!reward) {afterEffects(newHand);return;}
        draft(reward.p,reward.won);
    }
    function draft(p,won,reroll=false) {
        const pool=Rogue.rewardPool(p,won);
        if(!pool.length) {
            p.chips+=won?80:20;
            pushLog(`${p.name} / 全能力取得済み → +${won?80:20}`,"guard");
            nextReward(); return;
        }
        const previous=reroll?offers.map(m=>m.id):[];
        if(!reroll)rerollsLeft=1;
        offers=rewardChoices(shuffle([...pool]),won,previous);
        rewardWon=won;
        rewardOwner=p; phase="draft"; deadline=0;
        if(!reroll)cue("reward");
        $("#relic-title").textContent = `${p.name}、能力を1つ選ぼう`;
        $("#relic .eyebrow").textContent=won?(pool.some(m=>m.tier===3)?"VICTORY DROP / 伝説候補が必ず1つ":"VICTORY DROP / レア報酬"):"COMEBACK DROP / 次の勝負に持ち越そう";
        const canReroll=rerollsLeft>0&&pool.some(m=>!offers.some(o=>o.id===m.id));
        $("#reroll-reward").disabled=!canReroll;
        $("#reroll-reward").textContent=rerollsLeft?"REROLL / 1回だけ引き直す":"REROLL USED";
        $("#draft-time").textContent="時間制限なし";
        $("#relic-cards").innerHTML=offers.map((m,i)=>`<button data-i="${i}" data-tier="${m.tier}" class="mod-${m.cat}"><span>${CAT[m.cat]} · <b class="rarity">${Rogue.tiers[m.tier]}</b></span><i>${m.icon}</i><h3>${m.name}</h3><p>${m.desc}</p><em>この能力をもらう →</em></button>`).join("");
        $("#relic-cards").querySelectorAll("button").forEach(b=>b.onclick=()=>choose(p,+b.dataset.i));
        $("#relic").classList.remove("hidden");
    }
    $("#reroll-reward").onclick=()=>{
        if(phase!=="draft"||!rerollsLeft||$("#reroll-reward").disabled)return;
        rerollsLeft=0;cue("chaos");draft(rewardOwner,rewardWon,true);
    };
    function choose(p,i) {
        if(phase!=="draft" || p!==rewardOwner || !offers[i])return;
        const picked=offers[i]; offers=[];
        p.mods.push({...picked}); $("#relic").classList.add("hidden"); phase="transition";
        pushLog(`${p.name} INSTALL ${picked.name} / ${Rogue.tiers[picked.tier]}`,picked.cat);
        announce("INSTALLED / "+Rogue.tiers[picked.tier],picked.name,picked.desc,picked.cat,1800);
        render();
        afterEffects(nextReward);
    }

    function finish(p) {
        phase = "ended";
        $("#winner").textContent = `${p.name} の総合優勝！`;
        $("#result-copy").textContent =
            `${handNo}回の勝負 / 最終チップ ${p.chips}枚`;
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

    function playerStatuses(p,currentStreet) {
        const states=[];
        if(p.silenced&&currentStreet==="pre")states.push({code:"RAISE LOCK",copy:"この回は増額不可",kind:"debuff"});
        if(p.guardJammed)states.push({code:"GUARD OFF",copy:"チップ補助が無効",kind:"debuff"});
        if(p.fogged)states.push({code:"NO INFO",copy:"情報能力が無効",kind:"debuff"});
        if(p.exposed)states.push({code:"OPEN CARD",copy:"手札1枚を公開中",kind:"debuff"});
        if(p.allin)states.push({code:"ALL-IN",copy:"全チップ投入済み",kind:"danger"});
        return states;
    }
    function statusMarkup(p,currentStreet) {
        return playerStatuses(p,currentStreet).map(s=>`<i class="${s.kind}" title="${s.copy}"><b>${s.code}</b><span>${s.copy}</span></i>`).join("");
    }

    function closeTargetPicker() {
        $("#target-picker").classList.add("hidden");
        pendingModule=null;
    }
    function openTargetPicker(m,viewer) {
        if(!m.manual)return;
        const ready=phase==="act"&&P[actor]===viewer&&!manualResolving&&Rogue.manualReady(m,effectContext(),viewer);
        if(!ready){
            const wait=m.board&&board.length<3?"場札が3枚出たら使用できます":viewer.used?.['manual:'+m.id]?"この勝負では使用済みです":"自分の手番中に使用できます";
            $("#effect-receipt").innerHTML=`<header><em>${m.cat.toUpperCase()}</em><b>MANUAL MODULE</b></header><strong>${m.name}</strong><span>${m.desc}</span><span>${wait}</span>`;
            return;
        }
        pendingModule=m;
        $("#target-module").textContent=m.name;
        $("#target-copy").textContent=m.desc;
        const choices=m.targeted?live().filter(q=>q.id!==viewer.id):[];
        $("#target-options").innerHTML=m.board?`<button type="button" data-target="board"><small>COMMUNITY CARDS</small><b>BOARDを書き換える</b><span>全プレイヤーに影響</span></button>`:choices.map(q=>`<button type="button" data-target="${q.id}"><small>TARGET ${String(q.id+1).padStart(2,"0")}</small><b>${q.name}</b><span>所持 ${q.chips.toLocaleString("ja-JP")}枚</span></button>`).join("");
        $("#target-options").querySelectorAll("button").forEach(button=>button.onclick=()=>activateManual(button.dataset.target));
        $("#target-picker").classList.remove("hidden");
    }
    function activateManual(targetId) {
        const owner=P[actor],m=pendingModule;
        if(!m||phase!=="act"||!owner?.human||manualResolving)return;
        manualResolving=true;
        $("#target-picker").classList.add("hidden");
        pendingModule=null;
        const ctx=effectContext(),result=Rogue.manual(ctx,owner,m.id,targetId==="board"?null:Number(targetId));
        if(!result.ok){
            manualResolving=false;
            $("#effect-receipt").innerHTML=`<header><em>WAIT</em><b>${m.name}</b></header><span>${result.reason}</span>`;
            render();return;
        }
        lastHoleKey=null;lastBoardKey=null;
        lastActionText=`${owner.name} が ${m.name} を発動。${result.event.copy}`;
        phase="transition";
        publishEffects(ctx);render();
        afterEffects(()=>{manualResolving=false;phase="act";render();});
    }

    function render(show = false) {
        let [S, B] = LEVELS[level];
        $("#level").textContent = String(level + 1).padStart(2, "0");
        $("#blinds").textContent =
            `SB ${S} / BB ${B} / BBA ${active().length >= 3 ? B : 0}`;
        const potValue=pot(), potEl=$("#pot");
        const nextPot=String(potValue).padStart(4,"0");
        if(potEl.textContent!==nextPot){
            potEl.textContent=nextPot;
            potEl.parentElement.dataset.heat=String(Math.min(4,Math.floor(potValue/Math.max(B,1))));
            potEl.classList.remove("surge");
            requestAnimationFrame(()=>potEl.classList.add("surge"));
        }
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
            `<article class="h-seat pos-${i} ${i === actor && (phase === "act" || phase === "cpu") ? "acting" : ""} ${p.folded ? "folded" : ""} ${show && !p.folded ? "showing" : ""}"><div class="avatar">${i + 1}</div><header><b>${p.name}</b><span>${i === dealer ? "D " : ""}${i === sb ? "SB " : ""}${i === bb ? "BB" : ""}</span></header><div class="seat-bank"><span class="mini-chip chip-c${i % 4}"></span><strong>${p.chips}</strong></div><small>${p.last}</small><div class="status-strip">${statusMarkup(p,street)}</div><div class="seat-mods">${p.mods.map((m) => `<i class="${m.cat}" title="${m.name}">${m.icon}</i>`).join("")}</div><div class="tiny-cards">${show && !p.folded ? p.hole.map((c, j) => card(c, j)).join("") : p.hole.map((c, j) => p.exposed && j === 0 ? card(c,j) : card(null, j, true)).join("")}</div></article>`,
        ).join("");
        const actionPlayer = P[actor] || P[0];
        const viewer = mode === "solo" ? P[0] : actionPlayer;
        const canAct = phase === "act" && actionPlayer?.human && !manualResolving;
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
        $("#active-name").textContent = `${viewer?.name || "あなた"} の手札`;
        $("#viewer-status").innerHTML=viewer?statusMarkup(viewer,street):"";
        $("#turn-info").textContent = phase === "showdown" ?
            "CARDS REVEALED" :
            phase === "won" ?
            (viewer?.handWon?"HAND WON / RARE REWARD":"HAND LOST / COMMON REWARD") :
            phase === "transition" ?
            "RESOLVING..." :
            `${actionPlayer?.name || "TABLE"} TO ACT`;
        let due = Math.max(0, currentBet - (actionPlayer?.bet || 0));
        $(".active-pod").dataset.active = String(canAct);
        $(".active-pod").dataset.viewer=String(viewer?.id??0);
        const opponents=P.filter(p=>p.id!==viewer?.id);
        const orbit={1:[[50,22]],2:[[25,28],[75,28]],3:[[14,52],[50,22],[86,52]],4:[[12,58],[32,24],[68,24],[88,58]],5:[[11,60],[25,28],[50,19],[75,28],[89,60]]}[opponents.length]||[];
        document.querySelectorAll(".h-seat").forEach((seat, i) => {
            seat.hidden = i === viewer?.id;
            const at=opponents.findIndex(p=>p.id===i),pos=orbit[at];
            if(pos){seat.style.setProperty("--seat-x",pos[0]+"%");seat.style.setProperty("--seat-y",pos[1]+"%");}
        });
        $("#checkcall").innerHTML = due ?
            `CALL <small>${Math.min(due, actionPlayer.chips)}</small>` :
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
        const locked=canAct && actionPlayer.silenced && street==="pre";
        ["raise","minus","plus"].forEach(id=>$("#"+id).disabled=!canAct || locked);
        $("#allin").disabled=!canAct || (locked && actionPlayer.chips>due);
        if(locked) $("#turn-info").textContent="あなたの番 / この回の増額は禁止";
        let rank =
            (phase === "showdown" || (!viewer?.fogged && viewer?.mods.some((m) => m.id === "scan"))) && board.length >= 3 ?
            handRank(viewer).name :
            "—";
        $("#hand-name").textContent = rank;
        const data=viewer && canSee?Rogue.readout(viewer,{players:P,due:Math.max(0,currentBet-viewer.bet),pot:pot(),handName:rank!=="—"?rank:null,nextBlinds:LEVELS[level+1]?.join("/"),untilLevel:2-(handNo-1)%2}):[];
        $("#module-readout").textContent=data.join(" / ") || "NO MODULE DATA";
        $("#module-tray").innerHTML=viewer?.mods.length?viewer.mods.map(m=>{
            const ready=m.manual&&canAct&&viewer===actionPlayer&&Rogue.manualReady(m,effectContext(),viewer),used=viewer.used?.['manual:'+m.id];
            const state=m.manual?(used?"USED":ready?"USE":"WAIT"):(viewer.fired?.[m.id]?"✓":"AUTO");
            return `<button class="mod-chip ${m.cat} ${m.manual?"manual":"auto"} ${ready?"ready":""} ${used?"spent":""}" data-module="${m.id}" title="${m.desc}"><b>${m.icon}</b>${m.name}<span>${state}</span></button>`;
        }).join(""):`<span class="empty">能力40種類 / 勝つとレア・伝説、負けても通常能力</span>`;
        if(data.length) $("#module-tray").insertAdjacentHTML("afterbegin",`<span class="live-readout">${data.join(" · ")}</span>`);
        $("#module-tray").querySelectorAll("button").forEach(b=>b.onclick=()=>{
            const m=mods.find(m=>m.id===b.dataset.module);
            if(m.manual){openTargetPicker(m,viewer);return;}
            $("#effect-receipt").innerHTML=`<b>${m.name} / ${Rogue.tiers[m.tier]}</b><span>${m.desc}</span><span>${viewer.fired?.[m.id]||"条件成立時に自動発動"}${m.cat==="info"?" / "+(data.join(" · ")||"待機中"):""}</span>`;
        });
        ["pre", "flop", "turn", "river"].forEach((s) =>
            $("#s-" + s)?.classList.toggle("on", street === s),
        );
        const phaseName=({pre:"手札で勝負",flop:"場札3枚",turn:"場札4枚",river:"最後の場札",showdown:"カードを公開"})[street]||"";
        const whose=actionPlayer?.name||"";
        const heading=phase==="act"||phase==="cpu"||phase==="pass"?`${whose} の番`:phase==="transition"?"アクションの結果":phase==="draft"?"能力を選んでください":"今回の勝負の結果";
        const instruction=phase==="act"?(locked?"増額を止められています。CHECK / CALL / FOLDから選ぼう。":due?`続けるには${Math.min(due,actionPlayer.chips)}枚。CALLで続行、RAISEで増額、FOLDで降ります。`:"CHECKは追加0枚。RAISEならチップを追加して勝負できます。"):phase==="cpu"?`${whose} が考えています。操作せずに待ってください。`:phase==="pass"?"その人に端末を渡してから、手札を開いてください。":phase==="transition"?(lastActionText||"カードを配っています。自分の番までお待ちください。"):"勝敗と報酬を確認しましょう。";
        $("#turn-banner").innerHTML=`<strong>${heading}</strong><span>${instruction}</span>`;
        $("#turn-banner").dataset.your=String(canAct);
        $("#turn-info").textContent=heading;
        $("#table-msg").textContent=`第${handNo}回 / ${phaseName}`;
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
            guide.innerHTML = `<b>相手の番</b><span>${actionPlayer.name} が考えています。</span>`;
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
    $("#sound-toggle").onclick = () => {
        if (!soundEngine) {
            $("#sound-toggle").textContent = "SOUND unavailable";
            return;
        }
        soundEnabled = soundEngine.setEnabled(!soundEnabled);
        $("#sound-toggle").textContent = soundEnabled ? "SOUND ON" : "SOUND OFF";
        $("#sound-toggle").setAttribute("aria-pressed", String(soundEnabled));
        if (soundEnabled) cue("action");
    };
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
    $("#cancel-target").onclick=closeTargetPicker;
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
        if (phase === "draft" && deadline > 0) {
            let s = Math.max(0, Math.ceil((deadline - t) / 1000));
            $("#draft-time").textContent = s;
            if (!s) choose(mainWinner, 0);
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();
