(() => {
  const $ = (s) => document.querySelector(s),
    SUITS = ["♠", "♥", "♦", "♣"],
    RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    RN = { 11: "J", 12: "Q", 13: "K", 14: "A" },
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
    lastHoleKey = "",
    lastBoardKey = "";
  const mods = [
    {
      id: "odds",
      icon: "%POT",
      name: "POT CALC",
      desc: "コール額とポットから必要勝率を表示。",
    },
    {
      id: "scan",
      icon: "5/7",
      name: "HAND SCAN",
      desc: "現在できている最強の役を常時表示。",
    },
    {
      id: "tell",
      icon: "CPU?",
      name: "TELL TAP",
      desc: "CPUのアクション強度を解析表示。",
    },
    {
      id: "map",
      icon: "BB→",
      name: "LEVEL MAP",
      desc: "次のブラインドレベルを先読み表示。",
    },
  ];
  const active = () => P.filter((p) => p.chips > 0),
    live = () => P.filter((p) => !p.folded),
    next = (i, filter = (p) => p.chips > 0) => {
      for (let k = 1; k <= P.length; k++) {
        let j = (i + k) % P.length;
        if (filter(P[j])) return j;
      }
      return i;
    },
    makeDeck = () => SUITS.flatMap((s) => RANKS.map((r) => ({ s, r })));
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
        .map(([r, n]) => ({ r: +r, n }))
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
    return { cat, tie, name };
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
  function init() {
    mode = $("#mode").value;
    N = +$("#count").value;
    P = Array.from({ length: N }, (_, i) => ({
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
    }));
    $("#setup").classList.add("hidden");
    handNo = 0;
    dealer = -1;
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
  function newHand() {
    if (active().length === 1) {
      finish(active()[0]);
      return;
    }
    handNo++;
    lastHoleKey = "";
    lastBoardKey = "";
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
      p.hole = p.folded ? [] : [deck.pop(), deck.pop()];
      p.last = p.folded ? "OUT" : "IN";
    });
    if (active().length >= 3) pay(P[bb], B);
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
    showActor(true);
    render();
  }
  function showActor(first = false) {
    if (!pending.size) {
      advance();
      return;
    }
    let p = P[actor];
    if (!p.human) {
      phase = "cpu";
      render();
      setTimeout(cpu, 420);
      return;
    }
    if (mode === "local" && !first) {
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
    render();
  }
  function advance() {
    if (street === "river") {
      showdown();
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
    pending = new Set(
      live()
        .filter((p) => !p.allin)
        .map((p) => p.id),
    );
    if (pending.size <= 1 && live().every((p) => p.allin || p.folded)) {
      while (board.length < 5) {
        deck.pop();
        board.push(deck.pop());
      }
      showdown();
      return;
    }
    actor = next(dealer, (p) => pending.has(p.id));
    raiseTo = minRaise;
    showActor(true);
    render();
  }
  function cpu() {
    let p = P[actor],
      due = Math.max(0, currentBet - p.bet),
      strength =
        board.length >= 3
          ? best7([...p.hole, ...board]).cat
          : Math.max(...p.hole.map((c) => c.r)) / 14,
      roll = Math.random();
    p.tell = strength > 4 ? "STRONG" : strength > 1 ? "MIXED" : "WEAK";
    if (due > p.chips * 0.45 && strength < 2) act("fold");
    else if (strength >= 4 && roll > 0.45) {
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
    let eligible = live();
    eligible.forEach((p) => (p.rank = best7([...p.hole, ...board])));
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
    render(true);
    setTimeout(() => afterHand(main), 1000);
  }
  function awardUncontested(p) {
    p.chips += pot();
    p.last = "POT WON";
    mainWinner = p;
    phase = "showdown";
    render();
    setTimeout(() => afterHand([p]), 700);
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
          `<button data-i="${i}"><span>LEGAL INFO_0${i + 1}</span><i>${m.icon}</i><h3>${m.name}</h3><p>${m.desc}</p></button>`,
      )
      .join("");
    $("#relic-cards")
      .querySelectorAll("button")
      .forEach((b) => (b.onclick = () => choose(p, +b.dataset.i)));
    $("#relic").classList.remove("hidden");
    deadline = performance.now() + 12000;
  }
  function choose(p, i) {
    if (!offers[i]) return;
    p.mods.push(offers[i]);
    $("#relic").classList.add("hidden");
    newHand();
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
    if (back) return `<i class="card card-back" style="--i:${i}"></i>`;
    let hot = c.s === "♥" || c.s === "♦";
    return `<i class="card ${hot ? "hot" : ""}" style="--i:${i}"><b>${RN[c.r] || c.r}</b><em>${c.s}</em><small>ZA/${i + 1}</small></i>`;
  }
  function render(show = false) {
    let [S, B] = LEVELS[level];
    $("#level").textContent = String(level + 1).padStart(2, "0");
    $("#blinds").textContent =
      `SB ${S} / BB ${B} / BBA ${active().length >= 3 ? B : 0}`;
    $("#pot").textContent = String(pot()).padStart(4, "0");
    const boardKey = board.map((c) => `${c.s}${c.r}`).join("|");
    if (boardKey !== lastBoardKey) {
      $("#board").innerHTML =
        board.map(card).join("") +
        Array(5 - board.length)
          .fill(0)
          .map((_, i) => card(null, i, true))
          .join("");
      lastBoardKey = boardKey;
    }
    $("#seats").innerHTML = P.map(
      (p, i) =>
        `<article class="h-seat pos-${i} ${i === actor && phase === "act" ? "acting" : ""} ${p.folded ? "folded" : ""}"><div class="avatar">${i + 1}</div><header><b>${p.name}</b><span>${i === dealer ? "D " : ""}${i === sb ? "SB " : ""}${i === bb ? "BB" : ""}</span></header><strong>${p.chips}</strong><small>${p.last}</small><div class="tiny-cards">${show && !p.folded ? p.hole.map(card).join("") : p.hole.map((_, j) => card(null, j, true)).join("")}</div></article>`,
    ).join("");
    const actionPlayer = P[actor] || P[0];
    const viewer = mode === "solo" ? P[0] : actionPlayer;
    const canAct = phase === "act" && actionPlayer?.human;
    const canSee = mode === "solo"
      ? !!viewer && !viewer.folded && phase !== "setup"
      : canAct;
    const holeKey = `${handNo}:${viewer?.id}:${canSee}:${viewer?.hole.map((c) => `${c.s}${c.r}`).join("|")}`;
    if (holeKey !== lastHoleKey) {
      $("#hole").innerHTML = canSee
        ? viewer.hole.map(card).join("")
        : card(null, 0, true) + card(null, 1, true);
      lastHoleKey = holeKey;
    }
    $("#active-name").textContent = `${viewer?.name || "TABLE"} / YOUR CARDS`;
    $("#turn-info").textContent = `${actionPlayer?.name || "TABLE"} TO ACT`;
    let due = Math.max(0, currentBet - (actionPlayer?.bet || 0));
    $("#checkcall").textContent = due
      ? `CALL ${Math.min(due, actionPlayer.chips)}`
      : "CHECK";
    $("#raise-value").textContent = raiseTo;
    ["fold", "checkcall", "raise", "allin", "minus", "plus"].forEach(
      (id) => ($("#" + id).disabled = !canAct),
    );
    let rank =
      viewer?.mods.some((m) => m.id === "scan") && board.length >= 3
        ? best7([...viewer.hole, ...board]).name
        : "—";
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
    ["pre", "flop", "turn", "river"].forEach((s) =>
      $("#s-" + s)?.classList.toggle("on", street === s),
    );
    $("#table-msg").textContent =
      street === "showdown"
        ? "SHOWDOWN"
        : `${street.toUpperCase()} / ${actionPlayer?.name || ""} TO ACT`;
    $("#message").textContent =
      phase === "pass"
        ? "PRIVATE HANDOFF"
        : phase === "cpu"
          ? "CPU THINKING"
          : "ACTION REQUIRED";
  }
  $("#start").onclick = init;
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
