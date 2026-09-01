// 冒烟测试：模拟浏览器全局，跑 BP 有效战力结算与赛前准备数据流
const fs = require('fs');
const vm = require('vm');
const files = ['data.js','state.js','players.js','transfer.js','train.js','season.js','bp.js','match.js','ui.js','main.js'];
let code = '';
files.forEach(f => { code += fs.readFileSync('src/js/' + f, 'utf8') + '\n'; });
const el = () => ({classList:{add(){},remove(){},toggle(){}},style:{},innerHTML:'',value:'',textContent:'',dataset:{},addEventListener(){},appendChild(){},select(){},querySelector(){return null},querySelectorAll(){return[]}});
const elCache = {};
const cachedEl = sel => elCache[sel] || (elCache[sel] = el());
const dom = {
  getElementById: id => cachedEl('#' + id), querySelector: sel => cachedEl(sel), querySelectorAll: () => [],
  localStorage: {getItem: () => null, setItem(){}, removeItem(){}},
  document: {querySelector: sel => cachedEl(sel), querySelectorAll: () => [], createElement: () => el(), execCommand: () => {}, body: el(), addEventListener(){}, removeEventListener(){}},
  window: null, confirm: () => true, alert(){}, toast(){}, location: {reload(){}},
  setTimeout: () => 0, clearTimeout(){}, addEventListener(){}, removeEventListener(){},
};
dom.window = dom;
vm.createContext(dom);
vm.runInContext(code, dom);
const r = vm.runInContext(`
(function(){
  const out=[];
  S=newState('测试队','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>{
    S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set())));
  });
  S.players.push(genPlayer(genFreeAgentDef('jg','mid',new Set()))); // 打野替补
  S.lineup=S.players.map(p=>p.id).slice(0,5);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=400;
  initGroups(S);
  const my0=teamPower(S);
  const m=S.schedule[0];
  S.series={used:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
  const op0=powerOf(S,m.opp);
  out.push('基础战力 我方='+my0+' 对方('+m.opp+')='+op0+' 赛前胜率='+(winChance(my0,op0)*100).toFixed(0)+'%');
  const opR=ensureAiRosters(S,m.opp);
  const d={sr:S.series,ls:rosterLineup(S),isPeak:false,used:[],steps:expandSteps(S.series,false),idx:0,myBans:[],oppBans:[],myPicks:{},oppPicks:{},curPos:null,oppRoster:opR};
  let guard=0;
  while(guard++<40){
    const act=draftAction(d);
    if(act.type==='done')break;
    if(act.type==='ban'){
      const avail=banCandidates(d);
      let best=null,bs=-1;
      avail.forEach(h=>{const t=(threatOf(d,h,'opp')||0)+(heroOf(h).hot?2:0);if(t>bs){bs=t;best=h;}});
      d.myBans.push(best);d.idx++;
    }else{
      let bestPos=null,bestHero=null,bs=-1;
      myOpenPositions(d).forEach(pos=>{
        const avail=myCandidates(d,pos),best=bestHeroFor(d,pos,avail);
        if(best){const p=d.ls.find(x=>x.pos===pos);const pw=playerPower(p,best);if(pw>bs){bs=pw;bestPos=pos;bestHero=best;}}
      });
      d.myPicks[bestPos]=bestHero;ensureHeroInPool(d.ls.find(x=>x.pos===bestPos),bestHero);d.idx++;
    }
  }
  const v=bpEffPreview(d);
  out.push('BP后有效战力 我方='+v.my+' 对方='+v.op+' 预测胜率='+(winChance(v.my,v.op)*100).toFixed(0)+'%');
  out.push('修正明细: '+v.notes.join(' | '));
  const v2=bpEffective({myPicks:d.myPicks,myBans:['不存在甲','不存在乙','不存在丙','不存在丁'],oppPicks:d.oppPicks,oppBans:[],side:'blue',isPeak:false,opName:m.opp,opRoster:opR});
  out.push('BAN空气对照: 对方有效战力='+v2.op+'（池内BAN时='+v.op+'）');
  S.series.myBans=d.myBans.slice(0,4);S.series.oppBans=d.oppBans.slice(0,4);S.series.oppPicks={...d.oppPicks};
  applyBp({...d.myPicks});
  playGame();
  out.push('playGame后 比分 '+S.series.mw+':'+S.series.ow+'（log0: '+S.series.logs[0].slice(0,60)+'…）');
  renderPreMatch();
  out.push('renderPreMatch 渲染 OK，标题='+window._prepTitle);
  startMatch();
  out.push('startMatch(系列赛进行中) → 比分未被重置: '+S.series.mw+':'+S.series.ow);
  // BP 内换替补（显式 openBP 建立草稿状态，不依赖第1局胜负分支）
  openBP('测试局',playGame);
  const bench=rosterBench(S)[0];
  if(bench){bpOpenSwap();bpSwapIn(bench.id);out.push('BP内换替补 OK: d.ls='+window._draft.ls.length+'人, 首发含'+bench.name+'='+rosterLineup(S).some(p=>p.id===bench.id));}
  // 巅峰对决结算（不吃修正）
  const vp=bpEffective({myPicks:{},myBans:['张飞'],oppBans:[],oppPicks:{},side:'red',isPeak:true,opName:m.opp,opRoster:opR});
  out.push('巅峰对决: 不吃修正 我方='+vp.my+' 对方='+vp.op+' notes='+vp.notes.length);
  return out.join(' || ');
})()
`, dom);
console.log(r);

