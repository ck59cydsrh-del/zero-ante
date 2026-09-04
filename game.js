(() => {
  const $=s=>document.querySelector(s), SUITS=['♠','♥','♦','♣'], RANKS=[2,3,4,5,6,7,8,9,10,11,12,13,14], RN={11:'J',12:'Q',13:'K',14:'A'};
  let phase='idle',ante=1,lives=3,pWins=0,dWins=0,total=0,hand=[],dealerPool=[],selected=new Set(),relics=[],offers=[],deadline=0;
  const relicDefs=[
    {id:'heart',icon:'♥×2',name:'HEART ENGINE',desc:'Each heart adds +18 POWER',bonus:(cards)=>cards.filter(c=>c.suit==='♥').length*18},
    {id:'ace',icon:'A+',name:'ACE CACHE',desc:'Each ace adds +35 POWER',bonus:(cards)=>cards.filter(c=>c.rank===14).length*35},
    {id:'pair',icon:'22',name:'PAIR PRESS',desc:'Pair and Two Pair gain +80 POWER',bonus:(_,e)=>['PAIR','TWO PAIR'].includes(e.name)?80:0},
    {id:'straight',icon:'→5',name:'LINE DRIVER',desc:'Straight hands gain +140 POWER',bonus:(_,e)=>e.name.includes('STRAIGHT')?140:0},
    {id:'flush',icon:'●5',name:'INK FLUSH',desc:'Flush hands gain +150 POWER',bonus:(_,e)=>e.name.includes('FLUSH')?150:0},
    {id:'low',icon:'2—6',name:'LOW VOLTAGE',desc:'Cards 2–6 add +14 POWER each',bonus:(cards)=>cards.filter(c=>c.rank<=6).length*14},
    {id:'wide',icon:'+1',name:'WIDE DRAW',desc:'Draw one additional card each hand',effect:'wide'},
    {id:'crown',icon:'JQK',name:'COURT TAX',desc:'Face cards add +16 POWER each',bonus:(cards)=>cards.filter(c=>c.rank>=11&&c.rank<=13).length*16}
  ];
  const makeDeck=()=>SUITS.flatMap(suit=>RANKS.map(rank=>({suit,rank,id:`${suit}${rank}`})));
  function shuffle(a){for(let i=a.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  function combos(a,k){const out=[];function go(start,p){if(p.length===k){out.push(p);return}for(let i=start;i<=a.length-(k-p.length);i++)go(i+1,[...p,a[i]])}go(0,[]);return out}
  function evaluate(cards){
    const rs=cards.map(c=>c.rank).sort((a,b)=>b-a),counts={};rs.forEach(r=>counts[r]=(counts[r]||0)+1);const groups=Object.entries(counts).map(([r,n])=>({r:+r,n})).sort((a,b)=>b.n-a.n||b.r-a.r);const flush=cards.every(c=>c.suit===cards[0].suit);let uniq=[...new Set(rs)];if(uniq[0]===14)uniq.push(1);let highStraight=0;for(let i=0;i<=uniq.length-5;i++)if(uniq[i]-uniq[i+4]===4)highStraight=Math.max(highStraight,uniq[i]);const straight=!!highStraight;
    let cat=0,name='HIGH CARD';if(groups[0].n===2){cat=1;name='PAIR'}if(groups[0].n===2&&groups[1]?.n===2){cat=2;name='TWO PAIR'}if(groups[0].n===3){cat=3;name='THREE'}if(straight){cat=4;name='STRAIGHT'}if(flush){cat=5;name='FLUSH'}if(groups[0].n===3&&groups[1]?.n===2){cat=6;name='FULL HOUSE'}if(groups[0].n===4){cat=7;name='FOUR'}if(straight&&flush){cat=8;name=highStraight===14?'ROYAL FLUSH':'STRAIGHT FLUSH'}
    const tie=groups.flatMap(g=>Array(g.n).fill(g.r)).reduce((n,r)=>n*15+r,0);return {cat,name,base:cat*180+rs.reduce((a,r)=>a+r,0)+Math.floor(tie/100000)};
  }
  function power(cards,isPlayer=true){const e=evaluate(cards);let value=e.base;if(isPlayer)relics.forEach(r=>value+=r.bonus?r.bonus(cards,e):0);return {...e,power:value}}
  function best(pool,isPlayer=false){return combos(pool,5).map(cards=>({cards,...power(cards,isPlayer)})).sort((a,b)=>b.power-a.power)[0]}

  function deal(){
    phase='select';selected.clear();const deck=shuffle(makeDeck()),draw=8+(relics.some(r=>r.effect==='wide')?1:0);hand=deck.splice(0,draw);dealerPool=deck.splice(0,Math.min(7+ante,11));$('#dealer-rank').textContent='HIDDEN';$('#round-result').textContent='SELECT YOUR HAND';$('#phase-label').textContent='SELECT 5 CARDS';$('#play-hand').textContent='PLAY HAND ';$('#play-hand').insertAdjacentHTML('beforeend','<kbd>ENTER</kbd>');renderCards();update();message('NEW CARDS RECEIVED');
  }
  function toggleCard(i){if(phase!=='select')return;if(selected.has(i))selected.delete(i);else if(selected.size<5)selected.add(i);renderCards();update()}
  function play(){if(phase==='reveal'){deal();return}if(phase!=='select'||selected.size!==5)return;phase='reveal';const mine=[...selected].sort((a,b)=>a-b).map(i=>hand[i]),me=power(mine,true),dealer=best(dealerPool,false);total+=me.power;const win=me.power>dealer.power,tie=me.power===dealer.power;if(win)pWins++;else if(!tie)dWins++;$('#hand-rank').textContent=me.name;$('#hand-power').textContent=`${String(me.power).padStart(3,'0')} PWR`;$('#dealer-rank').textContent=`${dealer.name} / ${dealer.power}`;$('#round-result').textContent=tie?'PUSH':win?'YOU WIN':'HOUSE WINS';$('#phase-label').textContent='HAND RESOLVED';renderCards(dealer.cards);message(tie?'POWER COLLISION':win?'PAYOUT ACCEPTED':'SIGNAL REJECTED');update();
    if(pWins>=2||dWins>=2){setTimeout(resolveBlind,850)}else{$('#play-hand').disabled=false;$('#play-hand').textContent='NEXT HAND ';$('#play-hand').insertAdjacentHTML('beforeend','<kbd>ENTER</kbd>')}
  }
  function resolveBlind(){if(pWins>=2){if(ante>=5){finish(true);return}phase='draft';beginDraft()}else{lives--;if(lives<=0){finish(false);return}pWins=dWins=0;phase='select';message('INTEGRITY LOST / RETRY BLIND');setTimeout(deal,700)}update()}
  function beginDraft(){offers=[...relicDefs].filter(r=>!relics.some(x=>x.id===r.id)).sort(()=>Math.random()-.5).slice(0,3);$('#relic-cards').innerHTML=offers.map((r,i)=>`<button class="relic-card" data-i="${i}"><span>RELIC_0${i+1}</span><i>${r.icon}</i><h3>${r.name}</h3><p>${r.desc}</p></button>`).join('');$('#relic-cards').querySelectorAll('button').forEach(b=>b.onclick=()=>chooseRelic(+b.dataset.i));deadline=performance.now()+12000;$('#draft').classList.remove('hidden')}
  function chooseRelic(i){if(phase!=='draft'||!offers[i])return;relics.push(offers[i]);ante++;pWins=dWins=0;$('#draft').classList.add('hidden');message(`${offers[i].name} INSTALLED`);deal()}
  function finish(win){phase='ended';$('#result-label').textContent=win?'RUN COMPLETE':'RUN TERMINATED';$('#result-title').textContent=win?'HOUSE BROKEN':'NO CREDIT';$('#result-copy').textContent=`ANTE ${String(ante).padStart(2,'0')} / ${relics.length} RELICS / ${total} TOTAL POWER`;$('#result').classList.remove('hidden');update()}
  function start(){phase='select';$('#intro').classList.add('hidden');$('#result').classList.add('hidden');deal()}
  function reset(){ante=1;lives=3;pWins=dWins=0;total=0;hand=[];dealerPool=[];selected.clear();relics=[];offers=[];phase='idle';$('#result').classList.add('hidden');$('#draft').classList.add('hidden');$('#intro').classList.remove('hidden');renderCards();update()}

  function cardHTML(c,i,selectable=false){const red=c.suit==='♥'||c.suit==='♦';return `<${selectable?'button':'div'} class="playing-card ${red?'red':''} ${selected.has(i)?'selected':''}" ${selectable?`data-i="${i}" aria-pressed="${selected.has(i)}"`:''}><span class="rank">${RN[c.rank]||c.rank}</span><span class="suit">${c.suit}</span><span class="serial">${String(i+1).padStart(2,'0')}</span></${selectable?'button':'div'}>`}
  function renderCards(revealed=null){$('#player-cards').innerHTML=hand.length?hand.map((c,i)=>cardHTML(c,i,true)).join(''):Array(8).fill('<div class="playing-card back"></div>').join('');$('#player-cards').querySelectorAll('button').forEach(b=>b.onclick=()=>toggleCard(+b.dataset.i));$('#dealer-cards').innerHTML=revealed?revealed.map((c,i)=>cardHTML(c,i)).join(''):Array(5).fill('<div class="playing-card back"></div>').join('')}
  function update(){
    $('#ante-label').textContent=`ANTE_${String(ante).padStart(2,'0')} / 05`;$('#select-count').textContent=`${selected.size} / 5`;$('#play-hand').disabled=phase==='select'?selected.size!==5:phase!=='reveal';$('#player-wins').textContent=pWins;$('#dealer-wins').textContent=dWins;document.querySelectorAll('#player-pips i').forEach((e,i)=>e.classList.toggle('on',i<pWins));document.querySelectorAll('#dealer-pips i').forEach((e,i)=>e.classList.toggle('on',i<dWins));$('#life-text').textContent=`${lives} / 3`;document.querySelectorAll('#lives i').forEach((e,i)=>e.classList.toggle('off',i>=lives));$('#total-power').textContent=String(total).padStart(5,'0');$('#relic-list').innerHTML=relics.length?relics.map(r=>`<li>${r.name}<b>${r.icon}</b></li>`).join(''):'<li class="empty">NO RELICS FOUND</li>';
    if(phase==='select'&&selected.size===5){const e=power([...selected].map(i=>hand[i]),true);$('#hand-rank').textContent=e.name;$('#hand-power').textContent=`${String(e.power).padStart(3,'0')} PWR`}else if(phase==='select'){$('#hand-rank').textContent='—';$('#hand-power').textContent='000 PWR'}
  }
  function message(t){$('#message').textContent=t}
  function tick(t){if(phase==='draft'){const s=Math.max(0,Math.ceil((deadline-t)/1000));$('#draft-time').textContent=s;if(s===0)chooseRelic(0)}requestAnimationFrame(tick)}
  $('#start-button').onclick=start;$('#play-hand').onclick=play;$('#restart-button').onclick=reset;const manual=$('#manual');$('#help').onclick=()=>manual.showModal();manual.querySelector('.close').onclick=()=>manual.close();addEventListener('keydown',e=>{if(e.key===' '&&phase==='idle'){e.preventDefault();start()}if(e.key==='Enter'&&!$('#play-hand').disabled)play();if(e.key.toLowerCase()==='r'&&phase==='ended')reset();if(phase==='draft'&&['1','2','3'].includes(e.key))chooseRelic(+e.key-1)});
  if(document.modelContext?.registerTool){try{void Promise.resolve(document.modelContext.registerTool({name:'start_rogue_poker_run',title:'Start rogue poker run',description:'Start a new ZERO//ANTE rogue poker run and deal the first hand.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(){reset();start();return{status:'selecting',ante,drawCount:hand.length,requiredSelection:5,lives}}})).catch(()=>{})}catch(_){}}
  reset();requestAnimationFrame(tick);
})();
