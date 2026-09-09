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
        // 6回戦しかないので、参加額は一気に上げる。最後の2回はスタックの過半が
        // 毎回動く額になり、放っておいても決着がつく。
        LEVELS = [
            [250, 500],
            [500, 1000],
            [1000, 2000],
            [2000, 4000],
            [3500, 7000],
            [6000, 12000],
        ],
        // 1ランの既定の長さ。実際の長さはセットアップで選ぶ（maxHands）。
        DEFAULT_HANDS = 6,
        // 卓は1つ。参加額だけが上がっていく。
        // 卓はひとつ。段が上がるたびに参加額が上がり、BACK ROOM が開く。

        SHOP_PRICE = { 1: 700, 2: 1500, 3: 2800 },
        REROLL_COSTS = [400, 800, 1600],
        SCRAP_STEP = 0.08,
        SCRAP_MAX = 5,
        // Slots are the second cost. Without a ceiling a build is just an accumulation.
        SLOT_BASE = 5,
        CPU_SLOTS = 5,
        // 持ち時間。考え込んで止まらないように、能力60秒・行動30秒で切る。
        DRAFT_SECONDS = 60,
        ACT_SECONDS = 30,
        SLOT_BONUS_LEVELS = [2],
        // Information and chip drip are capped so a run cannot armour itself into safety.
        CATEGORY_CAP = { info: 3, guard: 4 },
        // 連勝はそのままチップに変わる。2連勝で+25%、5連勝で+100%(頭打ち)。
        // ラン側だけの増幅装置なので、卓のCPUには乗らない。
        CHAIN_STEP = 0.25,
        CHAIN_MAX = 4,
        // Tier odds per floor about to be entered — commons thin out as the run deepens.
        TIER_WEIGHTS = [
            [60, 35, 5], [60, 35, 5], [30, 50, 20], [30, 50, 20],
            [30, 50, 20], [10, 50, 40], [10, 50, 40], [10, 50, 40],
        ],
        // 補助でチップが湧かなくなったぶん、最初の厚みで受ける
        START_CHIPS = 7500;
    let maxHands = DEFAULT_HANDS,
        handsPerLevel = 2,
        mode = "solo",
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
        run = null,
        offers = [],
        deadline = 0,
        mainWinner = null,
        lastHoleKey = null,
        riverHold = false,
        potHold = 0,
        lastRoleKey = null, lastRoleHand = -1, lastRoleStep = -1,
        lastHoleCards = [],
        lastHoleHand = -1,
        lastBoardKey = null,
        logs = [],
        fxQueue = [],
        fxBusy = false,
        actionPopTimer = 0,
        actDeadline = 0,
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
    let soundEnabled = true;
    function cue(kind, level = 0) {
        if (!soundEnabled || !soundEngine) return false;
        const played=soundEngine.play(kind, level);
        const patterns={raise:18,allin:[24,35,70],attack:[16,28],chaos:[12,25,12],reward:[12,22],win:[18,35,18,60],defeat:28};
        if(played&&patterns[kind]&&navigator.vibrate)navigator.vibrate(patterns[kind]);
        return played;
    }
    function impact(kind) {
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const band = $(".rail");
        if (!band) return;
        // 一段だけの反転。曲線もフェードも使わない。
        band.classList.remove("hit", "hit-win");
        void band.offsetWidth;
        band.classList.add(kind === "win" ? "hit-win" : "hit");
        setTimeout(() => band.classList.remove("hit", "hit-win"), kind === "win" ? 420 : 180);
    }
    // 演出の語彙。普段は罫だけが動き、**報酬の瞬間にだけ大きさと色が出る**。
    // sshhooggii と同じ作りで、静けさが打点を立たせる。
    const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seatNode = (p) => (p && p.id === Number($(".active-pod").dataset.viewer) ? $(".active-pod") : $(`.pos-${p?.id}`));

    function popAt(node, text, tier = "mid") {
        if (!node || reduced()) return;
        const area = $(".game").getBoundingClientRect(), b = node.getBoundingClientRect();
        const el = document.createElement("b");
        el.className = `pop ${tier}`;
        el.textContent = text;
        el.style.cssText = `--x:${b.x + b.width / 2 - area.x}px;--y:${b.y + b.height / 2 - area.y}px`;
        $("#burst").append(el);
        setTimeout(() => el.remove(), 1700);
    }

    // 卓の中央に刻む一語。役名や到達はこれで殴る。
    // 勝った席は一拍だけ反転する。誰が取ったかが一目で分かる。
    // 負けた側にも一拍。勝ちだけ動くと勝ちも軽くなる。
    function markLoser(p) {
        const node = seatNode(p);
        if (!node) return;
        node.classList.add("lostbeat");
        setTimeout(() => node.classList.remove("lostbeat"), 900);
    }

    function markWinner(p) {
        const node = seatNode(p);
        if (!node) return;
        node.classList.add("won");
        setTimeout(() => node.classList.remove("won"), 1200);
    }

    // 卓ごと揺らす。使いどころを絞らないと、ただの読みにくい画面になる。
    let shakeTimer = 0;
    function shake(power = "soft") {
        if (reduced()) return;
        const el = $(".console");
        el.dataset.shake = power;
        clearTimeout(shakeTimer);
        shakeTimer = setTimeout(() => delete el.dataset.shake, power === "hard" ? 520 : 320);
    }

    function stamp(text, tier = "mid", delay = 0) {
        if (reduced()) return;
        setTimeout(() => {
            const el = document.createElement("b");
            el.className = `stamp ${tier}`;
            el.textContent = text;
            $("#burst").append(el);
            setTimeout(() => el.remove(), 1900);
        }, delay);
    }

    // 増えた数は「増えていること」が読めるよう直線で数え上げる。
    function odometer(el, value, format = (n) => n.toLocaleString("ja-JP")) {
        if (!el) return;
        const from = Number(el.dataset.value ?? NaN);
        el.dataset.value = String(value);
        if (!Number.isFinite(from) || from === value || reduced()) { el.textContent = format(value); return; }
        el.classList.add("counting");
        const t0 = performance.now(), span = Math.min(760, 260 + Math.abs(value - from) * 0.6);
        const tick = (t) => {
            const k = Math.min(1, (t - t0) / span);
            el.textContent = format(Math.round(from + (value - from) * k));
            if (k < 1) requestAnimationFrame(tick);
            else el.classList.remove("counting");
        };
        requestAnimationFrame(tick);
    }

    // 打点の段。役・ポットの大きさ・連勝のどれかが伸びると一段上がる。
    const TIER_LEVEL = { mid: 0, big: 3, huge: 6 };
    const BIG_HANDS = ["STRAIGHT", "FLUSH", "FULL HOUSE", "FOUR", "STRAIGHT FLUSH", "ROYAL FLUSH", "FIVE OF A KIND"];
    const HUGE_HANDS = ["FOUR", "STRAIGHT FLUSH", "ROYAL FLUSH", "FIVE OF A KIND"];
    function winTier(p, amount, rankName) {
        const share = amount / Math.max(1, p.startChips || 1), chain = p.streak || 0;
        if (share >= 1 || chain >= 3 || HUGE_HANDS.includes(rankName)) return "huge";
        if (share >= 0.5 || chain >= 2 || BIG_HANDS.includes(rankName)) return "big";
        return "mid";
    }

    // チップもドット絵。縁の切り欠きと中心の抜きが実物と同じ役割をする。
    const CHIP_SVG = '<svg viewBox="0 0 13 13" aria-hidden="true"><rect x="4" y="0" width="5" height="1"/><rect x="2" y="1" width="4" height="1"/><rect x="7" y="1" width="4" height="1"/><rect x="1" y="2" width="2" height="1"/><rect x="4" y="2" width="5" height="1"/><rect x="10" y="2" width="2" height="1"/><rect x="0" y="3" width="13" height="1"/><rect x="0" y="4" width="4" height="1"/><rect x="9" y="4" width="4" height="1"/><rect x="0" y="5" width="4" height="1"/><rect x="5" y="5" width="3" height="1"/><rect x="9" y="5" width="4" height="1"/><rect x="0" y="6" width="1" height="1"/><rect x="2" y="6" width="2" height="1"/><rect x="5" y="6" width="3" height="1"/><rect x="9" y="6" width="2" height="1"/><rect x="12" y="6" width="1" height="1"/><rect x="0" y="7" width="4" height="1"/><rect x="5" y="7" width="3" height="1"/><rect x="9" y="7" width="4" height="1"/><rect x="0" y="8" width="4" height="1"/><rect x="9" y="8" width="4" height="1"/><rect x="0" y="9" width="13" height="1"/><rect x="1" y="10" width="2" height="1"/><rect x="4" y="10" width="5" height="1"/><rect x="10" y="10" width="2" height="1"/><rect x="2" y="11" width="4" height="1"/><rect x="7" y="11" width="4" height="1"/><rect x="4" y="12" width="5" height="1"/></svg>';
    // 額に応じて色を変える。実際のカジノと同じで、色が単位を語る。
    const chipTone = (units) => units >= 8 ? "chip-hi" : units >= 3 ? "chip-mid" : units >= 1 ? "chip-low" : "chip-min";

    // 出した額はチップで見せる。CHECK は卓を叩く印だけを置く。
    function flyChips(player, spent = 0) {
        if (!player || reduced()) return;
        const area = $(".game").getBoundingClientRect();
        const from = (player.human ? $("#viewer-chips") : $(`.pos-${player.id} .seat-bank`))?.getBoundingClientRect();
        if (!from) return;
        const x = from.x + from.width / 2 - area.x, y = from.y + from.height / 2 - area.y;
        if (!spent) {
            const tap = document.createElement("i");
            tap.className = "table-tap";
            tap.style.cssText = `--x:${x}px;--y:${y}px`;
            $("#chip-flight").append(tap);
            setTimeout(() => tap.remove(), 420);
            return;
        }
        const target = $("#pot").getBoundingClientRect();
        const bb = Math.max(1, blindSpec()[1]);
        const units = spent / bb;
        const count = Math.max(2, Math.min(9, Math.round(units) + 1));
        const tone = chipTone(units);
        for (let i = 0; i < count; i++) {
            const chip = document.createElement("i");
            chip.className = `chip ${tone}`;
            chip.innerHTML = CHIP_SVG;
            chip.style.cssText = `--x:${x + (i % 3 - 1) * 7}px;--y:${y + Math.floor(i / 3) * 5}px;` +
                `--dx:${target.x + target.width / 2 - area.x - x}px;--dy:${target.y + target.height / 2 - area.y - y}px;--d:${i * 45}ms`;
            $("#chip-flight").append(chip);
            setTimeout(() => chip.remove(), 900 + i * 45);
        }
    }

    // 決着の一発。卓じゅうのチップが勝者の席に集まる。
    function chipRain(winner) {
        if (!winner || reduced()) return;
        const area = $(".game").getBoundingClientRect();
        const node = winner.human ? $("#viewer-chips") : $(`.pos-${winner.id} .seat-bank`);
        const goal = node?.getBoundingClientRect();
        // 席が見つからなくても降らせる。決着の一発を席の有無で落とさない。
        const tx = goal ? goal.x + goal.width / 2 - area.x : area.width / 2;
        const ty = goal ? goal.y + goal.height / 2 - area.y : area.height * 0.45;
        for (let i = 0; i < 34; i++) {
            const chip = document.createElement("i");
            chip.className = `chip rain chip-${["low", "mid", "hi"][i % 3]}`;
            chip.innerHTML = CHIP_SVG;
            const x = area.width * (0.08 + Math.random() * 0.84), y = -20 - Math.random() * 120;
            chip.style.cssText = `--x:${x}px;--y:${y}px;--dx:${tx - x}px;--dy:${ty - y}px;--d:${i * 34}ms`;
            $("#chip-flight").append(chip);
            setTimeout(() => chip.remove(), 1500 + i * 34);
        }
    }

    // 撃った先を線で結ぶ。系統の色で、steps で一気に伸ばす。
    function beam(from, to, cat) {
        if (!from || !to || from === to || reduced()) return;
        const area = $(".game").getBoundingClientRect();
        const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
        const x = a.x + a.width / 2 - area.x, y = a.y + a.height / 2 - area.y;
        const tx = b.x + b.width / 2 - area.x, ty = b.y + b.height / 2 - area.y;
        const el = document.createElement("i");
        el.className = `beam ${cat}`;
        el.style.cssText = `--x:${x}px;--y:${y}px;--len:${Math.hypot(tx - x, ty - y)}px;--angle:${Math.atan2(ty - y, tx - x)}rad`;
        $("#burst").append(el);
        setTimeout(() => el.remove(), 620);
        const hit = document.createElement("i");
        hit.className = `beam-hit ${cat}`;
        hit.style.cssText = `--x:${tx}px;--y:${ty}px`;
        $("#burst").append(hit);
        setTimeout(() => hit.remove(), 620);
    }

    let signalTimer = 0;
    function clearSignals() {
        document.querySelectorAll(".targeted,.fired,.casting,.debuff-hit,.buff-hit,.board-hit")
            .forEach(n => n.classList.remove("targeted", "fired", "casting", "debuff-hit", "buff-hit", "board-hit", "info", "attack", "guard", "chaos"));
    }
    function abilitySignal(effect) {
        const pod = $(".active-pod"), viewer = Number(pod.dataset.viewer);
        const node = id => id === viewer ? pod : $(`.pos-${id}`);
        const source = node(effect.owner);
        const target = effect.scope === "board" ? $("#board") : node(effect.target);
        source?.classList.add("casting", effect.cat);
        target?.classList.add("targeted", effect.cat, effect.scope === "board" ? "board-hit" : effect.cat === "attack" ? "debuff-hit" : "buff-hit");
        beam(source, target, effect.cat);
        // 自分が撃たれたときは、手前のレールにも同じ色で受けた印を出す
        if (target === pod && effect.owner !== viewer) popAt(pod, `${effect.name} を受けた`, "mid");
        clearTimeout(signalTimer);
        signalTimer = setTimeout(clearSignals, 1100);
    }

    const mods = Rogue.catalog;
    let rewardQueue = [], rewardOwner = null, roundWinners=[], lastActionText="", localNames=[], rewardWon=false, draftRerolls=0, draftLocked=false, draftStart=false, draftReplacing=null;
    function rewardChoices(pool,won,previous=[]) {
        const fresh=pool.filter(m=>!previous.includes(m.id));
        const ordered=[...fresh,...pool.filter(m=>previous.includes(m.id))];
        const selected=ordered.slice(0,3);
        const legendary=ordered.find(m=>m.tier===3);
        if(won&&legendary&&!selected.some(m=>m.tier===3))selected[selected.length-1]=legendary;
        return selected;
    }
    const safeName=(value,i)=>String(value||"").replace(/[^\p{L}\p{N} _ー・-]/gu,"").trim().slice(0,12)||`プレイヤー${i+1}`;
    const japaneseNumber=n=>{const d=["","一","二","三","四","五","六","七","八","九"];if(n<10)return d[n];if(n<100)return (n<20?"":d[Math.floor(n/10)])+"十"+d[n%10];return String(n)};
    const handLabel=n=>`第${japaneseNumber(n)}回`;
    const ROLE_ORDER = ["HIGH CARD","ONE PAIR","TWO PAIR","THREE","STRAIGHT","FLUSH","FULL HOUSE","FOUR","STRAIGHT FLUSH","ROYAL FLUSH","FIVE OF A KIND"];
    const roleName = name => ({"HIGH CARD":"ハイカード","ONE PAIR":"ワンペア","TWO PAIR":"ツーペア","THREE":"スリーカード","STRAIGHT":"ストレート","FLUSH":"フラッシュ","FULL HOUSE":"フルハウス","FOUR":"フォーカード","STRAIGHT FLUSH":"ストレートフラッシュ","ROYAL FLUSH":"ロイヤルフラッシュ","FIVE OF A KIND":"ファイブカード"})[name]||name;
    /* ── ローカル通信。中継サーバを置かず、合図コードを一度貼るだけで直につなぐ ──
       ホストが盤を持ち（権威）、ゲストは受け取った状態を映して入力だけ返す。
       同じ配りを二台で走らせる方式（ロックステップ）は、演出の有無や端末差で
       乱数の消費がずれた瞬間に卓が割れるので採らない。 */
    const link = { role: null, session: null, myId: 0, ready: false, myName: "", theirName: "" };
    const online = () => mode === "online";
    const isHost = () => link.role === "host";
    const remoteSeat = 1;

    function linkState(text) { $("#link-state").textContent = text; $("#room-state").textContent = text; }

    // 合言葉で合流する。同じ言葉を入れた2台が、公開ブローカー越しに直結する。
    async function joinByWord(asHost) {
        const code = $("#room-code").value.trim();
        if (!code) { linkState("合言葉を入れてください"); return; }
        link.role = asHost ? "host" : "guest";
        link.myId = asHost ? 0 : remoteSeat;
        $("#room-open").disabled = $("#room-join").disabled = true;
        linkState(asHost ? `「${code}」で相手を待っています` : `「${code}」につないでいます`);
        try {
            const session = await Net.room(code, asHost);
            link.session = session;
            session.onmessage = onNetMessage;
            session.onclose = () => { link.ready = false; linkState("接続が切れました"); netLost(); };
            session.onopen = () => {
                link.ready = true;
                linkState(`つながりました${link.theirName ? `（相手: ${link.theirName}）` : ""}`);
                if (asHost) $("#start").disabled = false;
                sayHello();
            };
            if (!asHost && session.open()) session.onopen();
            if (asHost) linkState(`「${code}」で相手を待っています`);
        } catch (e) {
            const why = String(e && e.message || e);
            linkState(
                why === "room-taken" ? "その合言葉は相手が開いています。「合言葉で入る」を押してください" :
                why === "no-host" ? "その合言葉の卓が見つかりません。相手が先に開いてください" :
                why === "peerjs-missing" ? "回線が使えません。下の合図コードでつないでください" :
                "つながりませんでした。合言葉と回線を確かめてください");
            $("#room-open").disabled = $("#room-join").disabled = false;
        }
    }
    $("#room-open").onclick = () => joinByWord(true);
    $("#room-join").onclick = () => joinByWord(false);
    $("#room-code").addEventListener("keydown", (e) => { if (e.key === "Enter") joinByWord(false); });
    function showLinkStep(copy) {
        $("#link-step").classList.remove("hidden");
        $("#link-copy").textContent = copy;
    }
    async function startHostLink() {
        link.role = "host";
        showLinkStep("この端末が卓を持ちます。下のコードを相手に渡し、返ってきたコードを貼ってください。");
        $("#link-out-label").textContent = "① あなたの合図コード（相手に渡す）";
        $("#link-in-label").textContent = "② 相手から返ってきたコードを貼る";
        linkState("コードを作成中");
        try {
            const session = await Net.host();
            link.session = session;
            $("#link-out").value = session.code;
            linkState("相手のコード待ち");
            session.onopen = () => { link.ready = true; linkState("接続できました"); $("#start").disabled = false; sayHello(); };
            session.onclose = () => { link.ready = false; linkState("切断されました"); netLost(); };
            session.onmessage = onNetMessage;
        } catch (e) { linkState("作成に失敗しました"); }
    }
    async function startGuestLink() {
        link.role = "guest";
        link.myId = remoteSeat;
        showLinkStep("相手のコードを貼って「つなぐ」を押すと、返すコードが出ます。それを相手に渡してください。");
        $("#link-out-label").textContent = "② あなたが返すコード（相手に渡す）";
        $("#link-in-label").textContent = "① 相手の合図コードを貼る";
        $("#link-out").value = "";
        linkState("コード待ち");
        $("#start").disabled = true;
    }
    async function applyLinkCode() {
        const code = $("#link-in").value.trim();
        if (!code) { linkState("コードが空です"); return; }
        try {
            if (isHost()) {
                if (!link.session) return;
                await link.session.accept(code);
                linkState("接続中");
            } else {
                const session = await Net.join(code);
                link.session = session;
                $("#link-out").value = session.code;
                linkState("返すコードを相手に渡してください");
                session.onopen = () => { link.ready = true; linkState("接続できました。相手の開始を待ちます"); sayHello(); };
                session.onclose = () => { link.ready = false; linkState("切断されました"); netLost(); };
                session.onmessage = onNetMessage;
            }
        } catch (e) { linkState("コードを読めませんでした"); }
    }
    // 横持ちのすすめ。縦でも遊べるようにしてあるので、断れる形にしておく。
    $("#rotate-stay").onclick = () => { document.body.dataset.rotateOk = "1"; };
    $("#be-host").onclick = startHostLink;
    $("#be-guest").onclick = startGuestLink;
    $("#link-apply").onclick = applyLinkCode;
    $("#link-copy-btn").onclick = () => {
        const box = $("#link-out");
        box.select?.();
        navigator.clipboard?.writeText(box.value).then(() => linkState("コピーしました"), () => linkState("手で選んでコピーしてください"));
    };

    const netSend = (obj) => { if (link.session && link.session.open()) link.session.send(obj); };
    const myName = () => safeName($("#my-name").value, isHost() ? 0 : remoteSeat);
    function sayHello() {
        link.myName = myName();
        netSend({ t: "hello", name: link.myName });
        if (isHost() && P.length) { P[0].name = link.myName; render(); }
    }
    // 相手が消えても卓を黙って止めない。何が起きたかは必ず言う。
    function netLost() {
        if (!online() || $("#setup").classList.contains("hidden") === false) return;
        $("#message").textContent = "接続が切れました";
        pushLog("接続が切れました。ページを開き直してください。", "attack");
        announce("LINK LOST", "接続が切れました", "相手の端末とつながらなくなりました。開き直してつなぎ直してください。", "attack", 2600);
    }

    function nameFields(){
        const el=$("#local-names"); const chosen=$("#mode").value, local=chosen==="local";
        el.classList.toggle("hidden",!local);
        $("#link-panel").classList.toggle("hidden",chosen!=="online");
        $("#count").closest("label").classList.toggle("hidden",chosen==="solo");
        const countLabel = $("#count").closest("label"), roundLabel = $("#rounds").closest("label");
        if (countLabel && countLabel.firstChild) countLabel.firstChild.nodeValue = chosen==="online" ? "02 / テーブル人数（あなた ＋ 相手 ＋ 空席の相手）" : "02 / テーブル人数";
        // 人数の欄はソロで畳むので、番号が飛ばないように振り直す
        if (roundLabel && roundLabel.firstChild) roundLabel.firstChild.nodeValue = chosen==="solo" ? "02 / 回戦数" : "03 / 回戦数";
        $("#start").disabled = chosen==="online" && !(link.session && link.session.open());
        el.innerHTML=Array.from({length:+$("#count").value},(_,i)=>`<label>${i+1}人目<input id="player-name-${i}" maxlength="12" aria-label="${i+1}人目の名前" value="${safeName(localNames[i],i)}"></label>`).join("");
        el.querySelectorAll("input").forEach((input,i)=>input.addEventListener("input",()=>localNames[i]=input.value));
    }
    $("#mode").addEventListener("change",nameFields);$("#count").addEventListener("change",nameFields);nameFields();
    const blindSpec = () => LEVELS[Math.min(run ? run.level : level, LEVELS.length - 1)];
    const livingRivals = () => P.filter((p) => p.id !== 0 && !p.out && p.chips > 0);
    const tableLabel = () => `第${handNo}回戦 / 残り${livingRivals().length + 1}人`;

    // いまテーブル全体に掛かっている決まりごと。常に見えていないと分からなくなる。
    const SHARED_RULES = {
        doubleante: "毎回、全員が追加で参加費を払う（全員に影響）",
        pressure: "毎回、次の人が追加で参加費を払う",
        riverboost: "最後の場札が1つ強くなる（全員に影響）",
        suitveil: "撃たれた人はフラッシュを作れない",
        thirdhole: "手札が3枚ある",
        steady: "手札は書き換えられない",
        tollgate: "増額のたび通行料をとる",
        bedrock: "役はワンペアを下回らない",
        lastword: "手番がいちばん後ろ",
        pairforge: "手札が最初からペア",
        overheat: "手札のスートが揃っている",
        snowball: "連勝ぶんチップが増える",
        taxman: "勝つと全員から徴収される",
    };
    function activeRules() {
        const out = [];
        for (const p of P) {
            if (p.out || p.chips <= 0) continue;
            for (const m of p.mods) if (SHARED_RULES[m.id]) out.push({ who: p.name, text: SHARED_RULES[m.id], cat: m.cat, name: m.name });
        }
        return out;
    }
    function effectContext() { return {players:P, deck, board, street, bb:blindSpec()[1],events:[]}; }
    // 卓を横切る帯は**自分に関係するものだけ**に絞る。実測で1ハンド12枚出ていて、
    // 帯が直列に詰まるせいで肝心の妨害が読めなくなっていた。
    // 関係しないものは線（ビーム）と席の印とレシートだけで見せる。こちらは並列で詰まらない。
    const QUIET = new Set(["guard", "info"]);
    function concernsViewer(e) {
        if (mode !== "solo") return true;
        if (e.scope === "board") return true;
        return e.owner === 0 || e.target === 0;
    }
    // 守りが働いたことは、いちばん見落とされやすい。撃たれた側の席で緑の札を出し、
    // 自分のことなら卓の中央にも一語置く。何も起きなかったのと区別が付かないと、
    // 守りの札を持つ意味が読めない。
    const SHIELD = new Set(["deflect", "syn-guard2", "steady", "syn-guard3"]);
    function shieldSignal(e) {
        if (!SHIELD.has(e.id) && !/守られている/.test(e.copy || "")) return;
        const node = e.owner === 0 ? $(".active-pod") : $(`.pos-${e.owner}`);
        popAt(node, e.id === "deflect" ? "跳ね返した" : "防いだ", "guard");
        cue("guard", 4);
        if (e.owner === 0 || e.target === 0) {
            stamp(e.id === "deflect" ? "跳ね返した" : "防いだ", "big");
            const last = $("#burst").lastElementChild;
            if (last) last.classList.add("guard");
            shake("soft");
        }
    }

    function publishEffects(ctx) {
        for (const e of ctx.events) {
            shieldSignal(e);
            pushLog(`${e.ownerName} → ${e.targetName} / ${e.name} / ${e.copy}`, e.cat);
            const quiet = (QUIET.has(e.cat) && e.owner === e.target) || !concernsViewer(e);
            if (quiet) { showReceipt(e); abilitySignal(e); continue; }
            const spec=Rogue.catalog.find(m=>m.id===e.id);
            fxQueue.push({type:`${CAT[e.cat]}｜${spec?.manual?"手動":"自動"}`,title:e.name,copy:e.copy,kind:e.cat,duration:e.cat==="attack"?1750:1500,effect:e});
        }
        if (!fxBusy) playNextFx();
    }

    // 横が狭い機では側の段が畳まれる。相手の手の内は畳んではいけないので、
    // そのときだけ手前の帯に移して一行にする。
    const narrow = window.matchMedia("(max-width:1180px)");
    narrow.addEventListener?.("change", () => placeScout());
    function placeScout() {
        const el = $(".scout"), band = narrow.matches;
        const parent = band ? $(".active-pod") : $(".side-rail");
        if (el.parentElement !== parent) {
            if (band) parent.insertBefore(el, $("#rules-panel"));
            else parent.insertBefore(el, parent.firstElementChild);
        }
        el.classList.toggle("in-band", band);
    }
    /* ── 状態の同期。盤はホストが持ち、ゲストには「見せてよい形」に削って渡す ── */
    const SNAP = ["id","name","human","chips","bet","total","folded","allin","last","out","exposed",
        "tell","streak","payout","startChips","handWon","silenced","guardJammed","fogged","suitBlind","rebuyUsed"];
    function snapshotFor(id) {
        const reveal = phase === "showdown";
        return {
            t: "s", N, handNo, level, board, street, phase, actor, dealer, sb, bb,
            currentBet, minRaise, raiseTo, potHold, riverHold, lastActionText,
            peek: deck.length ? deck[deck.length - 1] : null,
            actLeft: actDeadline ? Math.max(0, Math.ceil((actDeadline - performance.now()) / 1000)) : 0,
            logs: logs.slice(0, 12),
            draft: draftPayload(),
            over: phase === "ended" ? { winner: $("#winner").textContent, copy: $("#result-copy").textContent } : null,
            result: phase === "round-result" ? {
                title: $("#round-title").textContent,
                summary: $("#round-summary").textContent,
                outcome: $("#round-result").dataset.outcome,
                streak: $("#round-result").dataset.streak,
            } : null,
            P: P.map((p) => {
                const o = {};
                SNAP.forEach((k) => (o[k] = p[k]));
                o.mods = p.mods.map((m) => m.id);
                o.fired = p.fired || {};
                o.used = p.used || {};
                o.rank = p.rank ? { name: p.rank.name, cat: p.rank.cat } : null;
                // 手札は本人と、公開されている分だけ。ゲストの画面に他人の札を送らない。
                o.hole = (p.id === id || reveal || p.exposed) ? p.hole : p.hole.map(() => ({ h: 1 }));
                return o;
            }),
        };
    }
    function draftPayload() {
        if (phase !== "draft" || !rewardOwner || !offers.length) return null;
        return {
            owner: rewardOwner.id, ownerName: rewardOwner.name,
            offers: offers.map((m) => m.id),
            title: $("#relic-title").textContent,
            copy: $("#relic-copy").textContent,
            eyebrow: $("#relic .eyebrow").textContent,
            time: $("#draft-time").textContent,
            reroll: $("#reroll-reward").textContent, rerollOff: $("#reroll-reward").disabled,
            skip: $("#skip-reward").textContent, skipOff: $("#skip-reward").disabled,
            owned: rewardOwner.mods.map((m) => m.id), cap: slotCap(),
            replacing: draftReplacing,
        };
    }
    function applySnapshot(s) {
        mode = "online"; run = null; N = s.N;
        P = s.P.map((p) => ({ ...p, mods: p.mods.map((id) => mods.find((m) => m.id === id)).filter(Boolean) }));
        board = s.board; street = s.street; actor = s.actor; dealer = s.dealer; sb = s.sb; bb = s.bb;
        currentBet = s.currentBet; minRaise = s.minRaise; raiseTo = s.raiseTo;
        handNo = s.handNo; level = s.level; potHold = s.potHold; riverHold = s.riverHold;
        lastActionText = s.lastActionText;
        deck = s.peek ? [s.peek] : [];
        actDeadline = s.actLeft && s.actor === link.myId ? performance.now() + s.actLeft * 1000 : 0;
        // ホストの「相手待ち」は、こちら側では自分の手番。逆にホストの手番中はこちらは動かせない。
        phase = s.phase === "await" ? (s.actor === link.myId ? "act" : "cpu")
            : s.phase === "act" ? (s.actor === link.myId ? "act" : "cpu") : s.phase;
        logs = s.logs || [];
        $("#action-log").innerHTML = logs.map((x) => `<span class="${x.kind}">${x.copy}</span>`).join("");
        document.body.dataset.players = String(N);
        $("#setup").classList.add("hidden");
        renderRemoteDraft(s.draft);
        renderRemoteResult(s.result);
        if (s.over) { $("#winner").textContent = s.over.winner; $("#result-copy").textContent = s.over.copy; $("#result").classList.remove("hidden"); }
        render(s.phase === "showdown");
    }
    // 勝敗の板もそのまま映す。押すのはホストなので、こちらは見るだけ。
    function renderRemoteResult(r) {
        if (!r) { $("#round-result").classList.add("hidden"); return; }
        $("#round-title").textContent = r.title;
        $("#round-summary").textContent = r.summary;
        $("#round-result").dataset.outcome = r.outcome || "";
        $("#round-result").dataset.streak = r.streak || "0";
        $("#to-rewards").innerHTML = "相手の合図を待っています";
        $("#to-rewards").disabled = true;
        $("#round-result").classList.remove("hidden");
    }
    function renderRemoteDraft(d) {
        if (!d) { $("#relic").classList.add("hidden"); return; }
        const mine = d.owner === link.myId;
        $("#relic-title").textContent = d.title;
        $("#relic-copy").textContent = mine ? d.copy : `${d.ownerName} が選んでいます。`;
        $("#relic .eyebrow").textContent = d.eyebrow;
        $("#draft-time").textContent = d.time;
        $("#relic-cards").innerHTML = d.offers.map((id, i) => offerMarkup(mods.find((m) => m.id === id), i)).join("");
        $("#relic-cards").querySelectorAll("button").forEach((b, i) => {
            b.disabled = !mine;
            b.onclick = () => netSend({ t: "pick", i });
        });
        $("#reroll-reward").textContent = d.reroll; $("#reroll-reward").disabled = !mine || d.rerollOff;
        $("#reroll-reward").onclick = () => netSend({ t: "reroll" });
        $("#skip-reward").textContent = d.skip; $("#skip-reward").disabled = !mine || d.skipOff;
        $("#skip-reward").onclick = () => netSend({ t: "skip" });
        // 満杯なら「どれを外すか」までゲスト側で選ばせる。ここを送らないと相手だけ棚を育てられない。
        const swapping = mine && d.replacing !== null && d.replacing !== undefined;
        const owned = d.owned.map((id) => mods.find((m) => m.id === id)).filter(Boolean);
        $("#relic-owned").innerHTML = !mine ? `<small>${d.ownerName} が選んでいます</small>` :
            swapping ?
                `<small>外す能力を選んでください</small>` +
                owned.map((m) => `<button class="owned-chip ${m.cat} swap" data-drop="${m.id}" title="${m.desc}"><b>${m.icon}</b>${m.name}<span>外す</span></button>`).join("") +
                `<button class="owned-chip cancel" data-cancel="1">選び直す</button>` :
            owned.length ? `<small>ラック ${owned.length} / ${d.cap}</small>` +
                owned.map((m) => `<button class="owned-chip ${m.cat}" disabled title="${m.desc}"><b>${m.icon}</b>${m.name}</button>`).join("") : "";
        $("#relic-owned").querySelectorAll("button").forEach((b) => b.onclick = () => {
            if (b.dataset.cancel) { netSend({ t: "cancel" }); return; }
            if (b.dataset.drop) netSend({ t: "drop", id: b.dataset.drop });
        });
        $("#relic").classList.remove("hidden");
    }
    function onNetMessage(msg) {
        if (msg.t === "hello") {
            link.theirName = safeName(msg.name, isHost() ? remoteSeat : 0);
            linkState(`つながりました（相手: ${link.theirName}）`);
            if (isHost() && P[remoteSeat]) { P[remoteSeat].name = link.theirName; render(); }
            return;
        }
        if (!isHost()) { if (msg.t === "s") applySnapshot(msg); return; }
        const p = P[remoteSeat];
        if (!p) return;
        if (msg.t === "act" && phase === "await" && actor === remoteSeat) {
            if (Number.isFinite(msg.raiseTo)) raiseTo = msg.raiseTo;
            phase = "act"; act(msg.a);
        } else if (msg.t === "use" && phase === "await" && actor === remoteSeat) {
            const m = p.mods.find((x) => x.id === msg.id);
            if (m) { phase = "act"; pendingModule = m; activateManual(msg.target); }
        } else if (phase === "draft" && rewardOwner === p) {
            if (msg.t === "pick") choose(p, msg.i);
            else if (msg.t === "drop" && draftReplacing !== null) installPick(p, draftReplacing, msg.id);
            else if (msg.t === "cancel") { draftReplacing = null; renderDraftOwned(); render(); }
            else if (msg.t === "reroll") $("#reroll-reward").onclick();
            else if (msg.t === "skip") $("#skip-reward").onclick();
        }
    }

    // 押して撃つ能力は使い切り。撃った時点で棚から外れ、枠がひとつ空く。
    function consume(p, m) {
        const i = p.mods.findIndex((x) => x.id === m.id);
        if (i < 0) return;
        if (Rogue.keepsCharge(p)) {
            pushLog(`${p.name} / 制圧で ${m.name} を温存`, "attack");
            if (p.human) { stamp("制圧 / 温存", "big"); cue("attack", 4); }
            return;
        }
        p.mods.splice(i, 1);
        pushLog(`${p.name} / ${m.name} を使い切った`, "chaos");
    }

    // 系統の重なりは「いま効いているもの」と「あと1枚で届くもの」を並べる。
    // 次に何を取ればいいかがその場で分かるほうが、組む気になる。
    function synergyMarkup(p) {
        if (!p) return "";
        const live = Rogue.synergies(p);
        const parts = live.map((s) =>
            `<i class="syn ${s.cat}" title="${s.copy}"><b>${s.name}</b>${CAT[s.cat]}×${s.n}</i>`);
        for (const cat of Object.keys(Rogue.SYNERGY)) {
            const held = Rogue.catCount(p, cat);
            const next = Rogue.SYNERGY[cat].find((x) => x.n === held + 1);
            if (next && held >= 1 && (CATEGORY_CAP[cat] === undefined || next.n <= CATEGORY_CAP[cat]))
                parts.push(`<i class="syn near ${cat}" title="${next.copy}"><b>あと1枚</b>${next.name}</i>`);
        }
        return parts.length ? `<span class="syn-rack">${parts.join("")}</span>` : "";
    }

    function renderScout(viewer) {
        const seated = P.filter((p) => p !== viewer && !(p.chips <= 0 && p.folded));
        const foes = seated.filter((p) => p.mods.length);
        $("#scout-note").textContent = foes.length ? `${foes.reduce((n, p) => n + p.mods.length, 0)}個` : "まだ無し";
        $("#scout-list").innerHTML = foes.map((p) => {
            const acting = P[actor] === p && (phase === "act" || phase === "cpu");
            const syn = Rogue.synergies(p);
            return `<div class="scout-row${acting ? " acting" : ""}${p.folded ? " folded" : ""}"><b>${p.name}</b>` +
                (syn.length ? `<em class="scout-syn">${syn.map((x) => `<i class="${x.cat}" title="${x.copy}">${x.name}</i>`).join("")}</em>` : "") +
                `<span>${p.mods.map((m) => `<i class="${m.cat}"${m.manual ? ' data-use="1"' : ""} title="${m.desc}">${m.name}</i>`).join("")}</span></div>`;
        }).join("");
    }

    function showReceipt(e) {
        const selfCast = e.owner === e.target && e.scope !== "board";
        $("#effect-receipt").className = `effect-receipt ${e.cat}`;
        $("#effect-receipt").innerHTML = `<header><em>${CAT[e.cat]}</em><b>${selfCast ? `${e.ownerName}（自分に）` : `${e.ownerName} → ${e.targetName}`}</b></header><strong>${e.name}</strong><span>${e.copy}</span>`;
    }
    function afterEffects(fn) { if(fxBusy || fxQueue.length) setTimeout(()=>afterEffects(fn),120); else fn(); }
    const CAT = {
        info: "ヒント",
        attack: "相手を妨害",
        guard: "守り",
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

    const noFlush = (r) => !/FLUSH/.test(r.name);
    function bestFive(p) {
        const cards = Rogue.rankCards(p, board);
        const hands = combos(cards, 5).map((c) => ({ c, r: rank5(c) }));
        const pool = p.suitBlind ? (hands.filter((h) => noFlush(h.r)).length ? hands.filter((h) => noFlush(h.r)) : hands) : hands;
        const best = pool.sort((a, b) => cmp(a.r, b.r)).at(-1);
        return best ? { ...best, r: floorRank(p, best.r) } : best;
    }
    // BEDROCK を持っている人は、ハイカードで終わらない。
    // 判定そのものを書き換えるので、卓のどこから見ても同じ役になる。
    function floorRank(p, r) {
        if (!r || !Rogue.floorsRank(p) || r.cat > 0) return r;
        return { ...r, cat: 1, name: "ONE PAIR", floored: true };
    }
    function handRank(p) { return bestFive(p).r; }

    function pushLog(copy, kind = "system") {
        logs.unshift({ copy, kind });
        logs = logs.slice(0, 12);
        const el = $("#action-log");
        if (el) el.innerHTML = logs.map((x) => `<span class="${x.kind}">${x.copy}</span>`).join("");
    }

    function announce(type, title, copy, kind = "system", duration = 1850) {
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
        $("#action-pop").classList.add("hidden");
        cue(item.kind);
        impact(item.kind);
        const el = $("#event-fx");
        el.className = `event-fx ${item.kind}`;
        $("#event-type").textContent = item.type;
        $("#event-title").textContent = item.title;
        $("#event-copy").textContent = item.copy;
        const route=$("#event-route");
        route.hidden=!item.effect;
        clearSignals();
        if(item.effect){
            const e=item.effect;
            el.classList.add("ability-hit", e.cat);
            el.dataset.category=e.cat;
            // 自分に効くものは矢印を出さない。「CPU 2 → CPU 2」は読めない。
            const selfCast = e.owner === e.target && e.scope !== "board";
            $("#effect-source").textContent = selfCast ? `${e.ownerName} が自分に` : e.ownerName;
            $("#effect-target").textContent = e.scope === "board" ? "場札ぜんぶ" : e.targetName;
            route.querySelector("i").hidden = selfCast;
            $("#effect-target").hidden = selfCast;
            abilitySignal(e);
            showReceipt(e);
            $(`.pos-${e.target}`)?.classList.add("targeted");
            $(`[data-module="${e.id}"]`)?.classList.add("fired");
        }else{
            delete el.dataset.category;
        }
        // 一度に何枚も出るときだけ縮める。1枚のときは読み切れる長さを保つ。
        // 詰まっているときでも 7割までしか縮めない。読めない告知は出していないのと同じ。
        const hold = fxQueue.length > 2 ? Math.round(item.duration * 0.72) : item.duration;
        setTimeout(() => {
            el.classList.add("out");
            setTimeout(() => {
                el.className = "event-fx hidden";
                fxBusy = false;
                if (!fxQueue.length) clearSignals();
                playNextFx();
            }, 200);
        }, hold);
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
        if(title==="ALL-IN") { stamp("ALL-IN","big"); shake("hard"); }
        requestAnimationFrame(() => el.classList.add("show"));
        actionPopTimer = setTimeout(() => {
            el.classList.remove("show");
            actionHideTimer = setTimeout(() => el.classList.add("hidden"), 320);
        }, 1200);
    }

    function seatPlayers(heroChips, heroMods) {
        const names = Array.from({ length: N }, (_, i) => safeName(localNames[i], i));
        P = Array.from({ length: N }, (_, i) => ({
            id: i,
            name: run ?
                (i === 0 ? "あなた" : `席${i + 1}`) :
                (mode === "solo" ? (i === 0 ? "あなた" : `席${i + 1}`) :
                    mode === "online" ? (i === 0 ? (link.myName || myName() || "ホスト")
                        : i === remoteSeat ? (link.theirName || "ゲスト") : `席${i + 1}`) :
                    names[i] + (names.filter((n) => n === names[i]).length > 1 ? ` (${i + 1})` : "")),
            human: mode === "local" || (mode === "online" && i <= remoteSeat) || i === 0,
            chips: i === 0 ? heroChips : START_CHIPS,
            bet: 0,
            total: 0,
            folded: false,
            allin: false,
            hole: [],
            mods: run && i === 0 ? heroMods : [],
            last: "準備",
            silenced: false,
            shieldUsed: false,
            rebuyUsed: false,
        }));
        document.body.dataset.players = String(N);
    }

    function init() {
        // ここは利用者のクリックなので、音の解錠にちょうどよい。
        if (soundEngine) {
            soundEnabled = soundEngine.setEnabled(soundEnabled);
            $("#sound-toggle").textContent = soundEnabled ? "音 オン" : "音 オフ";
            $("#sound-toggle").setAttribute("aria-pressed", String(soundEnabled));
        }
        setTheme(document.querySelector('input[name="theme"]:checked')?.value || "light");
        mode = $("#mode").value;
        maxHands = Math.max(1, +$("#rounds").value || DEFAULT_HANDS);
        // 参加額の段は「卓の長さを3等分」する。2回ごとに固定すると、長い卓ほど
        // 終盤の参加額が先に走ってしまい、選んだ回戦数まで持たない。
        handsPerLevel = Math.max(1, Math.round(maxHands / 3));
        run = mode === "solo" ? { level: 0, handInLevel: 0, scrap: 0, scrapApplied: 0, rerolls: 0, offers: [], replacing: null } : null;
        N = run ? 6 : Math.max(mode === "online" ? 2 : 2, +$("#count").value);
        if (mode === "online" && !isHost()) return;
        seatPlayers(START_CHIPS, []);
        $("#setup").classList.add("hidden");
        handNo = 0;
        dealer = -1;
        logs = [];
        if (run) {
            pushLog(`RUN START　6人卓・全${maxHands}回戦`, "system");
            announce("TABLE OPEN", "6人卓 / 全6回戦", "毎回1つ能力が配られます。最後にいちばん持っていた人の勝ち", "system", 1400);
        } else {
            pushLog("TOURNAMENT START", "system");
            announce("SYSTEM", "TABLE OPEN", `${N}人テーブル / 能力ドラフト有効`, "system", 820);
        }
        if (run) afterEffects(startDraft); else newHand();
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



    // 山分けの決着。6回戦を終えた時点でいちばん持っている人が勝ち。
    const chipLeader = () => active().slice().sort((a, b) => b.chips - a.chips)[0] || P[0];

    function newHand() {
        if (handNo >= maxHands) {
            const top = chipLeader();
            stamp(`${maxHands}回戦 終了`, "huge");
            if (run) runOver(top === P[0], top === P[0] ? `${maxHands}回戦を勝ち抜きました` : `${top.name} が最多チップでした`, top);
            else finish(top);
            return;
        }
        if (run) {
            if (P[0].chips <= 0) { runOver(false, "チップが尽きました"); return; }
            if (active().length === 1) {
                stamp("TABLE CLEARED", "huge");
                runOver(true, "卓の全員を飛ばしました");
                return;
            }
            if (run.handInLevel >= handsPerLevel) { openBackroom(); return; }
            run.handInLevel++;
        } else if (active().length === 1) {
            finish(active()[0]);
            return;
        }
        lastActionText="";
        handNo++;
        potHold = 0;
        $("#effect-receipt").innerHTML="";
        lastHoleKey = null;
        lastBoardKey = null;
        level = run ? run.level : Math.min(LEVELS.length - 1, Math.floor((handNo - 1) / handsPerLevel));
        let [S, B] = blindSpec();
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
            p.refundBase = 0;
            p.hole = p.folded ? [] : [deck.pop(), deck.pop()];
            p.last = p.folded ? "脱落" : "参加";
        });
        // 配布した素の手札を先に見せてから、書き換え系の能力を通す。
        // 同じ勝負の中で札が変わるので `.changed` が乗り、何をされたのかが見える。
        street = "pre";
        phase = "transition";
        render();
        if (reduced()) startBetting(S, B);
        else setTimeout(() => startBetting(S, B), 520);
    }

    function startBetting(S, B) {
        applyOpeningModules();
        if (active().length >= 3) payAnte(P[bb], B);
        pay(P[sb], S);
        pay(P[bb], B);
        currentBet = P[bb].bet;
        minRaise = B;
        raiseTo = currentBet + minRaise;
        pending = new Set(
            live()
            .filter((p) => !p.allin)
            .map((p) => p.id),
        );
        actor = next(bb, (p) => pending.has(p.id));
        actor = deferLast(actor);
        phase = "act";
        const label = run ? tableLabel() : handLabel(handNo);
        pushLog(`${label} / PRE-FLOP`, "street");
        showActor(true);
        render();
    }

    // LAST WORD — 手番を後ろに回す。相手を見てから決められるのがポジションの価値。
    function deferLast(from) {
        const waiting = [...pending];
        if (waiting.length < 2 || !P[from]?.lastAct) return from;
        const other = next(from, (p) => pending.has(p.id) && !p.lastAct);
        return pending.has(P[other]?.id) ? other : from;
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
            setTimeout(cpu, 380);
            return;
        }
        if (online()) {
            if (p.id === remoteSeat) { phase = "await"; actDeadline = performance.now() + ACT_SECONDS * 1000; render(); }
            else { phase = "act"; actDeadline = performance.now() + ACT_SECONDS * 1000; render(); }
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
            actDeadline = performance.now() + ACT_SECONDS * 1000;
            render();
        }
    }

    function act(type) {
        if (online() && !isHost()) {
            if (phase !== "act" || actor !== link.myId) return;
            netSend({ t: "act", a: type, raiseTo });
            phase = "cpu"; render();
            return;
        }
        if ((phase !== "act" && phase !== "cpu") || manualResolving) return;
        actDeadline = 0;
        let p = P[actor],
            beforeChips = p.chips,
            due = Math.max(0, currentBet - p.bet);
        if (p.silenced && street === "pre" && (type === "raise" || (type === "allin" && p.chips > due))) return;
        if (type === "fold") {
            p.folded = true;
            p.last = "降りた";
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
        const kind = type === "allin" ? "attack" : type === "raise" ? "raise" : "action";
        pushLog(`${p.name} / ${p.last}`, kind);
        const spent=Math.max(0,beforeChips-p.chips);
        if (type !== "fold") flyChips(p, spent);
        const actionDescriptions={fold:"勝負から降りました",check:"追加のチップなしで続けました",call:`${Math.min(due,beforeChips)}枚を出して続けました`,raise:`合計${p.bet}枚に増額しました`,allin:`残りのチップをすべて賭けました`};
        lastActionText=`${p.name}が${actionDescriptions[type]}。所持 ${beforeChips} → ${p.chips}枚`;
        pushLog(lastActionText,kind);
        flashAction(p.last,p.name,kind);
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
        }, 340);
    }

    function advance() {
        if (street === "river") {
            phase = "transition";
            render();
            afterEffects(showdown);
            return;
        }
        P.forEach((p) => (p.bet = 0));
        currentBet = 0;
        minRaise = blindSpec()[1];
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
            // 最後の1枚は一拍おいてから開く。来るかもしれない時間が要る。
            if (!reduced()) {
                riverHold = true;
                cue("street");
                setTimeout(() => { riverHold = false; render(); }, 620);
            }
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
            afterEffects(advance);
            return;
        }
        actor = next(dealer, (p) => pending.has(p.id));
        raiseTo = minRaise;
        phase = "transition";
        render();
        pushLog(`${street.toUpperCase()} OPEN`, "street");
        setTimeout(() => showActor(true), 520);
    }

    // Pre-flop hands are scored on the same 0–9 scale as a made hand so one set of
    // thresholds covers every street. Before this the pre-flop score was max(rank)/14,
    // which never reached 2 — so a CPU folded to any bet over 45% of its stack and
    // never raised pre-flop, and a pre-flop shove won uncontested every single time.
    function preflopStrength(p) {
        const cards = p.hole;
        if (!cards.length) return 0;
        const ranks = cards.map((c) => c.r).sort((a, b) => b - a);
        const pair = ranks.find((r, i) => ranks.indexOf(r) !== i);
        if (pair) return 2 + ((pair - 2) / 12) * 4;
        const hi = ranks[0], lo = ranks[1] ?? ranks[0];
        const suited = cards.some((c, i) => cards.slice(i + 1).some((d) => d.s === c.s));
        return ((hi + lo) / 28) * 3 + (suited ? 0.7 : 0) + (hi - lo <= 2 ? 0.5 : 0);
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
                    consume(p,m);
                    lastHoleKey=null;lastBoardKey=null;phase="transition";
                    lastActionText=`${p.name} が ${m.name} を発動。${result.event.copy}`;
                    publishEffects(ctx);render();
                    afterEffects(()=>{phase="cpu";render();setTimeout(()=>cpu(true),200);});
                    return;
                }
            }
        }
        let
            due = Math.max(0, currentBet - p.bet),
            strength = board.length >= 3 ? handRank(p).cat : preflopStrength(p),
            roll = Math.random();
        p.tell = strength > 4 ? "強い" : strength > 1.5 ? "ふつう" : "弱い";
        // Calls are priced against the pot, not against the stack. A stack-share rule
        // cannot see that a shove into a big pot is cheap, so every big bet was folded
        // to and stealing with an all-in never lost anything.
        const potOdds = due / Math.max(1, pot() + due);
        const equity = 0.22 + strength * 0.075;
        const risky = due >= p.chips * 0.6;
        // 参加額に対して短くなった相手は、どうせ死ぬので広く受ける。
        // これが無いと「毎回オールインで盗む」が一方的に得になる（実測で20戦10勝）。
        const desperate = p.chips <= blindSpec()[1] * 6;
        const slack = risky ? (desperate ? -0.10 : 0.03) : 0.02;
        if (due > 0 && equity < potOdds + slack && roll > 0.04) act("fold");
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
        eligible.forEach(p=>{const best=bestFive(p);p.rank=best.r;p.bestCards=best.c;});
        // 配当は先に計算するだけ。実際に配るのは手札を捲り終えてから。
        // 先に結果が見えてしまうと、捲る意味が無くなる。
        const payouts = new Map();
        const give = (p, n) => payouts.set(p, (payouts.get(p) || 0) + n);
        let levels = [...new Set(P.map((p) => p.total).filter(Boolean))].sort((a, b) => a - b),
            prev = 0,
            main = [];
        levels.forEach((lv, idx) => {
            let amount = (lv - prev) * P.filter((p) => p.total >= lv).length,
                can = eligible.filter((p) => p.total >= lv),
                best = can.map((p) => p.rank).sort(cmp).at(-1),
                wins = can.filter((p) => cmp(p.rank, best) === 0),
                share = Math.floor(amount / wins.length);
            wins.forEach(w => give(w, share));
            for (let r = 0; r < amount - share * wins.length; r++) give(wins[r % wins.length], 1);
            if (!idx) main = wins;
            prev = lv;
        });
        potHold = awardedPot;
        P.forEach((p) => { p.total = 0; p.bet = 0; });
        render();
        showdownReveal(eligible, main, () => {
            potHold = 0;
            payouts.forEach((n, p) => { p.chips += n; p.payout += n; });
            mainWinner = main[0];
            P.forEach(p => p.handWon = main.includes(p));
            P.forEach((p) => (p.last = p.folded ? "降りた" : roleName(p.rank.name)));
            render(true);
            const names = main.map((p) => p.name).join(" + ");
            const tier = winTier(main[0], awardedPot, main[0].rank.name);
            main.forEach((w) => { markWinner(w); popAt(seatNode(w), `+${Math.round(awardedPot / main.length).toLocaleString()}`, tier); });
            if (TIER_LEVEL[tier] >= 3) shake(TIER_LEVEL[tier] >= 6 ? "hard" : "soft");
            pushLog(`${names}の勝ち　${roleName(main[0].rank.name)}`, "win");
            const lost = mode === "solo" && !main.some(p => p.human);
            announce(roleName(main[0].rank.name), lost ? `${names} の勝ち` : `+${awardedPot.toLocaleString()}`,
                `${names} がポット ${awardedPot.toLocaleString()}枚 を獲得`, lost ? "defeat" : "win", 1900);
            setTimeout(() => afterHand(main), 1500);
        });
    }

    function awardUncontested(p) {
        const awardedPot = pot();
        p.chips += awardedPot;
        p.payout=awardedPot;
        P.forEach((player) => {
            player.total = 0;
            player.bet = 0;
        });
        p.last = "ポット獲得";
        mainWinner = p;
        P.forEach(q=>q.handWon=q===p);
        phase = "won";
        render();
        markWinner(p);
        popAt(seatNode(p), `+${awardedPot.toLocaleString()}`, "mid");
        pushLog(`${p.name}の勝ち　ほかは全員降りた`, "win");
        const lost=mode==="solo"&&!p.human;
        announce("全員が降りた", lost?`${p.name} の勝ち`:`+${awardedPot.toLocaleString()}`, `${p.name} がポット ${awardedPot.toLocaleString()}枚 を獲得`, lost?"defeat":"win", 1500);
        setTimeout(() => afterHand([p]), 1400);
    }

    function afterHand(winners) {
        afterEffects(()=>{
            P.filter(p=>p.participated).forEach(p=>{p.streak=winners.includes(p)?(p.streak||0)+1:0;});
            if(run){
                for(const q of P){
                    if(q.out||q.id===0||q.chips>0||q.busted) continue;
                    q.busted=true;
                    const left=P.filter(x=>!x.out&&x.chips>0&&x.id!==0).length;
                    const seat=$(`.pos-${q.id}`);
                    if(seat){seat.classList.add("wiped");setTimeout(()=>seat.classList.remove("wiped"),760);}
                    popAt(seatNode(q),"OUT","huge");
                    stamp(`${q.name} 脱落`,"big",120);
                    if(left===1)stamp("HEADS UP","huge",900);
                    pushLog(`${q.name} ELIMINATED / 残り ${left}人`,"win");
                    cue("win");
                }
            }
            let scrapGain=0, chainBonus=0;
            if(run){
                const hero=P[0];
                // A loss is not a free module any more; it is the money for the next one.
                if(hero.participated&&!winners.includes(hero)) scrapGain=hero.folded?1:2;
                run.scrap+=scrapGain;
                if(winners.includes(hero)&&hero.streak>=2){
                    const steps=Math.min(CHAIN_MAX,hero.streak-1);
                    chainBonus=Math.round((hero.payout||0)*CHAIN_STEP*steps);
                    if(chainBonus>0){
                        hero.chips+=chainBonus;
                        pushLog(`CHAIN ×${hero.streak} / +${chainBonus.toLocaleString()}`,"win");
                        popAt(seatNode(hero),`CHAIN +${chainBonus.toLocaleString()}`,hero.streak>=3?"huge":"big");
                        cue("win");
                    }
                }
            }
            $("#to-rewards").innerHTML=`${run?"次の勝負へ":"能力を選ぶ"} <b id="round-time">60s</b>`;
            deadline=performance.now()+DRAFT_SECONDS*1000;
            roundWinners=winners; phase="round-result";
            const lost=mode==="solo"&&!winners.some(p=>p.human);
            $("#round-eyebrow").textContent=`${run?`第${handNo}回戦`:handLabel(handNo)}の結果`;
            $("#round-title").textContent=mode==="solo"?(lost?"あなたの負け":"あなたの勝ち！"):`${winners.map(p=>p.name).join("・")} の勝ち！`;
            $("#round-result").dataset.outcome=lost?"lost":"won";
            const chain=Math.max(...winners.map(p=>p.streak));
            if(chain>1&&winners.some(p=>p.human)) stamp(`${chain}連勝`, chain>=3?"huge":"big", 240);
            $("#round-result").dataset.streak=String(Math.min(chain,3));
            if(chain>1)$("#round-title").textContent+=`　${chain}連勝`;
            // 一行に「何で決まったか → タイブレーク → もらったもの」の順で積む。
            // 順序が入れ替わると、勝因の話と報酬の話が混ざって読めない。
            const line=[`${winners.map(p=>p.name).join("・")}の${winners[0].rank?roleName(winners[0].rank.name):"勝ち（ほかは全員降りた）"}`];
            const runner=P.filter(p=>p.rank&&!winners.includes(p)).sort((a,b)=>cmp(b.rank,a.rank))[0];
            if(runner && winners[0].rank.cat===runner.rank.cat){
                const win=winners[0], k=win.rank.tie.findIndex((r,i)=>r!==runner.rank.tie[i]);
                const label=r=>({14:"A",13:"K",12:"Q",11:"J"}[r]||r);
                if(k>=0)line.push(`同じ役、${label(win.rank.tie[k])}が${label(runner.rank.tie[k])}に勝ち`);
            }
            if(scrapGain)line.push(`SCRAP +${scrapGain}`);
            if(chainBonus)line.push(`${P[0].streak}連勝ボーナス +${chainBonus.toLocaleString()}枚`);
            $("#round-summary").textContent=line.join("　/　");
            $("#round-board").innerHTML=board.length?`<small>全員共通の場札</small><div>${board.map((c,i)=>card(c,i)).join("")}</div>`:"";
            $("#round-players").innerHTML=P.filter(p=>p.participated).map(p=>{
                const delta=p.chips-p.startChips;
                const hand=p.rank?p.bestCards.map((c,i)=>card(c,i)).join(""):"";
                const mark=p.handWon?"勝ち":p.payout>0?"サイドポット":p.folded?"降りた":"負け";
                const role=p.rank&&!p.folded?roleName(p.rank.name):"";
                return `<article class="${p.handWon?"round-winner":""}"><header><b>${p.name}</b><strong>${mark}</strong>${role?`<em>${role}</em>`:""}</header><div class="result-hand">${hand||`<span>${p.folded?"降りた":"—"}</span>`}</div><div class="result-numbers"><b>${delta>=0?"+":""}${delta.toLocaleString("ja-JP")}</b><small>のこり ${p.chips.toLocaleString("ja-JP")}</small></div></article>`;
            }).join("");
            $("#round-result").classList.remove("hidden");
            $("#turn-banner").innerHTML=`<i id="table-msg">結果</i><strong>今回の勝負が決まりました</strong><span>カードとチップの増減を確認してください</span>`;
        });
    }
    $("#to-rewards").onclick=()=>{
        if(phase!=="round-result")return;
        $("#round-result").classList.add("hidden");phase="transition";queueRewards(roundWinners);
    };
    function queueRewards(winners) {
        afterEffects(() => {
            const ctx=effectContext(); Rogue.result(ctx,winners.map(p=>p.id)); publishEffects(ctx);
            rewardQueue=P.filter(p=>p.participated && p.human && !p.out).map(p=>({p,won:winners.includes(p)}));
            P.filter(p=>p.participated && !p.human && !p.out).forEach(p=>{
                const pool=Rogue.rewardPool(p,winners.includes(p));
                if(!pool.length) return;
                const m=pool[Math.floor(Math.random()*pool.length)];
                // CPUのラックにも上限がある。溢れたら古いものから捨てるが、
                // ボスの固定構成は identity なので押し出さない。
                if(p.mods.length>=CPU_SLOTS+p.mods.filter(m=>m.fixed).length){
                    const index=p.mods.findIndex(m=>!m.fixed);
                    if(index<0) return;
                    p.mods.splice(index,1);
                }
                p.mods.push({...m});
                pushLog(`${p.name}が「${m.name}」を装着　${Rogue.tiers[m.tier]}`,m.cat);
            });
            afterEffects(nextReward);
        });
    }
    function nextReward() {
        const reward=rewardQueue.shift();
        if(!reward) {afterEffects(newHand);return;}
        draft(reward.p,reward.won);
    }
    // 潜る前に1つ持っていける。1手目からビルドがある状態にするための開始ドラフト。
    function startDraft() {
        rewardQueue = [];
        draft(P[0], false, false, Rogue.catalog.filter((m) => m.tier <= 2 && !Rogue.has(P[0], m.id)));
    }

    const offerMarkup = (m,i)=>`<button data-i="${i}" data-tier="${m.tier}" data-cat="${m.cat}" class="mod-${m.cat}" aria-label="${m.name}を選ぶ"><span class="pick-index">0${i+1}</span><span class="pick-meta"><b>${CAT[m.cat]}</b><strong>${Rogue.tiers[m.tier]}</strong></span><i>${m.icon}</i><h3>${m.name}</h3><small class="code-name">${m.codeName}</small><p>${m.desc}</p><span class="trigger-mode"><b>${m.manual?"USE 使い切り":"AUTO"}</b>${m.manual?"自分の手番で押して発動。使うと棚から消える":"条件成立時に何度でも自動発動"}</span><em>この能力を選択 <b>→</b></em></button>`;

    function draft(p,won,reroll=false,startPool=null) {
        // 棚と同じ上限をドラフトにも掛ける。片方だけ抜けると info/guard の枠が意味を失う。
        const base=startPool||Rogue.rewardPool(p,won);
        const pool=(run&&p===P[0])?base.filter(m=>!categoryFull(m)):base;
        if(!pool.length) {
            p.chips+=won?800:200;
            pushLog(`${p.name} / 全能力取得済み → +${won?800:200}`,"guard");
            nextReward(); return;
        }
        const previous=reroll?offers.map(m=>m.id):[];
        draftStart=!!startPool||(reroll&&draftStart);
        if(!reroll)draftRerolls=0;
        draftLocked=false;
        $("#relic").classList.remove("installing");
        offers=rewardChoices(shuffle([...pool]),won,previous);
        rewardWon=won;
        rewardOwner=p; phase="draft"; if(!deadline) deadline=performance.now()+DRAFT_SECONDS*1000;
        if(!reroll)cue("reward");
        $("#relic-title").textContent = draftStart?"潜る前に1つ持っていく":`${p.name}の能力を選択`;
        $("#relic .eyebrow").textContent=draftStart?"RUN START　開始の1枚":won?`${handLabel(handNo)}勝利　勝ちの報酬`:`${handLabel(handNo)}敗北　負けの報酬`;
        $("#relic-copy").textContent=draftStart?"タダで1枚。以降は毎回1枚もらえて、段の切れ目の BACK ROOM で買い足せます。":won?(pool.some(m=>m.tier===3)?"勝利報酬。レア以上の3択で、伝説能力が必ず1枚入ります。":"勝利報酬。レア能力から1枚選びます。") : "敗北しても能力を獲得できます。次の勝負を逆転する1枚を選んでください。";
        const rerollCost=run?REROLL_COSTS[Math.min(draftRerolls,REROLL_COSTS.length-1)]:0;
        const canReroll=draftRerolls<REROLL_COSTS.length&&pool.some(m=>!offers.some(o=>o.id===m.id))&&(!run||p.chips>=rerollCost);
        $("#reroll-reward").disabled=!canReroll;
        $("#reroll-reward").textContent=draftRerolls>=REROLL_COSTS.length?"REROLL 上限":
            run?`REROLL / ${rerollCost.toLocaleString()}枚で引き直す`:"REROLL / 1回だけ引き直す";
        $("#draft-time").textContent="1 PICK";
        $("#skip-reward").disabled=false;
        $("#skip-reward").textContent=p.human&&p.mods.length>=slotCap()?"選ばない / 入れ替えずに見送る":"選ばない / 見送る"+(run?"（SCRAP +1）":"");
        $("#relic-cards").innerHTML=offers.map(offerMarkup).join("");
        $("#relic-cards").querySelectorAll("button").forEach(b=>b.onclick=()=>choose(p,+b.dataset.i));
        draftReplacing=null;
        renderDraftOwned();
        $("#relic").classList.remove("hidden");
    }
    $("#skip-reward").onclick=()=>{
        // 満杯のたびに何かを外させると、育てた組み合わせが毎回壊れる。見送れることが選択になる。
        // 閉じ方は装着とまったく同じ道を通す。ここだけ別経路にすると進行が二重に走る。
        if(phase!=="draft"||draftLocked||!offers.length)return;
        installPick(rewardOwner,0,null,true);
    };
    $("#reroll-reward").onclick=()=>{
        if(phase!=="draft"||draftLocked||$("#reroll-reward").disabled)return;
        if(run){
            const cost=REROLL_COSTS[Math.min(draftRerolls,REROLL_COSTS.length-1)];
            if(rewardOwner.chips<cost)return;
            rewardOwner.chips-=cost;
            pushLog(`${rewardOwner.name}が引き直し　−${cost.toLocaleString()}枚`,"chaos");
        }
        draftRerolls++;cue("chaos");
        draft(rewardOwner,rewardWon,true,draftStart?Rogue.catalog.filter(m=>m.tier<=2&&!Rogue.has(rewardOwner,m.id)):null);
        render();
    };
    function choose(p,i) {
        if(phase!=="draft" || draftLocked || p!==rewardOwner || !offers[i])return;
        // ラックが満杯なら、何を外すかを先に決める。毎ハンド来るのでここが選択になる。
        if(p.human && p.mods.length>=slotCap()) { draftReplacing=i; renderDraftOwned(); render(); return; }
        installPick(p,i);
    }

    function renderDraftOwned() {
        const hero=(rewardOwner&&rewardOwner.human)?rewardOwner:P[0], swapping=draftReplacing!==null;
        $("#relic-owned").innerHTML = swapping ?
            `<small>外す能力を選んでください（${offers[draftReplacing].name} と入れ替え）</small>` +
            hero.mods.map(m=>`<button class="owned-chip ${m.cat} swap" data-drop="${m.id}" title="${m.desc}"><b>${m.icon}</b>${m.name}<span>外す</span></button>`).join("") +
            `<button class="owned-chip cancel" data-cancel="1">選び直す</button>` :
            (hero.mods.length) ? `<small>ラック ${hero.mods.length} / ${slotCap()}</small>` +
                hero.mods.map(m=>`<button class="owned-chip ${m.cat}" disabled title="${m.desc}"><b>${m.icon}</b>${m.name}</button>`).join("") : "";
        $("#relic-owned").querySelectorAll("button").forEach(b=>b.onclick=()=>{
            if(b.dataset.cancel){draftReplacing=null;renderDraftOwned();return;}
            if(draftReplacing!==null) installPick(hero,draftReplacing,b.dataset.drop);
        });
    }

    // 系統が新しく届いたら、それだけで一発。組み上がった瞬間が見えないと、
    // 「そろえる」という遊び方に気づけない。
    let synSeen = new Set();
    function announceSynergy(p) {
        if (!p || !p.human) return;
        const now = Rogue.synergies(p);
        for (const s of now) {
            const key = `${s.cat}:${s.n}`;
            if (synSeen.has(key)) continue;
            synSeen.add(key);
            stamp(s.name, "huge");
            cue("chaos", 6);
            shake("hard");
            announce(`${CAT[s.cat]} ×${s.n}`, s.name, s.copy, s.cat, 2000);
            pushLog(`系統ボーナス ${s.name} / ${s.copy}`, s.cat);
        }
        const live = new Set(now.map((s) => `${s.cat}:${s.n}`));
        synSeen = new Set([...synSeen].filter((k) => live.has(k)));
    }

    function installPick(p,i,dropId,skip=false) {
        const picked=offers[i],cards=[...$("#relic-cards").querySelectorAll("button")];
        if(dropId){
            const index=p.mods.findIndex(m=>m.id===dropId);
            if(index<0)return;
            const [gone]=p.mods.splice(index,1);
            pushLog(`${p.name}が「${gone.name}」を外した`,"chaos");
        }
        draftReplacing=null;
        draftLocked=true;
        $("#relic").classList.add("installing");
        cards.forEach((card,index)=>{card.disabled=true;card.classList.add(index===i?"selected":"rejected");});
        $("#reroll-reward").disabled=true;
        $("#skip-reward").disabled=true;
        $("#draft-time").textContent=skip?"SKIP":"INSTALL";
        $("#relic-copy").textContent=skip?"今回は見送りました。SCRAP が1つ増えます。":`${picked.name}を装着中。次の勝負から${picked.manual?"手番で1回だけ撃てます（使い切り）":"条件成立時に自動発動"}。`;
        cue(skip?"chaos":picked.cat);
        setTimeout(()=>{
            offers=[];if(!skip)p.mods.push({...picked});deadline=0;$("#relic-owned").innerHTML="";$("#relic").classList.add("hidden");phase="transition";
            if(skip){if(run)run.scrap+=1;pushLog(`${p.name} 能力を見送り / SCRAP +1`,"chaos");}
            else pushLog(`${p.name}が「${picked.name}」を装着　${Rogue.tiers[picked.tier]}`,picked.cat);
            if(p.human) stamp(picked.name, picked.tier>=3?"huge":picked.tier===2?"big":"mid");
            if(!skip) announceSynergy(p);
            render();afterEffects(nextReward);
        },720);
    }

    function finish(p) {
        finale(p, () => {
            $("#result-eyebrow").textContent = "TABLE OVER";
            $("#winner").textContent = `${p.name} の勝ち`;
            $("#result-copy").textContent =
                `${handLabel(handNo)}で決着 / 最終チップ ${p.chips.toLocaleString()}枚`;
            $("#result").classList.remove("hidden");
            render();
        });
    }

    const scrapUsable = () => Math.min(SCRAP_MAX, run ? run.scrap : 0);
    const slotCap = () => SLOT_BASE + (run ? SLOT_BONUS_LEVELS.filter((n) => run.level >= n).length : 0);
    const categoryCount = (cat) => P[0].mods.filter((m) => m.cat === cat).length;
    const categoryFull = (m) => CATEGORY_CAP[m.cat] !== undefined && categoryCount(m.cat) >= CATEGORY_CAP[m.cat];
    const priceOf = (m) => Math.max(1, Math.round(SHOP_PRICE[m.tier] * (1 - SCRAP_STEP * run.scrapApplied)));
    const resaleOf = (m) => Math.round(SHOP_PRICE[m.tier] / 2);

    function shopOffers(previous = []) {
        const owned = new Set(P[0].mods.map((m) => m.id));
        const weights = TIER_WEIGHTS[Math.min(run.level, TIER_WEIGHTS.length - 1)];
        const total = weights.reduce((a, b) => a + b, 0);
        const available = Rogue.catalog.filter((m) => !owned.has(m.id));
        const picked = [];
        while (picked.length < 3) {
            const taken = new Set(picked.map((m) => m.id));
            const fresh = available.filter((m) => !taken.has(m.id) && !previous.includes(m.id));
            const source = fresh.length ? fresh : available.filter((m) => !taken.has(m.id));
            if (!source.length) break;
            let roll = Math.random() * total, tier = 1;
            for (let t = 0; t < 3; t++) { roll -= weights[t]; if (roll <= 0) { tier = t + 1; break; } }
            const tierPool = source.filter((m) => m.tier === tier);
            const pool = tierPool.length ? tierPool : source;
            picked.push({ ...pool[Math.floor(Math.random() * pool.length)] });
        }
        return picked;
    }

    function openBackroom() {
        run.rerolls = 0;
        run.scrapApplied = 0;
        run.replacing = null;
        run.offers = shopOffers();
        phase = "backroom";
        $("#backroom").classList.remove("hidden");
        cue("reward");
        renderBackroom();
    }

    function renderBackroom() {
        const hero = P[0], next = LEVELS[Math.min(run.level + 1, LEVELS.length - 1)];
        $("#backroom-eyebrow").textContent = `BACK ROOM / 第${handNo}回戦のあと`;
        $("#backroom-stack").innerHTML = `<small>STACK</small>${hero.chips.toLocaleString()}`;
        $("#backroom-copy").textContent =
            `このあと参加費が ${next[0].toLocaleString()} / ${next[1].toLocaleString()} に上がります。残り${P.filter((p) => !p.out && p.chips > 0).length}人。` +
            `ここで払ったチップは、そのまま卓で賭けられない分になります。`;
        const rerollCost = REROLL_COSTS[Math.min(run.rerolls, REROLL_COSTS.length - 1)];
        const canReroll = run.rerolls < REROLL_COSTS.length && hero.chips >= rerollCost && run.offers.some((m) => !m.sold);
        $("#backroom-reroll").disabled = !canReroll;
        $("#backroom-reroll").textContent = run.rerolls >= REROLL_COSTS.length ?
            "REROLL 上限" : `REROLL / ${rerollCost}枚で引き直す`;
        const usable = scrapUsable();
        $("#scrap-held").textContent = String(run.scrap);
        $("#scrap-applied").textContent = String(run.scrapApplied);
        $("#scrap-effect").textContent = run.scrapApplied ?
            `−${run.scrapApplied * SCRAP_STEP * 100}%（購入時に ${run.scrapApplied} 消費）` :
            usable ? "SCRAPを使うと割引になります" : "SCRAPは負けた勝負で貯まります";
        $("#scrap-minus").disabled = run.scrapApplied <= 0;
        $("#scrap-plus").disabled = run.scrapApplied >= usable;
        const cap = slotCap(), full = hero.mods.length >= cap;
        $("#backroom-slots").innerHTML = Array.from({ length: cap }, (_, i) =>
            `<i class="${hero.mods[i] ? "filled " + hero.mods[i].cat + (run.justBought === i ? " fresh" : "") : "empty"}"></i>`).join("") +
            `<span>${hero.mods.length} / ${cap} SLOTS</span>` +
            Object.keys(CATEGORY_CAP).map((cat) =>
                `<span class="cat-cap${categoryCount(cat) >= CATEGORY_CAP[cat] ? " maxed" : ""}">${CAT[cat]} ${categoryCount(cat)}/${CATEGORY_CAP[cat]}</span>`).join("");
        // 買い物の場でこそ「あと1枚で何が付くか」が要る。組み方はここで決まる。
        $("#backroom-syn").innerHTML = synergyMarkup(hero) || `<i class="syn near">同じ系統を2枚そろえると効果が付きます</i>`;
        $("#backroom-cards").innerHTML = run.offers.length ? run.offers.map((m, i) => {
            const price = priceOf(m);
            const poor = hero.chips < price;
            const blocked = categoryFull(m);
            const note = m.sold ? `<span>購入済み</span><b>−${m.sold.toLocaleString()}</b>` :
                blocked ? `<span>${CAT[m.cat]}は上限</span><b>${price.toLocaleString()}</b>` :
                poor ? `<span>足りません</span><b>${price.toLocaleString()}</b>` :
                full ? `<span>1つ外して買う</span><b>${price.toLocaleString()}</b>` :
                `<span>買う</span><b>${price.toLocaleString()}</b>`;
            return `<button data-i="${i}" data-tier="${m.tier}" data-cat="${m.cat}" class="mod-${m.cat}${m.sold ? " sold" : ""}${run.replacing === i ? " replacing" : ""}"${m.sold || poor || blocked ? " disabled" : ""} aria-label="${m.name}を${price}枚で買う"><span class="pick-index">0${i + 1}</span><span class="pick-meta"><b>${CAT[m.cat]}</b><strong>${Rogue.tiers[m.tier]}</strong></span><i>${m.icon}</i><h3>${m.name}</h3><small class="code-name">${m.codeName}</small><p>${m.desc}</p><span class="trigger-mode"><b class="${m.manual ? "use" : ""}">${m.manual ? "手動 USE / 使い切り" : "自動 AUTO"}</b>${m.manual ? "自分の手番で押して撃つ。撃つと棚から消える" : "条件が揃うと何度でも勝手に出る"}</span><em class="shop-price">${note}</em></button>`;
        }).join("") : `<p class="shop-empty">買える能力がもうありません。チップを次の卓へ持ち越しましょう。</p>`;
        $("#backroom-cards").querySelectorAll("button").forEach((b) => (b.onclick = () => buyModule(+b.dataset.i)));
        if (run.replacing !== null && run.replacing !== undefined && !run.offers[run.replacing]) run.replacing = null;
        const swapping = run.replacing !== null && run.replacing !== undefined;
        $("#backroom-owned").innerHTML = hero.mods.length ?
            `<small>${swapping ? `外す能力を選んでください（${run.offers[run.replacing].name} と入れ替え / 払い戻しなし）` : "所持能力 / 押すと売却して半額が戻ります"}</small>` +
            hero.mods.map((m) =>
                `<button class="owned-chip ${m.cat}${swapping ? " swap" : ""}" data-sell="${m.id}" title="${m.desc}"><b>${m.icon}</b>${m.name}<span>${swapping ? "外す" : "+" + resaleOf(m)}</span></button>`).join("") +
            (swapping ? `<button class="owned-chip cancel" data-cancel="1">入れ替えをやめる</button>` : "") :
            `<small>まだ能力を持っていません</small>`;
        $("#backroom-owned").querySelectorAll("button").forEach((b) => (b.onclick = () =>
            b.dataset.cancel ? (run.replacing = null, renderBackroom()) :
            swapping ? completePurchase(run.replacing, b.dataset.sell) : sellModule(b.dataset.sell)));
    }

    function buyModule(i) {
        if (phase !== "backroom") return;
        const m = run.offers[i], hero = P[0];
        if (!m || m.sold || categoryFull(m)) return;
        if (hero.chips < priceOf(m)) return;
        // A full rack has to give something up; the discarded module is gone, not sold.
        if (hero.mods.length >= slotCap()) { run.replacing = i; renderBackroom(); return; }
        completePurchase(i);
    }

    function completePurchase(i, discardId) {
        const m = run.offers[i], hero = P[0];
        if (!m || m.sold || categoryFull(m)) return;
        const price = priceOf(m);
        if (hero.chips < price) return;
        if (discardId) {
            const index = hero.mods.findIndex((x) => x.id === discardId);
            if (index < 0) return;
            const [gone] = hero.mods.splice(index, 1);
            pushLog(`BACK ROOM / ${gone.name} を外した`, "chaos");
        }
        hero.chips -= price;
        run.scrap -= run.scrapApplied;
        run.scrapApplied = 0;
        run.replacing = null;
        m.sold = price;
        hero.mods.push({ id: m.id, icon: m.icon, name: m.name, codeName: m.codeName, cat: m.cat, tier: m.tier, desc: m.desc, manual: m.manual, targeted: m.targeted, board: m.board });
        pushLog(`BACK ROOM / ${m.name} を ${price}枚で購入`, m.cat);
        cue(m.cat);
        run.justBought = hero.mods.length - 1;
        renderBackroom();
        run.justBought = -1;
        render();
    }

    function sellModule(id) {
        if (phase !== "backroom" || (run.replacing !== null && run.replacing !== undefined)) return;
        const hero = P[0], index = hero.mods.findIndex((m) => m.id === id);
        if (index < 0) return;
        const [m] = hero.mods.splice(index, 1);
        const refund = resaleOf(m);
        hero.chips += refund;
        pushLog(`BACK ROOM / ${m.name} を売却 +${refund}枚`, "guard");
        cue("guard");
        run.offers = run.offers.filter((o) => o.id !== m.id).concat([]);
        renderBackroom();
        render();
    }

    function rerollShop() {
        if (phase !== "backroom" || run.rerolls >= REROLL_COSTS.length) return;
        const hero = P[0], cost = REROLL_COSTS[run.rerolls];
        if (hero.chips < cost) return;
        hero.chips -= cost;
        run.rerolls++;
        run.replacing = null;
        run.offers = shopOffers(run.offers.map((m) => m.id));
        pushLog(`BACK ROOM　品揃えを引き直し −${cost}枚`, "chaos");
        cue("chaos");
        renderBackroom();
        render();
    }

    // 段の切り替え。棚を閉じたらここへ来る。
    function nextLevel() {
        // 飛んだ相手はここで卓を降りる
        P.forEach((p) => { if (p.id !== 0 && p.chips <= 0 && !p.out) { p.out = true; pushLog(`${p.name} が卓を降りました`, "system"); } });
        run.level = Math.min(LEVELS.length - 1, run.level + 1);
        run.handInLevel = 0;
        N = P.filter((p) => !p.out).length;
        document.body.dataset.players = String(N);
        board = [];
        lastHoleKey = lastBoardKey = null;
        phase = "transition";
        const [S, B] = blindSpec();
        stamp("参加費アップ", "big");
        pushLog(`参加費 ${S.toLocaleString()} / ${B.toLocaleString()} / 残り${N}人`, "system");
        announce("参加費が上がりました", `${S.toLocaleString()} / ${B.toLocaleString()}`,
            `毎回この額を先に払う人が出ます。残り${N}人。`, "system", 1400);
        render();
        afterEffects(newHand);
    }

    function standings() {
        return P.slice().sort((a, b) => b.chips - a.chips || a.id - b.id);
    }
    function renderStandings(topId) {
        $("#standings").innerHTML = standings().map((p, i) =>
            `<li style="--r:${i}"${p.id === topId ? ' class="top"' : p.chips <= 0 ? ' class="bust"' : ""}>` +
            `<b>${String(i + 1).padStart(2, "0")}</b><span>${p.name}</span>` +
            `<i>${p.mods.length}能力</i><strong>${p.chips.toLocaleString()}</strong></li>`).join("");
    }
    // 決着は一拍おいてから出す。チップが勝者に集まりきる前に板が出ると、
    // 何が起きて終わったのかが見えない。
    function finale(winner, show) {
        phase = "ended";
        renderStandings(winner?.id);
        render();
        if (reduced()) { show(); return; }
        const mine = winner === P[0];
        cue(mine ? "win" : "defeat", mine ? 7 : 0);
        stamp("FINAL", "big");
        shake("hard");
        chipRain(winner);
        // 卓ぜんぶで決着を言う。勝った席は反転し、残りは一拍沈む。
        $(".rail")?.classList.add("hit-win");
        setTimeout(() => $(".rail")?.classList.remove("hit-win"), 700);
        P.forEach((p) => { if (p !== winner && !p.out) markLoser(p); });
        if (winner) markWinner(winner);
        stamp(mine ? "あなたの勝ち" : `${winner?.name || ""} の勝ち`, "huge", 620);
        cue("allin", 5);
        setTimeout(() => { if (winner) markWinner(winner); cue(mine ? "win" : "defeat", mine ? 7 : 2); }, 900);
        setTimeout(show, 1900);
    }

    function runOver(complete, copy, leader = null) {
        const hero = P[0];
        const top = leader || standings()[0];
        finale(complete ? hero : top, () => {
            $("#result-eyebrow").textContent = complete ? "RUN COMPLETE" : "RUN OVER";
            $("#winner").textContent = complete ? "あなたの勝ち"
                : hero.chips <= 0 ? "チップが尽きた"
                : top === hero ? "あなたの勝ち" : `${top.name} の勝ち`;
            $("#result-copy").textContent =
                `${copy} / ${handNo}回戦 / 最終チップ ${hero.chips.toLocaleString()}枚 / 装着能力 ${hero.mods.length}個`;
            $("#result").classList.remove("hidden");
            render();
        });
    }

    // スートはドット絵。11px幅の整数格子。スペードは尖った頭、クローバーは丸い頭と左右の耳。
    const SUIT_PIX = {
        "♠": '<svg class="suit" viewBox="0 0 11 11" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect x="5" y="0" width="1" height="1"/><rect x="4" y="1" width="3" height="1"/><rect x="3" y="2" width="5" height="1"/><rect x="2" y="3" width="7" height="1"/><rect x="1" y="4" width="9" height="1"/><rect x="0" y="5" width="11" height="1"/><rect x="0" y="6" width="11" height="1"/><rect x="0" y="7" width="11" height="1"/><rect x="0" y="8" width="4" height="1"/><rect x="7" y="8" width="4" height="1"/><rect x="4" y="9" width="3" height="1"/><rect x="3" y="10" width="5" height="1"/></svg>',
        "♥": '<svg class="suit" viewBox="0 0 11 10" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect x="2" y="0" width="3" height="1"/><rect x="6" y="0" width="3" height="1"/><rect x="1" y="1" width="9" height="1"/><rect x="0" y="2" width="11" height="1"/><rect x="0" y="3" width="11" height="1"/><rect x="0" y="4" width="11" height="1"/><rect x="1" y="5" width="9" height="1"/><rect x="2" y="6" width="7" height="1"/><rect x="3" y="7" width="5" height="1"/><rect x="4" y="8" width="3" height="1"/><rect x="5" y="9" width="1" height="1"/></svg>',
        "♦": '<svg class="suit" viewBox="0 0 11 11" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect x="5" y="0" width="1" height="1"/><rect x="4" y="1" width="3" height="1"/><rect x="3" y="2" width="5" height="1"/><rect x="2" y="3" width="7" height="1"/><rect x="1" y="4" width="9" height="1"/><rect x="0" y="5" width="11" height="1"/><rect x="1" y="6" width="9" height="1"/><rect x="2" y="7" width="7" height="1"/><rect x="3" y="8" width="5" height="1"/><rect x="4" y="9" width="3" height="1"/><rect x="5" y="10" width="1" height="1"/></svg>',
        "♣": '<svg class="suit" viewBox="0 0 11 11" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect x="4" y="0" width="3" height="1"/><rect x="3" y="1" width="5" height="1"/><rect x="3" y="2" width="5" height="1"/><rect x="4" y="3" width="3" height="1"/><rect x="1" y="4" width="2" height="1"/><rect x="4" y="4" width="3" height="1"/><rect x="8" y="4" width="2" height="1"/><rect x="0" y="5" width="11" height="1"/><rect x="0" y="6" width="11" height="1"/><rect x="1" y="7" width="2" height="1"/><rect x="4" y="7" width="3" height="1"/><rect x="8" y="7" width="2" height="1"/><rect x="4" y="8" width="3" height="1"/><rect x="4" y="9" width="3" height="1"/><rect x="2" y="10" width="7" height="1"/></svg>',
    };
    const pip = (suit) => SUIT_PIX[suit] || "";

    // 決着は卓の上でやる。場札は隠さず、残った人の手札を席で一斉に捲る。
    // 中央を覆うと、いちばん見たい共通の5枚が見えなくなる。
    function showdownReveal(eligible, main, done) {
        if (reduced() || eligible.length < 2) { done(); return; }
        const shoved = eligible.filter((p) => p.allin).length;
        document.body.dataset.showdown = "1";
        render(true);
        stamp(shoved >= 2 ? "ALL-IN 対決" : "SHOWDOWN", shoved >= 2 ? "huge" : "big");
        if (shoved >= 2) shake("hard");
        cue(shoved >= 2 ? "allin" : "street", shoved >= 2 ? 4 : 1);
        let closed = false;
        const finish = () => {
            if (closed) return;
            closed = true;
            delete document.body.dataset.showdown;
            done();
        };
        // 一斉に開いてから、読む時間を置いて勝者を出す。
        setTimeout(() => {
            eligible.forEach((p) => { if (main.includes(p)) markWinner(p); else if (p === P[0]) markLoser(p); });
            const hero = P[0], heroWon = main.includes(hero);
            cue(heroWon ? "win" : "defeat",
                heroWon ? TIER_LEVEL[winTier(hero, hero.payout || 0, main[0].rank.name)] + Math.min(3, hero.streak || 0) : 0);
            stamp(roleName(main[0].rank.name), "huge");
            setTimeout(finish, 1300);
        }, 1150);
        setTimeout(finish, 3600);
    }

    function card(c, i = 0, back = false) {
        if (back) return `<i class="card card-back back-${i % 4}" style="--i:${i}"><span></span></i>`;
        let hot = c.s === "♥" || c.s === "♦";
        let rank = RN[c.r] || c.r;
        let suit = { "♠": "s", "♥": "h", "♦": "d", "♣": "c" }[c.s];
        const mark = pip(c.s);
        return `<i class="card suit-${suit} ${hot ? "hot" : ""}" style="--i:${i}" aria-label="${rank}${c.s}"><span class="corner top"><b>${rank}</b>${mark}</span><strong class="pip">${mark}</strong><span class="corner bottom"><b>${rank}</b>${mark}</span></i>`;
    }

    function playerStatuses(p,currentStreet) {
        const states=[];
        if(p.silenced&&currentStreet==="pre")states.push({code:"増額できない",copy:"この回は増額不可",kind:"debuff"});
        if(p.guardJammed)states.push({code:"守りなし",copy:"守りの能力が無効",kind:"debuff"});
        if(p.fogged)states.push({code:"情報なし",copy:"情報能力が無効",kind:"debuff"});
        if(p.exposed)states.push({code:"手札が見えている",copy:"手札を公開中",kind:"debuff"});
        if(p.suitBlind)states.push({code:"スートが見えない",copy:"フラッシュを作れない",kind:"debuff"});
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
        if (online() && !isHost()) {
            const m = pendingModule;
            if (!m || actor !== link.myId) return;
            $("#target-picker").classList.add("hidden"); pendingModule = null;
            netSend({ t: "use", id: m.id, target: targetId });
            return;
        }
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
        consume(owner,m);
        lastHoleKey=null;lastBoardKey=null;
        lastActionText=`${owner.name} が ${m.name} を発動。${result.event.copy}`;
        phase="transition";
        publishEffects(ctx);render();
        afterEffects(()=>{manualResolving=false;phase="act";render();});
    }

    function render(show = false) {
        let [S, B] = blindSpec();
        $("#level-label").textContent = "回戦";
        $("#level").textContent = `${String(Math.max(1, handNo)).padStart(2, "0")} / ${String(maxHands).padStart(2, "0")}`;
        $("#goal").textContent = `目的：全${maxHands}回戦。終わった時いちばんチップを持っていた人が勝ち`;
        const cashBox = $("#cash-box"), track = $("#floor-track");
        cashBox.hidden = !run;
        track.hidden = !run;
        if (run) {
            // 残っている顔ぶれをそのまま出す。減っていくのが進捗そのもの。
            track.innerHTML = P.map((p) =>
                `<i class="${p.out || p.chips <= 0 ? "done" : p.id === 0 ? "now" : "todo"}" title="${p.name}"></i>`).join("");
            $("#cash-label").textContent = "残り";
            $("#cashline").textContent = `${P.filter((p) => !p.out && p.chips > 0).length}人`;
            cashBox.dataset.met = "false";
            $("#cash-gauge").style.setProperty("--fill", `${Math.round(P.filter((p) => !p.out && p.chips > 0).length / P.length * 100)}%`);
        }
        const scrapBox = $("#scrap-box");
        scrapBox.hidden = !run || !run.scrap;
        if (run) $("#scrap").textContent = String(run.scrap);
        $("#blinds").textContent =
            `ベットの単位 ${B.toLocaleString()} ／ 先払い ${S.toLocaleString()}・${B.toLocaleString()}` +
            (active().length >= 3 ? `・+${B.toLocaleString()}` : "");
        const potValue=potHold||pot(), potEl=$("#pot");
        // 熱はポットの絶対額ではなく、卓のいちばん大きなスタックに対する比で測る。
        // BB比だと普通のポットでも最上段に張り付いて、熱が意味を失っていた。
        const biggest = Math.max(1, ...active().map((p) => p.chips + p.total));
        const ratio = potValue / biggest;
        potEl.parentElement.dataset.heat = String(ratio >= .8 ? 4 : ratio >= .5 ? 3 : ratio >= .3 ? 2 : ratio >= .15 ? 1 : 0);
        odometer(potEl, potValue);
        const boardKey = (riverHold ? "hold:" : "") + board.map((c) => `${c.s}${c.r}`).join("|");
        if (boardKey !== lastBoardKey) {
            const container = $("#board");
            const count = 5;
            for (let i = 0; i < count; i++) {
                const c = riverHold && i === 4 ? null : board[i];
                const key = `${handNo}:${c ? c.s + c.r : riverHold && i === 4 ? "hold" : "back"}`;
                const previous = container.children[i];
                if (previous?.dataset.cardKey === key) continue;
                const template = document.createElement("template");
                // ホールデムの場札は伏せて置かれない。未着は空き枠として描く。
                template.innerHTML = c ? card(c, i) : `<i class="card card-slot${riverHold && i === 4 ? " waiting" : ""}" style="--i:${i}"></i>`;
                const node = template.content.firstElementChild;
                node.dataset.cardKey = key;
                // 空き枠から出たのが「配られた」、既にあった札が変わったのが「書き換えられた」。
                if (c && previous && !previous.classList.contains("card-slot")) node.classList.add("changed");
                else if (c && i === 4) node.classList.add("river");
                if (previous) previous.replaceWith(node);
                else container.appendChild(node);
            }
            while (container.children.length > count) container.lastElementChild.remove();
            lastBoardKey = boardKey;
        }
        const actionPlayer = P[actor] || P[0];
        const viewer = mode === "solo" ? P[0] : online() ? (P[link.myId] || P[0]) : actionPlayer;
        const topStack = Math.max(1, ...P.filter((p) => !p.out).map((p) => p.chips));
        const fieldBox = $(".table-field").getBoundingClientRect();
        const tight = fieldBox.height > 0 && fieldBox.height < 330;
        $(".table-field").dataset.compact = String(tight);
        // 卓の平面図。見ている本人は手前のレールに居るので席は置かず、
        // 残りを楕円の上半分に等間隔で並べる(左→右)。
        const others = P.filter((p) => p !== viewer && !p.out);
        const seatSlot = (n, total) => {
            const angle = (180 + ((n + 1) * 180) / (total + 1)) * Math.PI / 180;
            const cy = tight ? 40 : 52, ry = tight ? 20 : 28;
            return `--x:${(50 + Math.cos(angle) * 43).toFixed(2)}%;--y:${(cy + Math.sin(angle) * ry).toFixed(2)}%`;
        };
        const rules = activeRules();
        $("#rules-panel").hidden = !rules.length;
        $("#rules-list").innerHTML = rules.map((r) =>
            `<span class="${r.cat}"><b>${r.text}</b><i>${r.who}</i></span>`).join("");
        $("#rules-count").textContent = rules.length ? `${rules.length}件` : "";
        $("#rules-panel").title = "この勝負のあいだ、卓の決まりが書き換わっているもの";
        $("#seats").innerHTML = P.map((p, i) => {
            if (p === viewer || p.out) return "";
            const slot = seatSlot(others.indexOf(p), others.length);
            return `<article class="h-seat pos-${i}${i === actor && (phase === "act" || phase === "cpu") ? " acting" : ""}${p.folded ? " folded" : ""}${p.chips <= 0 && p.folded ? " busted" : ""}${show && !p.folded ? " showing" : ""}" style="${slot};--seat:${i}"><header><b>${p.name}</b><span>${i === dealer ? '<i class="tok-d">D</i>' : ""}${i === sb ? "<i>SB</i>" : ""}${i === bb ? "<i>BB</i>" : ""}</span></header><div class="seat-bank"><span class="hp"><i style="--w:${Math.max(0, Math.round(p.chips / topStack * 100))}%"></i></span><strong>${p.chips.toLocaleString()}</strong></div><small>${p.chips <= 0 && p.folded ? "脱落" : p.allin ? "ALL-IN" : p.last}</small>${p.bet ? `<span class="seat-bet"><i>BET</i><b>${p.bet.toLocaleString()}</b></span>` : ""}<div class="status-strip">${statusMarkup(p,street)}</div><div class="seat-mods">${p.mods.map((m) => `<i class="${m.cat}" title="${m.name}">${m.icon}</i>`).join("")}</div><div class="tiny-cards">${show && !p.folded ? p.hole.map((c, j) => card(c, j)).join("") : p.hole.map((c, j) => p.exposed === "all" || (p.exposed && j === 0) ? card(c,j) : card(null, j, true)).join("")}</div>${show && !p.folded && p.rank ? `<b class="seat-rank">${roleName(p.rank.name)}</b>` : ""}</article>`;
        }).join("");
        const canAct = phase === "act" && actionPlayer?.human && !manualResolving;
        const canSee = mode === "solo" ?
            !!viewer && !viewer.folded && phase !== "setup" :
            canAct;
        const holeNow = (viewer?.hole || []).map((c) => `${c.s}${c.r}`);
        const holeKey = `${handNo}:${viewer?.id}:${canSee}:${holeNow.join("|")}`;
        if (holeKey !== lastHoleKey) {
            // 同じ勝負のあいだに中身が変わった札は、その場で書き換わって見えるようにする。
            // 「いちばん高い手札を下げた」と言われても、札が黙って別物になっていると分からない。
            const swapped = lastHoleHand === handNo && lastHoleCards.length === holeNow.length ?
                holeNow.map((v, i) => lastHoleCards[i] && lastHoleCards[i] !== v) : [];
            $("#hole").innerHTML = canSee ?
                viewer.hole.map((c, i) => card(c, i)).join("") :
                card(null, 0, true) + card(null, 1, true);
            if (canSee && swapped.some(Boolean) && !reduced()) {
                [...$("#hole").children].forEach((el, i) => { if (swapped[i]) el.classList.add("changed"); });
                cue("attack");
            }
            lastHoleCards = holeNow;
            lastHoleHand = handNo;
            lastHoleKey = holeKey;
        }
        $("#active-name").textContent = `${viewer?.name || "あなた"} の手札`;
        $("#viewer-status").innerHTML=viewer?statusMarkup(viewer,street):"";
        let due = Math.max(0, currentBet - (actionPlayer?.bet || 0));
        $(".active-pod").dataset.active = String(canAct);
        $(".active-pod").dataset.viewer=String(viewer?.id??0);
        const chainNow = Math.min(3, (mode === "solo" ? P[0] : viewer)?.streak || 0);
        document.body.dataset.chain = String(chainNow);
        // 卓は回戦が上がるほど熱を持つ。色は差し色一色のまま、濃さだけが進む。
        document.body.dataset.level = String(Math.min(9, run ? run.level : level));
        const chainBox = $("#chain-box");
        chainBox.hidden = chainNow < 2;
        $("#chain").textContent = `×${(mode === "solo" ? P[0] : viewer)?.streak || 0}`;
        const myDue = Math.max(0, currentBet - (viewer?.bet || 0));
        const myPay = Math.min(myDue, viewer?.chips || 0);
        $("#checkcall").innerHTML = myDue ?
            `CALL <small>${myPay.toLocaleString("ja-JP")}${myDue > (viewer?.chips || 0) ? "（ALL-IN）" : ""}</small>` :
            "CHECK";
        $("#raise-value").textContent = raiseTo;
        odometer($("#viewer-chips"), viewer?.chips || 0);
        $("#viewer-hp").style.setProperty("--w", `${Math.max(0, Math.round((viewer?.chips || 0) / topStack * 100))}%`);
        $("#to-call").textContent = myDue ? myPay.toLocaleString("ja-JP") : "—";
        $("#viewer-bet").textContent = (viewer?.bet || 0).toLocaleString("ja-JP");
        // 肩書きは短く戻し、その横に「何番目に動くか」を小さく添える
        const seatedOrder = [];
        for (let k = 1; k <= P.length; k++) {
            const q = P[(dealer + k) % P.length];
            if (q && !q.out && q.chips > 0) seatedOrder.push(q.id);
        }
        const spot = seatedOrder.indexOf(viewer?.id ?? -1);
        const role = viewer?.id === dealer ? "DEALER" : viewer?.id === sb ? "SB" : viewer?.id === bb ? "BB" : "—";
        $("#position").innerHTML = `${role}<small>${spot >= 0 ? `${seatedOrder.length}人中 ${spot + 1}番目に動く` : "見学"}</small>`;
        ["fold", "checkcall", "raise", "allin", "minus", "plus"].forEach(
            (id) => ($("#" + id).disabled = !canAct),
        );
        const locked=canAct && actionPlayer.silenced && street==="pre";
        ["raise","minus","plus"].forEach(id=>$("#"+id).disabled=!canAct || locked);
        $("#allin").disabled=!canAct || (locked && actionPlayer.chips>due);
        let rank =
            viewer?.blinded ? "—" :
            board.length >= 3 && viewer?.hole?.length ?
            handRank(viewer).name :
            "—";
        const nameEl = $("#hand-name");
        nameEl.textContent = rank === "—" ? "—" : roleName(rank);
        // 役が上がった瞬間を黙って通さない。ポーカーの気持ちよさはほぼここにある。
        const step = ROLE_ORDER.indexOf(rank);
        const seen = `${handNo}:${step}`;
        if (rank !== "—" && seen !== lastRoleKey) {
            const climbed = lastRoleHand === handNo && step > lastRoleStep;
            lastRoleKey = seen; lastRoleHand = handNo; lastRoleStep = step;
            if (climbed && !reduced()) {
                nameEl.classList.remove("climb");
                void nameEl.offsetWidth;
                nameEl.classList.add("climb");
                cue("win", Math.min(6, step));
                if (step >= 4) popAt($(".active-pod"), `${roleName(rank)} が完成`, step >= 6 ? "big" : "mid");
            }
        } else if (rank === "—") { lastRoleKey = null; lastRoleStep = -1; }
        renderScout(viewer);
        placeScout();
        const rack = viewer ? `<span class="rack-pips"><em>自分の能力</em>${Array.from({length:slotCap()},(_,i)=>
            `<i class="${viewer.mods[i]?"filled "+viewer.mods[i].cat:"empty"}"></i>`).join("")}<b>${viewer.mods.length}/${slotCap()}</b></span>` + synergyMarkup(viewer) : "";
        const strongRivals = P.filter(q => q.id !== viewer?.id && !q.out && !q.folded && q.tell === "強い").length;
        const infoValue = {
            odds: `${Math.round((Math.max(0, currentBet - (viewer?.bet || 0)) / Math.max(1, pot() + Math.max(0, currentBet - (viewer?.bet || 0)))) * 100)}%`,
            scan: viewer?.fogged ? "無効" : deck.length ? `${RN[deck[deck.length-1].r] || deck[deck.length-1].r}${deck[deck.length-1].s}` : "なし",
            tell: `強い ${strongRivals}人`,
            map: `あと${run ? Math.max(0, handsPerLevel - run.handInLevel) : Math.max(1, handsPerLevel - ((handNo - 1) % handsPerLevel))}回`,
        };
        $("#module-tray").innerHTML=viewer?.mods.length?viewer.mods.map(m=>{
            const ready=m.manual&&canAct&&viewer===actionPlayer&&Rogue.manualReady(m,effectContext(),viewer),used=viewer.used?.['manual:'+m.id];
            const state=viewer.fogged&&m.cat==="info"?"無効":infoValue[m.id]??(m.manual?(used?"使用済":ready?"押せる":"待機"):(viewer.fired?.[m.id]?"発動済":"自動"));
            return `<button class="mod-chip ${m.cat} ${m.manual?"manual":"auto"} ${ready?"ready":""} ${used?"spent":""}" data-module="${m.id}" title="${m.codeName} / ${m.desc}"><b>${m.icon}</b>${m.name}<span>${state}</span></button>`;
        }).join(""):`<span class="empty">${run?"能力なし　毎回1つもらえる。BACK ROOM でも買える":"能力なし　勝つとレア・伝説、負けても通常能力"}</span>`;
        if(rack) $("#module-tray").insertAdjacentHTML("afterbegin",rack);
        $("#module-tray").querySelectorAll("button").forEach(b=>b.onclick=()=>{
            const m=mods.find(m=>m.id===b.dataset.module);
            if(m.manual){openTargetPicker(m,viewer);return;}
            $("#effect-receipt").innerHTML=`<b>${m.name} / ${Rogue.tiers[m.tier]}</b><span>${m.desc}</span><span>${viewer.fired?.[m.id]||"条件成立時に自動発動"}${m.cat==="info"?" / "+(infoValue[m.id]??"待機中"):""}</span>`;
        });
        ["pre", "flop", "turn", "river"].forEach((s) =>
            $("#s-" + s)?.classList.toggle("on", street === s),
        );
        const phaseName=({pre:"手札で勝負",flop:"場札3枚",turn:"場札4枚",river:"最後の場札",showdown:"カードを公開"})[street]||"";
        const whose=actionPlayer?.name||"";
        const heading=phase==="act"||phase==="cpu"||phase==="pass"||phase==="await"?`${whose} の番`:phase==="transition"?"アクションの結果":phase==="draft"?"能力を選んでください":"今回の勝負の結果";
        const instruction=phase==="act"?(locked?"増額を止められています。CHECK / CALL / FOLDから選ぼう。":due?`続けるには${Math.min(due,actionPlayer.chips)}枚。CALLで続行、RAISEで増額、FOLDで降ります。`:"CHECKは追加0枚。RAISEならチップを追加して勝負できます。"):phase==="cpu"?`${whose} が考えています。操作せずに待ってください。`:phase==="await"?`${whose} の操作を待っています。`:phase==="pass"?"その人に端末を渡してから、手札を開いてください。":phase==="transition"?(lastActionText||"カードを配っています。自分の番までお待ちください。"):"勝敗と報酬を確認しましょう。";
        const stage = phaseName || (phase === "setup" ? "" : "配布中");
        $(".active-pod").classList.toggle("revealing", !!document.body.dataset.showdown);
        $("#turn-banner").innerHTML=`<i id="table-msg">${stage}</i><strong>${heading}</strong><span>${instruction}</span>`;
        $("#turn-banner").dataset.your=String(canAct);
        if (online() && isHost()) netSend(snapshotFor(remoteSeat));
        $("#message").textContent =
            phase === "pass" ?
            "端末を渡す" :
            phase === "cpu" ?
            "相手が考えています" :
            phase === "await" ?
            "相手の端末を待っています" :
            phase === "showdown" ?
            "勝負終了" :
            phase === "won" ?
            "勝負終了" :
            phase === "transition" ?
            "効果を処理中" :
            "あなたの操作待ち";
    }

    $("#start").onclick = init;
    $("#sound-toggle").onclick = () => {
        if (!soundEngine) {
            $("#sound-toggle").textContent = "音は使えません";
            return;
        }
        soundEnabled = soundEngine.setEnabled(!soundEnabled);
        $("#sound-toggle").textContent = soundEnabled ? "音 オン" : "音 オフ";
        $("#sound-toggle").setAttribute("aria-pressed", String(soundEnabled));
        if (soundEnabled) cue("action");
    };
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
    $("#leave-backroom").onclick = () => { if (phase === "backroom") { $("#backroom").classList.add("hidden"); nextLevel(); } };
    $("#backroom-reroll").onclick = rerollShop;
    $("#scrap-minus").onclick = () => { if (phase === "backroom" && run.scrapApplied > 0) { run.scrapApplied--; renderBackroom(); } };
    $("#scrap-plus").onclick = () => { if (phase === "backroom" && run.scrapApplied < scrapUsable()) { run.scrapApplied++; renderBackroom(); } };
    $("#restart").onclick = () => location.reload();
    let dlg = $("#manual");
    $("#help").onclick = () => dlg.showModal();
    dlg.querySelector(".close").onclick = () => dlg.close();

    function tick(t) {
        if (phase === "round-result" && deadline > 0) {
            const left = Math.max(0, Math.ceil((deadline - t) / 1000));
            const el = $("#round-time");
            if (el) { el.textContent = `${left}s`; el.dataset.low = String(left <= 10); }
            if (!left) $("#to-rewards").onclick();
        }
        if (phase === "draft" && deadline > 0 && !draftLocked) {
            const left = Math.max(0, Math.ceil((deadline - t) / 1000));
            $("#draft-time").textContent = `${left}s`;
            $("#draft-time").dataset.low = String(left <= 10);
            if (!left) {
                deadline = 0;
                // 時間切れは先頭を自動で取る。ただし満杯のときは、黙って何かを外すより見送る。
                // 見送りは次の勝負をその場で始めてしまうので、tick の中からは呼ばない。
                const hero = rewardOwner;
                // 時間切れの既定は先頭を取る（満杯なら先頭と入れ替え）。
                // 見送りは「押して選ぶ」ものとして残す。放置で自動的に見送ると、
                // 補助能力だけの棚が固定されて卓が終わらなくなる（実測で確認）。
                if (hero.human && hero.mods.length >= slotCap()) installPick(hero, 0, hero.mods[0].id);
                else installPick(hero, 0);
            }
        }
        if ((phase === "act" || phase === "await") && actDeadline > 0) {
            const left = Math.max(0, Math.ceil((actDeadline - t) / 1000));
            const bar = $("#act-timer");
            bar.hidden = false;
            bar.style.setProperty("--left", `${Math.max(0, Math.min(100, (actDeadline - t) / (ACT_SECONDS * 10)))}%`);
            bar.dataset.low = String(left <= 5);
            bar.textContent = `${left}s`;
            if (!left) {
                actDeadline = 0;
                const p = P[actor];
                // 相手待ちのまま時間切れなら、ホストが代わりに降ろす。回線が切れても卓が止まらない。
                if (phase === "await" && isHost()) phase = "act";
                if (!online() || isHost()) act(currentBet > (p?.bet || 0) ? "fold" : "check");
            }
        } else {
            $("#act-timer").hidden = true;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();
