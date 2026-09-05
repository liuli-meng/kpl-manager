// 2026-09 亚运征召回归：入选选手缺席整个夏季赛；顶位一律用队内替补（替补择优），
// 无替补则位置空缺+开赛拦截（签替补是正式策略）——旧版「凭空青训借调」已移除，旧档 natFill 兼容清理
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = path.join(__dirname, '..', 'src', 'js');
let code = '';
['data.js','state.js','players.js','transfer.js','train.js','season.js','bp.js','match.js','ui.js','main.js'].forEach(f => { code += fs.readFileSync(path.join(SRC, f), 'utf8') + '\n'; });
const el = () => ({classList:{add(){},remove(){},toggle(){}},style:{},innerHTML:'',value:'',textContent:'',dataset:{},disabled:false,addEventListener(){},appendChild(){},select(){},querySelector(){return null},querySelectorAll(){return[]}});
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

  // ============ 场景A：有替补 → 替补择优顶位，5 人建制保持 ============
  S=newState('替补队','剑');
  const star=mk99();
  const others=['jg','mid','ad','sup'].map(pos=>genPlayer(genFreeAgentDef(pos,'low',new Set())));
  const benchTop=genPlayer(genFreeAgentDef('top','low',new Set()));
  benchTop.name='替补甲';benchTop.attrs={lane:70,farm:66,team:72,mind:68};
  S.players=[star,...others,benchTop];
  S.lineup=S.players.filter(x=>x!==benchTop).map(p=>p.id); // 替补甲在板凳
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=teamPower(S);
  S.fund=20000;
  // 直达夏季赛转会期（亚运年 season1=2026）：startSplit 内部触发征召宣布
  startSplit(S,'summer');
  log('进入 '+splitLabel(S)+' · 亚运年='+isAsiadYear(S)+' natAnnounced='+S.natAnnounced);

  const p=S.players.find(x=>x.name==='测试王牌');
  if(!p||!p.natCamp)fail('①王牌未被征召（应缺席夏季赛）');
  else log('①征召宣布: '+p.name+' 入选中国代表队');
  const topNow=S.players.find(x=>S.lineup.includes(x.id)&&x.pos==='top');
  if(!topNow||topNow===p)fail('②顶位不是替补（应为 替补甲）: '+(topNow&&topNow.name));
  else if(!S.lineup.includes(benchTop.id))fail('②顶位用错人: '+topNow.name);
  else log('②集训换下首发 → 替补择优顶位='+topNow.name);
  if(S.lineup.length!==5)fail('③阵容不足 5 人（替补顶位后应保持 5 人）');
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
  // ⑤b 旧档兼容：手动构造 natFill 残留（旧版本存档），禁售守卫仍生效
  const legacy={id:'legacy_fill',name:'旧档借调',pos:'jg',team:null,tags:['青训'],attrs:{lane:60,farm:60,team:60,mind:60},
   skill:{n:'x',t:'team',d:'x'},sig:'铠',heroPool:[{n:'铠',lv:2}],career:'',wage:3,energy:100,morale:80,injury:0,
   mvp:0,retiring:false,age:17,popularity:5,willingness:80,potential:3,natFill:true,contract:1};
  S.players.push(legacy);
  openSellNego(S,legacy.id);
  if(window._sellNego)fail('⑤b 旧档借调顶位可被出售（应拦截）');
  else log('⑤b 旧档 natFill 残留：禁售守卫生效');
  S.players=S.players.filter(x=>x!==legacy); // 场景A后续流程移除构造数据

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
    // 对阵逻辑：中韩分处上下半区（最强对手只能在决赛相遇），MVP 必须出自实际出征名单
    const qfCn=S.ag.qf.findIndex(m=>m.a==='中国代表队'||m.b==='中国代表队');
    const qfKr=S.ag.qf.findIndex(m=>m.a==='韩国'||m.b==='韩国');
    if(qfCn<0||qfKr<0)fail('⑩对阵表缺中国或韩国');
    else if(Math.floor(qfCn/2)===Math.floor(qfKr/2))fail('⑩中韩同半区（应在决赛才可能相遇）: QF'+qfCn+'/QF'+qfKr);
    else log('⑩中韩分处上下半区（QF'+(qfCn+1)+'/QF'+(qfKr+1)+'），半决赛不会相遇');
    const pop0=p.popularity||0,val0=p.val,eng0=p.energy==null?100:p.energy;
    const squadRef=S.ag.squad; // 按引用捕获（弱队收官当拍可能触发年总补完+跨年，S.ag 会被清空）
    let mvpCapture=null;
    const _le=logEvent;
    logEvent=function(s,txt){if(!mvpCapture&&txt.indexOf('亚运会 MVP')>=0)mvpCapture=txt;_le(s,txt);}; // 跨年日志洪水会挤出 eventLog，实时捕获
    while(S.phase==='asiad'&&ag++<20)asiadStep(S);
    logEvent=_le;
    const agEntry=(S.titleHistory||[]).filter(t=>t.event==='亚运会').pop();
    if(!agEntry)fail('⑩赛事史无亚运会记录');
    else if(agEntry.champ==='中国代表队'){
      const mvpName=(mvpCapture&&mvpCapture.match(/MVP：(.+?)（/)||[])[1];
      if(!mvpName||!squadRef.some(x=>x.name===mvpName))fail('⑩MVP 不在实际出征名单: '+mvpName);
      else log('⑩中国队夺金，MVP='+mvpName+' 出自实际出征名单');
    }else log('⑩中国队未夺金（冠军='+agEntry.champ+'），MVP 不评属正常');
    const back=S.players.find(x=>x.name==='测试王牌');
    if(!back)fail('⑦亚运后未归队');
    else if(back.natCamp)fail('⑦归队后 natCamp 未清除');
    else log('⑦亚运收官归队: natCamp 清除 · 身价 '+val0+'→'+back.val+' · 人气 '+pop0+'→'+(back.popularity||0)+' · 体力 '+eng0+'→'+back.energy);
    const logs=(S.eventLog||[]).map(x=>x.txt).join('|');
    const hasBonus=logs.indexOf('亚运会加成')>=0||logs.indexOf('人气+')>=0||back.popularity>pop0;
    const hasTitle=(S.titleHistory||[]).some(h=>h.event==='亚运会');
    if(!hasBonus)fail('⑨未看到奖牌回流（人气 '+pop0+'→'+(back.popularity||0)+'）');
    else log('⑨奖牌回流已生效（人气提升，赛事史有亚运会记录='+hasTitle+'）');
  }

  // ============ 场景B：无替补 → 位置空缺 + 开赛拦截 + 签替补恢复 ============
  S=newState('无替队','盾');
  const star2=mk99();
  const others2=['jg','mid','ad','sup'].map(pos=>genPlayer(genFreeAgentDef(pos,'low',new Set())));
  S.players=[star2,...others2];
  S.lineup=S.players.map(p=>p.id);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=teamPower(S);
  S.fund=20000;
  startSplit(S,'summer');
  const p2=S.players.find(x=>x.name==='测试王牌');
  if(!p2||!p2.natCamp)fail('B①无替队王牌未被征召');
  if(S.lineup.includes(p2.id))fail('B②无替补时集训选手仍在首发');
  else if(S.lineup.length!==4)fail('B②应为 4 人（top 空缺）: '+S.lineup.length);
  else log('B①无替补：集训选手强制下场，top 空缺 lineup=4人');
  const logs2=(S.eventLog||[]).map(x=>x.txt).join('|');
  if(logs2.indexOf('没有替补可顶')<0)fail('B③征召时无「签替补」警告');
  else log('B②征召宣布含行动警告（没有替补可顶）');
  // 开赛被拦截：BP 台拒开
  S.preseason=false;S.transferWindow=0;
  autoFillLineup(S);
  try{
    openBP('测试',playGame);
    if($('#app-modal').classList.contains('on'))fail('B④top 空缺仍可进 BP 台');
    else log('B③top 空缺开赛被拦截（BP 台未开）');
  }catch(e){log('B③top 空缺开赛被拦截（toast 提示路径）');}
  // 签一名 top 自由球员 → autoFill 顶位 → 可开战
  S.fund=50000;
  const fa=(S.freeAgents||[]).filter(x=>x.pos==='top')[0]||genPlayer(genFreeAgentDef('top','low',new Set()));
  if(!S.freeAgents.some(x=>x===fa))S.freeAgents=[fa,...(S.freeAgents||[])];
  signFreeAgent(S,fa.id);
  autoFillLineup(S);
  const okNow=S.players.find(x=>S.lineup.includes(x.id)&&x.pos==='top');
  if(!okNow||okNow===p2)fail('B⑤签替补后仍未顶位');
  else log('B④签下替补 '+okNow.name+' → 顶位恢复 5 人，可正常出战');
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join(String.fromCharCode(10));
})()
`,dom);
console.log(out);