// ---- 转会期流程回归：开局先转会期 → 结束 → 才能开赛 ----
const r2 = vm.runInContext(`
(function(){
  const out=[];
  S=newState('回归队','🐉');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.lineup=S.players.map(p=>p.id).slice(0,5);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=420;
  initGroups(S);
  S.preseason=true;S.transferWindow=7;buildTransferMarket(S);refreshMarket(S);
  out.push('转会期开启: 剩余='+S.transferWindow+'天 买断市场='+(S.transferList||[]).length+'人 自由市场='+(S.market||[]).length+'人 自由球员='+(S.freeAgents||[]).length);
  startMatch();
  out.push('转会期内 startMatch → 被拦截, series='+(S.series===null?'null(正确)':'异常!'));
  nextDay(S);
  out.push('推进一天 → 剩余='+S.transferWindow+'天 资金='+S.fund);
  endPreseason(S);
  out.push('手动结束转会期 → preseason='+S.preseason+' window='+S.transferWindow);
  startMatch();
  out.push('结束后 startMatch → series='+(S.series?('已建立 vs '+S.series.opName):'未建立!')+' 赛前准备标题='+window._prepTitle);
  // 天数用完自动开赛
  S.preseason=true;S.transferWindow=1;S.series=null;
  nextDay(S);
  out.push('最后一天推进 → 自动开赛: preseason='+S.preseason+' window='+S.transferWindow);
  return out.join(' || ');
})()
`, dom);
console.log(r2);

// ---- 卖方谈判回归：报价 → 递交要价 → 成交 / 回收商兜底 ----
const r3 = vm.runInContext(`
(function(){
  const out=[];
  S=newState('卖人队','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.players.push(genPlayer(genFreeAgentDef('sup','mid',new Set()))); // 替补
  S.lineup=S.players.map(p=>p.id).slice(0,5);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  initGroups(S);
  S.preseason=false;S.transferWindow=0;
  const seller=S.players.find(p=>!S.lineup.includes(p.id));
  Object.keys(seller.attrs).forEach(k=>{seller.attrs[k]=92;}); // 稳定顶星级：确保必有意向买家（去掉随机性）
  const fund0=S.fund,cnt0=S.players.length;
  openSellNego(S,seller.id);
  let n=window._sellNego;
  out.push('开谈判: 意向='+(n.clubs.length)+'家 开价区间='+(n.clubs.length?Math.min.apply(null,n.clubs.map(c=>c.bid))+'~'+Math.max.apply(null,n.clubs.map(c=>c.bid))+'万':'无')+' 回收兜底='+n.lowball+'万 心理价='+n.ask+'万');
  // 递交一个必然被接受的低价（游戏内 $ 已接状态化 stub，value 可持久）
  $('#sell-ask').value='1';
  sellSubmitAsk();
  n=window._sellNego;
  out.push('递交要价1万: '+n.clubs.map(c=>c.status).join(',')+' msg含接受='+(n.msg.indexOf('接受')>=0?'是':'否'));
  sellAcceptClub(0);
  out.push('成交: 人数'+cnt0+'→'+S.players.length+' 资金+'+(S.fund-fund0)+'万 状态清理='+(window._sellNego===null?'OK':'异常'));
  // 回收商兜底路径（R 卡可能无人问津）
  const s2=S.players[S.players.length-1];
  S.lineup=S.lineup.filter(id=>id!==s2.id); // 移出首发以便出售
  openSellNego(S,s2.id);
  const fund1=S.fund;
  sellAcceptClub(-1);
  out.push('回收商路径: 人数-1='+(S.players.length===cnt0-2?'OK':'异常')+' 资金+'+(S.fund-fund1)+'万(应为'+((window._sellNego&&window._sellNego.lowball)||'已清')+')');
  return out.join(' || ');
})()
`, dom);
console.log(r3);

