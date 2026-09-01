// 年度赛历回归测试：春季赛 → EWC → 夏季赛 → KPL年度总决赛 → 下一年春季赛 全流程贯通
// + 挂牌撤牌（有报价时也可撤牌）
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = path.join(__dirname, '..', 'src', 'js');
let code = '';
['data.js','state.js','players.js','transfer.js','train.js','season.js','bp.js','match.js','ui.js','main.js'].forEach(f => { code += fs.readFileSync(path.join(SRC, f), 'utf8') + '\n'; });
const el = () => ({classList:{add(){},remove(){},toggle(){}},style:{},innerHTML:'',value:'',textContent:'',dataset:{},addEventListener(){},appendChild(){},select(){},querySelector(){return null},querySelectorAll(){return[]}});
const dom = {getElementById:()=>el(),querySelector:()=>el(),querySelectorAll:()=>[],localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{querySelector:()=>el(),querySelectorAll:()=>[],createElement:()=>el(),execCommand:()=>{},body:el(),addEventListener(){},removeEventListener(){}},window:null,confirm:()=>true,alert(){},toast(){},location:{reload(){}},setTimeout:()=>0,clearTimeout(){},addEventListener(){},removeEventListener(){}};
dom.window = dom; vm.createContext(dom); vm.runInContext(code, dom);

