(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.Rogue = api;
})(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    const rows = [
        ['odds','%','POT CALC','info',1,'自分の番に、CALLする価値を考える目安の勝率を表示。勝つ確率の予測ではありません。'],
        ['scan','5/7','HAND SCAN','info',1,'場札が3枚以上のとき、現在の最強役を表示。'],
        ['tell','READ','TELL TAP','info',1,'CPUが行動した際の手の強さを表示。端末共有時は相手の直近アクションを表示。'],
        ['map','NEXT','BLIND MAP','info',1,'次の強制参加額と、あと何回の勝負で上がるかを表示。'],
        ['rebuy','+100','LIFE PATCH','guard',1,'残り200未満のハンド開始時、一度だけ100回復。0からの復帰は不可。'],
        ['reserve','+60','RESERVE CELL','guard',2,'残り300未満のハンド開始時、60回復。'],
        ['insurance','1BB','FOLD SHIELD','guard',1,'FOLD時、投入済みチップから最大1BBを回収。'],
        ['cushion','+15','FLOP BUFFER','guard',1,'FOLDせずフロップに到達すると15チップ獲得。'],
        ['patience','+10','CHECK ENGINE','guard',1,'ハンドで最初のCHECK時に10チップ獲得。'],
        ['cashback','+10','CALL CACHE','guard',1,'ハンドで最初のCALL時に10チップ獲得。'],
        ['comeback','+40','SECOND WIND','guard',1,'メインポットに負けたハンドの終了時、40回復。'],
        ['vault','+20','POWER SUPPLY','guard',2,'各ハンド開始時、20チップ獲得。'],
        ['scramble','HIGH','CARD SCRAMBLE','attack',2,'開始時、次の生存相手の最も高い手札を山札と交換。'],
        ['lowcut','LOW','LOW CUT','attack',2,'開始時、次の生存相手の最も低い手札を山札と交換。'],
        ['silence','LOCK','RAISE JAMMER','attack',3,'次の生存相手のプリフロップRAISEを封印。CALL分を超えるALL-INも不可。'],
        ['drain','−20','CHIP SIPHON','attack',2,'開始時、次の生存相手から最大20チップを奪う。相手に1チップは残す。'],
        ['jam','MUTE','SHIELD BREAK','attack',3,'次の生存相手の防御能力を、そのハンド中すべて無効化。'],
        ['fog','NO DATA','SIGNAL FOG','attack',2,'次の生存相手の情報能力を、そのハンド中すべて無効化。'],
        ['pressure','ANTE','PRESSURE TAX','attack',2,'開始時、次の生存相手から最大1BBを追加アンティとしてポットに投入。'],
        ['expose','EYE','OPEN CIRCUIT','attack',3,'次の生存相手の手札1枚を、開始時から全員に公開。'],
        ['redline','R+1','RED OVERCLOCK','chaos',3,'判定時、自分が使う♥・♦を1ランク上として扱う。Aが上限。'],
        ['blackline','B+1','BLACK OVERCLOCK','chaos',3,'判定時、自分が使う♠・♣を1ランク上として扱う。Aが上限。'],
        ['sixboard','+BOARD','SIXTH STREET','chaos',3,'自分がFOLDしていなければ、リバーに場札を1枚追加。重複発動なし。'],
        ['thirdhole','+CARD','POCKET EXPANSION','chaos',3,'開始時、自分に3枚目の手札を配る。最強の5枚で判定。'],
        ['reroll','REWIRE','POCKET REWIRE','chaos',2,'開始時、自分の最も低い手札を山札と交換。'],
        ['pairforge','COPY','PAIR FORGE','chaos',3,'開始時、自分の2枚目の手札を1枚目と同じランクに書き換える。'],
        ['hearts','HEART','HEART BUS','chaos',2,'開始時、自分の手札をすべて♥に書き換える。'],
        ['spades','SPADE','SPADE BUS','chaos',2,'開始時、自分の手札をすべて♠に書き換える。'],
        ['flopshift','SWAP','FLOP SWITCH','chaos',2,'FOLDせずフロップ到達時、場の3枚目を山札と交換。全員に適用。'],
        ['riverboost','RIVER+','RIVER AMP','chaos',2,'FOLDせずリバー到達時、5枚目の場札を1ランク上げる。Aが上限。'],
        ['doubleante','×2','ANTE SURGE','chaos',3,'開始時、全生存者から最大1BBずつ追加アンティを徴収。所有者ごとに発動。'],
        ['bounty','+80','VICTORY BOUNTY','chaos',2,'メインポット勝利時、ポットとは別に80チップ獲得。'],
    ];
    const plainNames = {odds:'必要な勝率を見る',scan:'今の役がわかる',tell:'相手の様子を見る',map:'次の参加額を見る',rebuy:'ピンチで100枚',reserve:'ピンチで60枚',insurance:'降りても少し返る',cushion:'場札3枚で15枚',patience:'CHECKで10枚',cashback:'CALLで10枚',comeback:'負けても40枚',vault:'毎回20枚もらう',scramble:'相手の高い札を交換',lowcut:'相手の低い札を交換',silence:'最初の増額を止める',drain:'相手から20枚もらう',jam:'相手のチップ補助を止める',fog:'相手の情報能力を止める',pressure:'相手に追加参加費',expose:'相手の札を1枚公開',redline:'赤い札を1つ強く',blackline:'黒い札を1つ強く',sixboard:'場札を6枚にする',thirdhole:'手札が3枚になる',reroll:'自分の低い札を交換',pairforge:'最初からペア',hearts:'手札をすべてハートに',spades:'手札をすべてスペードに',flopshift:'場の3枚目を交換',riverboost:'場の5枚目を強く',doubleante:'全員の参加費アップ',bounty:'勝ったら追加80枚'};
    const plain = text => text.replaceAll('回復','チップ追加').replaceAll('ハンド','勝負').replaceAll('全生存者','まだ脱落していない全員').replaceAll('プリフロップ','場札が出る前の勝負').replaceAll('フロップ','最初の場札3枚').replaceAll('リバー','最後の場札').replaceAll('アンティ','参加費').replaceAll('メインポット','最初のポット').replaceAll('ランク','数字').replaceAll('生存相手','まだ脱落していない相手').replaceAll('残り200未満','所持チップが200枚未満').replaceAll('残り300未満','所持チップが300枚未満').replaceAll('1BB','その回の大きい参加額（BB）');
    const catalog = rows.map(([id,icon,name,cat,tier,desc]) => ({id,icon,name,codeName:name,cat,tier,desc:plain(desc)}));
    const tiers = {1:'通常',2:'レア',3:'伝説'};
    const has = (p,id) => p.mods.some(m => m.id === id);
    const usable = (p,m) => !(p.guardJammed && m.cat === 'guard') && !(p.fogged && m.cat === 'info');
    function emit(ctx,p,m,copy,target=p) {
        p.fired ||= {};
        p.fired[m.id] = copy;
        const event = {owner:p.id,target:target.id,id:m.id,name:m.name,cat:m.cat,copy,ownerName:p.name,targetName:target.name};
        ctx.events.push(event);
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
    function opening(ctx) {
        ctx.players.forEach(p=>{p.fired={};p.used={};p.silenced=false;p.guardJammed=false;p.fogged=false;p.exposed=false;});
        // Jamming has explicit priority so seating order cannot make protection inconsistent.
        for(const p of ctx.players.filter(p=>!p.folded)) for(const m of p.mods.filter(m=>m.id==='jam'||m.id==='fog')) {
            const q=opponent(ctx,p); if(!q) continue;
            q[m.id==='jam'?'guardJammed':'fogged']=true;
            emit(ctx,p,m,m.id==='jam'?'防御系をこのハンド無効化':'情報系をこのハンド無効化',q);
        }
        for(const p of ctx.players.filter(p=>!p.folded)) for(const m of p.mods) {
            if(!usable(p,m)) { emit(ctx,p,m,'BLOCKED / SHIELD BREAKまたはSIGNAL FOGで無効');continue; }
            const q=opponent(ctx,p);
            if(m.id==='rebuy' && p.chips<200 && !p.rebuyUsed) {add(ctx,p,m,100,'緊急回復');p.rebuyUsed=true;}
            if(m.id==='reserve' && p.chips<300) add(ctx,p,m,60,'予備電源');
            if(m.id==='vault') add(ctx,p,m,20,'電源供給');
            if(['scramble','lowcut','reroll'].includes(m.id)) {
                const who=m.id==='reroll'?p:q; if(!who || !ctx.deck.length) continue;
                const ranks=who.hole.map(c=>c.r), rank=m.id==='scramble'?Math.max(...ranks):Math.min(...ranks);
                who.hole[ranks.indexOf(rank)]=ctx.deck.pop();
                emit(ctx,p,m,'手札1枚を交換済み（内容は非公開）',who);
            }
            if(m.id==='silence' && q) {q.silenced=true;emit(ctx,p,m,'PRE-FLOP / RAISE・増額ALL-INを封印',q);}
            if(m.id==='drain' && q) {const n=Math.min(20,Math.max(0,q.chips-1));q.chips-=n;p.chips+=n;emit(ctx,p,m,`相手 −${n} / 自分 +${n}`,q);}
            if(m.id==='pressure' && q) {const n=Math.min(q.chips,ctx.bb);q.chips-=n;q.total+=n;if(!q.chips)q.allin=true;emit(ctx,p,m,`追加ANTE ${n} → POT`,q);}
            if(m.id==='expose' && q) {q.exposed=true;emit(ctx,p,m,'手札1枚を全員に公開',q);}
            if(m.id==='thirdhole' && ctx.deck.length) {p.hole.push(ctx.deck.pop());emit(ctx,p,m,`手札 ${p.hole.length}枚に拡張`);}
            if(m.id==='pairforge' && p.hole.length>1) {p.hole[1]={...p.hole[1],r:p.hole[0].r};emit(ctx,p,m,'2枚目のランクを書き換え → PAIR形成');}
            if(m.id==='hearts'||m.id==='spades') {const suit=m.id==='hearts'?'♥':'♠';p.hole=p.hole.map(c=>({...c,s:suit}));emit(ctx,p,m,`自分の手札スート → ${suit}`);}
            if(m.id==='doubleante') {let total=0;for(const q of ctx.players.filter(q=>!q.folded)){const n=Math.min(q.chips,ctx.bb);q.chips-=n;q.total+=n;if(!q.chips)q.allin=true;total+=n;}emit(ctx,p,m,`全員追加ANTE / POT +${total}`);}
        }
        return ctx.events;
    }
    function action(ctx,p,type) {
        p.used ||= {};
        for(const m of p.mods.filter(m=>usable(p,m))) {
            if(p.used[m.id]) continue;
            if(m.id==='insurance'&&type==='fold') {const n=Math.min(ctx.bb,p.total);p.total-=n;p.bet=Math.max(0,p.bet-n);p.chips+=n;emit(ctx,p,m,`POTから ${n}回収 → STACK ${p.chips}`);p.used[m.id]=true;}
            if((m.id==='patience'&&type==='check')||(m.id==='cashback'&&type==='call')) {add(ctx,p,m,10,type.toUpperCase()+' BONUS');p.used[m.id]=true;}
        }
    }
    function street(ctx,name) {
        for(const p of ctx.players.filter(p=>!p.folded)) for(const m of p.mods.filter(m=>usable(p,m))) {
            p.used ||= {};
            const key=m.id+':'+name;if(p.used[key])continue;
            if(name==='flop'&&m.id==='cushion') {add(ctx,p,m,15,'FLOP到達');p.used[key]=true;}
            if(name==='flop'&&m.id==='flopshift'&&ctx.deck.length) {ctx.board[2]=ctx.deck.pop();emit(ctx,p,m,'場札3枚目を交換 / 全員共通');p.used[key]=true;}
            if(name==='river'&&m.id==='riverboost') {const c=ctx.board[4];if(c){ctx.board[4]={...c,r:Math.min(14,c.r+1)};emit(ctx,p,m,`場札5枚目 ${c.r} → ${ctx.board[4].r} / 全員共通`);p.used[key]=true;}}
            if(name==='river'&&m.id==='sixboard'&&ctx.board.length===5&&ctx.deck.length) {ctx.board.push(ctx.deck.pop());emit(ctx,p,m,'場札 5 → 6枚 / 全員共通');p.used[key]=true;}
        }
    }
    function result(ctx,winners) {
        for(const p of ctx.players) for(const m of p.mods.filter(m=>usable(p,m))) {
            if(!p.participated) continue;
            if(m.id==='comeback'&&!winners.includes(p.id))add(ctx,p,m,40,'敗北回復');
            if(m.id==='bounty'&&winners.includes(p.id))add(ctx,p,m,80,'勝利報酬');
        }
    }
    function rankCards(p,board) {
        return [...p.hole,...board].map(c=>({...c,r:Math.min(14,c.r+((has(p,'redline')&&['♥','♦'].includes(c.s))||(has(p,'blackline')&&['♠','♣'].includes(c.s))?1:0))}));
    }
    function rankEvents(ctx) {
        for(const p of ctx.players.filter(p=>!p.folded)) for(const m of p.mods.filter(m=>['redline','blackline'].includes(m.id))) {
            const red=m.id==='redline';const count=[...p.hole,...ctx.board].filter(c=>(['♥','♦'].includes(c.s)===red)&&c.r<14).length;
            emit(ctx,p,m,`判定用の${red?'赤':'黒'}カード ${count}枚を +1 / A上限（表示札は原本）`);
        }
    }
    function readout(p,ctx) {
        if(p.fogged)return ['SIGNAL FOG / 情報系無効'];
        const data=[];
        if(has(p,'odds'))data.push(`POT ODDS ${ctx.due?Math.round(ctx.due/(ctx.pot+ctx.due)*100):0}%`);
        if(has(p,'scan'))data.push(ctx.handName||'HAND SCAN / FLOP待ち');
        if(has(p,'tell'))data.push(ctx.players.filter(q=>q.id!==p.id).map(q=>`${q.name} ${q.tell||q.last||'WAIT'}`).join(' · '));
        if(has(p,'map'))data.push(`NEXT ${ctx.nextBlinds||'MAX'} / ${ctx.untilLevel} HANDS`);
        return data;
    }
    function rewardPool(p,won) {return catalog.filter(m=>!has(p,m.id)&&(won?m.tier>=2:m.tier===1));}
    return {catalog,tiers,opening,action,street,result,rankCards,rankEvents,readout,rewardPool,has,usable};
});
