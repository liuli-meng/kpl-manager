// 2026-09 亚运征召回归：入选选手缺席整个夏季赛（集训标记/换下首发/不可卖/青训借调/归队）
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = path.join(__dirname, '..', 'src', 'js');
let code = '';
['data.js','state.js','players.js','transfer.js','train.js','season.js','bp.js','match.js','ui.js','main.js'].forEach(f => { code += fs.readFileSync(path.join(SRC, f), 'utf8') + '\n'; });
const el = () => ({classList:{add(){},remove(){},toggle(){}},style:{},innerHTML:'',value:'',textContent:'',dataset:{},addEventListener(){},appendChild(){},select(){},querySelector(){return null},querySelectorAll(){return[]}});
const elCache = {};
const cachedEl = sel => elCache[sel] || (elCache[sel] = el());
const dom = {getElementById:id=>cachedEl('#'+id),querySelector:sel=>cachedEl(sel),querySelectorAll:()=>[],localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{querySelector:sel=>cachedEl(sel),querySelectorAll:()=>[],createElement:()=>el(),execCommand:()=>{},body:el(),addEventListener(){},removeEventListener(){}},window:null,confirm:()=>true,alert(){},toast(){},location:{reload(){}},setTimeout:()=>0,clearTimeout(){},addEventListener(){},removeEventListener(){}};
dom.window = dom; vm.createContext(dom); vm.runInContext(code, dom);

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  // 99 上限王牌（对线位），保证全联盟该位置最强 → 必入选
  const mk99=()=>{
    const d=genFreeAgentDef('top','star',new Set(['测试王牌']));
    const p=genPlayer(d);p.name='测试王牌';
    p.attrs={lane:99,farm:95,team:99,mind:96};
    p.heroPool=(p.heroPool||[]).map(h=>({...h,lv:3}));
    return p;
  };
  S=newState('陪跑队','剑');
  const star=mk99();
  const others=['jg','mid','ad','sup'].map(pos=>genPlayer(genFreeAgentDef(pos,'low',new Set())));
  S.players=[star,...others];
  S.lineup=S.players.map(p=>p.id);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=teamPower(S);
  S.fund=20000;
  // 直达夏季赛转会期（亚运年 season1=2026）：startSplit 内部触发征召宣布
  startSplit(S,'summer');
  log('进入 '+splitLabel(S)+' · 亚运年='+isAsiadYear(S)+' natAnnounced='+S.natAnnounced);

  const p=S.players.find(x=>x.name==='测试王牌');
  if(!p||!p.natCamp)fail('①王牌未被征召（应缺席夏季赛）');
  else log('①征召宣布: '+p.name+' 入选中国代表队');
  if(S.lineup.includes(p.id))fail('②征召选手仍在首发');
  else log('②集训换下首发 → 顶位='+S.players.find(x=>S.lineup.includes(x.id)&&x.pos==='top').name);
  if(S.lineup.length!==5)fail('③阵容不足 5 人（应替补/借调补位）');
  else log('③阵容 5 人建制保持');
  const pre=JSON.stringify(S.lineup);
  swapPlayer(p.id);
  if(JSON.stringify(S.lineup)!==pre)fail('④集训选手被换回首发');
  else log('④手动换入被拦截');
  const n0=S.players.length;
  openSellNego(S,p.id);
  releasePlayer(S,p.id);
  if(S.players.length!==n0)fail('⑤集训选手被出售/放走');
  else log('⑤集训期间不可出售/放走');
  // ⑤b 青训借调顶位（natFill）同样禁售——卖掉会破坏 5 人建制（2026-09-05 排查修复）
  const fill=S.players.find(x=>x.natFill);
  if(fill){
    openSellNego(S,fill.id);
    if(window._sellNego)fail('⑤b 借调顶位可被出售（应拦截）');
    else log('⑤b 借调顶位出售已拦截');
    const n1=S.players.length;
    releasePlayer(S,fill.id);
    if(S.players.length!==n1)fail('⑤b 借调顶位被放走');
    else log('⑤b 借调顶位不可放走（合同守卫）');
  }

  // 夏季赛全败打完：全程确认王牌不在首发
  S.preseason=false;S.transferWindow=0;
  let saw=false,g=0;
  while(!['champion','eliminated'].includes(S.phase)&&g++<200){
    if(['r1','r2','r3'].includes(S.phase)){
      if(S.matchIdx>=S.schedule.length){advancePhase(S);continue;}
      const m=S.schedule[S.matchIdx];
      if(S.lineup.includes(p.id))saw=true;
      S.series={used:[],usedOpp:[],mw:1,ow:3,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
      finishSeries(false);
    }else if(S.phase==='card'){
      startCard();
      if(!S.series&&!['champion','eliminated'].includes(S.phase))break;
    }else break;
  }
  if(saw)fail('⑥夏季赛期间王牌出现在首发');
  else log('⑥整个夏季赛缺席（'+g+' 步）· 收官 phase='+S.phase);

  // 亚运会推进 → 归队（弱队打完亚运后 AI 补完年总并年度轮换，ag 被清空属正常；用事件日志/属性断言）
  advanceCalendar(S);
  if(!S.ag)fail('⑦未进入亚运会: phase='+S.phase);
  else{
    let ag=0;
    const pop0=p.popularity||0,val0=p.val,eng0=p.energy==null?100:p.energy;
    while(S.phase==='asiad'&&ag++<20)asiadStep(S);
    const back=S.players.find(x=>x.name==='测试王牌');
    if(!back)fail('⑦亚运后未归队');
    else if(back.natCamp)fail('⑦归队后 natCamp 未清除');
    else log('⑦亚运收官归队: natCamp 清除 · 身价 '+val0+'→'+back.val+' · 人气 '+pop0+'→'+(back.popularity||0)+' · 体力 '+eng0+'→'+back.energy);
    if((S.players||[]).some(x=>x.natFill))fail('⑧青训借调未撤销');
    else log('⑧青训借调已撤销');
    const logs=(S.eventLog||[]).map(x=>x.txt).join('|');
    const hasBonus=logs.indexOf('亚运会加成')>=0||logs.indexOf('人气+')>=0||back.popularity>pop0;
    const hasTitle=(S.titleHistory||[]).some(h=>h.event==='亚运会');
    if(!hasBonus)fail('⑨未看到奖牌回流（人气 '+pop0+'→'+(back.popularity||0)+'）');
    else log('⑨奖牌回流已生效（人气提升，赛事史有亚运会记录='+hasTitle+'）');
  }
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`,dom);
console.log(out);