const out = vm.runInContext(`
(function(){
  const res=[];const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};let hadFail=false;
  const log=t=>res.push('[INFO] '+t);
  try{
    // ===== 开局：自建队，直接开始春季赛 =====
    S=newState('测试队','⚔️');
    ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
    S.lineup=S.players.map(p=>p.id);
    S.seedPower=teamPower(S);
    startSplit(S,'spring');
    S.preseason=false;S.transferWindow=0;S.day=10;
    // 快进工具：当前有赛程就按 3:1 打完玩家场次；杯赛系列赛打开时按 4:1 收官
    const closeSeries=()=>{if(S.series){S.series.mw=Math.ceil(S.series.max/2);S.series.ow=1;finishSeries(true);return true;}return false;};
    let guard=0;
    const runLeague=()=>{ // 联赛全程（玩家 3:1 稳赢）
      let g=0;
      while(!['champion','eliminated'].includes(S.phase)&&g++<200){
        if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
        if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
          if(S.matchIdx>=S.schedule.length){advancePhase(S);continue;}
          const m=S.schedule[S.matchIdx];
          if(S.series&&S.series.stage==='regular'){closeSeries();continue;}
          S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
          S.series.mw=3;S.series.ow=1;finishSeries(true);
        }else if(S.phase==='card'){
          if(S.series){closeSeries();continue;}
          const myCard=S.card&&S.card.matches.find(x=>!x.r&&(x.a===S.teamName||x.b===S.teamName));
          if(!myCard){startCard();continue;}
          S.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'card',cardMatch:myCard,logs:[],myName:S.teamName,opName:myCard.a===S.teamName?myCard.b:myCard.a,side:'blue'};
          S.series.mw=4;S.series.ow=1;finishSeries(true);
        }else if(S.phase==='playoff'){
          if(S.series){closeSeries();continue;}
          startPlayoff();
          if(!S.series)break;
        }else break;
      }
    };
    runLeague();
    if(S.phase!=='champion'&&S.phase!=='eliminated')fail('春季赛未正常收官: phase='+S.phase);
    log('春季赛收官: '+splitLabel(S)+' 冠军='+(S.playoff&&S.playoff.champ)+' 年度积分='+(S.annualPts[S.teamName]||0));
    if(!Object.keys(S.annualPts).length)fail('春季赛后年度积分未入账');
    if(!(S.fmvpHonor||[]).length)fail('春季赛 FMVP 未评出');
    // ===== 春季结束 → 挑战者杯（KPL 全员）→ EWC =====
    advanceCalendar(S);
    if(S.phase!=='challenger')fail('春季赛后未进入挑战者杯: phase='+S.phase);
    if(!S.challenger||!S.challenger.teams||S.challenger.teams.length!==32)fail('挑战者杯 32 队未就绪');
    // 挑战者杯：全胜打穿（32强 BO5 → 16强 BO7 → 8强双败 BO7 → 决赛 BO9）
    renderClub();renderLeague(); // 渲染冒烟：挑战者杯面板模板
    let g1=0;
    while(S.phase==='challenger'&&g1++<80){
      if(S.series){closeSeries();continue;}
      const c=S.challenger;
      const mySingle=[...c.r1,...(c.r2||[])].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
      const myPo=c.po&&!c.final&&[...c.po.wb1,...c.po.lb1,...c.po.wb2,...c.po.lb2,c.po.wf,c.po.lbs,c.po.lbf].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
      const myFinal=c.final&&!c.final.r&&(c.final.a===S.teamName||c.final.b===S.teamName);
      if(!mySingle&&!myPo&&!myFinal){
        if(!c.champ&&!(c.final&&!c.final.r))startCup(S); // AI 快进
        if(!S.series&&!c.champ&&!(c.final&&!c.final.r))break;
        if(!S.series)break;
        continue;
      }
      startCup(S);
      if(!S.series&&!c.champ)break;
    }
    if(!S.challenger.champ)fail('挑战者杯未产生冠军');
    // 挑杯 → EWC（玩家=春冠直邀，打穿）
    let g2=0;
    while(S.phase==='ewc'&&g2++<40){
      if(S.series){closeSeries();continue;}
      const myPending=[...S.ewc.qf,...S.ewc.sf,S.ewc.final].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
      if(!myPending)break; // 未晋级：AI 已补完
      startCup(S);
      if(!S.series&&!S.ewc.champ)break;
    }
    if(!S.ewc||!S.ewc.champ)fail('EWC 未产生冠军');
    if(S.split!=='summer')fail('挑战者杯/EWC 后未进入夏季赛: split='+S.split);
    log('挑战者杯收官: 冠军='+S.challenger.champ+'（年总积分+'+(S.annualPts[S.teamName]||0)+'）→ EWC 冠军='+S.ewc.champ+' → '+splitLabel(S));
    // ===== 夏季赛 =====
    runLeague();
    if(S.phase!=='champion'&&S.phase!=='eliminated')fail('夏季赛未正常收官: phase='+S.phase);
    const summerPts=S.annualPts[S.teamName]||0;
    log('夏季赛收官: 冠军='+(S.playoff&&S.playoff.champ)+' 年度积分累计='+summerPts);
    // ===== 夏季结束 → 年度总决赛 =====
    advanceCalendar(S);
    if(S.phase!=='annual'){fail('夏季赛后未进入年总: phase='+S.phase);}
    renderClub();renderLeague(); // 渲染冒烟：年总擂台赛面板模板
    let g3=0;
    while(S.phase==='annual'&&g3++<120){
      if(S.series){closeSeries();continue;}
      const a=S.annual;
      if(a.stage==='arena'&&a.roundIdx<6){startCup(S);if(!S.series)break;continue;}
      if(!S.series&&!a.po)break;
      startCup(S);
      if(!S.series&&a.stage==='po'&&a.po.champ)break;
      if(!S.series&&a.stage==='breakthrough'&&a.brk.every(m=>m.r))continue;
      if(!S.series)break;
    }
    if(!S.annual||!S.annual.po||!S.annual.po.champ)fail('年总未产生冠军: stage='+(S.annual&&S.annual.stage));
    // ===== 年度轮换：下一年春季赛 =====
    if(S.phase!=='r1')fail('年总后未年度轮换: phase='+S.phase+' split='+S.split);
    if(S.season!==2)fail('年度轮换后 season 应为 2: '+S.season);
    if(S.split!=='spring')fail('新一年应为春季赛: '+S.split);
    if(Object.keys(S.annualPts).length)fail('新一年年度积分应清零');
    if((S.players[0].age||18)<1)fail('年龄结算异常');
    log('年度轮换完成: 赛季='+S.season+'（'+(2025+S.season)+'年春季赛）· 圣龙杯='+S.annual.po.champ+' · FMVP 历届='+(S.fmvpHonor||[]).length+' 条');
    if((S.fmvpHonor||[]).length<3)fail('FMVP 记录应≥3（春夏/年总/EWC）: '+(S.fmvpHonor||[]).length);
    if(!(S.honors||[]).some(h=>/EWC/.test(h.title)))fail('荣誉室缺 EWC 记录');
    if(!(S.honors||[]).some(h=>/年度总决赛/.test(h.title)))fail('荣誉室缺年总记录');
    // ===== 撤牌：有报价时也可撤 =====
    const bench=S.players.find(p=>!S.lineup.includes(p.id));
    if(!bench){ // 首发 5 人无替补：直接签一名自由球员当替补
      const fa=genPlayer(genFreeAgentDef('mid','low',new Set()));
      fa.contract=2;S.players.push(fa);
    }
    const bench2=S.players.find(p=>!S.lineup.includes(p.id));
    S.transferWindow=7;
    listPlayer(S,bench2.id);
    S.bids=[{id:bench2.id,team:'成都AG超玩会',bid:100}];
    delistPlayer(S,bench2.id);
    if((S.listed||[]).some(x=>x.id===bench2.id))fail('撤牌后仍在挂牌名单');
    if((S.bids||[]).some(x=>x.id===bench2.id))fail('撤牌后报价未作废');
    log('撤牌（有报价时）：listed/bids 已清空 OK');
    // ===== 场景2：弱队全年陪跑（全输）→ EWC 观赛 → 无缘年总 → 直接下一年 =====
    S=newState('鱼腩队','🐟');
    ['top','jg','mid','ad','sup'].forEach(pos=>S.players.push(genPlayer(genFreeAgentDef(pos,'low',new Set()))));
    S.coach={...COACH_POOL.find(c=>c.id==='co11')};
    S.lineup=S.players.map(p=>p.id);
    S.seedPower=teamPower(S);
    startSplit(S,'spring');
    S.preseason=false;S.transferWindow=0;S.day=10;
    let g4=0;
    while(!['champion','eliminated'].includes(S.phase)&&g4++<200){
      if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
      if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
        if(S.matchIdx>=S.schedule.length){advancePhase(S);continue;}
        const m=S.schedule[S.matchIdx];
        S.series={used:[],usedOpp:[],mw:1,ow:3,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
        finishSeries(false);
      }else if(S.phase==='card'){
        startCard(); // 玩家在 B3-6：setupCard 直接判出局并补完
        if(!S.series&&!['champion','eliminated'].includes(S.phase))break;
      }else break;
    }
    if(S.phase!=='eliminated')fail('弱队应止步（实际 phase='+S.phase+'）');
    const ptsBefore=S.annualPts[S.teamName]||0;
    advanceCalendar(S); // 春季结束 → 挑战者杯（KPL 全员参赛，弱队陪跑全输）
    if(S.phase!=='challenger')fail('弱队春季后应进挑战者杯: phase='+S.phase);
    let g6=0;
    while(S.phase==='challenger'&&g6++<80){
      if(S.series){S.series.mw=1;S.series.ow=S.series.max-1;finishSeries(false);continue;}
      const c=S.challenger;
      const mySingle=[...c.r1,...(c.r2||[])].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
      const myPo=c.po&&!c.final&&[...c.po.wb1,...c.po.lb1,...c.po.wb2,...c.po.lb2,c.po.wf,c.po.lbs,c.po.lbf].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
      const myFinal=c.final&&!c.final.r&&(c.final.a===S.teamName||c.final.b===S.teamName);
      if(mySingle||myPo||myFinal){startCup(S);if(!S.series)break;continue;}
      simCup('challenger',S);break; // 玩家已出局：AI 快进补完挑杯（终局自动接 EWC/夏季赛）
    }
    if(!S.challenger.champ)fail('挑战者杯应由 AI 补完产生冠军');
    if(S.split!=='summer')fail('弱队挑战者杯后应直通夏季赛: split='+S.split);
    if(!S.ewc||!S.ewc.champ)fail('EWC 应由 AI 补完产生冠军');
    log('弱队春季止步（积分'+ptsBefore+'）→ 挑战者杯陪跑（冠军='+S.challenger.champ+'）→ EWC 观赛（冠军='+S.ewc.champ+'）→ '+splitLabel(S));
    // 夏季也全输 → 无缘年总 → 直接下一年
    let g5=0;
    while(!['champion','eliminated'].includes(S.phase)&&g5++<200){
      if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
      if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
        if(S.matchIdx>=S.schedule.length){advancePhase(S);continue;}
        const m=S.schedule[S.matchIdx];
        S.series={used:[],usedOpp:[],mw:1,ow:3,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
        finishSeries(false);
      }else if(S.phase==='card'){
        startCard();
        if(!S.series&&!['champion','eliminated'].includes(S.phase))break;
      }else break;
    }
    advanceCalendar(S); // 夏季结束 → 年总判定
    if(S.phase!=='r1'||S.season!==2)fail('无缘年总应直接年度轮换: phase='+S.phase+' season='+S.season);
    if(!S.annual||!S.annual.po||!S.annual.po.champ)fail('年总应由 AI 补完产生冠军');
    log('弱队夏季止步 → 无缘年总 → AI 补完年总（圣龙杯='+S.annual.po.champ+'）→ '+splitLabel(S));
  }catch(e){fail('异常: '+(e&&e.stack||e).toString().slice(0,300));}
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`,dom);
console.log(out);
