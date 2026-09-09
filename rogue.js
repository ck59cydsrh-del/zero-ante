(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.Rogue = api;
})(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    const rows = [
        ['odds','%','POT CALC','info',1,'自分の番に、CALLする価値を考える目安の勝率を表示。勝つ確率の予測ではありません。'],
        ['scan','PEEK','CARD PEEK','info',1,'まだ出ていない場札の次の1枚を、自分だけ先に見る。'],
        ['tell','READ','TELL TAP','info',1,'相手が行動したときの手の強さを表示。端末共有時は相手の直近アクションを表示。'],
        ['map','NEXT','BLIND MAP','info',1,'次の強制参加額と、あと何回の勝負で上がるかを表示。'],
        ['rebuy','+1000','LIFE PATCH','guard',1,'所持2000枚未満で勝負を始めると、一度だけ1000チップ追加。0からの復帰は不可。'],
        ['insurance','1BB','FOLD SHIELD','guard',1,'FOLD時、投入済みチップから最大1BBを回収。'],
        ['scramble','HIGH','CARD SCRAMBLE','attack',2,'開始時、次の生存相手の最も高い手札を山札と交換。'],
        ['lowcut','LOW','LOW CUT','attack',2,'開始時、次の生存相手の最も低い手札を山札と交換。'],
        ['silence','LOCK','RAISE JAMMER','attack',3,'次の生存相手のプリフロップRAISEを封印。CALL分を超えるALL-INも不可。'],
        ['drain','−200','CHIP SIPHON','attack',2,'開始時、次の生存相手から最大200チップを奪う。相手に1チップは残す。'],
        ['jam','MUTE','SHIELD BREAK','attack',3,'次の生存相手の守りの能力を、そのハンド中すべて無効化。'],
        ['fog','NO DATA','SIGNAL FOG','attack',2,'次の生存相手の情報能力を、そのハンド中すべて無効化。'],
        ['pressure','ANTE','PRESSURE TAX','attack',2,'開始時、次の生存相手から最大1BBを追加アンティとしてポットに投入。'],
        ['expose','EYE','OPEN CIRCUIT','attack',3,'次の生存相手の手札1枚を、開始時から全員に公開。'],
        ['redline','R+1','RED OVERCLOCK','chaos',3,'開始時、自分の手札の♥・♦を1ランク上に書き換える。Aが上限。'],
        ['blackline','B+1','BLACK OVERCLOCK','chaos',3,'開始時、自分の手札の♠・♣を1ランク上に書き換える。Aが上限。'],
        ['thirdhole','+CARD','POCKET EXPANSION','chaos',3,'開始時、自分に3枚目の手札を配る。最強の5枚で判定。'],
        ['reroll','REWIRE','POCKET REWIRE','chaos',2,'開始時、自分の最も低い手札を山札と交換。'],
        ['pairforge','COPY','PAIR FORGE','chaos',3,'開始時、自分の2枚目の手札を1枚目と同じランクに書き換える。'],
        ['riverboost','RIVER+','RIVER AMP','chaos',2,'FOLDせずリバー到達時、5枚目の場札を1ランク上げる。Aが上限。'],
        ['doubleante','×2','ANTE SURGE','chaos',3,'開始時、全生存者から最大1BBずつ追加アンティを徴収。所有者ごとに発動。'],
        ['bounty','+800','VICTORY BOUNTY','chaos',2,'最初のポットに勝つと、ポットとは別に800チップ獲得。'],
        ['downshift','−2','DOWN SHIFT','attack',2,'手番中に1回、選んだ相手の最も高い手札の数字を2下げる。2が下限。'],
        ['pocketstatic','NOISE','POCKET STATIC','attack',2,'手番中に1回、選んだ相手の手札1枚を山札とランダム交換する。'],
        ['suitburn','♣','SUIT BURN','attack',2,'手番中に1回、選んだ相手の手札1枚のスートを♣へ書き換える。'],
        ['ranklock','≤7','RANK LOCK','attack',3,'手番中に1回、選んだ相手の最も高い手札を7以下に固定する。'],
        ['boardscramble','↻1','BOARD SCRAMBLE','chaos',2,'場札が出た後の手番中に1回、見えている場札1枚を山札と交換する。'],
        ['boardwipe','↻ALL','BOARD WIPE','chaos',3,'場札が出た後の手番中に1回、見えている場札をすべて交換する。'],
        ['rankroulette','RNG','RANK ROULETTE','chaos',3,'場札が出た後の手番中に1回、見えている場札すべての数字をランダムにする。'],
        ['suitstorm','SUIT','SUIT STORM','chaos',2,'場札が出た後の手番中に1回、見えている場札すべてのスートをランダムにする。'],
        ['mirror','SWAP','MIRROR TAP','attack',3,'手番中に1回、選んだ相手の最も高い手札と、自分の最も低い手札を入れ替える。'],
        ['tax','−300','DIRECT TAX','attack',2,'手番中に1回、選んだ相手から300チップを奪う。相手に1チップは残す。'],
        ['freeze','=2','COLD DECK','attack',2,'手番中に1回、選んだ相手の最も低い手札を2に固定する。'],
        ['spotlight','SHOW','SPOTLIGHT','attack',3,'手番中に1回、選んだ相手の手札を全員に公開する。'],
        ['rankdrop','−1ALL','RANK DROP','attack',3,'手番中に1回、選んだ相手の手札すべてを1ランク下げる。2が下限。'],
        ['snowball','CHAIN','CHAIN AMP','chaos',2,'開始時、連勝数×200チップ獲得。連勝が切れると0。'],
        ['taxman','+CUT','HOUSE CUT','chaos',3,'メインポット勝利時、まだ脱落していない全員から100ずつ徴収。'],
        ['lowball','L+1','LOW TIDE','chaos',1,'開始時、自分の最も低い手札を1ランク上に書き換える。Aが上限。'],
        ['refund','50%','REBATE','guard',2,'FOLDした勝負の終了時、そのハンドで払った額の50%が戻る。'],
        ['deflect','返','DEFLECT','guard',2,'このハンド最初に受けた妨害を無効にし、撃った相手から300チップ奪う。'],
        ['steady','固','HOLD FAST','guard',2,'このハンド、自分の手札は誰にも書き換えられない。'],
        ['tollgate','関','TOLL GATE','guard',3,'ほかの人が増額するたび、その額の1割を通行料として受け取る。'],
        ['lockout','封','LOCKOUT','guard',3,'手番中に1回、選んだ相手の押して撃つ能力をこのハンド封じる。'],
        ['overheat','SUIT=','SUIT LOCK','chaos',2,'開始時、自分の手札をすべて1枚目と同じスートに揃える。'],
        ['suitveil','NO SUIT','SUIT VEIL','chaos',3,'開始時、自分以外の全員はこのハンド、場札のスートが見えなくなる。判定でフラッシュ系が作れない。'],
        ['handpick','拾','HAND PICK','chaos',3,'場札が出た後の手番中に1回、見えている場札1枚と自分の手札1枚を入れ替える。'],
        ['lastword','後','LAST WORD','chaos',2,'開始時、自分の手番をその回のいちばん後ろに回す。相手を見てから決められる。'],
        ['allornothing','倍','ALL OR NOTHING','chaos',3,'手番中に1回。この勝負の自分の増減が、勝っても負けても2倍になる。'],
        ['bedrock','底','BEDROCK','chaos',2,'判定時、自分の役はワンペアを下回らない。'],
        ['handjack','奪','HAND JACK','attack',3,'手番中に1回、選んだ相手と手札を丸ごと交換する。'],
        ['blindfold','盲','BLINDFOLD','attack',2,'手番中に1回、選んだ相手はこのハンド、自分の役が見えなくなる。'],
        ['deckread','×3','DEEP READ','info',2,'まだ出ていない場札を3枚先まで見る。'],
    ];
    const plainNames = {odds:'必要な勝率を見る',scan:'次の場札を1枚先に見る',tell:'相手の様子を見る',map:'次の参加額を見る',rebuy:'ピンチで1000枚',insurance:'降りても少し返る',deflect:'最初の妨害を跳ね返す',steady:'手札を守る',tollgate:'増額から通行料をとる',lockout:'相手の手動能力を封じる',scramble:'相手の高い札を交換',lowcut:'相手の低い札を交換',silence:'最初の増額を止める',drain:'相手から200枚もらう',jam:'相手の守りを止める',fog:'相手の情報能力を止める',pressure:'相手に追加参加費',expose:'相手の札を1枚公開',redline:'手札の赤い札を1つ強く',blackline:'手札の黒い札を1つ強く',thirdhole:'手札が3枚になる',reroll:'自分の低い札を交換',pairforge:'最初からペア',riverboost:'場の5枚目を強く',doubleante:'全員の参加費アップ',bounty:'勝ったら追加800枚',
        mirror:'相手の高い札と交換',tax:'相手から300枚もらう',freeze:'相手の低い札を2に',spotlight:'相手の手札を全員に公開',
        rankdrop:'相手の札を全部1つ弱く',snowball:'連勝ぶんチップ',taxman:'勝つと全員から徴収',lowball:'いちばん低い手札を1つ強く',
        refund:'降りた分が半分戻る',overheat:'手札のスートを揃える',suitveil:'相手全員のフラッシュを封じる',
        handpick:'場札と手札を入れ替える',lastword:'手番を最後に回す',allornothing:'この勝負の増減が2倍',
        bedrock:'役がワンペアを下回らない',handjack:'相手と手札を丸ごと交換',blindfold:'相手の役を見えなくする',
        deckread:'次の場札を3枚先まで見る',
        downshift:'相手の高い札を2つ弱く',pocketstatic:'相手の札1枚を引き直させる',suitburn:'相手の札を♣に変える',ranklock:'相手の高い札を7以下に',
        boardscramble:'場札1枚を引き直す',boardwipe:'場札を全部引き直す',rankroulette:'場札の数字を全部ランダムに',suitstorm:'場札のスートを全部ランダムに'};
    const plain = text => text.replaceAll('回復','チップ追加').replaceAll('ハンド','勝負').replaceAll('全生存者','まだ脱落していない全員').replaceAll('プリフロップ','場札が出る前の勝負').replaceAll('フロップ','最初の場札3枚').replaceAll('リバー','最後の場札').replaceAll('アンティ','参加費').replaceAll('メインポット','最初のポット').replaceAll('ランク','数字').replaceAll('生存相手','まだ脱落していない相手').replaceAll('1BB','その回の大きい参加額（BB）');
    const manualIds = new Set(['downshift','pocketstatic','suitburn','ranklock','boardscramble','boardwipe','rankroulette','suitstorm','mirror','tax','freeze','spotlight','rankdrop','lockout','handpick','allornothing','handjack','blindfold']);
    const targetIds = new Set(['downshift','pocketstatic','suitburn','ranklock','mirror','tax','freeze','spotlight','rankdrop','lockout','handjack','blindfold']);
    const boardIds = new Set(['boardscramble','boardwipe','rankroulette','suitstorm','handpick']);
    const catalog = rows.map(([id,icon,name,cat,tier,desc]) => ({id,icon,name:plainNames[id]||name,plain:plainNames[id]||name,codeName:name,cat,tier,desc:plain(desc),manual:manualIds.has(id),targeted:targetIds.has(id),board:boardIds.has(id)}));
    const tiers = {1:'通常',2:'レア',3:'伝説'};
    const RANK_LABEL = {11:'J',12:'Q',13:'K',14:'A'};
    const label = c => c ? `${c.s}${RANK_LABEL[c.r]||c.r}` : '—';
    const has = (p,id) => p.mods.some(m => m.id === id);
    const usable = (p,m) => !(p.guardJammed && m.cat === 'guard') && !(p.fogged && m.cat === 'info');
    // 妨害が刺さる直前に、守り側の言い分を通す。
    // 返せた／止めたが見えないと、守りの札は持っている意味が分からない。
    function guarded(ctx, p, m, target) {
        if (m.cat !== 'attack' || target === p || !target || target.folded) return false;
        target.used ||= {};
        const shield = target.mods && target.mods.find(x => x.id === 'deflect');
        if (shield && !target.used['deflect'] && usable(target, shield)) {
            target.used['deflect'] = true;
            const n = Math.min(300, Math.max(0, p.chips - 1));
            p.chips -= n; target.chips += n;
            emit(ctx, target, shield, `${p.name} の妨害を跳ね返した / +${n}枚`, p);
            return true;
        }
        // 「盾」— 守りを2枚寄せた棚は、毎ハンド1発だけ妨害を受け流す
        if (hasSyn(target, 'guard', 2) && !target.used['syn:shield']) {
            target.used['syn:shield'] = true;
            emit(ctx, target, { id: 'syn-guard2', name: '盾', cat: 'guard', icon: '×2' }, `${p.name} の妨害を受け流した`, p);
            return true;
        }
        return false;
    }

    function emit(ctx,p,m,copy,target=p) {
        p.fired ||= {};
        p.fired[m.id] = copy;
        // 「追撃」— 妨害が当たるたびに削り取る
        if (m.cat === 'attack' && target !== p && hasSyn(p, 'attack', 2) && !/BLOCKED/.test(copy)) p.chips += 250;
        const event = {owner:p.id,target:target.id,id:m.id,name:m.name,cat:m.cat,copy,ownerName:p.name,targetName:target.name};
        ctx.events.push(event);
        return event;
    }
    function add(ctx,p,m,n,reason) {
        const before=p.chips;
        p.chips += n;
        // An ALL-IN remains locked until the next hand, even if a bonus supplies chips.
        emit(ctx,p,m,`${reason}。チップ ${before}枚 → ${p.chips}枚（銀行から +${n}枚。体力ではありません）`);
    }
    const opponent = (ctx,p) => {
        for(let k=1;k<ctx.players.length;k++) {
            const q=ctx.players[(p.id+k)%ctx.players.length];
            if(!q.folded) return q;
        }
    };
    /* ── 系統シナジー ──────────────────────────────────────────
       同じ系統を2枚・3枚と重ねると、その系統らしい効果が無料で付く。
       1枚ずつ強い能力を拾うか、系統を寄せて土台を作るか——
       ここができて初めて「組み方」が生まれる。 */
    const SYNERGY = {
        attack: [{ n: 2, name: "追撃", copy: "妨害を当てるたびに +250枚" },
                 { n: 3, name: "制圧", copy: "毎回1発、押して撃つ能力が減らない" }],
        guard:  [{ n: 2, name: "盾", copy: "毎回1発、妨害を受け流す" },
                 { n: 3, name: "要塞", copy: "手札も場札も書き換えられない" }],
        chaos:  [{ n: 2, name: "変異", copy: "開始時、いちばん低い手札を引き直す" },
                 { n: 3, name: "暴走", copy: "開始時、手札が3枚になる" }],
        info:   [{ n: 2, name: "観測", copy: "次の場札が常に見える" },
                 { n: 3, name: "透視", copy: "相手1人の手札が公開される" }],
    };
    const catCount = (p, cat) => p.mods.filter(m => m.cat === cat).length;
    // 「制圧」— 勝負ごとに1発だけ、使い切りを帳消しにする。
    // 撃つたびに棚が痩せる妨害型に、寄せる理由を与える。
    function keepsCharge(p) {
        if (!hasSyn(p, 'attack', 3)) return false;
        p.used ||= {};
        if (p.used['syn:keep']) return false;
        p.used['syn:keep'] = true;
        return true;
    }
    // その系統でいま届いている段（0 = なし）
    const tierOf = (p, cat) => SYNERGY[cat].reduce((best, s) => catCount(p, cat) >= s.n ? Math.max(best, s.n) : best, 0);
    const hasSyn = (p, cat, n) => catCount(p, cat) >= n;
    // 守りの札が立っているあいだは、札そのものが動かない
    const holeLocked = q => !!(q && (q.steady || q.fortress));
    const boardLocked = ctx => ctx.players.some(q => !q.folded && q.fortress);
    function synergies(p) {
        const out = [];
        for (const cat of Object.keys(SYNERGY))
            for (const s of SYNERGY[cat])
                if (catCount(p, cat) >= s.n) out.push({ cat, ...s });
        return out;
    }

    function opening(ctx) {
        ctx.players.forEach(p=>{p.fired={};p.used={};p.silenced=false;p.guardJammed=false;p.fogged=false;p.exposed=false;p.suitBlind=false;p.steady=false;p.fortress=false;p.lastAct=false;p.bedrock=false;p.blinded=false;p.stakeX=1;});
        // Jamming has explicit priority so seating order cannot make protection inconsistent.
        for(const p of ctx.players.filter(p=>!p.folded)) for(const m of p.mods.filter(m=>m.id==='jam'||m.id==='fog')) {
            const q=opponent(ctx,p); if(!q) continue;
            if(guarded(ctx,p,m,q)) continue;
            q[m.id==='jam'?'guardJammed':'fogged']=true;
            emit(ctx,p,m,m.id==='jam'?'防御系をこのハンド無効化':'情報系をこのハンド無効化',q);
        }
        for(const p of ctx.players.filter(p=>!p.folded)) synergyOpening(ctx, p);
        for(const p of ctx.players.filter(p=>!p.folded)) for(const m of p.mods) {
            if(!usable(p,m)) { emit(ctx,p,m,'BLOCKED　相手に止められている');continue; }
            const q=opponent(ctx,p);
            if(m.id==='rebuy' && p.chips<2000 && !p.rebuyUsed) {add(ctx,p,m,1000,'緊急回復');p.rebuyUsed=true;}
            if(m.id==='snowball') {const n=(p.streak||0)*200;if(n)add(ctx,p,m,n,`連勝 ×${p.streak}`);else emit(ctx,p,m,'連勝なし / 加算 0');}
            if(m.id==='overheat' && p.hole.length>1) {const suit=p.hole[0].s;p.hole=p.hole.map(c=>({...c,s:suit}));emit(ctx,p,m,`手札 ${p.hole.length}枚を ${suit} に揃えた`);}
            if(['scramble','lowcut','reroll'].includes(m.id)) {
                const who=m.id==='reroll'?p:q; if(!who || !ctx.deck.length) continue;
                if(who!==p && guarded(ctx,p,m,who)) continue;
                if(who!==p && holeLocked(who)) { emit(ctx,p,m,`${who.name} の手札は守られている`,who); continue; }
                const ranks=who.hole.map(c=>c.r), rank=m.id==='scramble'?Math.max(...ranks):Math.min(...ranks);
                const index=ranks.indexOf(rank), before=label(who.hole[index]);
                who.hole[index]=ctx.deck.pop();
                emit(ctx,p,m,`${before} → ${label(who.hole[index])}`,who);
            }
            if(m.id==='silence' && q && !guarded(ctx,p,m,q)) {q.silenced=true;emit(ctx,p,m,'PRE-FLOP / RAISE・増額ALL-INを封印',q);}
            if(m.id==='drain' && q && !guarded(ctx,p,m,q)) {const n=Math.min(200,Math.max(0,q.chips-1));q.chips-=n;p.chips+=n;emit(ctx,p,m,`相手 −${n} / 自分 +${n}`,q);}
            if(m.id==='pressure' && q && !guarded(ctx,p,m,q)) {const n=Math.min(q.chips,ctx.bb);q.chips-=n;q.total+=n;if(!q.chips)q.allin=true;emit(ctx,p,m,`追加ANTE ${n} → POT`,q);}
            if(m.id==='expose' && q && !guarded(ctx,p,m,q)) {q.exposed=true;emit(ctx,p,m,`${label(q.hole[0])} を全員に公開`,q);}
            if(m.id==='lastword') {p.lastAct=true;emit(ctx,p,m,'この回の手番をいちばん後ろへ回した');}
            if(m.id==='bedrock') {p.bedrock=true;emit(ctx,p,m,'役はワンペアを下回らない');}
            if(m.id==='thirdhole' && ctx.deck.length) {p.hole.push(ctx.deck.pop());emit(ctx,p,m,`手札 ${p.hole.length}枚に拡張`);}
            if(m.id==='pairforge' && p.hole.length>1) {p.hole[1]={...p.hole[1],r:p.hole[0].r};emit(ctx,p,m,'2枚目のランクを書き換え → PAIR形成');}
            if((m.id==='redline'||m.id==='blackline') && p.hole.length) {
                const suits=m.id==='redline'?['♥','♦']:['♠','♣'];
                let n=0;
                p.hole=p.hole.map(c=>{ if(suits.includes(c.s)&&c.r<14){n++;return {...c,r:c.r+1};} return c; });
                emit(ctx,p,m,n?`手札の${m.id==='redline'?'赤':'黒'}い札 ${n}枚を1つ強く書き換えた`:`対象の${m.id==='redline'?'赤':'黒'}い札なし / 変化なし`);
            }
            if(m.id==='lowball' && p.hole.length) {
                let index=0;
                for(let i=1;i<p.hole.length;i++) if(p.hole[i].r<p.hole[index].r) index=i;
                if(p.hole[index].r<14){p.hole[index]={...p.hole[index],r:p.hole[index].r+1};emit(ctx,p,m,'いちばん低い手札を1つ強く書き換えた');}
                else emit(ctx,p,m,'手札がすべてA / 変化なし');
            }
            if(m.id==='suitveil') {
                let n=0;
                for(const q of ctx.players.filter(q=>q.id!==p.id&&!q.folded)){q.suitBlind=true;n++;}
                emit(ctx,p,m,`${n}人がこのハンド、スートを見失う（フラッシュ不可）`);
            }
            if(m.id==='doubleante') {let total=0;for(const q of ctx.players.filter(q=>!q.folded)){const n=Math.min(q.chips,ctx.bb);q.chips-=n;q.total+=n;if(!q.chips)q.allin=true;total+=n;}emit(ctx,p,m,`全員追加ANTE / POT +${total}`);}
        }
        return ctx.events;
    }
    // 系統がそろっていることで起きる分。能力と同じ書式で告知する。
    function synergyOpening(ctx, p) {
        const mark = (cat, n) => {
            const s = SYNERGY[cat].find(x => x.n === n);
            return { id: 'syn-' + cat + n, name: s.name, cat, icon: '×' + n };
        };
        if (hasSyn(p, 'guard', 3)) { p.fortress = true; emit(ctx, p, mark('guard', 3), '手札も場札も書き換えられない'); }
        if (has(p, 'steady') && usable(p, p.mods.find(x => x.id === 'steady'))) { p.steady = true; emit(ctx, p, p.mods.find(x => x.id === 'steady'), 'このハンド、手札は書き換えられない'); }
        if (hasSyn(p, 'attack', 3)) emit(ctx, p, mark('attack', 3), 'この勝負、押して撃つ能力を1発ぶん温存できる');
        if (hasSyn(p, 'chaos', 2) && p.hole.length && ctx.deck.length) {
            let i = 0;
            for (let k = 1; k < p.hole.length; k++) if (p.hole[k].r < p.hole[i].r) i = k;
            p.hole[i] = ctx.deck.pop();
            emit(ctx, p, mark('chaos', 2), 'いちばん低い手札を引き直した');
        }
        if (hasSyn(p, 'chaos', 3) && ctx.deck.length && p.hole.length < 3) {
            p.hole.push(ctx.deck.pop());
            emit(ctx, p, mark('chaos', 3), '手札が3枚になった');
        }
        if (hasSyn(p, 'info', 3) && usable(p, { cat: 'info' })) {
            const q = ctx.players.find(x => x.id !== p.id && !x.folded && x.hole?.length);
            if (q) { q.exposed = true; emit(ctx, p, mark('info', 3), `${q.name} の手札が公開される`, q); }
        }
    }

    function action(ctx,p,type) {
        p.used ||= {};
        for(const m of p.mods.filter(m=>usable(p,m))) {
            if(p.used[m.id]) continue;
            if(m.id==='insurance'&&type==='fold') {const n=Math.min(ctx.bb,p.total);p.total-=n;p.bet=Math.max(0,p.bet-n);p.chips+=n;emit(ctx,p,m,`POTから ${n}回収 → STACK ${p.chips}`);p.used[m.id]=true;}
            if(m.id==='refund'&&type==='fold') {p.refundBase=p.total;}
        }
        // 関所は「誰かが増額するたび」に効く。撃った本人ではなく、待っている側の札。
        if(type==='raise') for(const keeper of ctx.players) {
            if(keeper===p || keeper.folded || !has(keeper,'tollgate')) continue;
            const gate=keeper.mods.find(x=>x.id==='tollgate');
            if(!usable(keeper,gate)) continue;
            const n=Math.min(Math.floor(p.bet*0.1), Math.max(0,p.chips-1));
            if(n<=0) continue;
            p.chips-=n; keeper.chips+=n;
            emit(ctx,keeper,gate,`${p.name} の増額から通行料 ${n}枚`,p);
        }
    }
    function street(ctx,name) {
        for(const p of ctx.players.filter(p=>!p.folded)) for(const m of p.mods.filter(m=>usable(p,m))) {
            p.used ||= {};
            const key=m.id+':'+name;if(p.used[key])continue;
            if(name==='river'&&m.id==='riverboost') {const c=ctx.board[4];if(c){ctx.board[4]={...c,r:Math.min(14,c.r+1)};emit(ctx,p,m,`場札5枚目 ${c.r} → ${ctx.board[4].r} / 全員共通`);p.used[key]=true;}}
        }
    }
    // ALL OR NOTHING — その勝負の増減だけを2倍にする。
    // ポットの分配そのものは触らず、差額を銀行が上乗せ／没収する。
    function settle(ctx, p) {
        if (!p || (p.stakeX || 1) === 1) return 0;
        const swing = p.chips - (p.startChips || p.chips);
        // 勝ちはそのまま倍。負けも倍だが、持っている以上は取られない（0で止まる）。
        const extra = swing >= 0 ? swing : -Math.min(-swing, p.chips);
        p.chips += extra;
        return extra;
    }

    function result(ctx,winners) {
        for(const p of ctx.players) {
            if(!p.participated || (p.stakeX||1)===1) continue;
            const gate=p.mods.find(x=>x.id==='allornothing'); if(!gate) continue;
            const extra=settle(ctx,p);
            emit(ctx,p,gate,`${extra>=0?'+':''}${extra}枚 / 増減が2倍になった`);
        }
        for(const p of ctx.players) for(const m of p.mods.filter(m=>usable(p,m))) {
            if(!p.participated) continue;
            // 勝負が終わった時点で0枚なら、そこで飛ぶ。ここで補助が届くと
            // 「もらって全部賭けて失う」を延々と繰り返して卓が終わらない（実測でレベル600）。
            if(p.chips<=0) continue;
            if(m.id==='bounty'&&winners.includes(p.id))add(ctx,p,m,800,'勝利報酬');
            if(m.id==='refund'&&p.folded&&p.refundBase) {add(ctx,p,m,Math.floor(p.refundBase/2),'降り分の返金');p.refundBase=0;}
            if(m.id==='taxman'&&winners.includes(p.id)) {
                let total=0;
                for(const q of ctx.players.filter(q=>q.id!==p.id&&q.chips>0)){const n=Math.min(100,Math.max(0,q.chips-1));q.chips-=n;total+=n;}
                p.chips+=total;emit(ctx,p,m,`全員から徴収 / +${total}`);
            }
        }
    }
    function rankCards(p,board) {
        // 補正は配布時に札そのものへ入れてある。ここは素直に7枚を返すだけ。
        return [...p.hole,...board];
    }
    // BEDROCK — ハイカードで終わらせない。役の下限をワンペアに引き上げる。
    const floorsRank = p => !!(p && p.bedrock);
    function manualReady(m,ctx,p) {
        if(m?.id==='tax'&&!ctx.players.some(q=>q.id!==p?.id&&!q.folded&&q.chips>1)) return false;
        if(!m?.manual || !p || p.folded || !usable(p,m) || p.used?.['manual:'+m.id]) return false;
        if(m.board && (!ctx.board || ctx.board.length<3)) return false;
        if(m.id==='boardwipe' && ctx.deck.length<ctx.board.length) return false;
        if(m.id==='boardscramble' && !ctx.deck.length) return false;
        if(m.targeted && !ctx.players.some(q=>q.id!==p.id&&!q.folded&&q.hole?.length)) return false;
        if(m.id==='pocketstatic' && !ctx.deck.length) return false;
        // 空振りする相手には撃たせない。使い切りなので、外すと札が無駄になる。
        if(m.id==='lockout' && !ctx.players.some(q=>q.id!==p.id&&!q.folded&&q.mods.some(x=>x.manual&&!q.used?.['manual:'+x.id]))) return false;
        if(m.id==='handjack' && !ctx.players.some(q=>q.id!==p.id&&!q.folded&&q.hole?.length)) return false;
        if(m.id==='handpick' && !p.hole?.length) return false;
        return true;
    }
    function manual(ctx,p,moduleId,targetId) {
        const m=p?.mods?.find(x=>x.id===moduleId);
        if(!m?.manual) return {ok:false,reason:'この能力は手動発動ではありません'};
        if(!manualReady(m,ctx,p)) return {ok:false,reason:m.board&&ctx.board.length<3?'場札が3枚出るまで待ってください':'この勝負ではもう使えません'};
        const q=m.targeted?ctx.players.find(x=>x.id===Number(targetId)&&x.id!==p.id&&!x.folded):null;
        if(m.targeted&&!q) return {ok:false,reason:'対象を選んでください'};
        // 撃つ前に守りを通す。返された・受け流された場合は、そこで終わり。
        if(q && guarded(ctx,p,m,q)) return {ok:true,event:ctx.events[ctx.events.length-1],guarded:true};
        const rewrites=['downshift','pocketstatic','suitburn','mirror','freeze','rankdrop','ranklock'].includes(m.id);
        if(q && rewrites && holeLocked(q)) return {ok:true,event:emit(ctx,p,m,`${q.name} の手札は守られている`,q),guarded:true};
        if(m.board && boardLocked(ctx)) return {ok:true,event:emit(ctx,p,m,'場札は守られている'),guarded:true};
        let copy='', event;
        if(m.id==='downshift') {
            const index=q.hole.reduce((best,c,i,a)=>c.r>a[best].r?i:best,0);
            q.hole[index]={...q.hole[index],r:Math.max(2,q.hole[index].r-2)};
            copy='いちばん高い手札を2つ下げた';
        } else if(m.id==='pocketstatic') {
            const index=Math.floor(Math.random()*q.hole.length), old=q.hole[index];
            q.hole[index]=ctx.deck.pop();ctx.deck.unshift(old);
            copy=`${label(old)} → ${label(q.hole[index])}`;
        } else if(m.id==='suitburn') {
            const index=Math.floor(Math.random()*q.hole.length);
            q.hole[index]={...q.hole[index],s:'♣'};
            copy='手札1枚のスートを ♣ にした';
        } else if(m.id==='mirror') {
            const theirs=q.hole.reduce((best,c,i,a)=>c.r>a[best].r?i:best,0);
            const mine=p.hole.reduce((best,c,i,a)=>c.r<a[best].r?i:best,0);
            const keep=q.hole[theirs];q.hole[theirs]=p.hole[mine];p.hole[mine]=keep;
            copy=`相手の ${label(keep)} と 自分の ${label(q.hole[theirs])} を交換`;
        } else if(m.id==='tax') {
            const n=Math.min(300,Math.max(0,q.chips-1));
            q.chips-=n;p.chips+=n;
            copy=`相手 −${n} / 自分 +${n}`;
        } else if(m.id==='freeze') {
            const index=q.hole.reduce((best,c,i,a)=>c.r<a[best].r?i:best,0);
            q.hole[index]={...q.hole[index],r:2};
            copy='いちばん低い手札を2にした';
        } else if(m.id==='spotlight') {
            q.exposed='all';
            copy=`${q.hole.map(label).join(' ')} を全員に公開`;
        } else if(m.id==='rankdrop') {
            q.hole=q.hole.map(c=>({...c,r:Math.max(2,c.r-1)}));
            copy=`手札 ${q.hole.length}枚をすべて1つ下げた`;
        } else if(m.id==='handjack') {
            const mine=p.hole, theirs=q.hole;
            p.hole=theirs; q.hole=mine;
            copy=`${q.name} と手札を丸ごと交換した`;
        } else if(m.id==='blindfold') {
            q.blinded=true;
            copy=`${q.name} はこのハンド、自分の役が見えない`;
        } else if(m.id==='allornothing') {
            p.stakeX=2;
            copy='この勝負の増減が2倍になる';
        } else if(m.id==='handpick') {
            const seen=ctx.board.filter(Boolean);
            if(!seen.length||!p.hole.length) return {ok:false,reason:'入れ替える札がありません'};
            let bi=0; for(let i=1;i<seen.length;i++) if(seen[i].r>seen[bi].r) bi=i;
            let hi=0; for(let i=1;i<p.hole.length;i++) if(p.hole[i].r<p.hole[hi].r) hi=i;
            const took=ctx.board[bi], gave=p.hole[hi];
            ctx.board[bi]=gave; p.hole[hi]=took;
            copy=`場札の ${label(took)} と 手札の ${label(gave)} を入れ替えた`;
        } else if(m.id==='lockout') {
            q.used ||= {};
            let n=0;
            for(const x of q.mods.filter(x=>x.manual)) { if(!q.used['manual:'+x.id]) { q.used['manual:'+x.id]=true; n++; } }
            copy=n?`押して撃つ能力 ${n}個をこのハンド封じた`:'封じる能力が無かった';
        } else if(m.id==='ranklock') {
            const index=q.hole.reduce((best,c,i,a)=>c.r>a[best].r?i:best,0);
            q.hole[index]={...q.hole[index],r:Math.min(7,q.hole[index].r)};
            copy='いちばん高い手札を7以下にした';
        } else if(m.id==='boardscramble') {
            const index=Math.floor(Math.random()*ctx.board.length), old=ctx.board[index], fresh=ctx.deck.pop();
            ctx.board[index]=fresh;ctx.deck.unshift(old);
            copy=`場札 ${index+1}枚目を ${fresh.s}${fresh.r>10?({11:'J',12:'Q',13:'K',14:'A'}[fresh.r]):fresh.r} に交換`;
        } else if(m.id==='boardwipe') {
            const fresh=ctx.board.map(()=>ctx.deck.pop()), old=ctx.board.splice(0,ctx.board.length,...fresh);
            ctx.deck.unshift(...old);
            copy=`場札 ${fresh.length}枚をすべて交換`;
        } else if(m.id==='rankroulette') {
            for(let i=0;i<ctx.board.length;i++)ctx.board[i]={...ctx.board[i],r:2+Math.floor(Math.random()*13)};
            copy=`場札 ${ctx.board.length}枚の数字を再抽選`;
        } else if(m.id==='suitstorm') {
            const suits=['♠','♥','♦','♣'];
            for(let i=0;i<ctx.board.length;i++)ctx.board[i]={...ctx.board[i],s:suits[Math.floor(Math.random()*4)]};
            copy=`場札 ${ctx.board.length}枚のスートを再抽選`;
        }
        p.used ||= {};p.used['manual:'+m.id]=true;
        event=emit(ctx,p,m,copy,q||p);
        if(m.board){event.scope='board';event.targetName='BOARD';}
        return {ok:true,event};
    }
    function readout(p,ctx) {
        if(p.fogged)return ['SIGNAL FOG / 情報系無効'];
        const data=[];
        if(has(p,'odds'))data.push(`コールに必要な勝率 ${ctx.due?Math.round(ctx.due/(ctx.pot+ctx.due)*100):0}%`);
        if(has(p,'scan')||hasSyn(p,'info',2))data.push(`次の場札 ${ctx.deck&&ctx.deck.length?label(ctx.deck[ctx.deck.length-1]):'なし'}`);
        if(has(p,'deckread'))data.push(`この先3枚 ${ctx.deck&&ctx.deck.length?ctx.deck.slice(-3).reverse().map(label).join(' '):'なし'}`);
        if(has(p,'tell'))data.push('相手の手 ' + ctx.players.filter(q=>q.id!==p.id&&!q.out).map(q=>`${q.name}:${q.tell||q.last||'まだ'}`).join(' / '));
        if(has(p,'map'))data.push(`次の参加額 ${ctx.nextBlinds||'これ以上なし'}（あと${ctx.untilLevel}回）`);
        return data;
    }
    function rewardPool(p,won) {return catalog.filter(m=>!has(p,m.id)&&(won?m.tier>=2:m.tier===1));}
    return {catalog,tiers,opening,action,street,result,rankCards,manual,manualReady,readout,rewardPool,has,usable,SYNERGY,synergies,catCount,keepsCharge,floorsRank};
});