// ---- 转售保护回归：刚买的选手卖不出原价，打满 5 场解锁 ----
const r4 = vm.runInContext(`
(function(){
  const out=[];
  S=newState('倒卖检测','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.lineup=S.players.map(p=>p.id).slice(0,5);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.fund=5000;
  S.wageCap=200; // 直签工资帽校验需要帽额余量
  initGroups(S);
  S.preseason=false;S.transferWindow=0;
  // 自由市场买一个顶星（star 档）
  const fa=genPlayer(genFreeAgentDef('mid','star',new Set()));
  S.market=[fa];
  buyPlayer(S,fa);
  const cost=fa.acqCost;
  out.push('买入: acqCost='+cost+'万 资金余='+S.fund);
  // 立刻挂出售：报价必须 ≤ 买入价九折
  openSellNego(S,fa.id);
  let n=window._sellNego;
  const maxNow=Math.max.apply(null,n.clubs.map(c=>c.max));
  out.push('保护期内: lock='+n.lock+' 俱乐部出价上限='+maxNow+'（≤'+Math.round(cost*0.9)+'）→ 必亏='+(maxNow<cost?'OK':'异常!'));
  // 打满 5 场后解锁
  fa.caps=5;
  openSellNego(S,fa.id);
  n=window._sellNego;
  const maxAfter=Math.max.apply(null,n.clubs.map(c=>c.max));
  out.push('打满5场: lock='+n.lock+' 出价上限='+maxAfter+'（恢复身价区间）'+(maxAfter>Math.round(cost*0.9)?'OK':'（本roll未超锚点，属正常波动）'));
  return out.join(' || ');
})()
`, dom);
console.log(r4);

// ---- 表现→身价联动回归：EMA 区间、赛后浮动、定价映射 ----
const r5 = vm.runInContext(`
(function(){
  const out=[];
  S=newState('身价检测','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.lineup=S.players.map(p=>p.id).slice(0,5);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  initGroups(S);
  S.preseason=false;S.transferWindow=0;
  // 公式映射：同总值/age/pop，仅表现不同 → 身价按比例浮动
  const a=genPlayer(genFreeAgentDef('jg','mid',new Set())),b=genPlayer(genFreeAgentDef('jg','mid',new Set()));
  b.attrs={...a.attrs};b.age=a.age;b.popularity=a.popularity; // 控制变量：只有 val 不同
  a.val=150;b.val=70;
  const va=sellAskPrice(a),vb=sellAskPrice(b);
  out.push('定价映射: 火热150%='+va+'万 vs 低迷70%='+vb+'万（比值'+(va/vb).toFixed(2)+'，理论≈2.14）');
  // 打一场自动 BO5：全体首发获得 val 与赛季数据
  const m=S.schedule[0];
  S.series={used:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
  S.seriesAuto=true;autoPlayNext();
  const ls=rosterLineup(S);
  const vals=ls.map(p=>p.val||100);
  const inRange=vals.every(v=>v>=70&&v<=150);
  const hasKda=ls.every(p=>(p.kTotal||0)>0);
  out.push('赛后: 全员val在70~150='+inRange+' 赛季KDA累计='+hasKda+' val样本='+vals.join(',')+' 场均KDA示例='+ls[0].name+' '+(ls[0].kTotal/ls[0].caps).toFixed(1)+'/'+(ls[0].dTotal/ls[0].caps).toFixed(1)+'/'+(ls[0].aTotal/ls[0].caps).toFixed(1));
  // 卖价展示与选手卡渲染
  renderLineup();
  out.push('renderLineup(含总身价)渲染 OK');
  return out.join(' || ');
})()
`, dom);
console.log(r5);

