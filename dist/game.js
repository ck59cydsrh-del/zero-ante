(() => {
  const $ = (s) => document.querySelector(s);
  const boardEl=$('#board'), intro=$('#intro'), draft=$('#draft'), result=$('#result');
  const SIZE=7;
  let mode='cpu', playing=false, drafting=false, board=[], selected=null, valid=[], turn='white', ap=2, floor=1, deadline=0, offers=[];
  const player={white:{wins:0,scrap:0,rules:[],shield:false},black:{wins:0,scrap:0,rules:[],shield:false}};
  const names={core:'C',blade:'B',wisp:'W'};

  const upgrades=[
    {id:'stride',icon:'↔',name:'LONG STEP',desc:'WISP may move up to 2 tiles',apply:p=>p.rules.push('LONG STEP')},
    {id:'slash',icon:'×',name:'CROSS CUT',desc:'BLADE gains orthogonal movement',apply:p=>p.rules.push('CROSS CUT')},
    {id:'ghost',icon:'□',name:'GHOST PATH',desc:'WISP may pass through one ally',apply:p=>p.rules.push('GHOST PATH')},
    {id:'crown',icon:'◇',name:'CROWN WALK',desc:'CORE may move up to 2 tiles',apply:p=>p.rules.push('CROWN WALK')},
    {id:'guard',icon:'▣',name:'NULL SHELL',desc:'First capture is cancelled each floor',apply:p=>{p.rules.push('NULL SHELL');p.shield=true}},
    {id:'tempo',icon:'++',name:'EXTRA CYCLE',desc:'Gain 3 actions on your next turn',apply:p=>{p.rules.push('EXTRA CYCLE');p.bonus=true}}
  ];

  function piece(type,side,x,y){return {id:crypto.randomUUID?.()||Math.random(),type,side,x,y}}
  function setupBoard(){
    board=[];
    [['wisp','black',1,0],['blade','black',2,0],['core','black',3,0],['blade','black',4,0],['wisp','black',5,0],['wisp','white',1,6],['blade','white',2,6],['core','white',3,6],['blade','white',4,6],['wisp','white',5,6]].forEach(v=>board.push(piece(...v)));
    selected=null;valid=[];turn=floor%2?'white':'black';ap=2;player.white.shield=player.white.rules.includes('NULL SHELL');player.black.shield=player.black.rules.includes('NULL SHELL');render();
    if(mode==='cpu'&&turn==='black')setTimeout(cpuTurn,550);
  }
  const at=(x,y)=>board.find(p=>p.x===x&&p.y===y);
  const inside=(x,y)=>x>=0&&x<SIZE&&y>=0&&y<SIZE;
  const has=(side,rule)=>player[side].rules.includes(rule);

  function getMoves(p){
    let vectors=[];
    if(p.type==='core'){const d=has(p.side,'CROWN WALK')?2:1;for(let r=1;r<=d;r++)vectors.push([r,0],[-r,0],[0,r],[0,-r],[r,r],[r,-r],[-r,r],[-r,-r]);}
    if(p.type==='blade'){vectors=[[1,1],[1,-1],[-1,1],[-1,-1]];if(has(p.side,'CROSS CUT'))vectors.push([1,0],[-1,0],[0,1],[0,-1]);}
    if(p.type==='wisp'){const d=has(p.side,'LONG STEP')?2:1;for(let r=1;r<=d;r++)vectors.push([r,0],[-r,0],[0,r],[0,-r]);}
    return vectors.map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).filter(m=>{
      if(!inside(m.x,m.y))return false;const target=at(m.x,m.y);if(target?.side===p.side)return false;
      const dist=Math.max(Math.abs(m.x-p.x),Math.abs(m.y-p.y));if(dist>1){const mx=p.x+Math.sign(m.x-p.x),my=p.y+Math.sign(m.y-p.y),block=at(mx,my);if(block&&!(p.type==='wisp'&&has(p.side,'GHOST PATH')&&block.side===p.side))return false;}
      return true;
    });
  }

  function clickTile(x,y){
    if(!playing||drafting||(mode==='cpu'&&turn==='black'))return;
    const target=at(x,y);
    if(selected&&valid.some(m=>m.x===x&&m.y===y)){move(selected,x,y);return;}
    if(target?.side===turn){selected=target;valid=getMoves(target);message(`${target.type.toUpperCase()} SELECTED`);}else{selected=null;valid=[];message('INVALID SIGNAL');}
    render();
  }

  function move(p,x,y){
    const target=at(x,y);let captured=false;
    if(target){
      if(player[target.side].shield){player[target.side].shield=false;message('NULL SHELL / CAPTURE CANCELLED');endAction();return;}
      board=board.filter(q=>q!==target);captured=true;player[p.side].scrap++;
      if(target.type==='core'){p.x=x;p.y=y;render();setTimeout(()=>winFloor(p.side),260);return;}
    }
    p.x=x;p.y=y;selected=null;valid=[];message(captured?'PIECE EXTRACTED':'MOVE ACCEPTED');render();
    if(captured&&player[p.side].scrap>=2){player[p.side].scrap-=2;beginDraft(p.side);return;}
    endAction();
  }

  function endAction(){selected=null;valid=[];ap--;render();if(ap<=0){turn=turn==='white'?'black':'white';ap=player[turn].bonus?3:2;player[turn].bonus=false;message(`${turn.toUpperCase()} SIGNAL`);render();if(mode==='cpu'&&turn==='black')setTimeout(cpuTurn,500);}}
  function allCpuMoves(){return board.filter(p=>p.side==='black').flatMap(p=>getMoves(p).map(m=>({p,m,target:at(m.x,m.y)})));}
  function cpuTurn(){if(!playing||drafting||turn!=='black')return;const moves=allCpuMoves();if(!moves.length){turn='white';ap=2;render();return;}moves.sort((a,b)=>scoreMove(b)-scoreMove(a));const top=moves.slice(0,Math.min(3,moves.length));const pick=top[Math.floor(Math.random()*top.length)];move(pick.p,pick.m.x,pick.m.y);if(playing&&!drafting&&turn==='black')setTimeout(cpuTurn,480);}
  function scoreMove(m){let s=Math.random()*2;if(m.target?.type==='core')s+=100;if(m.target)s+=12;const wc=board.find(p=>p.side==='white'&&p.type==='core');s+=7-Math.abs(m.m.x-wc.x)-Math.abs(m.m.y-wc.y);return s;}

  function beginDraft(side){drafting=true;$('#draft-player').textContent=`${side.toUpperCase()} / MUTATE`;offers=[...upgrades].sort(()=>Math.random()-.5).slice(0,3);$('#cards').innerHTML=offers.map((u,i)=>`<button class="card" data-i="${i}"><span>RULE_0${i+1}</span><i>${u.icon}</i><h3>${u.name}</h3><p>${u.desc}</p></button>`).join('');$('#cards').querySelectorAll('.card').forEach(b=>b.onclick=()=>choose(+b.dataset.i,side));draft.classList.remove('hidden');deadline=performance.now()+12000;if(mode==='cpu'&&side==='black')setTimeout(()=>drafting&&choose(Math.floor(Math.random()*3),side),700);}
  function choose(i,side){if(!drafting||!offers[i])return;upgrades.find(u=>u.id===offers[i].id).apply(player[side]);drafting=false;draft.classList.add('hidden');message(`${offers[i].name} INSTALLED`);render();endAction();}

  function winFloor(side){playing=false;player[side].wins++;message(`${side.toUpperCase()} CAPTURED CORE`);render();if(player[side].wins>=2){setTimeout(()=>finish(side),450);return;}floor++;setTimeout(()=>{setupBoard();playing=true;},850);}
  function finish(side){result.classList.remove('hidden');$('#winner').textContent=`${side.toUpperCase()} WINS`;$('#result-copy').textContent=`${floor} FLOORS / ${player[side].rules.length} MUTATIONS / RUN COMPLETE`;}
  function resetRun(){Object.assign(player.white,{wins:0,scrap:0,rules:[],shield:false});Object.assign(player.black,{wins:0,scrap:0,rules:[],shield:false});floor=1;playing=false;drafting=false;result.classList.add('hidden');intro.classList.remove('hidden');setupBoard();}
  function start(){intro.classList.add('hidden');result.classList.add('hidden');playing=true;setupBoard();message('WHITE SIGNAL');}

  function render(){
    boardEl.innerHTML='';for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const b=document.createElement('button'),p=at(x,y);b.className=`tile ${(x+y)%2?'dark':''}`;b.dataset.x=x;b.dataset.y=y;b.setAttribute('role','gridcell');b.setAttribute('aria-label',`${String.fromCharCode(65+x)}${y+1}${p?` ${p.side} ${p.type}`:''}`);if(selected?.x===x&&selected?.y===y)b.classList.add('selected');if(valid.some(m=>m.x===x&&m.y===y))b.classList.add(p?'capture':'valid');if(p){const e=document.createElement('span');e.className=`piece ${p.side} ${p.type}${player[p.side].shield&&p.type==='core'?' shielded':''}`;e.innerHTML=p.type==='core'?`<b>${names[p.type]}</b>`:names[p.type];b.appendChild(e)}b.onclick=()=>clickTile(x,y);boardEl.appendChild(b)}
    $('#turn-name').textContent=turn.toUpperCase();$('#turn-value').classList.toggle('black',turn==='black');$('#ap-1').classList.toggle('used',ap<1);$('#ap-2').classList.toggle('used',ap<2);$('#floor-label').textContent=`FLOOR ${String(floor).padStart(2,'0')} / 03`;$('#scrap-count').textContent=`${player[turn].scrap} / 2`;document.querySelectorAll('.scrap-meter i').forEach((e,i)=>e.classList.toggle('on',i<player[turn].scrap));
    $('#white-rules').innerHTML=player.white.rules.length?player.white.rules.map(r=>`<li>${r}</li>`).join(''):'<li>STANDARD SET</li>';$('#black-rules').innerHTML=player.black.rules.length?player.black.rules.map(r=>`<li>${r}</li>`).join(''):'<li>STANDARD SET</li>';document.querySelectorAll('#white-wins i').forEach((e,i)=>e.classList.toggle('won',i<player.white.wins));document.querySelectorAll('#black-wins i').forEach((e,i)=>e.classList.toggle('won',i<player.black.wins));
  }
  function message(t){$('#message').textContent=t;}
  function tick(t){if(drafting){const s=Math.max(0,Math.ceil((deadline-t)/1000));$('#draft-timer').textContent=s;if(s===0)choose(0,turn)}requestAnimationFrame(tick)}

  $('#start-button').onclick=start;$('#restart-button').onclick=resetRun;document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('active',x===b));$('#black-type').textContent=mode==='cpu'?'AUTOMATON':'PLAYER_02';resetRun()});
  const manual=$('#manual');$('#help').onclick=()=>manual.showModal();manual.querySelector('.close').onclick=()=>manual.close();addEventListener('keydown',e=>{if(e.key===' '&&!playing){e.preventDefault();start()}if(e.key.toLowerCase()==='r'&&!result.classList.contains('hidden'))resetRun();if(drafting&&['1','2','3'].includes(e.key))choose(+e.key-1,turn)});
  if(document.modelContext?.registerTool){try{void Promise.resolve(document.modelContext.registerTool({name:'start_rogue_board',title:'Start rogue board',description:'Start a new NULL//CROWN board-game run in CPU or local two-player mode.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['cpu','local']}},required:['mode'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!['cpu','local'].includes(input.mode))throw new Error('mode must be cpu or local');mode=input.mode;document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('active',x.dataset.mode===mode));resetRun();start();return{status:'running',mode,boardSize:'7x7',targetFloorWins:2}}})).catch(()=>{})}catch(_){}}
  resetRun();requestAnimationFrame(tick);
})();