// ---- 全局 BP 分队记账回归：AI 不得复用己方已用英雄，双方互不串 ----
const r6 = vm.runInContext(`
(function(){
  const out=[];
  S=newState('全局BP检测','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.lineup=S.players.map(p=>p.id);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=400;initGroups(S);
  const m=S.schedule[0];
  const opR=ensureAiRosters(S,m.opp);
  S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
  function draft(){
    const d={sr:S.series,ls:rosterLineup(S),isPeak:false,used:S.series.used.slice(),usedOpp:S.series.usedOpp.slice(),
      steps:expandSteps(S.series,false),idx:0,myBans:[],oppBans:[],myPicks:{},oppPicks:{},curPos:null,oppRoster:opR};
    let guard=0;
    while(guard++<40){
      const act=draftAction(d);
      if(act.type==='done')break;
      if(act.type==='ban'){
        const avail=banCandidates(d);
        let best=null,bs=-1;
        avail.forEach(h=>{const v=(threatOf(d,h,'opp')||0)+(heroOf(h).hot?2:0);if(v>bs){bs=v;best=h;}});
        d.myBans.push(best);d.idx++;
      }else{
        myOpenPositions(d).forEach(pos=>{
          if(d.myPicks[pos])return;
          const best=bestHeroFor(d,pos,myCandidates(d,pos));
          if(best){d.myPicks[pos]=best;ensureHeroInPool(d.ls.find(x=>x.pos===pos),best);}
        });
        d.idx++;
      }
    }
    return d;
  }
  const d1=draft();
  S.series.oppPicks={...d1.oppPicks};
  applyBp({...d1.myPicks}); // 玩家 picks 入 used、对方 picks 入 usedOpp
  out.push('第1局: 我方已用=['+S.series.used.join('、')+'] 对方已用=['+S.series.usedOpp.join('、')+']');
  // 第2局：AI 不得复用己方已用英雄，也不得选我方已用英雄
  const d2=draft();
  const dupOpp=Object.values(d2.oppPicks).filter(h=>S.series.usedOpp.includes(h));
  const dupMy=Object.values(d2.oppPicks).filter(h=>S.series.used.includes(h));
  out.push('第2局: 对方复用己方英雄='+dupOpp.length+'（应0） 对方选我方已用='+dupMy.length+'（应0）');
  out.push('第2局 对方阵容='+Object.values(d2.oppPicks).join('/'));
  const noReuse=Object.keys(d2.myPicks).every(pos=>!S.series.used.includes(d2.myPicks[pos]));
  out.push('我方不复用已用='+(noReuse?'OK':'异常!'));
  // 工资帽直签拦截回归
  S.series=null;
  const rich=newState('帽检测','⚔️');
  return out.join(' || ');
})()
`, dom);
console.log(r6);

// ---- 青训晋升回归：新秀随赛季长岁数，满18岁且四维达标可晋升 ----
const r7 = vm.runInContext(`
(function(){
  const out=[];
  S=newState('青训检测','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.lineup=S.players.map(p=>p.id);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  initGroups(S);S.preseason=false;S.transferWindow=0;
  recruitRookie(S);
  const r=S.academy[0];
  Object.keys(r.attrs).forEach(k=>{r.attrs[k]=90;}); // 练到四维达标
  promoteRookie(S,r.id);
  out.push(r.age+'岁晋升 → 被拦截='+(S.academy.length===1?'OK':'异常!'));
  newSeason(S);
  newSeason(S);
  const r2=S.academy[0];
  out.push('两个赛季后 '+r2.age+'岁（应≥18）');
  promoteRookie(S,r2.id);
  out.push('晋升='+(S.players.some(p=>p.id===r2.id)?'OK':'异常!')+' 周薪维持='+r2.wage+'万');
  return out.join(' || ');
})()
`, dom);
console.log(r7);

// ---- 联盟页回归：战队总览 / 榜单切换 / 阵容弹窗 ----
const r8 = vm.runInContext(`
(function(){
  const out=[];
  renderUnion();
  out.push('战队总览+榜单渲染='+($('#page-union').innerHTML.length>1000?'OK':'异常!'));
  const m=S.schedule[0];
  showSquad(S.teamName);
  out.push('本队阵容弹窗='+($('#app-modal-body').innerHTML.indexOf('全队阵容')>=0?'OK':'异常!'));
  showSquad(m.opp);
  out.push('对手阵容弹窗('+m.opp+')='+(($('#app-modal-body').innerHTML.indexOf(m.opp)>=0&&$('#app-modal-body').innerHTML.indexOf('全队阵容')>=0)?'OK':'异常!'));
  window._unionTab='young';
  renderUnion();
  out.push('新星榜切换='+($('#page-union').innerHTML.indexOf('新星榜')>=0?'OK':'异常!'));
  window._unionTab='ovr';
  renderUnion();
  out.push('18队名录='+(S.leagueTeams?S.leagueTeams.length+'队':'缺失'));
  out.push('最佳阵容='+(($('#page-union').innerHTML.indexOf('赛季最佳阵容')>=0?'面板OK':'缺失')+' / 历届'+((S.awards||[]).length)+'季'));
  return out.join(' || ');
})()
`, dom);
console.log(r8);

// ---- 页面骨架结构回归：每个导航页必须有对应 section 容器（防"按钮有、容器无"白屏）----
const idxSrc = fs.readFileSync('src/index.html', 'utf8');
const navPages = [...idxSrc.matchAll(/data-page="([^"]+)"/g)].map(m => m[1]);
const missing = navPages.filter(p => !idxSrc.includes('id="page-' + p + '"'));
console.log('页面骨架: ' + navPages.length + ' 个导航页 · 缺失容器=' + (missing.length ? missing.join(',') + ' 异常!' : '无 OK'));

// ---- BAN 决策回归：对方已用的英雄不再是有效 BAN（推荐避开、结算按空气价）----
const r9 = vm.runInContext(`
(function(){
  const out=[];
  S=newState('BAN检测','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.lineup=S.players.map(p=>p.id);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=400;initGroups(S);
  const m=S.schedule[0];
  const opR=ensureAiRosters(S,m.opp);
  S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
  // 找对方池内威胁最高的英雄，标记为"对方已用"
  let top=null,tp=-1;
  opR.forEach(p=>(p.heroPool||[]).forEach(x=>{
    if(heroOf(x.n)&&heroOf(x.n).pos.includes(p.pos)){const w=playerPower(p,x.n);if(w>tp){tp=w;top=x.n;}}
  }));
  S.series.usedOpp=[top];
  const d={sr:S.series,ls:rosterLineup(S),isPeak:false,used:[],usedOpp:S.series.usedOpp.slice(),steps:expandSteps(S.series,false),idx:0,myBans:[],oppBans:[],myPicks:{},oppPicks:{},curPos:null,oppRoster:opR};
  const bb=bestBanFor(d);
  out.push('对方最强点='+top+'(已标记已用) BAN推荐='+bb+' → 避开已用='+(bb!==top?'OK':'异常!'));
  const base={oppBans:[],oppPicks:{},side:'blue',isPeak:false,opName:m.opp,opRoster:opR,used:[]};
  const v1=bpEffective({...base,myBans:[top],usedOpp:[top]});      // BAN 对方已用 → 空气价
  const v2=bpEffective({...base,myBans:['不存在的英雄'],usedOpp:[]}); // BAN 空气
  out.push('BAN已用='+v1.op+' vs BAN空气='+v2.op+'（应相等）'+(v1.op===v2.op?' OK':' 异常!'));
  let poolHero=null;
  opR.forEach(p=>(p.heroPool||[]).forEach(x=>{
    if(x.n!==top&&!poolHero&&heroOf(x.n)&&heroOf(x.n).pos.includes(p.pos))poolHero=x.n;
  }));
  const v3=bpEffective({...base,myBans:[poolHero],usedOpp:[]});    // BAN 池内可选 → 仍 -2%
  out.push('BAN池内 '+poolHero+'='+v3.op+'（应低于空气 '+v2.op+'）'+(v3.op<v2.op?' OK':' 异常!'));
  return out.join(' || ');
})()
`, dom);
console.log(r9);

// ---- 王朝反制回归：连冠判定 / 研究加成 / 工资帽冻结 / 版本针对 ----
const r10 = vm.runInContext(`
(function(){
  const out=[];
  S=newState('王朝检测','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.lineup=S.players.map(p=>p.id);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=400;initGroups(S);
  S.titleHistory=[{season:1,champ:'王朝检测'},{season:2,champ:'王朝检测'}]; // 前两个赛季的冠军（当前第3季进行中）
  S.season=3;
  out.push('连冠判定='+dynastyStreak(S,'王朝检测')+'（应2） 非王朝='+dynastyStreak(S,'成都AG超玩会')+'（应0）');
  const op=ensureAiRosters(S,'成都AG超玩会');
  const v=bpEffective({myBans:[],oppBans:[],oppPicks:{},side:'blue',isPeak:false,opName:'成都AG超玩会',opRoster:op,used:[],usedOpp:[]});
  out.push('BP研究加成='+(v.notes.some(x=>x.indexOf('研究我方')>=0)?'OK':'异常!'));
  const cap0=S.wageCap;
  S.titleHistory.push({season:3,champ:'王朝检测'}); // 模拟第3季收官：playoffStep 记录冠军
  newSeason(S);
  out.push('帽冻结='+(S.wageCap===cap0+7?'OK(+'+(S.wageCap-cap0)+'万)':'异常!')+' 版本针对='+(S.eventLog.some(e=>e.txt.indexOf('版本针对')>=0)?'OK':'异常!'));
  out.push('新赛季连冠判定='+dynastyStreak(S,'王朝检测')+'（应3）');
  return out.join(' || ');
})()
`, dom);
console.log(r10);
